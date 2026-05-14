import AIService from '../../ai/AIService';
import { WorkerProfile, JobRequest } from '../types';
import { buildMatchingPrompt } from '../prompts';

export class AIScorer {
    /**
     * Use AI for semantic matching and ranking
     */
    async calculate(
        worker: WorkerProfile,
        job: JobRequest,
        traditionalScore: number,
    ): Promise<{ score: number; explanation: string }> {
        const prompt = buildMatchingPrompt(worker, job, traditionalScore);

        try {
            const result = await AIService.chat(prompt);
            
            if (result.success && result.response) {
                // Try to parse JSON from response
                const jsonMatch = result.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        score: Math.min(Math.max(parsed.score || 0, 0), 100),
                        explanation: parsed.explanation || 'AI analysis completed',
                    };
                }
            }
            
            // Fallback: use traditional score
            return {
                score: traditionalScore,
                explanation: 'Match based on skills, location, and reputation',
            };
        } catch (error) {
            console.error('AI matching error:', error);
            return {
                score: traditionalScore,
                explanation: 'Match based on traditional algorithm',
            };
        }
    }
}
