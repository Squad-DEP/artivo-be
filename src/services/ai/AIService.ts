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
        const prompt = userType === 'artisan'
            ? 'You are helping an artisan sign up. Ask about their skills, experience, location, and availability. Extract structured data from their responses.'
            : 'You are helping a customer sign up. Ask about their needs, location, and preferences. Extract structured data from their responses.';

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
