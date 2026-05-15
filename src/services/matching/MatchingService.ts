/**
 * AI-Powered Matching Service
 * Combines traditional scoring with LLM semantic matching
 */

import { TraditionalScorer } from './scorers/TraditionalScorer';
import { AIScorer } from './scorers/AIScorer';
import { WorkerProfile, JobRequest, MatchResult } from './types';

class MatchingService {
    private traditionalScorer: TraditionalScorer;

    private aiScorer: AIScorer;

    constructor() {
        this.traditionalScorer = new TraditionalScorer();
        this.aiScorer = new AIScorer();
    }

    /**
     * Main matching function: Rank workers for a job.
     * Traditional-scores all workers first, then AI-scores only the top candidates
     * to avoid N AI calls per request.
     */
    async rankWorkersForJob(
        job: JobRequest,
        workers: WorkerProfile[],
        useAI: boolean = true,
        limit: number = 5,
    ): Promise<MatchResult[]> {
        // Step 1: traditional score every worker — O(N), no API calls
        const traditionally = workers.map(worker => ({
            worker,
            traditional: this.traditionalScorer.calculate(worker, job),
        }));

        // Step 2: keep only the top candidates for AI scoring (2× limit, min 10)
        const aiCandidateCount = Math.max(limit * 2, 10);
        const sorted = traditionally.sort((a, b) => b.traditional.score - a.traditional.score);
        const candidates = sorted.slice(0, aiCandidateCount);
        const rest = sorted.slice(aiCandidateCount);

        // Step 3: AI-score only the shortlist
        const results: MatchResult[] = [];

        for (const { worker, traditional } of candidates) {
            let aiScore = traditional.score;
            let explanation = 'Match based on skills, location, and reputation';

            if (useAI) {
                const aiResult = await this.aiScorer.calculate(worker, job, traditional.score);
                aiScore = aiResult.score;
                explanation = aiResult.explanation;
            }

            const finalScore = (traditional.score * 0.7) + (aiScore * 0.3);
            results.push({
                worker_id: worker.user_id,
                worker_name: worker.display_name,
                match_score: Math.round(finalScore * 10) / 10,
                explanation,
                score_breakdown: { ...traditional.breakdown, ai_semantic: aiScore },
            });
        }

        // Step 4: append the non-AI-scored tail (traditional score only, won't be returned normally)
        for (const { worker, traditional } of rest) {
            results.push({
                worker_id: worker.user_id,
                worker_name: worker.display_name,
                match_score: Math.round(traditional.score * 10) / 10,
                explanation: 'Match based on skills, location, and reputation',
                score_breakdown: { ...traditional.breakdown, ai_semantic: traditional.score },
            });
        }

        return results.sort((a, b) => b.match_score - a.match_score);
    }

    /**
     * Quick match: Get top N workers for a job
     */
    async getTopMatches(
        job: JobRequest,
        workers: WorkerProfile[],
        limit: number = 5,
    ): Promise<MatchResult[]> {
        const ranked = await this.rankWorkersForJob(job, workers, true, limit);
        return ranked.slice(0, limit);
    }
}

export default new MatchingService();
