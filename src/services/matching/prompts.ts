import { WorkerProfile, JobRequest } from './types';

export const buildMatchingPrompt = (
    worker: WorkerProfile,
    job: JobRequest,
    traditionalScore: number,
): string => {
    return `You are a job matching AI. Rate how well this worker matches this job on a scale of 0-100.

Job:
- Title: ${job.title}
- Description: ${job.description}
- Location: ${job.location}
- Budget: $${job.budget}

Worker:
- Name: ${worker.display_name}
- Skills: ${worker.skills.join(', ')}
- Bio: ${worker.bio}
- Location: ${worker.location}
- Reputation: ${worker.reputation_score?.average_rating || 0}/5 stars, ${worker.reputation_score?.completion_rate || 0}% completion rate

Traditional algorithm score: ${traditionalScore.toFixed(1)}/100

Provide:
1. A match score (0-100)
2. A brief explanation (2-3 sentences) of why this worker is a good/bad match

Format your response as JSON:
{
  "score": <number>,
  "explanation": "<string>"
}`;
};
