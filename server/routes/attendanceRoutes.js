const express = require("express");
const router = express.Router();
const {
    verifyQRCode,
    markAttendance,
    syncOfflineAttendances,
    getHallAttendanceRoster,
    getExamAttendanceReport
} = require("../controllers/attendanceController");
const { protect } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

// Flexible auth middleware: populates req.user if token is present, but doesn't block verification
const optionalProtect = (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "smart_exam_secret_123");
            req.user = decoded;
        } catch (e) {
            console.warn("Token verification note:", e.message);
        }
    }
    next();
};

router.post("/verify-qr", optionalProtect, verifyQRCode);
router.post("/mark", optionalProtect, markAttendance);
router.post("/sync-offline", optionalProtect, syncOfflineAttendances);
router.get("/hall-roster/:examId/:hallId", optionalProtect, getHallAttendanceRoster);
router.get("/report/:examId", protect, getExamAttendanceReport);

module.exports = router;
