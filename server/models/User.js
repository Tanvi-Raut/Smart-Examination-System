const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        username: {
            type: String,
            trim: true
        },

        password: {
            type: String,
            required: false // May be pending during invitation workflow until setup
        },

        role: {
            type: String,
            enum: ["admin", "student", "invigilator", "ADMIN", "STUDENT", "INVIGILATOR"],
            default: "admin"
        },

        accountStatus: {
            type: String,
            enum: ["active", "pending_verification", "pending_setup", "suspended"],
            default: "active"
        },

        studentProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student"
        },

        PRN: {
            type: String,
            trim: true
        },

        // Invigilator specific examination and hall duties
        assignedExam: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam"
        },

        assignedHall: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hall"
        },

        // Invigilator time-limited password setup token
        invitationToken: {
            type: String,
            default: null,
            index: true
        },

        invitationTokenExpires: {
            type: Date,
            default: null
        },

        isInvitationUsed: {
            type: Boolean,
            default: false
        },

        mustChangePassword: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }

);

// Normalize role to lowercase before saving
userSchema.pre("save", function () {
    if (this.role) {
        this.role = this.role.toLowerCase();
    }
    if (!this.username) {
        this.username = this.PRN || this.email;
    }
});


module.exports = mongoose.model("User", userSchema);