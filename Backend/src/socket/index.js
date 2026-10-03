import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import User from "../models/users.js";

import { registerMeetingHandlers } from "./meeting.socket.js";
import { registerChatHandlers } from "./chat.socket.js";
import { registerSignalingHandlers } from "./signaling.socket.js";


export const connectSocket = (server) => {

    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            credentials: true
        }
    });


    // ==========================================
    // SOCKET AUTHENTICATION
    // ==========================================

    io.use(async (socket, next) => {

        try {

            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(
                    new Error("Authentication required")
                );
            }


            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET,
                {
                    issuer:
                        process.env.JWT_ISSUER || "meetus",

                    audience:
                        process.env.JWT_AUDIENCE ||
                        "meetus-client"
                }
            );


            // ======================================
            // GUEST
            // ======================================

            if (decoded.role === "guest") {

                socket.user = {
                    id: decoded.sub,
                    name: decoded.name,
                    role: "guest",
                    meetingId: decoded.meetingId
                };

                return next();
            }


            // ======================================
            // REGISTERED USER
            // ======================================

            const user = await User
                .findById(decoded.sub)
                .select("_id name username")
                .lean();


            if (!user) {

                return next(
                    new Error("User no longer exists")
                );
            }


            socket.user = {
                id: user._id.toString(),
                name: user.name,
                username: user.username,
                role: "user"
            };


            next();

        } catch (error) {

            console.error(
                "Socket authentication error:",
                error.message
            );

            next(
                new Error("Invalid or expired token")
            );
        }
    });


    // ==========================================
    // CONNECTION
    // ==========================================

    io.on("connection", (socket) => {

        console.log(
            `Socket connected: ${socket.id}`
        );

        console.log(
            "Socket user:",
            socket.user
        );


        registerMeetingHandlers(io, socket);

        registerChatHandlers(io, socket);

        registerSignalingHandlers(io, socket);


        socket.on("disconnect", (reason) => {

            console.log(
                `Socket disconnected: ${socket.id}`,
                reason
            );

        });

    });


    return io;
};