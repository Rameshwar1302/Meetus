import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                issuer: process.env.JWT_ISSUER || "meetus",
                audience: process.env.JWT_AUDIENCE || "meetus-client"
            }
        );

        req.user = decoded;

        next();

    } catch (error) {

        console.error("JWT verification error:", error);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};