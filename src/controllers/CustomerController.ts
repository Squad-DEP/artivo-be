import express from 'express';
import { WorkerService, WorkerFeedFilters } from '../services/marketplace/WorkerService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { JobService } from '../services/marketplace/JobService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';
import { PayoutService } from '../services/marketplace/PayoutService';
import { HireService, HirePaymentMethod } from '../services/marketplace/HireService';
import MatchingService from '../services/matching/MatchingService';
import { JOB_STATUS, USER_ROLE } from '../constants/statuses';

export class CustomerController {
    constructor(
        private workerService: WorkerService,
        private jobRequestService: JobRequestService,
        private jobService: JobService,
        private escrowService: EscrowService,
        private reviewService: ReviewService,
        private matchingService: typeof MatchingService,
        private hireService: HireService,
        private payoutService: PayoutService = new PayoutService()
    ) {}

    async getFeed(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const filters: WorkerFeedFilters = {
                location: req.query.location as string,
                jobTypeId: req.query.job_type_id as string,
                query: req.query.query as string,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
            };

            let workers = await this.workerService.getWorkerFeed(filters);

            if (filters.jobTypeId && workers.length > 0) {
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

                const rankedWorkers = ranked.map(r => {
                    const worker = workers.find(w => w.id === r.worker_id);
                    return { ...worker, match_score: r.match_score, match_explanation: r.explanation };
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
            let { job_request_id, worker_id, amount, proposal_id, payment_method } = req.body;
            const paymentMethod: HirePaymentMethod = payment_method === 'offline' ? 'offline' : 'online';

            // Resolve proposal → concrete fields
            if (proposal_id) {
                const resolved = await this.hireService.resolveProposal(proposal_id);
                if (!resolved) return res.status(404).json({ msg: 'Proposal not found' });
                job_request_id = resolved.jobRequestId;
                worker_id = resolved.workerId;
                amount = resolved.amount;
            }

            // Idempotency: return existing pending job if payment was cancelled mid-flow
            const existing = await this.hireService.findExistingPendingJob(job_request_id, req.user.id);
            if (existing) {
                return res.json({
                    job: existing.job,
                    escrow: existing.escrow,
                    requires_payment: true,
                });
            }

            const isOwner = await this.jobRequestService.verifyJobRequestOwnership(job_request_id, req.user.id);
            if (!isOwner) return res.status(404).json({ msg: 'Job request not found or already assigned' });

            const result = await this.hireService.executeHire({
                jobRequestId: job_request_id,
                workerId: worker_id,
                customerId: req.user.id,
                amount,
                paymentMethod,
            });

            return res.json({
                job: result.job,
                escrow: result.escrow,
                requires_payment: result.requiresPayment,
            });
        } catch (error: any) {
            return next(error);
        }
    }

    async getJobRequestProposals(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id: jobRequestId } = req.params;
            const proposals = await this.jobRequestService.getProposalsForJobRequest(jobRequestId, req.user.id);
            if (proposals === null) return res.status(404).json({ msg: 'Job request not found' });
            return res.json({ proposals });
        } catch (error) {
            return next(error);
        }
    }


    async completeJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id } = req.params;

            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, USER_ROLE.CUSTOMER);
            if (!isOwner) return res.status(404).json({ msg: 'Job not found' });

            const result = await this.escrowService.confirmCompletion(job_id, USER_ROLE.CUSTOMER);

            if (result.released) {
                await this.jobService.completeJob(job_id);
                try {
                    const payout = await this.payoutService.initiateJobPayout(job_id);
                    return res.json({
                        success: true,
                        msg: payout.skipped
                            ? 'Job completed. This was an offline job — no transfer needed.'
                            : 'Both parties confirmed. Payment is being sent to the worker.',
                        released: true,
                        payout_reference: payout.reference,
                    });
                } catch (payoutErr: any) {
                    return res.json({
                        success: true,
                        msg: 'Job completed! The worker will need to add their bank account to receive payment.',
                        released: true,
                    });
                }
            }

            return res.json({
                success: true,
                msg: 'Your confirmation recorded. Waiting for worker to confirm.',
                worker_confirmed: result.workerConfirmed,
                customer_confirmed: result.customerConfirmed,
                released: false,
            });
        } catch (error: any) {
            if (error.message?.includes('Escrow not found') || error.message?.includes('payment must be confirmed')) {
                return res.status(400).json({ msg: error.message });
            }
            if (error.message?.includes('bank account')) {
                return res.status(400).json({ msg: error.message });
            }
            return next(error);
        }
    }

    async uncompleteJob(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id } = req.params;
            const isOwner = await this.jobService.verifyJobOwnership(job_id, req.user.id, USER_ROLE.CUSTOMER);
            if (!isOwner) return res.status(404).json({ msg: 'Job not found' });

            const result = await this.escrowService.revokeConfirmation(job_id, USER_ROLE.CUSTOMER);
            return res.json({
                success: true,
                msg: 'Your completion mark has been removed.',
                worker_confirmed: result.workerConfirmed,
                customer_confirmed: result.customerConfirmed,
            });
        } catch (error: any) {
            if (error.message?.includes('Payout already initiated') || error.message?.includes('not marked') || error.message?.includes('not confirmed')) {
                return res.status(400).json({ msg: error.message });
            }
            return next(error);
        }
    }

    async rateWorker(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id, rating, comment } = req.body;

            const job = await this.jobService.getJobById(job_id);
            if (!job || job.customerId !== req.user.id || job.status !== JOB_STATUS.COMPLETED) {
                return res.status(404).json({ msg: 'Job not found or not completed' });
            }

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
            const jobRequests = await this.jobRequestService.getJobRequestsWithProposalCount(req.user.id);
            return res.json({ job_requests: jobRequests });
        } catch (error) {
            return next(error);
        }
    }

    async getMyJobs(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const jobs = await this.jobService.getEnrichedJobsByCustomer(req.user.id);
            return res.json({ jobs });
        } catch (error) {
            return next(error);
        }
    }
}
