import { WorkerProfile, JobRequest, ScoreBreakdown } from '../types';

export class TraditionalScorer {
    /**
     * Extract skills from text (simple keyword extraction)
     */
    private extractSkills(text: string): string[] {
        const commonSkills = [
            'plumbing', 'electrical', 'carpentry', 'painting', 'welding',
            'masonry', 'roofing', 'hvac', 'landscaping', 'cleaning',
            'cooking', 'driving', 'security', 'tailoring', 'hairdressing',
        ];
        
        const lowerText = text.toLowerCase();
        return commonSkills.filter(skill => lowerText.includes(skill));
    }

    /**
     * Calculate skills match score (40% weight)
     */
    private calculateSkillsScore(worker: WorkerProfile, job: JobRequest): number {
        const jobSkills = this.extractSkills(job.description + ' ' + job.title);
        const matchingSkills = worker.skills.filter(skill =>
            jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase())),
        );
        return (matchingSkills.length / Math.max(jobSkills.length, 1)) * 40;
    }

    /**
     * Calculate location proximity score (20% weight)
     */
    private calculateLocationScore(worker: WorkerProfile, job: JobRequest): number {
        if (!worker.location || !job.location) return 0;
        
        const sameLocation = worker.location.toLowerCase().includes(job.location.toLowerCase()) ||
                            job.location.toLowerCase().includes(worker.location.toLowerCase());
        return sameLocation ? 20 : 10; // partial credit for nearby
    }

    /**
     * Calculate reputation score (40% weight)
     */
    private calculateReputationScore(worker: WorkerProfile): number {
        if (!worker.reputation_score) return 0;

        const rep = worker.reputation_score;
        const creditWeight = (rep.credit_score / 100) * 15;
        const completionWeight = (rep.completion_rate / 100) * 10;
        const ratingWeight = (rep.average_rating / 5) * 10;
        const experienceWeight = Math.min(rep.total_jobs / 10, 1) * 5; // cap at 10 jobs
        
        return creditWeight + completionWeight + ratingWeight + experienceWeight;
    }

    /**
     * Calculate overall traditional score
     */
    calculate(worker: WorkerProfile, job: JobRequest): ScoreBreakdown {
        const skillsScore = this.calculateSkillsScore(worker, job);
        const locationScore = this.calculateLocationScore(worker, job);
        const reputationScore = this.calculateReputationScore(worker);

        const totalScore = skillsScore + locationScore + reputationScore;

        return {
            score: Math.min(totalScore, 100),
            breakdown: {
                skills_match: skillsScore,
                location_match: locationScore,
                reputation: reputationScore,
            },
        };
    }
}
