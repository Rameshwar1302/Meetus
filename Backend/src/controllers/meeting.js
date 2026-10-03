import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import Meeting from "../models/meeting.js";



// ==========================================
// CREATE MEETING
// ==========================================

export const createMeeting = async (req, res) => {
    try {

        const meetingId = crypto
            .randomBytes(6)
            .toString("hex")
            .toUpperCase();

        const meeting = await Meeting.create({
            meetingId,
            host: req.user.sub
        });

        return res.status(201).json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                startTime: meeting.startTime,
                isActive: meeting.isActive
            }
        });

    } catch (error) {

        console.error("Create meeting error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create meeting"
        });
    }
};


// ==========================================
// GET MEETING
// ==========================================

export const getMeeting = async (req, res) => {
    try {

        const { meetingId } = req.params;

        const meeting = await Meeting
            .findOne({
                meetingId: meetingId.toUpperCase()
            })
            .populate("host", "name username")
            .lean();

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        if (!meeting.isActive) {
            return res.status(410).json({
                success: false,
                message: "Meeting has ended"
            });
        }

        return res.status(200).json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                host: meeting.host,
                startTime: meeting.startTime,
                isActive: meeting.isActive
            }
        });

    } catch (error) {

        console.error("Get meeting error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch meeting"
        });
    }
};


// ==========================================
// GUEST TOKEN
// ==========================================

export const createGuestToken = async (req, res) => {
    try {

        const { meetingId } = req.params;
        const { name } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Guest name is required"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId: meetingId.toUpperCase(),
            isActive: true
        });

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found or has ended"
            });
        }

        const guestId = crypto.randomUUID();

        const token = jwt.sign(
            {
                sub: guestId,
                role: "guest",
                name: name.trim(),
                meetingId: meeting.meetingId
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn:
                    process.env.GUEST_JWT_EXPIRES_IN || "2h",
                issuer:
                    process.env.JWT_ISSUER || "meetus",
                audience:
                    process.env.JWT_AUDIENCE || "meetus-client"
            }
        );

        return res.status(200).json({
            success: true,
            token
        });

    } catch (error) {

        console.error("Guest token error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create guest session"
        });
    }
};


// ==========================================
// MEETING HISTORY
// ==========================================

export const getMeetingHistory = async (req, res) => {
    try {

        const meetings = await Meeting
            .find({
                host: req.user.sub
            })
            .sort({
                createdAt: -1
            })
            .lean();

        return res.status(200).json({
            success: true,
            meetings
        });

    } catch (error) {

        console.error(
            "Meeting history error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch meeting history"
        });
    }
};


// ==========================================
// END MEETING
// ==========================================

export const endMeeting = async (req, res) => {
    try {

        const { meetingId } = req.params;

        // Guests can never end a meeting
        if (req.user.role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only the host can end a meeting"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId: meetingId.toUpperCase()
        });

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        // Only host can end
        if (
            meeting.host.toString() !==
            req.user.sub
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the host can end this meeting"
            });
        }

        // Already ended
        if (!meeting.isActive) {
            return res.status(400).json({
                success: false,
                message: "Meeting is already ended"
            });
        }

        // ==========================================
        // UPDATE DATABASE
        // ==========================================

        meeting.isActive = false;
        meeting.endTime = new Date();

        await meeting.save();


        // ==========================================
        // NOTIFY SOCKET CLIENTS
        // ==========================================

        const io = req.app.get("io");

        if (io) {

            io.to(meeting.meetingId).emit(
                "meeting-ended",
                {
                    meetingId: meeting.meetingId,
                    endTime: meeting.endTime,
                    message: "Meeting has been ended by the host"
                }
            );


            // Remove everyone from the room
            io.in(meeting.meetingId)
                .socketsLeave(meeting.meetingId);
        }


        return res.status(200).json({
            success: true,
            message: "Meeting ended successfully",
            meeting: {
                meetingId: meeting.meetingId,
                endTime: meeting.endTime,
                isActive: meeting.isActive
            }
        });

    } catch (error) {

        console.error(
            "End meeting error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to end meeting"
        });
    }
};