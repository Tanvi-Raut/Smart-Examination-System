const Allocation = require("../models/Allocation");
const Exam = require("../models/Exam");
const Student = require("../models/Student");
const Hall = require("../models/Hall");
const Seat = require("../models/Seat");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const QRCode = require("qrcode");
const { allocateSeats } = require("../utils/seatingAlgorithm");

// @desc    Get all allocations for an exam
// @route   GET /api/allocations/exam/:examId
// @access  Private
const getAllocationsByExam = async (req, res) => {
    try {
        const allocations = await Allocation.find({ exam: req.params.examId })
            .populate({
                path: "student",
                select: "name PRN rollNumber branch photo semester registeredSubjects",
                populate: { path: "branch", select: "branchCode branchName" }
            })
            .populate("hall", "hallNumber building floor")
            .populate("seat", "seatNumber row column")
            .sort({ "hall.hallNumber": 1, "seat.row": 1, "seat.column": 1 });

        // Auto-purge any orphaned allocations where the student document no longer exists
        const orphaned = allocations.filter((a) => !a.student);
        if (orphaned.length > 0) {
            const orphanedIds = orphaned.map((a) => a._id);
            await Allocation.deleteMany({ _id: { $in: orphanedIds } });
            await Attendance.deleteMany({ allocation: { $in: orphanedIds } });
        }

        const validAllocations = allocations.filter((a) => Boolean(a.student));
        res.json(validAllocations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get allocation for a specific student in an exam
// @route   GET /api/allocations/student/:studentId/exam/:examId
// @access  Private
const getStudentAllocation = async (req, res) => {
    try {
        const allocation = await Allocation.findOne({
            student: req.params.studentId,
            exam: req.params.examId
        })
            .populate("student", "name PRN rollNumber branch photo semester")
            .populate("exam")
            .populate("hall", "hallNumber building floor")
            .populate("seat", "seatNumber row column");

        if (!allocation) return res.status(404).json({ message: "Allocation not found" });
        res.json(allocation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get complete Hall Ticket for a student (with QR codes for each subject)
// @route   GET /api/allocations/hall-ticket/:identifier
// @access  Public or Private (students or admin)
const getStudentHallTicket = async (req, res) => {
    try {
        const { identifier } = req.params;

        let student = null;
        if (require("mongoose").Types.ObjectId.isValid(identifier)) {
            student = await Student.findById(identifier)
                .populate("branch")
                .populate("registeredSubjects", "subjectCode subjectName semester");
        }
        if (!student) {
            student = await Student.findOne({
                $or: [
                    { PRN: identifier },
                    { PRN: { $regex: new RegExp(`^${identifier}$`, "i") } },
                    { email: String(identifier).toLowerCase() }
                ]
            })
                .populate("branch")
                .populate("registeredSubjects", "subjectCode subjectName semester");
        }

        if (!student) {
            return res.status(404).json({ message: "Student not found with PRN / ID: " + identifier });
        }

        const allocations = await Allocation.find({ student: student._id })
            .populate({
                path: "exam",
                populate: { path: "subject" }
            })
            .populate("hall")
            .populate("seat")
            .sort({ "exam.examDate": 1 });

        // Fetch recorded attendances for this student to know whether they presented for each subject
        const attendances = await Attendance.find({ student: student._id });
        const attMap = new Map();
        for (const att of attendances) {
            if (att.exam) {
                attMap.set(att.exam.toString(), att);
            }
        }

        const crypto = require("crypto");

        const scheduleWithQRs = await Promise.all(
            allocations.map(async (alloc) => {
                const signature = crypto.createHmac("sha256", process.env.JWT_SECRET || "smart_exam_secret")
                    .update(`${alloc.student._id}:${alloc.exam._id}:${alloc.exam?.subject?.subjectCode}:${alloc.seat?.seatNumber}`)
                    .digest("hex").substring(0, 16);

                const qrPayload = JSON.stringify({
                    allocationId: alloc._id,
                    studentId: alloc.student._id,
                    examId: alloc.exam?._id,
                    sig: signature,
                    prn: student.PRN,
                    sub: alloc.exam?.subject?.subjectCode || "EXAM"
                });

                const qrCode = await QRCode.toDataURL(qrPayload, {
                    width: 320,
                    margin: 3,
                    errorCorrectionLevel: "M",
                    color: { dark: "#000000", light: "#ffffff" }
                });

                const attRecord = alloc.exam ? attMap.get(alloc.exam._id.toString()) : null;

                return {
                    allocationId: alloc._id,
                    exam: alloc.exam,
                    hall: alloc.hall,
                    seat: alloc.seat,
                    qrCode,
                    qrPayload,
                    attendance: attRecord ? {
                        status: attRecord.status,
                        verifiedAt: attRecord.verifiedAt,
                        invigilatorName: attRecord.invigilatorName,
                        verificationMethod: attRecord.verificationMethod,
                        remarks: attRecord.remarks
                    } : {
                        status: "Pending",
                        verifiedAt: null
                    }
                };
            })
        );

        const isEnrolled = Boolean(student.registeredSubjects && student.registeredSubjects.length > 0);
        const hasAllocations = Boolean(scheduleWithQRs && scheduleWithQRs.length > 0);
        const hallTicketGenerated = isEnrolled && hasAllocations;

        let status = "GENERATED";
        let message = "Official hall ticket and subject QR tokens generated successfully.";

        if (!isEnrolled) {
            status = "NOT_ENROLLED";
            message = `Candidate ${student.name} (PRN: ${student.PRN}) is not enrolled for any subject. Hall ticket cannot be generated.`;
        } else if (!hasAllocations) {
            status = "NO_ALLOCATIONS";
            message = `Candidate ${student.name} (PRN: ${student.PRN}) has no examination seating allocations scheduled. Hall ticket cannot be generated until exam seating allocation is completed.`;
        }

        if (req.query.requireGenerated === "true" && !hallTicketGenerated) {
            return res.status(400).json({
                message,
                student,
                allocations: scheduleWithQRs,
                isEnrolled,
                hasAllocations,
                hallTicketGenerated: false,
                status
            });
        }

        res.json({
            student,
            allocations: scheduleWithQRs,
            isEnrolled,
            hasAllocations,
            hallTicketGenerated,
            status,
            message
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student eligibility analysis for an exam (before allocation)
// @route   GET /api/allocations/eligibility/:examId
// @access  Private
const getExamEligibility = async (req, res) => {
    try {
        const { examId } = req.params;
        const exam = await Exam.findById(examId).populate({
            path: "subject",
            populate: { path: "branches" }
        });
        if (!exam) return res.status(404).json({ message: "Exam not found" });

        const eligibleBranchIds = exam.subject.branches.map((b) => b._id.toString());

        const allStudents = await Student.find()
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester");

        const eligibleStudents = [];
        const ineligibleStudents = [];

        for (const student of allStudents) {
            const studentBranchId = student.branch?._id ? student.branch._id.toString() : student.branch?.toString();
            const branchMatches = eligibleBranchIds.includes(studentBranchId);
            const semesterMatches = student.semester === exam.semester;

            let subjectRegistered = false;
            if (student.registeredSubjects && student.registeredSubjects.length > 0) {
                subjectRegistered = student.registeredSubjects.some((s) =>
                    (s._id ? s._id.toString() : s.toString()) === exam.subject._id.toString()
                );
            } else {
                subjectRegistered = branchMatches && semesterMatches;
            }

            if (branchMatches && semesterMatches && subjectRegistered) {
                eligibleStudents.push({
                    _id: student._id,
                    name: student.name,
                    PRN: student.PRN,
                    rollNumber: student.rollNumber,
                    branch: student.branch?.branchCode || "N/A",
                    semester: student.semester,
                    photo: student.photo,
                    subject: exam.subject.subjectName
                });
            } else {
                let reason = [];
                if (!semesterMatches) reason.push(`Semester ${student.semester} (Exam is Sem ${exam.semester})`);
                if (!branchMatches) reason.push(`Branch ${student.branch?.branchCode || 'N/A'} not eligible`);
                if (!subjectRegistered) reason.push(`Not registered for ${exam.subject.subjectName}`);

                ineligibleStudents.push({
                    _id: student._id,
                    name: student.name,
                    PRN: student.PRN,
                    branch: student.branch?.branchCode || "N/A",
                    semester: student.semester,
                    reasons: reason
                });
            }
        }

        res.json({
            exam: {
                _id: exam._id,
                subjectCode: exam.subject.subjectCode,
                subjectName: exam.subject.subjectName,
                semester: exam.semester,
                eligibleBranches: exam.subject.branches.map((b) => b.branchCode)
            },
            eligibleCount: eligibleStudents.length,
            ineligibleCount: ineligibleStudents.length,
            eligibleStudents,
            ineligibleStudents
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Run automated seating allocation for an exam following the 5-step algorithm:
//          Step 1: Select Examination
//          Step 2: Match Student Eligibility (Branch + Semester + Registered Subject)
//          Step 3: Check Hall Availability (Capacity, timing, available seats)
//          Step 4: Allocate Unique Seats (One student per seat, anti-cheating branch mix)
//          Step 5: Save and Publish to MongoDB for Hall Tickets & QR verification
// @route   POST /api/allocations/generate
// @access  Private/Admin
const generateAllocation = async (req, res) => {
    try {
        const { examId, hallIds, strategy = "branch-mix" } = req.body;

        if (!examId || !hallIds || hallIds.length === 0) {
            return res.status(400).json({ message: "Exam ID and at least one Hall ID are required." });
        }

        // ================= STEP 1: Select the Examination =================
        const exam = await Exam.findById(examId).populate({
            path: "subject",
            populate: { path: "branches" }
        });
        if (!exam) return res.status(404).json({ message: "Examination record not found." });

        const eligibleBranchIds = exam.subject.branches.map((b) => b._id.toString());

        // ================= STEP 2: Match Student Eligibility =================
        // Criteria: Branch + Semester + Registered Subject
        // (Important: Registered subject is the final check! Two students from same branch may have different subjects)
        const allStudents = await Student.find()
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester");

        const eligibleStudents = [];
        const excludedStudents = [];

        for (const student of allStudents) {
            const studentBranchId = student.branch?._id ? student.branch._id.toString() : student.branch?.toString();
            const branchMatches = eligibleBranchIds.includes(studentBranchId);
            const semesterMatches = student.semester === exam.semester;

            // Subject registration check
            let subjectRegistered = false;
            if (student.registeredSubjects && student.registeredSubjects.length > 0) {
                subjectRegistered = student.registeredSubjects.some((s) =>
                    (s._id ? s._id.toString() : s.toString()) === exam.subject._id.toString()
                );
            } else {
                subjectRegistered = branchMatches && semesterMatches;
            }

            if (branchMatches && semesterMatches && subjectRegistered) {
                eligibleStudents.push(student);
            } else {
                let reason = "Ineligible for this examination";
                if (!semesterMatches) {
                    reason = `Semester mismatch: Student in Sem ${student.semester}, Exam is for Sem ${exam.semester}`;
                } else if (!branchMatches) {
                    reason = `Branch mismatch: Student in ${student.branch?.branchCode || 'N/A'}, Exam is for ${exam.subject.branches.map(b => b.branchCode).join(', ')}`;
                } else if (!subjectRegistered) {
                    reason = `Subject mismatch: Student is not registered for ${exam.subject.subjectName} (${exam.subject.subjectCode})`;
                }

                excludedStudents.push({
                    name: student.name,
                    PRN: student.PRN,
                    branch: student.branch?.branchCode || "N/A",
                    semester: student.semester,
                    reason
                });
            }
        }

        if (eligibleStudents.length === 0) {
            return res.status(400).json({
                message: `No eligible students found for ${exam.subject.subjectName} (${exam.subject.subjectCode}) in Semester ${exam.semester}. Verified branch eligibility and subject registrations.`,
                excludedCount: excludedStudents.length,
                excludedStudents: excludedStudents.slice(0, 5)
            });
        }

        // ================= STEP 3: Check Hall Availability =================
        // Capacity, exam timing and available seats
        const conflictingExams = await Exam.find({
            _id: { $ne: exam._id },
            examDate: exam.examDate,
            startTime: exam.startTime
        });
        const conflictingExamIds = conflictingExams.map((e) => e._id);

        const occupiedAllocations = await Allocation.find({ exam: { $in: conflictingExamIds } });
        const occupiedSeatIds = new Set(occupiedAllocations.map((a) => a.seat.toString()));

        // Fetch all seats in selected halls
        const allSeatsInHalls = await Seat.find({ hall: { $in: hallIds } })
            .populate("hall", "hallNumber building totalSeats")
            .sort({ hall: 1, row: 1, column: 1 });

        const availableSeats = allSeatsInHalls.filter((s) => !occupiedSeatIds.has(s._id.toString()));

        if (availableSeats.length < eligibleStudents.length) {
            return res.status(400).json({
                message: `Insufficient hall capacity: ${eligibleStudents.length} eligible students require seats, but only ${availableSeats.length} seats are available in the selected halls (${hallIds.length} halls). Please add more examination halls.`
            });
        }

        // ================= STEP 4: Allocate Unique Seats =================
        // One student per seat for each exam, applying branch-mixing anti-copying logic
        await Allocation.deleteMany({ exam: examId });

        const pairs = allocateSeats(eligibleStudents, availableSeats, strategy);

        // ================= STEP 5: Save and Publish to MongoDB =================
        const allocations = await Allocation.insertMany(
            pairs.map((p) => ({
                student: p.student,
                exam: examId,
                hall: p.hall,
                seat: p.seat,
                status: "Allocated"
            }))
        );

        // Branch breakdown statistics
        const branchBreakdown = {};
        for (const s of eligibleStudents) {
            const bName = s.branch?.branchCode || "Other";
            branchBreakdown[bName] = (branchBreakdown[bName] || 0) + 1;
        }

        res.status(201).json({
            message: `✅ Proper seating allocation completed for ${exam.subject.subjectName} (${exam.subject.subjectCode})!`,
            exam: {
                id: exam._id,
                subject: exam.subject.subjectName,
                subjectCode: exam.subject.subjectCode,
                semester: exam.semester
            },
            totalEligibleStudents: eligibleStudents.length,
            totalAllocated: allocations.length,
            branchBreakdown,
            hallsUsed: hallIds.length,
            excludedStudentsCount: excludedStudents.length,
            excludedStudentsPreview: excludedStudents.slice(0, 6)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete all allocations for an exam (to redo)
// @route   DELETE /api/allocations/exam/:examId
// @access  Private/Admin
const deleteAllocationsByExam = async (req, res) => {
    try {
        const result = await Allocation.deleteMany({ exam: req.params.examId });
        res.json({ message: `${result.deletedCount} allocations deleted` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate QR code for a student's seat allocation
// @route   GET /api/allocations/:id/qr
// @access  Private
const generateQRCode = async (req, res) => {
    try {
        const allocation = await Allocation.findById(req.params.id)
            .populate("student", "name PRN rollNumber")
            .populate("exam")
            .populate({ path: "exam", populate: { path: "subject", select: "subjectName subjectCode" } })
            .populate("hall", "hallNumber building floor")
            .populate("seat", "seatNumber row column");

        if (!allocation) return res.status(404).json({ message: "Allocation not found" });

        // Build QR payload with cryptographic binding
        const crypto = require("crypto");
        const signature = crypto.createHmac("sha256", process.env.JWT_SECRET || "smart_exam_secret")
            .update(`${allocation.student._id}:${allocation.exam._id}:${allocation.exam.subject?.subjectCode}:${allocation.seat.seatNumber}`)
            .digest("hex").substring(0, 16);

        const qrPayload = JSON.stringify({
            allocationId: allocation._id,
            studentId: allocation.student._id,
            examId: allocation.exam._id,
            sig: signature,
            prn: allocation.student.PRN,
            sub: allocation.exam.subject?.subjectCode || "EXAM"
        });

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            width: 320,
            margin: 3,
            errorCorrectionLevel: "M",
            color: { dark: "#000000", light: "#ffffff" }
        });

        res.json({
            allocation,
            qrCode: qrDataUrl // base64 PNG data URL
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get allocation summary for an exam (per hall)
// @route   GET /api/allocations/exam/:examId/summary
// @access  Private
const getAllocationSummary = async (req, res) => {
    try {
        const summary = await Allocation.aggregate([
            { $match: { exam: require("mongoose").Types.ObjectId.createFromHexString(req.params.examId) } },
            {
                $group: {
                    _id: "$hall",
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "halls",
                    localField: "_id",
                    foreignField: "_id",
                    as: "hallInfo"
                }
            },
            { $unwind: "$hallInfo" },
            {
                $project: {
                    hallNumber: "$hallInfo.hallNumber",
                    building: "$hallInfo.building",
                    totalSeats: "$hallInfo.totalSeats",
                    allocatedSeats: "$count"
                }
            }
        ]);

        const total = summary.reduce((acc, h) => acc + h.allocatedSeats, 0);
        res.json({ total, halls: summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a single seat allocation (free up seat)
// @route   DELETE /api/allocations/:id
// @access  Private/Admin
const deleteAllocation = async (req, res) => {
    try {
        const alloc = await Allocation.findById(req.params.id);
        if (!alloc) return res.status(404).json({ message: "Allocation not found" });

        await Allocation.findByIdAndDelete(req.params.id);
        await Attendance.deleteMany({ allocation: req.params.id });

        res.json({ message: "Seat allocation removed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllocationsByExam,
    getStudentAllocation,
    getStudentHallTicket,
    getExamEligibility,
    generateAllocation,
    deleteAllocationsByExam,
    deleteAllocation,
    generateQRCode,
    getAllocationSummary
};
