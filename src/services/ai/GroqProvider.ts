import { IAIProvider, AIResult } from './IAIProvider';
import Groq from "groq-sdk";
import fs, {promises as fsPromises} from "fs";
import path from "path";
import os from "os";

export class GroqProvider implements IAIProvider {
    private apiKey: string;
    private groq: Groq;

    constructor() {
        this.apiKey = process.env.GROQ_API_KEY || '';
        if (!this.apiKey) {
            console.warn('GROQ_API_KEY not set! Groq AI will not work.');
        }
        this.groq = new Groq({ apiKey: this.apiKey });
    }

    async process(prompt: string, userInput: string, context?: string[]): Promise<AIResult> {
        let tempFilePath: string | null = null;

        try {
            console.log("Groq attempting to transcribe audio")
            if (!this.apiKey) {
                throw new Error('GROQ API key not configured');
            }
            let textToProcess = userInput;

            //detct if input is base 64 audio
            const isAudio = userInput.length > 100 && !userInput.includes(' ');

            if(isAudio) {
                const buffer = Buffer.from(userInput.replace(/^data:audio\/\w+;base64,/, ''), 'base64');

                tempFilePath = path.join(os.tmpdir(), `groq_stt_${Date.now()}.wav`);

                await fsPromises.writeFile(tempFilePath, buffer);

                const transcription = await this.groq.audio.transcriptions.create({file: fs.createReadStream(tempFilePath), model: 'whisper-large-v3', response_format: 'json'});

                textToProcess = transcription.text;
            }

            //Now handle the text with llama
            const structuredContext = context && context.length > 0
                ? `Conversation Context History:\n${context.join('\n')}\n\n`
                : '';

                const response = await this.groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile', messages: [{role: 'system', content: prompt}, {role: 'user', content: `${structuredContext}User Input: ${textToProcess}`}], response_format: {type: 'json_object'}, temperature: 0.1
                });

                const content = response.choices[0]?.message?.content || '{}';
                console.log("Groq final response");
                return {
                    success: true,
                    response: content,
                    data: JSON.parse(content)
                }
        } catch (error: any) {
            console.error('Groq provider Error:', error);
            return {
                success: false,
                error: error.message
            }
        } finally {
            if(tempFilePath) {
                await fsPromises.unlink(tempFilePath).catch(() => {});
            }
        }
    }
}