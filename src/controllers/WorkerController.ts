import express from 'express';
import { WorkerJobService } from '../services/marketplace/WorkerJobService';
import { JobService } from '../services/marketplace/JobService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';
import { JOB_STATUS, USER_ROLE } from '../constants/statuses';
import { JobProposal } from '../models/JobProposal';

export class WorkerController {
    constructor(
        private workerJobService: WorkerJobService,
        private jobService: JobService,
        private escrowService: EscrowService,
        private reviewService: ReviewService
    ) {}

    async subscribe(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_type_id } = req.body;
            const subscription = await this.workerJobService.subscribeToJobType(req.user.id, job_type_id);
            return res.json({ subscription, msg: 'Successfully subscribed to job type notifications' });
        } catch (error) {
            return next(error);
        }
    }

    async unsubscribe(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_type_id } = req.body;
            const success = await this.workerJobService.unsubscribeFromJobType(req.user.id, job_type_id);
            if (!success) return res.status(404).json({ msg: 'Subscription not found' });
            return res.json({ success: true, msg: 'Successfully unsubscribed from job type' });
        } catch (error) {
            return next(error);
        }
    }

    async getSubscriptions(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const subscriptions = await this.workerJobService.getWorkerSubscriptions(req.user.id);
            return res.json({ subscriptions });
        } catch (error) {
            return next(error);
        }
    }

    async getJobs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobs = await this.workerJobService.getAvailableJobsForWorker(req.user.id);
            return res.json({ jobs });
        } catch (error) {
            return next(error);
        }
    }

    async acceptJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_request_id, proposed_amount } = req.body;

            // Upsert: update amount if a proposal already exists for this worker+job_request
            const [proposal] = await JobProposal.upsert({
                jobRequestId: job_request_id,
                workerId: req.user.id,
                proposedAmount: proposed_amount,
                status: 'pending',
            }, {
                conflictFields: ['job_request_id', 'worker_id'] as any,
                returning: true,
            });

            return res.json({
                proposal: {
                    id: proposal.id,
                    job_request_id: proposal.jobRequestId,
                    worker_id: proposal.workerId,
                    proposed_amount: proposal.proposedAmount,
                    status: proposal.status,
                },
            });
        } catch (error) {
            return next(error);
        }
    }

    async completeJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id } = req.params;

            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, USER_ROLE.WORKER);
            if (!isOwner) return res.status(404).json({ msg: 'Job not found' });

            const result = await this.escrowService.confirmCompletion(job_id, USER_ROLE.WORKER);

            if (result.released) {
                await this.jobService.completeJob(job_id);
                return res.json({
                    success: true,
                    msg: 'Both parties confirmed. Job completed and payment released to your account.',
                    released: true,
                });
            }

            return res.json({
                success: true,
                msg: 'Your confirmation recorded. Waiting for customer to confirm.',
                worker_confirmed: result.workerConfirmed,
                customer_confirmed: result.customerConfirmed,
                released: false,
            });
        } catch (error: any) {
            if (error.message?.includes('Escrow not found') || error.message?.includes('payment must be confirmed')) {
                return res.status(400).json({ msg: error.message });
            }
            return next(error);
        }
    }

    async getMyJobs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobs = await this.jobService.getJobsByWorker(req.user.id);
            return res.json({ jobs });
        } catch (error) {
            return next(error);
        }
    }

    async rateCustomer(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id, rating, comment } = req.body;

            const job = await this.jobService.getJobById(job_id);
            if (!job || job.workerId !== req.user.id || job.status !== JOB_STATUS.COMPLETED) {
                return res.status(404).json({ msg: 'Job not found or not completed' });
            }

            const hasReviewed = await this.reviewService.hasReviewed(job_id, req.user.id);
            if (hasReviewed) {
                return res.status(400).json({ msg: 'You have already reviewed this customer' });
            }

            const review = await this.reviewService.createReview({
                jobId: job_id,
                reviewerId: req.user.id,
                revieweeId: job.customerId,
                rating,
                comment,
            });

            return res.json({ review, msg: 'Customer rated successfully' });
        } catch (error) {
            return next(error);
        }
    }

    async streamJobs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to job stream' })}\n\n`);

            const jobs = await this.workerJobService.getAvailableJobsForWorker(req.user.id);
            res.write(`data: ${JSON.stringify({ type: 'jobs', data: jobs })}\n\n`);

            const intervalId = setInterval(async () => {
                try {
                    const updatedJobs = await this.workerJobService.getAvailableJobsForWorker(req.user.id);
                    res.write(`data: ${JSON.stringify({ type: 'jobs', data: updatedJobs })}\n\n`);
                } catch (err) {
                    console.error('Error fetching jobs in SSE:', err);
                }
            }, 10000);

            req.on('close', () => {
                clearInterval(intervalId);
                res.end();
            });
        } catch (error) {
            return next(error);
        }
    }
}
