import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import Meeting from "../Models/meeting.js";

const createMeetingId = () =>
    crypto.randomBytes(6).toString("hex").toUpperCase();

export const createMeeting = async (req, res) => {
    try {
        const { accessMode = "guest" } = req.body;

        if (!["guest", "authenticated"].includes(accessMode)) {
            return res.status(400).json({
                success: false,
                message: "accessMode must be 'guest' or 'authenticated'"
            });
        }

        const meeting = await Meeting.create({
            meetingId: createMeetingId(),
            host: req.user.sub,
            accessMode
        });

        return res.status(201).json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                accessMode: meeting.accessMode,
                startTime: meeting.startTime,
                isActive: meeting.isActive
            }
        });
    } catch (error) {
        console.error("Create meeting error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const getMeetingInfo = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({
            meetingId: req.params.meetingId.toUpperCase(),
            isActive: true
        })
            .select("meetingId accessMode startTime isActive")
            .lean();

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        return res.status(200).json({
            success: true,
            meeting
        });
    } catch (error) {
        console.error("Get meeting error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const createGuestToken = async (req, res) => {
    try {
        const { name } = req.body;
        const meetingId = req.params.meetingId.toUpperCase();

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Guest name is required"
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Guest name is too long"
            });
        }

        const meeting = await Meeting.findOne({
            meetingId,
            isActive: true
        }).lean();

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        if (meeting.accessMode !== "guest") {
            return res.status(403).json({
                success: false,
                message: "This meeting requires a logged-in user"
            });
        }

        const token = jwt.sign(
            {
                sub: `guest:${crypto.randomUUID()}`,
                role: "guest",
                name: name.trim(),
                meetingId
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: process.env.GUEST_JWT_EXPIRES_IN || "2h",
                issuer: process.env.JWT_ISSUER || "meetus",
                audience: process.env.JWT_AUDIENCE || "meetus-client"
            }
        );

        return res.status(200).json({
            success: true,
            token
        });
    } catch (error) {
        console.error("Create guest token error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const endMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({
            meetingId: req.params.meetingId.toUpperCase(),
            host: req.user.sub,
            isActive: true
        });

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found or you are not the host"
            });
        }

        meeting.isActive = false;
        meeting.endTime = new Date();
        await meeting.save();

        return res.status(200).json({
            success: true,
            message: "Meeting ended"
        });
    } catch (error) {
        console.error("End meeting error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
