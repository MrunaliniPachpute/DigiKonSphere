const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

async function createVideoFromImages(
  images,
  storyText,
  narrationFile,
  bgMusicFile,
  outputFile
) {
  return new Promise(async (resolve, reject) => {
    const tempDir = path.join(__dirname, "temp_images_" + uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      console.log("🖼️ Downloading images...");

      const localImagePaths = [];
      for (const imgUrl of images.slice(0, 5)) {
        const imgPath = path.join(tempDir, `${uuidv4()}.jpg`);
        const response = await axios.get(imgUrl, { responseType: "arraybuffer" });
        fs.writeFileSync(imgPath, response.data);
        localImagePaths.push(imgPath);
      }

      // 🕒 Get total audio duration (we’ll match the video to it)
      const narrationDur = await getAudioDuration(narrationFile);
      const bgDur = await getAudioDuration(bgMusicFile);
      const totalDuration = Math.max(narrationDur, bgDur) || 10; // fallback

      // 🖼️ Create looped image list for 2 sec per image
      const imageDuration = 2; // seconds
      const loopsNeeded = Math.ceil(totalDuration / (localImagePaths.length * imageDuration));
      const allImages = [];
      for (let i = 0; i < loopsNeeded; i++) {
        allImages.push(...localImagePaths);
      }

      const listFile = path.join(tempDir, "list.txt");
      const listContent = allImages
        .map((p) => `file '${p.replace(/\\/g, "/")}'\nduration ${imageDuration}`)
        .join("\n");
      fs.writeFileSync(listFile, listContent);

      console.log("🎬 Creating video...");

      const safeText = storyText.replace(/'/g, "’");

      ffmpeg()
        .input(listFile)
        .inputOptions(["-f concat", "-safe 0"])
        .input(narrationFile)
        .input(bgMusicFile)
        .complexFilter([
          `[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black[v0]`,
          `[1:a]volume=1[a1]`,
          `[2:a]volume=0.3[a2]`,
          `[a1][a2]amix=inputs=2:duration=longest:dropout_transition=3[mixed]`
        ])
        .outputOptions([
          "-map [v0]",
          "-map [mixed]",
          "-c:v libx264",
          "-c:a aac",
          "-pix_fmt yuv420p",
          "-r 30",
          "-shortest",
          "-y"
        ])
        .on("start", (cmd) => console.log("▶️ FFmpeg started:\n", cmd))
        .on("stderr", (line) => console.log("FFmpeg log:", line))
        .on("end", () => {
          console.log("✅ Video successfully created:", outputFile);
          fs.rmSync(tempDir, { recursive: true, force: true });
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          fs.rmSync(tempDir, { recursive: true, force: true });
          reject(err);
        })
        .save(outputFile);
    } catch (err) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      reject(err);
    }
  });
}

module.exports = { createVideoFromImages };
