import express from 'express';
import { WorkerService, WorkerFeedFilters } from '../services/marketplace/WorkerService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { JobService } from '../services/marketplace/JobService';
import { PaymentService } from '../services/marketplace/PaymentService';
import { ReviewService } from '../services/marketplace/ReviewService';
import MatchingService from '../services/matching/MatchingService';

export class CustomerController {
    constructor(
        private workerService: WorkerService,
        private jobRequestService: JobRequestService,
        private jobService: JobService,
        private paymentService: PaymentService,
        private reviewService: ReviewService,
        private matchingService: typeof MatchingService
    ) {}

    async getFeed(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const filters: WorkerFeedFilters = {
                location: req.query.location as string,
                jobTypeId: req.query.job_type_id as string,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
            };

            let workers = await this.workerService.getWorkerFeed(filters);

            // If job_type_id provided, use AI matching
            if (filters.jobTypeId && workers.length > 0) {
                // Convert workers to the format expected by MatchingService
                const jobRequest = {
                    job_type_id: filters.jobTypeId,
                    location: filters.location || '',
                    skills_required: [],
                };

                const workerProfiles = workers.map(w => ({
                    user_id: w.id,
                    display_name: w.display_name,
                    skills: w.skills || [],
                    location: w.location || '',
                    reputation_score: w.credit_score || 0,
                    completion_rate: w.completion_rate || 0,
                    average_rating: w.average_rating || 0,
                }));

                const ranked = await this.matchingService.rankWorkersForJob(
                    jobRequest as any,
                    workerProfiles as any,
                    true
                );

                // Merge ranking with full worker data
                const rankedWorkers = ranked.map(r => {
                    const worker = workers.find(w => w.id === r.worker_id);
                    return {
                        ...worker,
                        match_score: r.match_score,
                        match_explanation: r.explanation,
                    };
                });

                return res.json({ workers: rankedWorkers });
            }

            return res.json({ workers });
        } catch (error) {
            return next(error);
        }
    }

    async requestJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobRequest = await this.jobRequestService.createJobRequest({
                customerId: req.user.id,
                jobTypeId: req.body.job_type_id,
                title: req.body.title,
                description: req.body.description,
                location: req.body.location,
                budget: req.body.budget,
            });

            return res.json({ job_request: jobRequest });
        } catch (error) {
            return next(error);
        }
    }

    async hire(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_request_id, worker_id, amount } = req.body;

            // Verify job request ownership
            const isOwner = await this.jobRequestService.verifyJobRequestOwnership(
                job_request_id,
                req.user.id
            );

            if (!isOwner) {
                return res.status(404).json({ msg: 'Job request not found or already assigned' });
            }

            const job = await this.jobService.createJob({
                jobRequestId: job_request_id,
                workerId: worker_id,
                customerId: req.user.id,
                amount,
            });

            return res.json({ job });
        } catch (error) {
            return next(error);
        }
    }

    async logPayment(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id, squad_transaction_id, amount, status } = req.body;

            // Verify job ownership
            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, 'customer');

            if (!isOwner) {
                return res.status(404).json({ msg: 'Job not found' });
            }

            const paymentLog = await this.paymentService.logPayment({
                jobId: job_id,
                squadTransactionId: squad_transaction_id,
                amount,
                status,
            });

            return res.json({ payment_log: paymentLog });
        } catch (error) {
            return next(error);
        }
    }

    async completeJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id } = req.params;

            // Verify job ownership
            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, 'customer');

            if (!isOwner) {
                return res.status(404).json({ msg: 'Job not found' });
            }

            await this.jobService.completeJob(job_id);

            return res.json({ success: true, msg: 'Job marked as completed' });
        } catch (error) {
            return next(error);
        }
    }

    async rateWorker(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id, rating, comment } = req.body;

            // Get job details
            const job = await this.jobService.getJobById(job_id);

            if (!job || job.customerId !== req.user.id || job.status !== 'completed') {
                return res.status(404).json({ msg: 'Job not found or not completed' });
            }

            // Check if already reviewed
            const hasReviewed = await this.reviewService.hasReviewed(job_id, req.user.id);
            if (hasReviewed) {
                return res.status(400).json({ msg: 'You have already reviewed this job' });
            }

            const review = await this.reviewService.createReview({
                jobId: job_id,
                reviewerId: req.user.id,
                revieweeId: job.workerId,
                rating,
                comment,
            });

            return res.json({ review, msg: 'Rating submitted successfully' });
        } catch (error) {
            return next(error);
        }
    }

    async getMyJobRequests(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobRequests = await this.jobRequestService.getJobRequestsByCustomer(req.user.id);
            return res.json({ job_requests: jobRequests });
        } catch (error) {
            return next(error);
        }
    }

    async getMyJobs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobs = await this.jobService.getJobsByCustomer(req.user.id);
            return res.json({ jobs });
        } catch (error) {
            return next(error);
        }
    }
}
