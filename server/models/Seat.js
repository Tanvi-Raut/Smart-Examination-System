const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema({
    hall: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hall",
        required: true
    },

    seatNumber: {
        type: String,
        required: true
    },

    row: {
        type: Number,
        required: true
    },

    column: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model("Seat", seatSchema);