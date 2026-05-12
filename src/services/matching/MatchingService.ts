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
     * Main matching function: Rank workers for a job
     */
    async rankWorkersForJob(
        job: JobRequest,
        workers: WorkerProfile[],
        useAI: boolean = true
    ): Promise<MatchResult[]> {
        const results: MatchResult[] = [];

        for (const worker of workers) {
            // Calculate traditional score
            const traditional = this.traditionalScorer.calculate(worker, job);
            
            // Get AI semantic score (if enabled)
            let aiScore = traditional.score;
            let explanation = 'Match based on skills, location, and reputation';
            
            if (useAI) {
                const aiResult = await this.aiScorer.calculate(worker, job, traditional.score);
                aiScore = aiResult.score;
                explanation = aiResult.explanation;
            }

            // Combine scores (70% traditional, 30% AI)
            const finalScore = (traditional.score * 0.7) + (aiScore * 0.3);

            results.push({
                worker_id: worker.user_id,
                worker_name: worker.display_name,
                match_score: Math.round(finalScore * 10) / 10,
                explanation,
                score_breakdown: {
                    ...traditional.breakdown,
                    ai_semantic: aiScore
                }
            });
        }

        // Sort by match score (highest first)
        return results.sort((a, b) => b.match_score - a.match_score);
    }

    /**
     * Quick match: Get top N workers for a job
     */
    async getTopMatches(
        job: JobRequest,
        workers: WorkerProfile[],
        limit: number = 5
    ): Promise<MatchResult[]> {
        const ranked = await this.rankWorkersForJob(job, workers, true);
        return ranked.slice(0, limit);
    }
}

export default new MatchingService();
