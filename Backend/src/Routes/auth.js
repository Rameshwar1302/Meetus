import { Router } from "express";

import {
    login,
    register,
    getMe
} from "../controllers/auth.js";

import { authenticate } from "../middleware/auth.js";


const router = Router();


// Public routes
router.post("/login", login);
router.post("/register", register);


// Protected route
router.get("/me", authenticate, getMe);


export default router;