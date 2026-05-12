export interface WorkerProfile {
    user_id: string;
    display_name: string;
    bio: string;
    skills: string[];
    location: string;
    reputation_score?: {
        credit_score: number;
        completion_rate: number;
        average_rating: number;
        total_jobs: number;
    };
}

export interface JobRequest {
    id: string;
    title: string;
    description: string;
    location: string;
    budget: number;
    job_type: string;
}

export interface MatchResult {
    worker_id: string;
    worker_name: string;
    match_score: number;
    explanation: string;
    score_breakdown: {
        skills_match: number;
        location_match: number;
        reputation: number;
        ai_semantic: number;
    };
}

export interface ScoreBreakdown {
    score: number;
    breakdown: {
        skills_match: number;
        location_match: number;
        reputation: number;
    };
}
