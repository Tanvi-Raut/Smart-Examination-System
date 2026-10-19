const express = require("express");
const router = express.Router();
const {
	getAllocationsByExam,
	getStudentAllocation,
	getStudentHallTicket,
	getExamEligibility,
	generateAllocation,
	deleteAllocationsByExam,
	deleteAllocation,
	generateQRCode,
	getAllocationSummary
} = require("../controllers/allocationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/hall-ticket/:identifier", getStudentHallTicket); // Public/Student route for ticket download
router.get("/eligibility/:examId", protect, getExamEligibility);
router.get("/exam/:examId", protect, getAllocationsByExam);
router.get("/exam/:examId/summary", protect, getAllocationSummary);
router.get("/student/:studentId/exam/:examId", protect, getStudentAllocation);
router.get("/:id/qr", protect, generateQRCode);
router.post("/generate", protect, authorizeRoles("admin"), generateAllocation);
router.delete("/exam/:examId", protect, authorizeRoles("admin"), deleteAllocationsByExam);
router.delete("/:id", protect, authorizeRoles("admin"), deleteAllocation);

module.exports = router;
