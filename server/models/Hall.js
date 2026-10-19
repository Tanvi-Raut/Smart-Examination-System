const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema(
    {
        hallNumber: {
            type: String,
            required: true,
            unique: true
        },

        building: {
            type: String
        },

        floor: {
            type: Number
        },

        totalSeats: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Hall", hallSchema);