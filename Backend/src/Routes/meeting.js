import { Router } from "express";

import {
    createMeeting,
    getMeeting,
    createGuestToken,
    getMeetingHistory,
    endMeeting
} from "../controllers/meeting.js";

import { authenticate } from "../middleware/auth.js";

const router = Router();


// ==========================================
// AUTHENTICATED USER
// ==========================================

// Create meeting
router.post(
    "/create",
    authenticate,
    createMeeting
);

// Meeting history
router.get(
    "/history",
    authenticate,
    getMeetingHistory
);

// End meeting
router.post(
    "/:meetingId/end",
    authenticate,
    endMeeting
);


// ==========================================
// PUBLIC
// ==========================================

// Guest token
router.post(
    "/:meetingId/guest-token",
    createGuestToken
);

// Meeting information
router.get(
    "/:meetingId",
    getMeeting
);


export default router;