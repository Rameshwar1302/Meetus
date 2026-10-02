import User from "../Models/users.js";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const Register = async (req, res) => {
    try {

        const { name, username, password } = req.body;

        // Validate input
        if (!name || !username || !password) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: "Name, username and password are required"
            });
        }

        // Normalize username
        const normalizedUsername = username.trim().toLowerCase();

        // Check existing user
        const existingUser = await User.findOne({
            username: normalizedUsername
        });

        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({
                success: false,
                message: "Username already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = new User({
            name: name.trim(),
            username: normalizedUsername,
            password: hashedPassword
        });

        await newUser.save();

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: "User registered successfully"
        });

    } catch (error) {

        console.error("Register Error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


const Login = async (req, res) => {
    try {

        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const normalizedUsername = username.trim().toLowerCase();

        // Find user
        const user = await User.findOne({
            username: normalizedUsername
        });

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        // Compare password
        const isMatched = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatched) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                sub: user._id.toString(),
                username: user.username,
                name: user.name,
                role: "user"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        return res.status(httpStatus.OK).json({
            success: true,
            message: "Logged in successfully",
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                token
            }
        });

    } catch (error) {

        console.error("Login Error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


export { Register, Login };