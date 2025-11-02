const { Storage } = require("@google-cloud/storage");
const path = require("path");
const fs = require("fs");

// Initialize storage with your service account
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS 
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : undefined,
});

const bucketName = process.env.bucketName;
const bucket = storage.bucket(bucketName);

async function uploadToGCS(localFilePath, destination) {
  try {
    await bucket.upload(localFilePath, {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // await bucket.file(destination).makePublic();

    fs.unlinkSync(localFilePath);

    return `https://storage.googleapis.com/${bucketName}/${destination}`;
  } catch (err) {
    console.error("GCS Upload Error:", err);
    throw err;
  }
}

module.exports = { uploadToGCS };
