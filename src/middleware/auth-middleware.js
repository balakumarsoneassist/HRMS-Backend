const user_service = require("../services/user-service");

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // ✅ Check if token exists
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized: Token is required" 
            });
        }

        // ✅ Extract token
        const token = authHeader.split(" ")[1];

        // ✅ Validate token
        let userservice = new user_service();
        let decrypted = await userservice.checkValidUser(token);

        // ✅ If invalid token
        if (!decrypted || !decrypted.id) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Invalid or expired token"
            });
        }

        // ✅ Attach user data to request
        req.user = decrypted;
        next();

    } catch (error) {
        console.error("Authentication Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = authenticateToken;
