import { Review, ReviewModel } from '../../models/Review';
import { ReputationScore } from '../../models/ReputationScore';
import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';

export interface CreateReviewDTO {
    jobId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment?: string;
}

export class ReviewService {
    async createReview(data: CreateReviewDTO): Promise<ReviewModel> {
        const transaction = await sequelize.transaction();

        try {
            // Create review
            const review = await Review.create({
                jobId: data.jobId,
                reviewerId: data.reviewerId,
                revieweeId: data.revieweeId,
                rating: data.rating,
                comment: data.comment || null,
            }, { transaction });

            // Update reputation score
            await this.updateReputationScore(data.revieweeId, transaction);

            await transaction.commit();
            return review;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    private async updateReputationScore(userId: string, transaction?: any): Promise<void> {
        // Calculate new reputation metrics
        const query = `
            INSERT INTO reputation_scores (user_id, credit_score, completion_rate, total_jobs, average_rating, updated_at)
            VALUES (
                $1,
                (SELECT COALESCE(AVG(rating) * 20, 0) FROM reviews WHERE reviewee_id = $1),
                (SELECT COALESCE((COUNT(*) FILTER (WHERE status = 'completed')::FLOAT / NULLIF(COUNT(*), 0)) * 100, 0) FROM jobs WHERE worker_id = $1),
                (SELECT COUNT(*) FROM jobs WHERE worker_id = $1 AND status = 'completed'),
                (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviewee_id = $1),
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                credit_score = (SELECT COALESCE(AVG(rating) * 20, 0) FROM reviews WHERE reviewee_id = $1),
                completion_rate = (SELECT COALESCE((COUNT(*) FILTER (WHERE status = 'completed')::FLOAT / NULLIF(COUNT(*), 0)) * 100, 0) FROM jobs WHERE worker_id = $1),
                total_jobs = (SELECT COUNT(*) FROM jobs WHERE worker_id = $1 AND status = 'completed'),
                average_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviewee_id = $1),
                updated_at = NOW()
        `;

        await sequelize.query(query, {
            bind: [userId],
            type: QueryTypes.UPDATE,
            transaction,
        });
    }

    async getReviewsByReviewee(revieweeId: string): Promise<ReviewModel[]> {
        return await Review.findAll({
            where: { revieweeId },
            order: [['createdAt', 'DESC']],
        });
    }

    async getReviewByJob(jobId: string): Promise<ReviewModel | null> {
        return await Review.findOne({
            where: { jobId },
        });
    }

    async hasReviewed(jobId: string, reviewerId: string): Promise<boolean> {
        const review = await Review.findOne({
            where: { jobId, reviewerId },
        });
        return review !== null;
    }
}
