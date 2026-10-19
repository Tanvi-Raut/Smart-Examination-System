const express = require("express");
const router = express.Router();
const {
    getExams, getExamById, createExam, updateExam, deleteExam
} = require("../controllers/examController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", protect, getExams);
router.get("/:id", protect, getExamById);
router.post("/", protect, authorizeRoles("admin"), createExam);
router.put("/:id", protect, authorizeRoles("admin"), updateExam);
router.delete("/:id", protect, authorizeRoles("admin"), deleteExam);

module.exports = router;
