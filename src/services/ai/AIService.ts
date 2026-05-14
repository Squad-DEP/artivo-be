/**
 * AI Service - Manages AI providers
 * Switch providers by changing AI_PROVIDER env variable
 */

import { IAIProvider, AIResult } from './IAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';

class AIService {
    private providers: IAIProvider[];

    constructor() {
        this.providers = [
            new GeminiProvider(),
            new GroqProvider(),
        ];
    }

    private async executeWithFallback(prompt: string, userInput: string, context?: string[]): Promise<AIResult> {
        let lastError = "";
    
        // Loop through all registered providers (Gemini, then Groq)
        for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            const providerName = provider instanceof GeminiProvider ? "Gemini" : "Groq";
            
            console.log(`Attempting request with ${providerName}...`);
            
            const result = await provider.process(prompt, userInput, context);
    
            if (result.success) {
                return result;
            }
    
            // If we reach here, the current provider failed.
            lastError = result.error || "Unknown error";
            const errorString = JSON.stringify(lastError).toLowerCase();
    
            // Specific check for "Try again later" / "High demand" / "Overloaded"
            const isOverloaded = 
                errorString.includes("503") || 
                errorString.includes("high demand") || 
                errorString.includes("unavailable") ||
                errorString.includes("rate_limit"); // Added for Groq safety
    
            if (isOverloaded) {
                console.warn(`${providerName} is overloaded or down. Error: ${lastError}`);
                
                // If there's another provider in the array, the loop continues to the next one
                if (i < this.providers.length - 1) {
                    console.log(`🔄 Switching to next available provider...`);
                    continue; 
                }
            } else {
                // If it's a fatal error (like a bad prompt or code bug), 
                // you might want to stop immediately, but for a hackathon, 
                // it's safer to try the fallback anyway.
                continue;
            }
        }
    
        // If the loop finishes and nothing worked:
        return { 
            success: false, 
            error: `All AI providers failed. Last error: ${lastError}` 
        };
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
                "bio": "string or null",
                "phoneNumber": "number or null",
                "tagline": "string or null",
                "cityLocation": "string or null (e.g., 'Yaba, Lagos')",
                "avgPay": "string or null (keep currency units clear, e.g., '5000 naira')",
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
        return this.executeWithFallback(prompt, userInput, context);
    }

    /**
     * Extract job description from voice/text input
     */
    async extractJobDescription(userInput: string, availableJobTypes: Array<{id: string, name: string}>): Promise<AIResult> {
        const jobTypesList = availableJobTypes.map(jt => `- ${jt.name} (id: ${jt.id})`).join('\n');
        
        const prompt = `You are an AI assistant for Artivo platform in Nigeria that extracts job posting details from customer input.
The user's input may be in English, Nigerian Pidgin English, Yoruba, Igbo, or Hausa, or a mix of these.

Available job types:
${jobTypesList}

CRITICAL INSTRUCTIONS:
1. Listen/Read the input carefully regardless of the Nigerian dialect or language used.
2. Extract job details and translate descriptive values into standard English.
3. Match the job to one of the available job types above based on the description.
4. Extract budget/price information if mentioned.

Analyze the input and return a valid JSON object matching this schema exactly:
{
    "job_type_id": "string or null (UUID from the list above that best matches)",
    "title": "string or null (concise job title in English)",
    "description": "string or null (detailed description in English)",
    "location": "string or null (e.g., 'Yaba, Lagos')",
    "budget": number or null (numeric value only, no currency symbols),
    "confidence": "string ('high' | 'medium' | 'low')",
    "language_detected": "string (e.g., 'English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa')"
}

Do not return any conversational text or markdown blocks, only return raw stringified JSON.`;

        return this.executeWithFallback(prompt, userInput);
    }

    /**
     * General chat
     */
    async chat(message: string, context?: string[]): Promise<AIResult> {
        const prompt = 'You are a helpful assistant for the Artivo platform, connecting artisans with customers.';
        return this.executeWithFallback(prompt, message, context);
    }
}

export default new AIService();
