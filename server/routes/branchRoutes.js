const express = require("express");
const router = express.Router();
const {
    getBranches, getBranchById, createBranch, updateBranch, deleteBranch
} = require("../controllers/branchController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", getBranches);
router.get("/:id", protect, getBranchById);
router.post("/", protect, authorizeRoles("admin"), createBranch);
router.put("/:id", protect, authorizeRoles("admin"), updateBranch);
router.delete("/:id", protect, authorizeRoles("admin"), deleteBranch);

module.exports = router;
