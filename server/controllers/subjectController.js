const Subject = require("../models/Subject");

// @desc    Get all subjects
// @route   GET /api/subjects
// @access  Private
const getSubjects = async (req, res) => {
    try {
        const { semester } = req.query;
        const filter = {};
        if (semester) filter.semester = Number(semester);

        const subjects = await Subject.find(filter)
            .populate("branches", "branchCode branchName")
            .sort({ subjectCode: 1 });
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single subject
// @route   GET /api/subjects/:id
// @access  Private
const getSubjectById = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id).populate("branches", "branchCode branchName");
        if (!subject) return res.status(404).json({ message: "Subject not found" });
        res.json(subject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create subject
// @route   POST /api/subjects
// @access  Private/Admin
const createSubject = async (req, res) => {
    try {
        const { subjectCode, subjectName, semester, branches } = req.body;

        const exists = await Subject.findOne({ subjectCode });
        if (exists) return res.status(400).json({ message: "Subject code already exists" });

        const subject = await Subject.create({ subjectCode, subjectName, semester, branches });
        const populated = await subject.populate("branches", "branchCode branchName");
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
const updateSubject = async (req, res) => {
    try {
        const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate("branches", "branchCode branchName");

        if (!subject) return res.status(404).json({ message: "Subject not found" });
        res.json(subject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
const deleteSubject = async (req, res) => {
    try {
        const subject = await Subject.findByIdAndDelete(req.params.id);
        if (!subject) return res.status(404).json({ message: "Subject not found" });
        res.json({ message: "Subject deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
