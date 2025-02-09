import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import File from "../models/File.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Set up local file storage using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads"; // Local folder for storing files
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}_${file.originalname}`);
  },
});

const upload = multer({ storage });

// ===================================================================
// POST /multiple - Upload multiple files
// ===================================================================
router.post("/multiple", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded!" });
    }

    // Generate a unique batch (upload) ID
    const uploadBatchId = new mongoose.Types.ObjectId();

    // Prepare file metadata for saving in the database, including the batch ID
    const filesData = req.files.map((file) => ({
      filename: file.filename,
      filepath: file.path,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24-hour expiration
      uploadId: uploadBatchId,
    }));

    const savedFiles = await File.insertMany(filesData);

    const responseFiles = savedFiles.map((file) => ({
      fileId: file._id,
      filename: file.filename,
      fileUrl: `${process.env.BACKEND_URL}/upload/download/${file._id}`,
    }));

    res.status(200).json({
      message: "Files uploaded successfully!",
      files: responseFiles,
      uploadBatchId: uploadBatchId.toString(), // Return the batch ID
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "File upload failed!" });
  }
});

// ===================================================================
// GET /download/:fileId - Download a single file by ID
// ===================================================================
router.get("/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Use findById to look for the file document in MongoDB
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found in database!" });
    }

    const filePath = path.join(process.cwd(), file.filepath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server!" });
    }

    // Send the file as a download
    res.download(filePath, file.filename);
  } catch (error) {
    console.error("File download error:", error);
    res.status(500).json({ message: "Error downloading file!" });
  }
});


// ===================================================================
// GET /download-all/:uploadBatchId - Download all files for a given batch as a ZIP archive
// ===================================================================
router.get("/download-all/:uploadBatchId", async (req, res) => {
  try {
    const { uploadBatchId } = req.params;

    // Only find files with the given uploadId
    const files = await File.find({ uploadId: uploadBatchId });
    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No files available for download!" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=upload_batch_${uploadBatchId}.zip`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    for (const file of files) {
      const filePath = path.join(process.cwd(), file.filepath);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file.filename });
      }
    }
    await archive.finalize();
  } catch (error) {
    console.error("Error creating ZIP archive:", error);
    res.status(500).json({ message: "Error downloading files!" });
  }
});


// ===================================================================
// Periodic Job: Delete expired files from storage and DB
// ===================================================================
const deleteExpiredFiles = async () => {
  try {
    const now = Date.now();
    const expiredFiles = await File.find({ expiresAt: { $lt: now } });

    for (const file of expiredFiles) {
      const filePath = path.join(process.cwd(), file.filepath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Delete file from local storage
      }
      await File.deleteOne({ _id: file._id }); // Remove from database
    }
  } catch (error) {
    console.error("Error deleting expired files:", error);
  }
};

// Run the cleanup job every hour
setInterval(deleteExpiredFiles, 60 * 60 * 1000);

export default router;
