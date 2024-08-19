const OpenAI = require('openai');
require('dotenv').config();

const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
async function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(audioPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

async function transcribeAudio(audioPath) {
    const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
    });
    console.log(response.text);
    return response.text;
}

async function translateText(text, targetLanguage) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": `Translate the following text to ${targetLanguage}: ${text}`}
        ]
    });

    // console.log(response.choices[0].message.content);
    return response.choices[0].message.content.trim();
}

async function textToSpeech(text, language, outputPath) {
    const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(outputPath, buffer);
}

async function addAudioToVideo(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .addInput(audioPath)
            .outputOptions('-c:v copy')
            .outputOptions('-c:a aac')
            .outputOptions('-map 0:v:0')
            .outputOptions('-map 1:a:0')
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

module.exports = {
    extractAudio,
    transcribeAudio,
    translateText,
    textToSpeech,
    addAudioToVideo
};