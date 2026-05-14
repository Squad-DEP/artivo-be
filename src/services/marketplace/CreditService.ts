import { ReputationScore } from '../../models/ReputationScore';

export interface WorkerCreditProfileShape {
    credit_score: {
        score: number;
        components: {
            job_completion: number;
            earnings_consistency: number;
            tenure: number;
            verification_level: number;
            payment_history: number;
        };
        last_updated: string;
        trend: string;
        trend_change: number;
        eligible_products: any[];
    };
    history: any[];
    insights: any[];
    financial_summary: {
        total_earnings: number;
        average_monthly_earnings: number;
        earnings_trend: string;
        on_time_payment_rate: number;
    };
}

export class CreditService {
    async getCreditProfile(userId: string): Promise<WorkerCreditProfileShape> {
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

        const creditScore = Number(score.creditScore);
        const completionRate = Number(score.completionRate);

        return {
            credit_score: {
                score: Math.round(300 + (creditScore * 5.5)),
                components: {
                    job_completion: completionRate,
                    earnings_consistency: 50,
                    tenure: 30,
                    verification_level: 50,
                    payment_history: 70,
                },
                last_updated: score.updatedAt.toISOString(),
                trend: 'stable',
                trend_change: 0,
                eligible_products: [],
            },
            history: [],
            insights: [],
            financial_summary: {
                total_earnings: 0,
                average_monthly_earnings: 0,
                earnings_trend: 'stable',
                on_time_payment_rate: completionRate / 100,
            },
        };
    }

    async updateConsent(_userId: string, _enabled: boolean): Promise<void> {
        // stub
    }
}
