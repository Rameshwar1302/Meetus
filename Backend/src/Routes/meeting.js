import express from "express";

import {createMeeting, getMeeting} from "../controllers/meeting.js";

// import { authenticate } from "../middleware/auth.js";

const router = express.Router();


// Create meeting → login required
router.post(
    "/create",
    // authenticate,
    createMeeting
);


// Get meeting information
router.get(
    "/:meetingId",
    getMeeting
);


export default router;