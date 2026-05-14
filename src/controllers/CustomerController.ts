import express from 'express';
import { WorkerService, WorkerFeedFilters } from '../services/marketplace/WorkerService';
import { JobRequestService } from '../services/marketplace/JobRequestService';
import { JobService } from '../services/marketplace/JobService';
import { PaymentService } from '../services/marketplace/PaymentService';
import { EscrowService } from '../services/marketplace/EscrowService';
import { ReviewService } from '../services/marketplace/ReviewService';
import { PayoutService } from '../services/marketplace/PayoutService';
import MatchingService from '../services/matching/MatchingService';
import { JOB_STATUS, USER_ROLE } from '../constants/statuses';
import { JobProposal } from '../models/JobProposal';
import { JobRequest } from '../models/JobRequest';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../providers/db';

export class CustomerController {
    constructor(
        private workerService: WorkerService,
        private jobRequestService: JobRequestService,
        private jobService: JobService,
        private paymentService: PaymentService,
        private escrowService: EscrowService,
        private reviewService: ReviewService,
        private matchingService: typeof MatchingService,
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
            const paymentMethod: 'online' | 'offline' = payment_method === 'offline' ? 'offline' : 'online';

            if (proposal_id) {
                const proposal = await JobProposal.findByPk(proposal_id);
                if (!proposal) return res.status(404).json({ msg: 'Proposal not found' });
                job_request_id = proposal.jobRequestId;
                worker_id = proposal.workerId;
                amount = Number(proposal.proposedAmount);
            }

            const isOwner = await this.jobRequestService.verifyJobRequestOwnership(job_request_id, req.user.id);
            if (!isOwner) return res.status(404).json({ msg: 'Job request not found or already assigned' });

            const { job, escrow } = await sequelize.transaction(async (t) => {
                // Online: job starts in pending_payment — escrow pending until Squad confirms
                // Offline: job starts in_progress immediately — no Squad payment
                const initialStatus = paymentMethod === 'offline' ? JOB_STATUS.IN_PROGRESS : JOB_STATUS.PENDING_PAYMENT;

                const job = await this.jobService.createJob(
                    { jobRequestId: job_request_id, workerId: worker_id, customerId: req.user.id, amount, paymentMethod },
                    t
                );

                await this.jobService.updateJobStatus(job.id, initialStatus, t);

                // Create escrow entry — funded immediately for offline, pending for online
                const escrow = paymentMethod === 'offline'
                    ? await this.escrowService.createEscrowFunded(
                        { jobId: job.id, customerId: req.user.id, workerId: worker_id, amount }, t
                      )
                    : await this.escrowService.createEscrow(
                        { jobId: job.id, customerId: req.user.id, workerId: worker_id, amount }, t
                      );

                if (proposal_id) {
                    await JobProposal.update({ status: 'accepted' }, { where: { id: proposal_id }, transaction: t });
                    await JobProposal.update(
                        { status: 'rejected' },
                        { where: { jobRequestId: job_request_id, status: 'pending' }, transaction: t }
                    );
                }

                return { job, escrow };
            });

            return res.json({
                job,
                escrow,
                // Tell the frontend whether to open Squad checkout
                requires_payment: paymentMethod === 'online',
            });
        } catch (error: any) {
            return next(error);
        }
    }

    async getJobRequestProposals(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id: jobRequestId } = req.params;

            // Verify the job request belongs to this customer
            const jobRequest = await JobRequest.findOne({
                where: { id: jobRequestId, customerId: req.user.id },
            });
            if (!jobRequest) {
                return res.status(404).json({ msg: 'Job request not found' });
            }

            const proposals = await sequelize.query<{
                id: string;
                worker_id: string;
                worker_name: string;
                photo_url: string | null;
                proposed_amount: number;
                status: string;
                created_at: Date;
            }>(
                `SELECT
                    jp.id,
                    jp.worker_id,
                    u.full_name AS worker_name,
                    wp.photo_url,
                    jp.proposed_amount,
                    jp.status,
                    jp.created_at
                FROM job_proposals jp
                JOIN users u ON u.id = jp.worker_id
                LEFT JOIN worker_profiles wp ON wp.user_id = jp.worker_id
                WHERE jp.job_request_id = $1
                ORDER BY jp.created_at ASC`,
                {
                    bind: [jobRequestId],
                    type: QueryTypes.SELECT,
                }
            );

            return res.json({ proposals });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Verify a Squad payment server-side before logging it.
     * The frontend calls this after onSuccess fires from the Squad JS SDK.
     */
    async verifyPayment(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { job_id, transaction_reference } = req.body;

            const job = await this.jobService.getJobById(job_id);
            if (!job || job.customerId !== req.user.id) {
                return res.status(404).json({ msg: 'Job not found' });
            }

            const paymentLog = await this.paymentService.verifyAndLogPayment({
                jobId: job_id,
                squadTransactionReference: transaction_reference,
                expectedAmountNgn: Number(job.amount),
            });

            return res.json({ payment_log: paymentLog, msg: 'Payment verified and logged successfully' });
        } catch (error: any) {
            if (
                error.message?.includes('not found') ||
                error.message?.includes('mismatch') ||
                error.message?.includes('Verification failed') ||
                error.message?.includes('not a credit')
            ) {
                return res.status(400).json({ msg: error.message });
            }
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
                const payout = await this.payoutService.initiateJobPayout(job_id);
                return res.json({
                    success: true,
                    msg: payout.skipped
                        ? 'Job completed. This was an offline job — no transfer needed.'
                        : 'Both parties confirmed. Payment is being transferred to the worker.',
                    released: true,
                    payout_reference: payout.reference,
                });
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
            const jobRequests = await sequelize.query<{
                id: string; title: string; description: string; location: string | null;
                budget: number | null; status: string; job_type_name: string;
                proposal_count: number; created_at: Date;
            }>(
                `SELECT jr.id, jr.title, jr.description, jr.location, jr.budget, jr.status,
                        jt.name AS job_type_name,
                        COALESCE(COUNT(jp.id), 0)::int AS proposal_count,
                        jr.created_at
                 FROM job_requests jr
                 JOIN job_types jt ON jr.job_type_id = jt.id
                 LEFT JOIN job_proposals jp ON jp.job_request_id = jr.id
                 WHERE jr.customer_id = $1
                 GROUP BY jr.id, jt.name
                 ORDER BY jr.created_at DESC`,
                { bind: [req.user.id], type: QueryTypes.SELECT }
            );
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
