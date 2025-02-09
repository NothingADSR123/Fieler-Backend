import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fileRoutes from "./routes/fileRoutes.js";
import "./config/db.js"; // Import the database connection

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.FRONTEND_URL,  // Allow frontend to access the backend
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// Root route to display text
app.get("/", (req, res) => {
  res.send("Welcome to the File Sharing App!");
});

// Set up routes
app.use("/upload", fileRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
