/**
 * Speech Service - Manages STT providers
 * Switch providers by changing SPEECH_PROVIDER env variable
 */

import { ISpeechProvider, SpeechResult } from './ISpeechProvider';
import { WhisperProvider } from './WhisperProvider';

class SpeechService {
    private provider: ISpeechProvider;

    constructor() {
        // Select provider based on env variable
        const providerName = process.env.SPEECH_PROVIDER || 'whisper';
        
        switch (providerName.toLowerCase()) {
            case 'whisper':
                this.provider = new WhisperProvider();
                break;
            // Add more providers here:
            // case 'google':
            //     this.provider = new GoogleSTTProvider();
            //     break;
            // case 'assemblyai':
            //     this.provider = new AssemblyAIProvider();
            //     break;
            default:
                console.warn(`Unknown speech provider: ${providerName}, defaulting to Whisper`);
                this.provider = new WhisperProvider();
        }
    }

    /**
     * Convert audio to text using configured provider
     */
    async transcribe(audioData: string, options?: any): Promise<SpeechResult> {
        return this.provider.transcribe(audioData, options);
    }
}

export default new SpeechService();
