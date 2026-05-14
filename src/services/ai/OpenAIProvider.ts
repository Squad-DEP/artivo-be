/**
 * OpenAI GPT Provider
 */

import { IAIProvider, AIResult } from './IAIProvider';
import axios from 'axios';

export class OpenAIProvider implements IAIProvider {
    private apiKey: string;

    private baseURL: string = 'https://api.openai.com/v1';

    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️  OPENAI_API_KEY not set! OpenAI will not work.');
        }
    }

    async process(prompt: string, userInput: string, context?: string[]): Promise<AIResult> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const messages: any[] = [
                { role: 'system', content: prompt },
            ];

            if (context && context.length > 0) {
                context.forEach((msg, i) => {
                    messages.push({
                        role: i % 2 === 0 ? 'user' : 'assistant',
                        content: msg,
                    });
                });
            }

            messages.push({ role: 'user', content: userInput });

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'gpt-4',
                    messages,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            return {
                success: true,
                response: response.data.choices?.[0]?.message?.content,
                data: response.data,
            };
        } catch (error: any) {
            console.error('OpenAI API Error:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}
