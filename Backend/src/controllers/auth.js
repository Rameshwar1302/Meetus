import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/users.js";

export const register = async (req, res) => {
    try {
        const { name, username, password } = req.body;

        if (!name?.trim() || !username?.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, username and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const normalizedUsername = username.trim().toLowerCase();

        const existingUser = await User.findOne({
            username: normalizedUsername
        }).lean();

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            username: normalizedUsername,
            password: hashedPassword
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            }
        });
    } catch (error) {
        // Covers a race with MongoDB's unique username index.
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        console.error("Register error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username?.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const normalizedUsername = username.trim().toLowerCase();

        const user = await User.findOne({
            username: normalizedUsername
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const isMatched = await bcrypt.compare(password, user.password);

        if (!isMatched) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign(
            {
                sub: user._id.toString(),
                role: "user"
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: process.env.JWT_EXPIRES_IN || "1d",
                issuer: process.env.JWT_ISSUER || "meetus",
                audience: process.env.JWT_AUDIENCE || "meetus-client"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Logged in successfully",
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            },
            token
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.sub)
            .select("_id name username createdAt")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error("Get me error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
