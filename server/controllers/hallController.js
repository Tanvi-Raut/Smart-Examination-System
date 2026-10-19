const Hall = require("../models/Hall");
const Seat = require("../models/Seat");
const Allocation = require("../models/Allocation");
const Attendance = require("../models/Attendance");

// @desc    Get all halls
// @route   GET /api/halls
// @access  Private
const getHalls = async (req, res) => {
    try {
        const halls = await Hall.find().sort({ hallNumber: 1 });
        res.json(halls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single hall with its seats
// @route   GET /api/halls/:id
// @access  Private
const getHallById = async (req, res) => {
    try {
        const hall = await Hall.findById(req.params.id);
        if (!hall) return res.status(404).json({ message: "Hall not found" });

        const seats = await Seat.find({ hall: hall._id }).sort({ row: 1, column: 1 });
        res.json({ hall, seats });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create hall
// @route   POST /api/halls
// @access  Private/Admin
const createHall = async (req, res) => {
    try {
        const { hallNumber, building, floor, totalSeats } = req.body;

        const exists = await Hall.findOne({ hallNumber });
        if (exists) return res.status(400).json({ message: "Hall number already exists" });

        const hall = await Hall.create({ hallNumber, building, floor, totalSeats });
        res.status(201).json(hall);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update hall
// @route   PUT /api/halls/:id
// @access  Private/Admin
const updateHall = async (req, res) => {
    try {
        const hall = await Hall.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!hall) return res.status(404).json({ message: "Hall not found" });
        res.json(hall);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete hall and its seats
// @route   DELETE /api/halls/:id
// @access  Private/Admin
const deleteHall = async (req, res) => {
    try {
        const hall = await Hall.findByIdAndDelete(req.params.id);
        if (!hall) return res.status(404).json({ message: "Hall not found" });

        await Seat.deleteMany({ hall: hall._id });
        await Allocation.deleteMany({ hall: hall._id });
        await Attendance.deleteMany({ hall: hall._id });

        res.json({ message: "Hall, seats, and associated allocations deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auto-generate seats for a hall (rows x columns)
// @route   POST /api/halls/:id/generate-seats
// @access  Private/Admin
const generateSeats = async (req, res) => {
    try {
        const hall = await Hall.findById(req.params.id);
        if (!hall) return res.status(404).json({ message: "Hall not found" });

        const { rows, columns } = req.body;
        if (!rows || !columns) {
            return res.status(400).json({ message: "Please provide rows and columns" });
        }

        // Delete existing seats and obsolete allocations for this hall
        await Seat.deleteMany({ hall: hall._id });
        await Allocation.deleteMany({ hall: hall._id });
        await Attendance.deleteMany({ hall: hall._id });

        const seats = [];
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= columns; c++) {
                seats.push({
                    hall: hall._id,
                    seatNumber: `R${r}C${c}`,
                    row: r,
                    column: c
                });
            }
        }

        const created = await Seat.insertMany(seats);

        // Update totalSeats in hall
        await Hall.findByIdAndUpdate(hall._id, { totalSeats: created.length });

        res.status(201).json({
            message: `${created.length} seats generated for Hall ${hall.hallNumber}`,
            totalSeats: created.length,
            seats: created
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get seat layout for a hall
// @route   GET /api/halls/:id/seats
// @access  Private
const getSeatLayout = async (req, res) => {
    try {
        const hall = await Hall.findById(req.params.id);
        if (!hall) return res.status(404).json({ message: "Hall not found" });

        const seats = await Seat.find({ hall: hall._id }).sort({ row: 1, column: 1 });
        res.json({ hall, seats });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getHalls, getHallById, createHall, updateHall, deleteHall, generateSeats, getSeatLayout };
