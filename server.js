//hi ahad just leaving comments here for you
const express = require('express');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
//main functions are imported from index.js
const { extractAudio, transcribeAudio, translateText, textToSpeech, addAudioToVideo } = require('./index');

const app = express();
const upload = multer({ dest: 'public/uploads/' });

//serve frontend files
app.use(express.static('public'));

//checking endpoint
app.get('/hello', (req, res) => {
    res.send('hello bldr');
});

//upload endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
    const videoPath = req.file.path;
    const audioPath = `public/uploads/audio.wav`;
    const languages = ['arabic', 'french', 'spanish'];
    const languageCodes = ['ar', 'fr', 'es'];
    const outputVideos = [];

    try {
        //grab audio from video
        await extractAudio(videoPath, audioPath);
        //grab transcription from audio
        const transcription = await transcribeAudio(audioPath);
        //translate transcription in each language
        for (let i = 0; i < languages.length; i++) {
            const translatedText = await translateText(transcription, languages[i]);
            const audioOutputPath = `public/uploads/audio_${languages[i]}.wav`;
            await textToSpeech(translatedText, languageCodes[i], audioOutputPath);
            const videoOutputPath = `public/uploads/output_${languages[i]}.mp4`;
            await addAudioToVideo(videoPath, audioOutputPath, videoOutputPath);
            outputVideos.push(`uploads/output_${languages[i]}.mp4`); // Adjusted path for frontend
        }
        //return videos
        res.json({ videos: outputVideos });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing video');
    } finally {
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
    }
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});