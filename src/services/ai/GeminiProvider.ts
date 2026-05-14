/**
 * Google Gemini AI Provider
 */

import { IAIProvider, AIResult } from './IAIProvider';
import { GoogleGenAI } from '@google/genai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export class GeminiProvider implements IAIProvider {
    private apiKey: string;

    private ai: GoogleGenAI;

    private fileManager: GoogleAIFileManager;

    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        if (!this.apiKey) {
            console.warn('GEMINI_API_KEY not set! Gemini AI will not work.');
        }
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        this.fileManager = new GoogleAIFileManager(this.apiKey);
    }

    async process(prompt: string, userInput: string, context?: string[]): Promise<AIResult> {
        let tempFilePath: string | null = null;
        try {
            console.log("Gemini attempting to transcribe audio")
            if (!this.apiKey) {
                throw new Error('Gemini API key not configured');
            }

            const structuredContext = context && context.length > 0
                ? `Conversation Context History:\n${context.join('\n')}\n\n`
                : '';

            //check if userInput is likely a base64 audio string.. 
            const isAudio = userInput.length > 100 && !userInput.includes(' ');

            let parts: any[] = [{ text: `${prompt}\n\n${structuredContext}` }]; 

            if (isAudio) {
                const buffer = Buffer.from(userInput.replace(/^data:audio\/\w+;base64,/, ''), 'base64');

                //if audio is > 1mb, use filemanger 
                if (buffer.length > 1024 * 1024) {
                    tempFilePath = path.join(os.tmpdir(), `artivo_${Date.now()}.m4a`);
                    await fs.writeFile(tempFilePath, buffer); //non blocking write
                    const upload = await this.fileManager.uploadFile(tempFilePath, {
                        mimeType: 'audio/mp4',
                        displayName: 'ArtisanRecording',
                    });

                    parts.push({ fileData: { mimeType: upload.file.mimeType, fileUri: upload.file.uri } });
                } else {
                    parts.push({ inlineData: { mimeType: 'audio/wav', data: buffer.toString('base64') } });
                }

            } else {
                parts.push({ text: `Target User Input: "${userInput}"` });
            }


            // Execute content generation via native SDK syntax
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash', // Fastest model optimized for quick hackathon responses
                contents: [{ role: 'user', parts }],
                config: {
                    // Forces model to respond strictly with programmatic JSON text payloads
                    responseMimeType: 'application/json', 
                    temperature: 0.1, // Near-zero variance ensuring dependable schema alignment
                },
            });

            const rawText = response.text;
            if (!rawText) {
                throw new Error('Null text body returned from GenAI engine operations');
            }

            // Directly parse raw structured string cleanly
            const parsedData = JSON.parse(rawText.trim());

            console.log("Gemini final response");

            return {
                success: true,
                response: rawText,
                data: parsedData,
            };
        } catch (error: any) {
            console.error('Unified Gemini SDK Processing Error:', error.message);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            // Clean up temp file asynchronously - don't leave trash on the server!
            if (tempFilePath) {
                fs.unlink(tempFilePath).catch(err => console.error('Cleanup error:', err));
            }
        }
    }
}
