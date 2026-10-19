const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
    branchCode: {
        type: String,
        required: true,
        unique: true
    },

    branchName: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Branch", branchSchema);