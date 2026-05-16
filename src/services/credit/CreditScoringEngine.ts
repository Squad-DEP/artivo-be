/**
 * Artivo Credit Scoring Engine
 *
 * Produces a 300–850 FICO-style credit score for artisans using
 * platform-native data: job history, earnings, reviews, profile
 * completeness, withdrawal behaviour and platform tenure.
 *
 * Score bands
 *   300–499  Poor      — new / very limited history
 *   500–579  Fair      — some activity, gaps in profile
 *   580–669  Good      — solid completion, decent earnings
 *   670–739  Very Good — strong track record
 *   740–850  Excellent — top performer
 */

import { sequelize } from '../../providers/db';
import { QueryTypes } from 'sequelize';
import { ReputationScore } from '../../models/ReputationScore';

// ─── Component weights (must sum to 100) ────────────────────────────────────

const WEIGHTS = {
    job_performance:       30,
    earnings_history:      20,
    customer_satisfaction: 20,
    profile_trust:         15,
    platform_tenure:       10,
    financial_reliability:  5,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoreComponents {
    job_performance:       number;   // 0–30
    earnings_history:      number;   // 0–20
    customer_satisfaction: number;   // 0–20
    profile_trust:         number;   // 0–15
    platform_tenure:       number;   // 0–10
    financial_reliability: number;   // 0–5
}

export interface CreditScoreResult {
    user_id:    string;
    full_name:  string;
    email:      string;
    score:      number;               // 300–850
    band:       string;
    raw_score:  number;               // 0–100
    components: ScoreComponents;
    component_weights: typeof WEIGHTS;
    trend:       'improving' | 'stable' | 'declining';
    trend_change: number;             // point delta vs previous
    insights:    string[];
    eligible_products: EligibleProduct[];
    financial_summary: FinancialSummary;
    last_calculated: string;
    version: string;                  // engine version for auditability
}

export interface EligibleProduct {
    id:          string;
    name:        string;
    description: string;
    min_score:   number;
    max_amount:  number | null;
}

export interface FinancialSummary {
    total_earnings:          number;
    total_deposited:         number;
    average_monthly_earnings: number;
    total_jobs:              number;
    completed_jobs:          number;
    completion_rate:         number;
    average_rating:          number;
    review_count:            number;
    successful_withdrawals:  number;
    total_withdrawals:       number;
    withdrawal_success_rate: number;
    platform_tenure_days:    number;
}

// ─── Product catalogue ───────────────────────────────────────────────────────

const PRODUCTS: EligibleProduct[] = [
    {
        id: 'artivo_micro_loan',
        name: 'Artivo Micro Loan',
        description: 'Quick access to small working capital up to ₦50,000.',
        min_score: 400,
        max_amount: 50_000,
    },
    {
        id: 'equipment_financing',
        name: 'Equipment Financing',
        description: 'Finance tools and equipment up to ₦200,000 at low rates.',
        min_score: 520,
        max_amount: 200_000,
    },
    {
        id: 'invoice_financing',
        name: 'Invoice Financing',
        description: 'Get paid early on pending jobs — up to 80% upfront.',
        min_score: 570,
        max_amount: null,
    },
    {
        id: 'working_capital',
        name: 'Working Capital Loan',
        description: 'Larger loan up to ₦500,000 to grow your business.',
        min_score: 620,
        max_amount: 500_000,
    },
    {
        id: 'business_expansion',
        name: 'Business Expansion Loan',
        description: 'Up to ₦2,000,000 for scaling operations.',
        min_score: 700,
        max_amount: 2_000_000,
    },
    {
        id: 'premium_partner',
        name: 'Artivo Premium Partner',
        description: 'Full suite of financial products and priority support.',
        min_score: 750,
        max_amount: null,
    },
];

// ─── Engine ──────────────────────────────────────────────────────────────────

export class CreditScoringEngine {

    /**
     * Calculate (and persist) a fresh credit score for the given userId.
     * Falls back to an empty-state score if the user has no activity yet.
     */
    async calculate(userId: string): Promise<CreditScoreResult> {
        const data = await this.fetchRawData(userId);

        const components = this.scoreComponents(data);
        const rawScore   = Object.values(components).reduce((a, b) => a + b, 0);
        const score      = Math.round(300 + (rawScore / 100) * 550);

        // Trend vs previously stored raw score
        const prevRaw    = data.prevCreditScore ?? rawScore;
        const trendDelta = rawScore - prevRaw;
        const trend      = trendDelta > 3 ? 'improving' : trendDelta < -3 ? 'declining' : 'stable';

        // Persist updated raw score so next call can compute trend
        await ReputationScore.upsert({
            userId,
            creditScore:    rawScore,
            completionRate: data.completion_rate,
            totalJobs:      data.total_jobs,
            averageRating:  data.average_rating,
        } as any);

        return {
            user_id:   data.user_id,
            full_name: data.full_name,
            email:     data.email,
            score,
            band:      this.band(score),
            raw_score: Math.round(rawScore * 10) / 10,
            components,
            component_weights: WEIGHTS,
            trend,
            trend_change: Math.round(trendDelta * 5.5), // convert to 850-scale delta
            insights:     this.generateInsights(components, data),
            eligible_products: PRODUCTS.filter(p => score >= p.min_score),
            financial_summary: {
                total_earnings:          data.total_earnings,
                total_deposited:         data.total_deposited,
                average_monthly_earnings: data.avg_monthly_earnings,
                total_jobs:              data.total_jobs,
                completed_jobs:          data.completed_jobs,
                completion_rate:         Math.round(data.completion_rate * 10) / 10,
                average_rating:          Math.round(data.average_rating * 10) / 10,
                review_count:            data.review_count,
                successful_withdrawals:  data.successful_withdrawals,
                total_withdrawals:       data.total_withdrawals,
                withdrawal_success_rate: Math.round(data.withdrawal_success_rate * 10) / 10,
                platform_tenure_days:    data.tenure_days,
            },
            last_calculated: new Date().toISOString(),
            version: '1.0.0',
        };
    }

    // ── Raw data fetch ────────────────────────────────────────────────────────

    private async fetchRawData(userId: string): Promise<RawData> {
        const [row] = await sequelize.query<any>(`
            SELECT
                u.id                              AS user_id,
                u.full_name,
                u.email,
                u.created_at                      AS account_created,

                -- Previous stored score (for trend)
                COALESCE(rs.credit_score, -1)     AS prev_credit_score,

                -- Job stats (all jobs where this user is the worker)
                COUNT(DISTINCT j.id)              AS total_jobs,
                COUNT(DISTINCT j.id) FILTER (WHERE j.status IN ('completed','paid'))
                                                  AS completed_jobs,
                COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'paid')
                                                  AS paid_jobs,
                COALESCE(SUM(j.amount) FILTER (WHERE j.status = 'paid'), 0)
                                                  AS total_earnings_from_jobs,

                -- Financial account
                COALESCE(va.total_deposited, 0)   AS total_deposited,
                COALESCE(va.balance, 0)            AS current_balance,

                -- Withdrawals
                COUNT(DISTINCT wl.id)             AS total_withdrawals,
                COUNT(DISTINCT wl.id) FILTER (WHERE wl.status = 'success')
                                                  AS successful_withdrawals,

                -- Reviews (as reviewee)
                COUNT(DISTINCT rv.id)             AS review_count,
                COALESCE(AVG(rv.rating), 0)       AS average_rating,

                -- Reputation cache
                COALESCE(rs.completion_rate, 0)   AS cached_completion_rate,
                COALESCE(rs.average_rating, 0)    AS cached_avg_rating,

                -- Profile completeness
                CASE WHEN wp.photo_url IS NOT NULL THEN 1 ELSE 0 END
                                                  AS has_photo,
                CASE WHEN wp.bio IS NOT NULL AND LENGTH(wp.bio) > 20 THEN 1 ELSE 0 END
                                                  AS has_bio,
                COALESCE(array_length(wp.skills, 1), 0)
                                                  AS skill_count,
                CASE WHEN wp.hourly_rate IS NOT NULL THEN 1 ELSE 0 END
                                                  AS has_hourly_rate,
                CASE WHEN wp.location IS NOT NULL THEN 1 ELSE 0 END
                                                  AS has_location,

                -- Supporting docs
                (SELECT COUNT(*) FROM worker_education    we  WHERE we.user_id  = u.id) AS edu_count,
                (SELECT COUNT(*) FROM worker_certifications wc WHERE wc.user_id = u.id) AS cert_count,
                (SELECT COUNT(*) FROM worker_portfolio    wp2 WHERE wp2.user_id = u.id) AS portfolio_count,
                (SELECT COUNT(*) FROM documents           d
                 WHERE d.user_id = u.id AND d.upload_status = 'uploaded')               AS doc_count,
                (SELECT COUNT(*) FROM worker_bank_accounts wba WHERE wba.user_id = u.id AND wba.verified = true)
                                                  AS bank_accounts,

                -- Escrow disputes
                COUNT(DISTINCT ee.id) FILTER (WHERE ee.status = 'disputed')
                                                  AS disputed_escrows

            FROM users u
            LEFT JOIN reputation_scores        rs  ON rs.user_id   = u.id
            LEFT JOIN jobs                     j   ON j.worker_id  = u.id
            LEFT JOIN virtual_accounts         va  ON va.user_id   = u.id
            LEFT JOIN withdrawal_logs          wl  ON wl.user_id   = u.id
            LEFT JOIN reviews                  rv  ON rv.reviewee_id = u.id
            LEFT JOIN worker_profiles          wp  ON wp.user_id   = u.id
            LEFT JOIN escrow_entries           ee  ON ee.worker_id = u.id
            WHERE u.id = $1
            GROUP BY u.id, u.full_name, u.email, u.created_at,
                     rs.credit_score, rs.completion_rate, rs.average_rating,
                     wp.photo_url, wp.bio, wp.skills, wp.hourly_rate, wp.location,
                     va.total_deposited, va.balance
        `, { bind: [userId], type: QueryTypes.SELECT });

        if (!row) throw new Error(`User ${userId} not found`);

        const total      = Number(row.total_jobs);
        const completed  = Number(row.completed_jobs);
        const compRate   = total > 0 ? (completed / total) * 100 : 0;

        const totalWithdrawals   = Number(row.total_withdrawals);
        const successWithdrawals = Number(row.successful_withdrawals);
        const wdSuccessRate      = totalWithdrawals > 0
            ? (successWithdrawals / totalWithdrawals) * 100
            : 100; // no withdrawal history = no negative signal

        const totalDeposited   = Number(row.total_deposited);
        const tenureDays       = Math.floor(
            (Date.now() - new Date(row.account_created).getTime()) / 86_400_000
        );
        const tenureMonths     = Math.max(1, Math.floor(tenureDays / 30));
        const avgMonthlyEarns  = totalDeposited / tenureMonths;

        return {
            user_id:   row.user_id,
            full_name: row.full_name,
            email:     row.email,

            prevCreditScore: Number(row.prev_credit_score) < 0 ? null : Number(row.prev_credit_score),

            total_jobs:      total,
            completed_jobs:  completed,
            paid_jobs:       Number(row.paid_jobs),
            completion_rate: compRate,

            total_earnings:   Number(row.total_earnings_from_jobs),
            total_deposited:  totalDeposited,
            current_balance:  Number(row.current_balance),

            total_withdrawals:       totalWithdrawals,
            successful_withdrawals:  successWithdrawals,
            withdrawal_success_rate: wdSuccessRate,

            review_count:   Number(row.review_count),
            average_rating: Number(row.average_rating),

            has_photo:      Number(row.has_photo) === 1,
            has_bio:        Number(row.has_bio)   === 1,
            skill_count:    Number(row.skill_count),
            has_hourly_rate: Number(row.has_hourly_rate) === 1,
            has_location:   Number(row.has_location)    === 1,
            edu_count:      Number(row.edu_count),
            cert_count:     Number(row.cert_count),
            portfolio_count: Number(row.portfolio_count),
            doc_count:      Number(row.doc_count),
            bank_accounts:  Number(row.bank_accounts),
            disputed_escrows: Number(row.disputed_escrows),

            tenure_days:        tenureDays,
            avg_monthly_earnings: avgMonthlyEarns,
        };
    }

    // ── Component scorers ─────────────────────────────────────────────────────

    private scoreComponents(d: RawData): ScoreComponents {
        return {
            job_performance:       this.scoreJobPerformance(d),
            earnings_history:      this.scoreEarnings(d),
            customer_satisfaction: this.scoreCustomerSatisfaction(d),
            profile_trust:         this.scoreProfileTrust(d),
            platform_tenure:       this.scoreTenure(d),
            financial_reliability: this.scoreFinancialReliability(d),
        };
    }

    /** 0–30 pts: completion rate, volume, dispute penalty */
    private scoreJobPerformance(d: RawData): number {
        if (d.total_jobs === 0) return 0;

        // Up to 20 pts from completion rate
        const rateScore = (d.completion_rate / 100) * 20;

        // Up to 10 pts from volume — sqrt scaling so early jobs count more
        const volumeScore = Math.min(10, Math.sqrt(d.completed_jobs) * 2.5);

        // Dispute penalty — each dispute shaves 3 pts
        const penalty = Math.min(15, d.disputed_escrows * 3);

        return Math.max(0, Math.round((rateScore + volumeScore - penalty) * 10) / 10);
    }

    /** 0–20 pts: total earnings deposited into platform (tiered) */
    private scoreEarnings(d: RawData): number {
        // Use total_deposited (virtual account) as the most reliable earnings signal
        const earnings = Math.max(d.total_deposited, d.total_earnings);
        const tiers = [
            { threshold: 2_000_000, pts: 20 },
            { threshold: 1_000_000, pts: 18 },
            { threshold:   500_000, pts: 15 },
            { threshold:   200_000, pts: 12 },
            { threshold:   100_000, pts:  9 },
            { threshold:    50_000, pts:  7 },
            { threshold:    20_000, pts:  5 },
            { threshold:    10_000, pts:  3 },
            { threshold:     5_000, pts:  1 },
        ];
        for (const t of tiers) {
            if (earnings >= t.threshold) return t.pts;
        }
        return 0;
    }

    /** 0–20 pts: average rating + review volume */
    private scoreCustomerSatisfaction(d: RawData): number {
        if (d.review_count === 0) {
            // No reviews = neutral new worker, give small grace score
            return d.total_jobs > 0 ? 5 : 0;
        }
        // Up to 16 pts from average rating (1–5 scale)
        const ratingScore = ((d.average_rating - 1) / 4) * 16;
        // Up to 4 pts from review volume
        const volumeScore = Math.min(4, Math.log2(d.review_count + 1) * 2);
        return Math.max(0, Math.round((ratingScore + volumeScore) * 10) / 10);
    }

    /** 0–15 pts: profile completeness & identity signals */
    private scoreProfileTrust(d: RawData): number {
        let pts = 0;
        if (d.has_photo)              pts += 2;
        if (d.has_bio)                pts += 2;
        if (d.skill_count >= 1)       pts += 1;
        if (d.skill_count >= 3)       pts += 1;
        if (d.has_hourly_rate)        pts += 1;
        if (d.has_location)           pts += 1;
        if (d.bank_accounts > 0)      pts += 3;   // verified bank = strong signal
        if (d.edu_count > 0)          pts += 1;
        if (d.cert_count > 0)         pts += 1;
        if (d.portfolio_count > 0)    pts += 1;
        if (d.doc_count > 0)          pts += 1;
        return Math.min(15, pts);
    }

    /** 0–10 pts: platform tenure, capped at 18 months full score */
    private scoreTenure(d: RawData): number {
        // Full score at 18 months, linear before that
        const monthScore = Math.min(10, (d.tenure_days / 540) * 10);
        return Math.round(monthScore * 10) / 10;
    }

    /** 0–5 pts: withdrawal reliability */
    private scoreFinancialReliability(d: RawData): number {
        const rate = d.withdrawal_success_rate;
        if (d.total_withdrawals === 0) return 3;  // neutral — no history
        if (rate >= 95) return 5;
        if (rate >= 80) return 4;
        if (rate >= 60) return 3;
        if (rate >= 40) return 2;
        return 1;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private band(score: number): string {
        if (score >= 740) return 'Excellent';
        if (score >= 670) return 'Very Good';
        if (score >= 580) return 'Good';
        if (score >= 500) return 'Fair';
        return 'Poor';
    }

    private generateInsights(c: ScoreComponents, d: RawData): string[] {
        const insights: string[] = [];

        if (d.total_jobs === 0) {
            insights.push('Complete your first job to start building your credit history.');
        } else if (d.completed_jobs < 5) {
            insights.push(`You have ${d.completed_jobs} completed job${d.completed_jobs === 1 ? '' : 's'}. Completing more jobs significantly boosts your score.`);
        }

        if (d.completion_rate > 0 && d.completion_rate < 80) {
            insights.push('Your job completion rate is below 80%. Completing accepted jobs consistently is the biggest lever for your score.');
        }

        if (d.review_count === 0 && d.total_jobs > 0) {
            insights.push('You have no reviews yet. Ask satisfied customers to leave a rating — reviews unlock the customer satisfaction score component.');
        } else if (d.average_rating > 0 && d.average_rating < 4) {
            insights.push('Your average rating is below 4.0. Focus on communication and quality to improve customer satisfaction.');
        }

        if (!d.has_photo || !d.has_bio) {
            insights.push('Complete your profile (photo + bio) to gain profile trust points and attract more customers.');
        }

        if (d.bank_accounts === 0) {
            insights.push('Add a verified bank account to unlock the full financial reliability score and enable withdrawals.');
        }

        if (d.cert_count === 0 && d.edu_count === 0) {
            insights.push('Add certifications or education credentials to your profile to increase your trust score.');
        }

        if (d.total_deposited > 0 && c.earnings_history < 10) {
            insights.push('Growing your total earnings on the platform will improve your earnings score. Take on more jobs!');
        }

        if (d.disputed_escrows > 0) {
            insights.push(`You have ${d.disputed_escrows} disputed job${d.disputed_escrows > 1 ? 's' : ''}. Resolving disputes positively improves your score.`);
        }

        if (insights.length === 0) {
            insights.push('Great profile! Keep completing jobs and collecting reviews to push your score higher.');
        }

        return insights;
    }
}

// ─── Internal data shape ─────────────────────────────────────────────────────

interface RawData {
    user_id:   string;
    full_name: string;
    email:     string;

    prevCreditScore: number | null;

    total_jobs:      number;
    completed_jobs:  number;
    paid_jobs:       number;
    completion_rate: number;

    total_earnings:   number;
    total_deposited:  number;
    current_balance:  number;

    total_withdrawals:       number;
    successful_withdrawals:  number;
    withdrawal_success_rate: number;

    review_count:   number;
    average_rating: number;

    has_photo:      boolean;
    has_bio:        boolean;
    skill_count:    number;
    has_hourly_rate: boolean;
    has_location:   boolean;
    edu_count:      number;
    cert_count:     number;
    portfolio_count: number;
    doc_count:      number;
    bank_accounts:  number;
    disputed_escrows: number;

    tenure_days:         number;
    avg_monthly_earnings: number;
}
