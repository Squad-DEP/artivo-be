import { ReputationScore } from '../../models/ReputationScore';
import { Review } from '../../models/Review';

export interface WorkerReputationShape {
    trust_score: {
        overall: number;
        components: {
            completion_rate: number;
            response_time: number;
            customer_satisfaction: number;
            verification_level: number;
            tenure_months: number;
        };
        badges: any[];
        last_updated: string;
        trend: string;
        trend_change: number;
    };
    review_summary: {
        total_reviews: number;
        average_rating: number;
        rating_distribution: Record<number, number>;
        recent_reviews: ReviewItem[];
    };
    history: any[];
    insights: any[];
    rank_percentile: number;
}

export interface ReviewItem {
    id: string;
    job_id: string;
    job_title: string;
    reviewer_id: string;
    reviewer_name: string;
    reviewee_id: string;
    rating: number;
    comment: string;
    helpful_count: number;
    created_at: string;
    updated_at: string;
    is_verified: boolean;
}

export interface ReviewSummaryShape {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<number, number>;
    recent_reviews: ReviewItem[];
    page: number;
    per_page: number;
}

export class ReputationService {
    async getReputation(userId: string): Promise<WorkerReputationShape> {
        const [score] = await ReputationScore.findOrCreate({
            where: { userId },
            defaults: {
                userId,
                creditScore: 0,
                completionRate: 0,
                totalJobs: 0,
                averageRating: 0,
            },
        });

        const reviews = await Review.findAll({ where: { revieweeId: userId }, order: [['created_at', 'DESC']] });
        const count = reviews.length;

        const completionRate = Number(score.completionRate);
        const averageRating = Number(score.averageRating);
        const overall = Math.round((completionRate * 0.4) + (averageRating * 20 * 0.4) + 50 * 0.2);

        const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            if (r.rating >= 1 && r.rating <= 5) {
                ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
            }
        });

        return {
            trust_score: {
                overall,
                components: {
                    completion_rate: completionRate,
                    response_time: 60,
                    customer_satisfaction: averageRating * 20,
                    verification_level: 50,
                    tenure_months: 0,
                },
                badges: [],
                last_updated: score.updatedAt.toISOString(),
                trend: 'stable',
                trend_change: 0,
            },
            review_summary: {
                total_reviews: count,
                average_rating: averageRating,
                rating_distribution: ratingDistribution,
                recent_reviews: reviews.slice(0, 5).map(r => ({
                    id: r.id,
                    job_id: r.jobId,
                    job_title: '',
                    reviewer_id: r.reviewerId,
                    reviewer_name: '',
                    reviewee_id: r.revieweeId,
                    rating: r.rating,
                    comment: r.comment || '',
                    helpful_count: 0,
                    created_at: r.createdAt.toISOString(),
                    updated_at: r.createdAt.toISOString(),
                    is_verified: true,
                })),
            },
            history: [],
            insights: [],
            rank_percentile: 50,
        };
    }

    async getReviews(userId: string, page: number): Promise<ReviewSummaryShape> {
        const perPage = 10;
        const offset = (page - 1) * perPage;

        const [score] = await ReputationScore.findOrCreate({
            where: { userId },
            defaults: {
                userId,
                creditScore: 0,
                completionRate: 0,
                totalJobs: 0,
                averageRating: 0,
            },
        });

        const reviews = await Review.findAll({ where: { revieweeId: userId }, order: [['created_at', 'DESC']] });
        const count = reviews.length;
        const averageRating = Number(score.averageRating);

        const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            if (r.rating >= 1 && r.rating <= 5) {
                ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
            }
        });

        const pageReviews = reviews.slice(offset, offset + perPage);

        return {
            total_reviews: count,
            average_rating: averageRating,
            rating_distribution: ratingDistribution,
            recent_reviews: pageReviews.map(r => ({
                id: r.id,
                job_id: r.jobId,
                job_title: '',
                reviewer_id: r.reviewerId,
                reviewer_name: '',
                reviewee_id: r.revieweeId,
                rating: r.rating,
                comment: r.comment || '',
                helpful_count: 0,
                created_at: r.createdAt.toISOString(),
                updated_at: r.createdAt.toISOString(),
                is_verified: true,
            })),
            page,
            per_page: perPage,
        };
    }

    async respondToReview(_reviewId: string, _response: string): Promise<void> {
        // stub
    }
}
