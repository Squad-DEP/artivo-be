/**
 * OpenAI Whisper Speech-to-Text Provider
 */

import { ISpeechProvider, SpeechResult } from './ISpeechProvider';
import axios from 'axios';

export class WhisperProvider implements ISpeechProvider {
    private apiKey: string;
    private baseURL: string = 'https://api.openai.com/v1';

    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️  OPENAI_API_KEY not set! Whisper STT will not work.');
        }
    }

    async transcribe(audioData: string, options?: any): Promise<SpeechResult> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // TODO: Implement actual Whisper API call
            // This is a placeholder structure
            const response = await axios.post(
                `${this.baseURL}/audio/transcriptions`,
                {
                    file: audioData,
                    model: 'whisper-1',
                    ...options
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            return {
                success: true,
                text: response.data.text,
                language: response.data.language
            };
        } catch (error: any) {
            console.error('Whisper API Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
