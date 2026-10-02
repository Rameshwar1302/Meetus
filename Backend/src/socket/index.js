import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import { registerMeetingHandlers } from "./meeting.socket.js";
import { registerChatHandlers } from "./chat.socket.js";
import { registerSignalingHandlers } from "./signaling.socket.js";

export const connectSocket = (server) => {

    const io = new Server(server, {
        cors: {
            origin: "process.env.CLIENT_URL",
            credentials: true
        }
    });

    io.use((socket, next) => {

        try {

            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(
                    new Error("Authentication required")
                );
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            socket.user = decoded;

            next();

        } catch (error) {

            next(new Error("Invalid or expired token"));

        }
    });

    io.on("connection", (socket) => {

        console.log(
            "Connected:",
            socket.id,
            socket.user
        );

        registerMeetingHandlers(io, socket);
        registerChatHandlers(io, socket);
        registerSignalingHandlers(io, socket);

    });

    return io;
};