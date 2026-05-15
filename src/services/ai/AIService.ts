/**
 * AI Service - Manages AI providers with automatic fallback
 */

import { IAIProvider, AIResult } from './IAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { GroqProvider } from './GroqProvider';
import {
    ARTISAN_ONBOARDING_PROMPT,
    CUSTOMER_ONBOARDING_PROMPT,
    DEFAULT_CHAT_PROMPT,
    buildJobExtractionPrompt,
} from './prompts';

class AIService {
    private providers: IAIProvider[];

    constructor() {
        this.providers = [
            new GeminiProvider(),
            new GroqProvider(),
        ];
    }

    private async executeWithFallback(prompt: string, userInput: string, context?: string[], mimeType?: string): Promise<AIResult> {
        let lastError = "";

        for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            const providerName = provider instanceof GeminiProvider ? "Gemini" : "Groq";

            console.log(`Attempting request with ${providerName}...`);

            const result = await provider.process(prompt, userInput, context, mimeType);

            if (result.success) {
                // Guard against silent extraction failure — provider returned success but all fields are null.
                // This happens when Gemini processes audio in a format it can't hear (e.g. audio/mp4 inline on Safari).
                // Fall through to the next provider instead of returning empty data.
                const isAudioInput = userInput.length > 100 && !userInput.includes(' ');
                const hasExtractedData = result.data && Object.values(result.data).some(
                    (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
                );
                if (isAudioInput && !hasExtractedData && i < this.providers.length - 1) {
                    console.warn(`${providerName} returned all-null extraction for audio input, trying next provider.`);
                    continue;
                }
                return result;
            }

            lastError = result.error || "Unknown error";
            const errorString = lastError.toLowerCase();

            const isRetryable =
                errorString.includes("503") ||
                errorString.includes("429") ||
                errorString.includes("rate") ||
                errorString.includes("high demand") ||
                errorString.includes("unavailable") ||
                errorString.includes("overloaded");

            if (isRetryable && i < this.providers.length - 1) {
                console.warn(`${providerName} rate-limited/overloaded, trying next provider. Error: ${lastError}`);
                continue;
            }

            // Fatal error (bad key, bad prompt, parse failure) — don't waste quota on fallback
            console.error(`${providerName} failed with non-retryable error: ${lastError}`);
            break;
        }

        return {
            success: false,
            error: `All AI providers failed. Last error: ${lastError}`,
        };
    }

    /**
     * Process onboarding — voice or text, for artisans and customers
     */
    async processOnboarding(userInput: string, userType: 'artisan' | 'customer', context?: string[], mimeType?: string): Promise<AIResult> {
        const prompt = userType === 'artisan' ? ARTISAN_ONBOARDING_PROMPT : CUSTOMER_ONBOARDING_PROMPT;
        return this.executeWithFallback(prompt, userInput, context, mimeType);
    }

    /**
     * Extract structured job details from voice or text input
     */
    async extractJobDescription(userInput: string, availableJobTypes: Array<{ id: string; name: string }>, mimeType?: string): Promise<AIResult> {
        const prompt = buildJobExtractionPrompt(availableJobTypes);
        return this.executeWithFallback(prompt, userInput, undefined, mimeType);
    }

    /**
     * General-purpose chat (supports custom system prompt override)
     */
    async chat(message: string, context?: string[], systemPrompt?: string): Promise<AIResult> {
        const prompt = systemPrompt || DEFAULT_CHAT_PROMPT;
        return this.executeWithFallback(prompt, message, context);
    }
}

export default new AIService();
