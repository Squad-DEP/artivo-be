/**
 * AI Provider Interface
 * Implement this for any LLM (Gemini, OpenAI, Claude, etc.)
 */

export interface IAIProvider {
    /**
     * Process text with AI
     * @param prompt - The prompt/instruction
     * @param userInput - User's input text
     * @param context - Conversation history
     */
    process(prompt: string, userInput: string, context?: string[], mimeType?: string): Promise<AIResult>;
}

export interface AIResult {
    success: boolean;
    response?: string;
    data?: any;
    error?: string;
}
