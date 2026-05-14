import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import AIService from "../../src/services/ai/AIService";

async function liveVerify() {
    console.log("🎙️ Initiating Gemini Multimodal Audio Test...");

    // 1. Path to your test audio file (ensure this file exists!)
    // Supports: .wav, .mp3, .aiff, .aac, .ogg, .flac
    const audioFilePath = path.join("/Users/apple/Desktop/hackathon/artivo-be", "tests/hackathon_audio/testaudio.m4a");

    if (!fs.existsSync(audioFilePath)) {
        console.error(`🚨 File not found: ${audioFilePath}`);
        console.log("Please place a recorded .wav file in a 'test-recordings' folder.");
        return;
    }

    try {
        // 2. Convert audio file to Base64 string
        console.log("Reading audio file and converting to Base64...");
        const audioBuffer = fs.readFileSync(audioFilePath);
        const base64Audio = audioBuffer.toString("base64");

        console.log("⏳ Sending Audio to Gemini for direct transcription and parsing...");
        
        // 3. Call the AIService (it will pass the base64 to GeminiProvider)
        const outcome = await AIService.chat(base64Audio);

        if (outcome.success) {
            console.log("SUCCESS! Gemini heard the audio and extracted this:");
            console.log(JSON.stringify(outcome.data, null, 4));
        } else {
            console.error("🚨 FAILURE! Extraction Error:", outcome.error);
        }
    } catch (error) {
        console.error("🚨 Test Crash:", error);
    }
}

liveVerify();