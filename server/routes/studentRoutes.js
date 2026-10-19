const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    bulkCreateStudents,
    registerStudent
} = require("../controllers/studentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { handlePhotoUpload } = require("../middleware/uploadMiddleware");

// Multer setup for Excel/CSV import (memory)
const excelUpload = multer({ storage: multer.memoryStorage() });

// Public student registration route (Step 1 & 2: Multer validates JPEG & pipes to Cloudinary)
router.post("/register", handlePhotoUpload("photo"), registerStudent);

// Student listing & details
router.get("/", protect, getStudents);
router.get("/:id", protect, getStudentById);

// Admin-managed student creation, updates (with Cloudinary photo replacement/deletion)
router.post("/", protect, authorizeRoles("admin"), handlePhotoUpload("photo"), createStudent);
router.put("/:id", protect, authorizeRoles("admin"), handlePhotoUpload("photo"), updateStudent);
router.delete("/:id", protect, authorizeRoles("admin"), deleteStudent);

// Bulk operations
router.post("/import", protect, authorizeRoles("admin"), excelUpload.single("file"), importStudents);
router.post("/bulk", protect, authorizeRoles("admin"), bulkCreateStudents);

module.exports = router;
