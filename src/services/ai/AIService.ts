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
            prompt = `You are a localized AI onboarding assistant for "Artivo", a platform in Nigeria connecting artisans to clients.
            The user's input may be in English, Nigerian Pidgin English, Yoruba, Igbo, or Hausa, or a mix of these (code-switching).

            CRITICAL INSTRUCTIONS:
            1. Listen/Read the input carefully regardless of the Nigerian dialect or language used.
            2. Extract the core information and translate the descriptive values into standard English for the profile JSON fields.
            3. Identify what language or dialect they spoke in and capture it.

            Analyze the input and return a valid JSON object matching this schema exactly:
            {
                "fullName": "string or null",
                "profession": "string or null (translate trade name to English, e.g., 'Alajota/Mekaniki' -> 'Mechanic')",
                "skills": ["array of strings translated to standard English keywords"],
                "yearsOfExperience": number or null,
                "cityLocation": "string or null (e.g., 'Yaba, Lagos')",
                "expectedHourlyRate": "string or null (keep currency units clear, e.g., '5000 naira')",
                "availability": "string or null (translated to English)",
                "primaryLanguageUsed": "string (e.g., 'Yoruba', 'Pidgin', 'Igbo', 'Hausa', 'English')",
                "confidenceScore": "string ('high' | 'medium' | 'low' based on how complete or clear the audio/text was)"
            }
            Do not return any conversational text or markdown blocks, only return raw stringified JSON.`;
        } else {
            prompt = `You are a localized AI onboarding assistant parsing inputs into client requests for the Artivo platform.
            The user input may be in English, Nigerian Pidgin, Yoruba, Igbo, or Hausa.
            Translate the extracted descriptive elements into standard English for the JSON output fields.

            Analyze the input and return a valid JSON object matching this schema exactly:
            {
                "clientName": "string or null",
                "serviceRequired": "string or null (translated trade category name, e.g., 'Plumber')",
                "projectDescription": "string or null (summary translated to standard English)",
                "budgetLimit": "string or null (e.g., '20,000 naira')",
                "urgency": "string or null (e.g., 'immediately', 'this weekend')",
                "primaryLanguageUsed": "string (e.g., 'Pidgin', 'Yoruba', etc.)"
            }
            Do not return any conversational text or markdown blocks, only return raw stringified JSON.`;
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
