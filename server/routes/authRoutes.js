const express = require("express");
const router = express.Router();
const { 
    registerUser, 
    loginUser, 
    getMe, 
    createStaffUser, 
    getAllUsers,
    verifyStudentUser,
    changePassword,
    verifyInvitationToken,
    setupInvigilatorPassword,
    resendInvitation,
    requestResendSetupEmail
} = require("../controllers/authController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Public authentication & password setup routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify-invitation/:token", verifyInvitationToken);
router.post("/setup-password", setupInvigilatorPassword);
router.post("/resend-setup-email", requestResendSetupEmail);

// Protected routes
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);
router.post("/staff", protect, authorizeRoles("admin"), createStaffUser);
router.get("/users", protect, authorizeRoles("admin"), getAllUsers);
router.put("/users/:id/verify", protect, authorizeRoles("admin"), verifyStudentUser);
router.post("/users/:id/resend-invitation", protect, authorizeRoles("admin"), resendInvitation);

module.exports = router;


