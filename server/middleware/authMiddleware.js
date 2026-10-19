const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes — verify JWT token
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(
                token, 
                process.env.JWT_SECRET || "exam_management_secret_key_2026"
            );
            req.user = await User.findById(decoded.id).select("-password");
            
            if (!req.user) {
                return res.status(401).json({ message: "User account no longer exists" });
            }

            if (req.user.accountStatus === "suspended") {
                return res.status(403).json({ message: "This account has been suspended" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, token verification failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

// Role-based access — case-insensitive role matching
const authorizeRoles = (...roles) => {
    const normalizedRoles = roles.map(r => r.toLowerCase());
    return (req, res, next) => {
        if (!req.user || !normalizedRoles.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({
                message: `Role '${req.user?.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };

