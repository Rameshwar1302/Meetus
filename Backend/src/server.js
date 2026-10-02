import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "node:http";

import { connectDB } from "./config/database.js";
import { connectSocket } from "./socket/index.js";

import authRoutes from "./routes/auth.js";
import meetingRoutes from "./routes/meeting.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({
    limit: "1mb",
    extended: true
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/meeting", meetingRoutes);

// Socket.IO
connectSocket(server);

const start = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`Server is listening on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

start();