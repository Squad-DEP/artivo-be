import express from 'express';
import { WorkerJobService } from '../services/marketplace/WorkerJobService';
import { JobService } from '../services/marketplace/JobService';
import { ReviewService } from '../services/marketplace/ReviewService';
import { JOB_STATUS, USER_ROLE } from '../constants/statuses';

export class WorkerController {
    constructor(
        private workerJobService: WorkerJobService,
        private jobService: JobService,
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
            const job = await this.jobService.createJob({
                jobRequestId: job_request_id,
                workerId: req.user.id,
                customerId: '',
                amount: proposed_amount,
            });
            return res.json({ job, msg: 'Job accepted successfully' });
        } catch (error) {
            return next(error);
        }
    }

    async completeJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id } = req.params;

            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, USER_ROLE.WORKER);
            if (!isOwner) return res.status(404).json({ msg: 'Job not found' });

            await this.jobService.updateJobStatus(job_id, JOB_STATUS.IN_PROGRESS);

            return res.json({
                success: true,
                msg: 'Job marked as in progress. Waiting for customer confirmation.',
            });
        } catch (error) {
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
