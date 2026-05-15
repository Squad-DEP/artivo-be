import { WorkerProfile, JobRequest } from './types';

export const buildMatchingPrompt = (
  worker: WorkerProfile,
  job: JobRequest,
  traditionalScore: number,
): string => {
  return `You are a professional recruitment AI for Artivo, specializing in the Nigerian labor market. 
Your task is to provide a "Semantic Match Score" that looks beyond keywords to find the best artisan for a client.

JOB CONTEXT:
- Title: ${job.title}
- Description: ${job.description}
- Location: ${job.location}
- Budget: ${job.budget}

WORKER CONTEXT:
- Name: ${worker.display_name}
- Bio: ${worker.bio}
- Skills: ${worker.skills.join(', ')}
- Location: ${worker.location}
- Stats: ${worker.reputation_score?.average_rating || 0}/5 stars, ${worker.reputation_score?.completion_rate || 0}% completion.

The traditional keyword match score is ${traditionalScore.toFixed(1)}/100.

CRITICAL INSTRUCTIONS:
1. SEMANTIC ANALYSIS: If the job is "leaking tap" and the worker's bio mentions "industrial pipe maintenance," recognize the semantic overlap even if the word "tap" isn't in their skills.
2. LOCAL CONTEXT: Value proximity and specific Nigerian trade expertise mentioned in the bio.
3. ADAPTIVE SCORING: Use the traditional score as a baseline, but adjust it up or down based on the bio's quality and specific relevance to the description.

Return ONLY a JSON object:
{
"score": <number 0-100>,
"explanation": "<string, max 2 sentences, explain the specific fit or gap>"
}`;
};

