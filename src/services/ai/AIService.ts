/**
 * AI Service - Manages AI providers
 * Switch providers by changing AI_PROVIDER env variable
 */

import { IAIProvider, AIResult } from './IAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';

class AIService {
    private provider: IAIProvider;

    constructor() {
        // Select provider based on env variable
        const providerName = process.env.AI_PROVIDER || 'gemini';
        
        switch (providerName.toLowerCase()) {
            case 'gemini':
                this.provider = new GeminiProvider();
                break;
            case 'openai':
                this.provider = new OpenAIProvider();
                break;
            // Add more providers:
            // case 'claude':
            //     this.provider = new ClaudeProvider();
            //     break;
            default:
                console.warn(`Unknown AI provider: ${providerName}, defaulting to Gemini`);
                this.provider = new GeminiProvider();
        }
    }

    /**
     * Process onboarding conversation
     */
    async processOnboarding(userInput: string, userType: 'artisan' | 'customer', context?: string[]): Promise<AIResult> {

        let prompt = '';

        if (userType === 'artisan') {
            prompt = `You are an AI onboarding assistant parsing inputs into structural artisan profiles. 
            Analyze the input and return valid JSON matching this schema:
            {
                "fullName": "string or null",
                "profession": "string or null",
                "skills": ["array of strings"],
                "yearsOfExperience": number or null,
                "cityLocation": "string or null",
                "expectedHourlyRate": "string or null",
                "availability": "string or null"
            }
            Do not return any conversational text, only return raw stringified JSON.`;
        } else {
            prompt = `You are an AI onboarding assistant parsing inputs into client requests. 
            Analyze the input and return valid JSON matching this schema:
            {
                "clientName": "string or null",
                "serviceRequired": "string or null",
                "projectDescription": "string or null",
                "budgetLimit": "string or null",
                "urgency": "string or null"
            }
            Do not return any conversational text, only return raw stringified JSON.`;
        }
        return this.provider.process(prompt, userInput, context);
    }

    /**
     * General chat
     */
    async chat(message: string, context?: string[]): Promise<AIResult> {
        const prompt = 'You are a helpful assistant for the Artivo platform, connecting artisans with customers.';
        return this.provider.process(prompt, message, context);
    }
}

export default new AIService();
