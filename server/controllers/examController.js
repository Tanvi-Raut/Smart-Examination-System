const Exam = require("../models/Exam");

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
const getExams = async (req, res) => {
    try {
        const { status, semester } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (semester) filter.semester = Number(semester);

        const exams = await Exam.find(filter)
            .populate("subject", "subjectCode subjectName semester branches")
            .sort({ examDate: 1 });
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single exam
// @route   GET /api/exams/:id
// @access  Private
const getExamById = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate({ path: "subject", populate: { path: "branches", select: "branchCode branchName" } });
        if (!exam) return res.status(404).json({ message: "Exam not found" });
        res.json(exam);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create exam
// @route   POST /api/exams
// @access  Private/Admin
const createExam = async (req, res) => {
    try {
        const { subject, examDate, startTime, endTime, semester } = req.body;

        const exam = await Exam.create({ subject, examDate, startTime, endTime, semester });
        const populated = await exam.populate("subject", "subjectCode subjectName");
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Private/Admin
const updateExam = async (req, res) => {
    try {
        const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate("subject", "subjectCode subjectName");

        if (!exam) return res.status(404).json({ message: "Exam not found" });
        res.json(exam);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private/Admin
const deleteExam = async (req, res) => {
    try {
        const exam = await Exam.findByIdAndDelete(req.params.id);
        if (!exam) return res.status(404).json({ message: "Exam not found" });
        res.json({ message: "Exam deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getExams, getExamById, createExam, updateExam, deleteExam };
