/**
 * Speech-to-Text Provider Interface
 * Implement this interface for any STT service (Whisper, Google, AssemblyAI, etc.)
 */

export interface ISpeechProvider {
    /**
     * Convert audio to text
     * @param audioData - Base64 encoded audio or file path
     * @param options - Provider-specific options
     */
    transcribe(audioData: string, options?: any): Promise<SpeechResult>;
}

export interface SpeechResult {
    success: boolean;
    text?: string;
    error?: string;
    confidence?: number;
    language?: string;
}
