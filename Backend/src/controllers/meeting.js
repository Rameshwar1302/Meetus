import crypto from "node:crypto";
import httpStatus from "http-status";

import Meeting from "../Models/meeting.js";


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

        return res.status(httpStatus.CREATED).json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                startTime: meeting.startTime,
                isActive: meeting.isActive
            }
        });

    } catch (error) {

        console.error("Create meeting error:", error);

        return res.status(
            httpStatus.INTERNAL_SERVER_ERROR
        ).json({
            success: false,
            message: "Failed to create meeting"
        });
    }
};


export const getMeeting = async (req, res) => {

    try {

        const { meetingId } = req.params;

        const meeting = await Meeting.findOne({
            meetingId,
            isActive: true
        });

        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: "Meeting not found"
            });
        }

        return res.status(httpStatus.OK).json({
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

        return res.status(
            httpStatus.INTERNAL_SERVER_ERROR
        ).json({
            success: false,
            message: "Failed to fetch meeting"
        });
    }
};