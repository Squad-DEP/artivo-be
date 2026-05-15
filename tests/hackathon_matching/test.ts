import 'dotenv/config';
import MatchingService from '../../src/services/matching/MatchingService';

const runMatchingTest = async () => {
    const testScenarios = [
        {
            name: "SCENARIO 1: Semantic Overlap (The 'I-pass-my-neighbor' Generator)",
            job: {
                id: 'job-001',
                title: 'Small Generator Repair',
                description: 'My small tiger generator (I-pass-my-neighbor) is smoking and wont start. Need urgent fix.',
                location: 'Yaba, Lagos',
                budget: 5000,
                job_type: 'Mechanical',
            },
            workers: [
                {
                    user_id: 'm1',
                    display_name: 'Toyota Chidi',
                    bio: 'Specialist in Japanese car engines, suspension, and gearboxes.',
                    skills: ['Mechanic', 'Automotive'],
                    location: 'Surulere, Lagos',
                    reputation_score: { credit_score: 80, completion_rate: 90, average_rating: 4.5, total_jobs: 30 }
                },
                {
                    user_id: 'm2',
                    display_name: 'Baba Rewire',
                    bio: 'I fix small petrol engines, pumping machines, and generator coils. Very fast service.',
                    skills: ['Electrical', 'Repairs'],
                    location: 'Yaba, Lagos',
                    reputation_score: { credit_score: 70, completion_rate: 85, average_rating: 4.0, total_jobs: 15 }
                }
            ]
        },
        {
            name: "SCENARIO 2: Luxury Context (POP and Interior Finish)",
            job: {
                id: 'job-002',
                title: 'Luxury Living Room Finishing',
                description: 'Need modern POP ceiling design with hidden rope lights and screeding.',
                location: 'Lekki Phase 1',
                budget: 250000,
                job_type: 'Painting',
            },
            workers: [
                {
                    user_id: 'p1',
                    display_name: 'Standard Painters Ltd',
                    bio: 'We do all kinds of house painting and outdoor whitewashing.',
                    skills: ['Painting', 'Masonry'],
                    location: 'Ajah, Lagos',
                    reputation_score: { credit_score: 85, completion_rate: 95, average_rating: 4.6, total_jobs: 40 }
                },
                {
                    user_id: 'p2',
                    display_name: 'Artistic Tunde',
                    bio: 'Expert in 3D wall panels, Venetian plaster, and high-end POP architectural designs.',
                    skills: ['Interior Decor', 'Painting'],
                    location: 'Victoria Island, Lagos',
                    reputation_score: { credit_score: 75, completion_rate: 88, average_rating: 4.3, total_jobs: 10 }
                }
            ]
        },
        {
            name: "SCENARIO 3: Pidgin and Street Slang Translation",
            job: {
                id: 'job-003',
                title: 'House Wire Trip',
                description: 'My light de trip since morning, I need person wey sabi wire house well well make house no burn.',
                location: 'Mushin, Lagos',
                budget: 15000,
                job_type: 'Electrical',
            },
            workers: [
                {
                    user_id: 'e1',
                    display_name: 'Engr. Philips',
                    bio: 'Electrical Engineer specializing in industrial power plants and circuit board design.',
                    skills: ['Electrical', 'Engineering'],
                    location: 'Ikeja, Lagos',
                    reputation_score: { credit_score: 95, completion_rate: 100, average_rating: 5.0, total_jobs: 5 }
                },
                {
                    user_id: 'e2',
                    display_name: 'Segun Spark',
                    bio: 'Experienced house electrician. I sabi trace fault, fix tripping breakers, and do full house wiring.',
                    skills: ['Electrician', 'Wiring'],
                    location: 'Oshodi, Lagos',
                    reputation_score: { credit_score: 80, completion_rate: 92, average_rating: 4.7, total_jobs: 65 }
                }
            ]
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n🚀 TESTING ${scenario.name}`);
        console.log(`📝 Job: ${scenario.job.description}`);
        
        const matches = await MatchingService.getTopMatches(scenario.job as any, scenario.workers as any);

        matches.forEach((m, i) => {
            const medal = i === 0 ? "🥇" : "🥈";
            console.log(`${medal} ${m.worker_name}`);
            console.log(`   Final Match Score: ${m.match_score}/100`);
            console.log(`   AI Explanation: ${m.explanation}`);
            console.log(`   Breakdown: [Trad: ${m.score_breakdown.skills_match + m.score_breakdown.location_match + m.score_breakdown.reputation}] [AI: ${m.score_breakdown.ai_semantic}]`);
        });
        console.log("------------------------------------------------------------------");
    }
};

runMatchingTest();
