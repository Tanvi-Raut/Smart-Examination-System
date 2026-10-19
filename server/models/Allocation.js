const mongoose = require("mongoose");

const allocationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        exam: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },

        hall: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hall",
            required: true
        },

        seat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seat",
            required: true
        },

        status: {
            type: String,
            default: "Allocated"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Allocation", allocationSchema);