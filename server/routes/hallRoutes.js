const express = require("express");
const router = express.Router();
const {
    getHalls, getHallById, createHall, updateHall, deleteHall, generateSeats, getSeatLayout
} = require("../controllers/hallController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", protect, getHalls);
router.get("/:id", protect, getHallById);
router.get("/:id/seats", protect, getSeatLayout);
router.post("/", protect, authorizeRoles("admin"), createHall);
router.put("/:id", protect, authorizeRoles("admin"), updateHall);
router.delete("/:id", protect, authorizeRoles("admin"), deleteHall);
router.post("/:id/generate-seats", protect, authorizeRoles("admin"), generateSeats);

module.exports = router;
