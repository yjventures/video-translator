const express = require('express');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { extractAudio, transcribeAudio, translateText, textToSpeech, addAudioToVideo } = require('./index');

const app = express();
const upload = multer({ dest: 'public/uploads/' });

app.use(express.static('public'));

app.post('/upload', upload.single('video'), async (req, res) => {
    const videoPath = req.file.path;
    const audioPath = `public/uploads/audio.wav`;
    const languages = ['arabic', 'french', 'spanish'];
    const languageCodes = ['ar', 'fr', 'es'];
    const outputVideos = [];

    try {
        await extractAudio(videoPath, audioPath);
        const transcription = await transcribeAudio(audioPath);

        for (let i = 0; i < languages.length; i++) {
            const translatedText = await translateText(transcription, languages[i]);
            const audioOutputPath = `public/uploads/audio_${languages[i]}.wav`;
            await textToSpeech(translatedText, languageCodes[i], audioOutputPath);
            const videoOutputPath = `public/uploads/output_${languages[i]}.mp4`;
            await addAudioToVideo(videoPath, audioOutputPath, videoOutputPath);
            outputVideos.push(`uploads/output_${languages[i]}.mp4`); // Adjusted path for frontend
        }

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