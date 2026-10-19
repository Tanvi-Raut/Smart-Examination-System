const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        exam: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },
        hall: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hall",
            required: false
        },
        seat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seat",
            required: false
        },
        allocation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Allocation"
        },
        status: {
            type: String,
            enum: ["Present", "Absent", "Malpractice Flagged", "Invalid"],
            default: "Present"
        },
        verifiedAt: {
            type: Date,
            default: Date.now
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        invigilatorName: {
            type: String,
            default: "Hall Invigilator"
        },
        verificationMethod: {
            type: String,
            enum: ["QR_SCAN", "MANUAL", "OFFLINE_SYNC"],
            default: "QR_SCAN"
        },
        photoVerified: {
            type: Boolean,
            default: true
        },
        isOfflineSync: {
            type: Boolean,
            default: false
        },
        offlineRecordedAt: {
            type: Date
        },
        remarks: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate attendance for the same student in the same exam
attendanceSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
