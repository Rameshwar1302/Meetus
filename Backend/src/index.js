import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { connectDB } from "./Connection.js";
import { connectSocket } from "./Controller/connetSocket.js";
import authRoutes from "./Routes/auth.js";


dotenv.config();
const PORT = 8000;

const app = express();
const server = createServer(app);
const io = await connectSocket(server);


app.use(cors());
app.use(express.json({limit: "1mb"}));
app.use(express.urlencoded({limit : "1mb", extended: true}));

app.use("/api/auth", authRoutes);

const start = async ()=>{
    await connectDB();
    server.listen(PORT, ()=>{
    console.log(`Server is listinign on ${PORT}`);
    })
}

start();
