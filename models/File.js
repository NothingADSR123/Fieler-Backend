import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  uploadId: { type: mongoose.Schema.Types.ObjectId, required: true }, // New field
});

export default mongoose.model("File", FileSchema);
