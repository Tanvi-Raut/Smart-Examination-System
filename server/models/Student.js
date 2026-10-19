const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        PRN: {
            type: String,
            required: true,
            unique: true
        },

        rollNumber: {
            type: String,
            required: true
        },

        branch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            required: true
        },

        year: {
            type: String,
            required: true
        },

        semester: {
            type: Number,
            required: true
        },

        division: {
            type: String
        },

        email: {
            type: String
        },

        photo: {
            type: String, // Cloudinary unique image URL
            default: ""
        },

        photoPublicId: {
            type: String, // Cloudinary public ID for managing and deleting image
            default: ""
        },

        collegeId: {
            type: String
        },

        registeredSubjects: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subject"
            }
        ],

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        isVerified: {
            type: Boolean,
            default: true
        },

        verificationStatus: {
            type: String,
            enum: ["verified", "pending_verification", "rejected"],
            default: "verified"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Student", studentSchema);