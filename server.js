// //hi ahad just leaving comments here for you
// const express = require("express");
// const multer = require("multer");
// const path = require("path");
// const { exec } = require("child_process");
// const fs = require("fs");
// const cors = require("cors");
// //main functions are imported from index.js
// const {
//   extractAudio,
//   transcribeAudio,
//   translateText,
//   textToSpeech,
//   addAudioToVideo,
// } = require("./index");

// const app = express();
// // const upload = multer({ dest: "public/uploads/" });
// //upload image
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });
// router.post("/upload", upload.single("file"), uploadController.uploadImage);

// app.use(cors());
// //serve frontend files
// app.use(express.static("public"));

// //checking endpoint
// app.get("/hello", (req, res) => {
//   res.send("hello bldr");
// });

// //upload endpoint
// app.post("/upload", upload.single("video"), async (req, res) => {
//   const videoPath = req.file.path;
//   const audioPath = `public/uploads/audio.wav`;
//   const languages = ["arabic", "french", "spanish"];
//   const languageCodes = ["ar", "fr", "es"];
//   const outputVideos = [];

//   try {
//     //grab audio from video
//     await extractAudio(videoPath, audioPath);
//     //grab transcription from audio
//     const transcription = await transcribeAudio(audioPath);
//     //translate transcription in each language
//     for (let i = 0; i < languages.length; i++) {
//       const translatedText = await translateText(transcription, languages[i]);
//       const audioOutputPath = `public/uploads/audio_${languages[i]}.wav`;
//       // const audioOutputPath = `../../video-translator/public/uploads/audio_${languages[i]}.wav`
//       await textToSpeech(translatedText, languageCodes[i], audioOutputPath);
//       const videoOutputPath = `public/uploads/output_${languages[i]}.mp4`;
//       // const videoOutputPath = `../../video-translator/public/uploads/output_${languages[i]}.mp4`
//       await addAudioToVideo(videoPath, audioOutputPath, videoOutputPath);
//       // outputVideos.push(`uploads/output_${languages[i]}.mp4`); // Adjusted path for frontend
//       outputVideos.push(
//         `/output_${languages[i]}.mp4`
//       );
//     }
//     //return videos
//     res.json({ videos: outputVideos });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error processing video");
//   } finally {
//     fs.unlinkSync(videoPath);
//     fs.unlinkSync(audioPath);
//   }
// });

// app.listen(3000, () => {
//   console.log("Server started on http://localhost:3000");
// });

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const {
  extractAudio,
  transcribeAudio,
  translateText,
  textToSpeech,
  addAudioToVideo,
} = require("./index");

const app = express();

// Configure AWS S3
const s3Config = {
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  region: process.env.S3_REGION,
};

const s3Client = new S3Client(s3Config);

// Memory storage for Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.static("public"));

app.get("/hello", (req, res) => {
  res.send("hello bldr");
});

// Helper function for unique file names
const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// Function to upload a file to S3
const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
  const bucketParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: "public-read",
  };

  const data = await s3Client.send(new PutObjectCommand(bucketParams));
  return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
};

app.post("/upload", upload.single("video"), async (req, res) => {
  const file = req.file;
  const videoFileName = `${randomImageName()}.${file.originalname.split('.').pop()}`;
  const audioFileName = `${randomImageName()}.wav`;
  const languages = ["arabic", "french", "spanish"];
  const languageCodes = ["ar", "fr", "es"];
  const outputVideos = [];

  // Declare the paths outside of the try block
  let videoPath;
  let audioPath;

  try {
    // Save the uploaded video temporarily
    videoPath = path.join(__dirname, videoFileName);
    fs.writeFileSync(videoPath, file.buffer);

    // Upload the original video to S3
    const originalVideoUrl = await uploadToS3(file.buffer, videoFileName, file.mimetype);

    // Path for the extracted audio
    audioPath = path.join(__dirname, audioFileName);

    // Extract audio from video
    await extractAudio(videoPath, audioPath);

    // Transcribe the audio
    const transcription = await transcribeAudio(audioPath);

    // Process translations and upload results to S3
    for (let i = 0; i < languages.length; i++) {
      const translatedText = await translateText(transcription, languages[i]);
      const translatedAudioFileName = `${randomImageName()}.wav`;
      const outputVideoFileName = `${randomImageName()}.mp4`;

      const audioOutputPath = path.join(__dirname, translatedAudioFileName);
      const videoOutputPath = path.join(__dirname, outputVideoFileName);

      // Convert text to speech
      await textToSpeech(translatedText, languageCodes[i], audioOutputPath);

      // Merge the new audio with the original video
      await addAudioToVideo(videoPath, audioOutputPath, videoOutputPath);

      // Upload the processed video to S3
      const s3VideoUrl = await uploadToS3(fs.readFileSync(videoOutputPath), outputVideoFileName, "video/mp4");

      outputVideos.push(s3VideoUrl);

      // Clean up the generated files
      fs.unlinkSync(audioOutputPath);
      fs.unlinkSync(videoOutputPath);
    }

    // Return the original video URL and the URLs of the uploaded translated videos
    res.json({ originalVideo: originalVideoUrl, videos: outputVideos });
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).send("Error processing video");
  } finally {
    // Clean up the temporary video and audio files, if they were created
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
});


app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});