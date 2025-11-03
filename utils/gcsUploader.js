const { Storage } = require("@google-cloud/storage");
const path = require("path");
const fs = require("fs");

const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : undefined,
});

const bucketName = process.env.bucketName;
const bucket = storage.bucket(bucketName);

/**
 * Upload to Google Cloud Storage
 * Works with either:
 * - local file path (string)
 * - in-memory buffer (Buffer)
 */
async function uploadToGCS(fileOrBuffer, destination) {
  try {
    let file;

    if (Buffer.isBuffer(fileOrBuffer)) {
      file = bucket.file(destination);
      await file.save(fileOrBuffer, {
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });
    } 
    else if (typeof fileOrBuffer === "string") {
      await bucket.upload(fileOrBuffer, {
        destination,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });
      fs.unlinkSync(fileOrBuffer); 
    } 
    else {
      throw new Error("Invalid file type passed to uploadToGCS");
    }

    // await bucket.file(destination).makePublic();

    return `https://storage.googleapis.com/${bucketName}/${destination}`;
  } catch (err) {
    console.error("GCS Upload Error:", err);
    throw err;
  }
}

module.exports = { uploadToGCS };
