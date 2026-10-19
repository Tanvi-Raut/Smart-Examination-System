const Attendance = require("../models/Attendance");
const Allocation = require("../models/Allocation");
const Student = require("../models/Student");
const Exam = require("../models/Exam");
const Hall = require("../models/Hall");
const Seat = require("../models/Seat");

// @desc    Verify Scanned QR Code
// @route   POST /api/attendance/verify-qr
// @access  Private (Invigilator / Admin)
const verifyQRCode = async (req, res) => {
    try {
        const { qrData, activeExamId, activeHallId } = req.body;

        if (!qrData) {
            return res.status(400).json({ valid: false, message: "No QR code data provided." });
        }

        const activeExamObj = activeExamId ? await Exam.findById(activeExamId).populate("subject") : null;

        let parsed = null;
        let rawText = "";

        if (typeof qrData === "object" && qrData !== null) {
            parsed = qrData;
        } else if (typeof qrData === "string") {
            rawText = qrData.trim();
            try {
                parsed = JSON.parse(rawText);
            } catch {
                parsed = null;
            }
        } else if (typeof qrData === "number") {
            rawText = qrData.toString();
        }

        // Extract possible identifiers
        const allocationIdCandidate = parsed?.allocationId || parsed?.aid || (rawText && /^[0-9a-fA-F]{24}$/.test(rawText) ? rawText : null);
        const studentIdCandidate = parsed?.studentId || parsed?.student?._id;
        
        let prnCandidate = parsed?.student?.PRN || parsed?.PRN || parsed?.prn;
        if (!prnCandidate && rawText) {
            // Check for PRN pattern like 23005081 or PRN: 23005081
            const prnMatch = rawText.match(/\b(2\d{7})\b/) || rawText.match(/PRN[:\s\-]+([A-Za-z0-9]+)/i);
            if (prnMatch) {
                prnCandidate = prnMatch[1];
            } else if (/^\d{6,10}$/.test(rawText)) {
                prnCandidate = rawText;
            }
        }

        let allocation = null;

        // Strategy 1: Find by Allocation ID
        if (allocationIdCandidate) {
            allocation = await Allocation.findById(allocationIdCandidate)
                .populate({
                    path: "student",
                    populate: [
                        { path: "branch", select: "branchCode branchName" },
                        { path: "registeredSubjects", select: "subjectCode subjectName semester" }
                    ]
                })
                .populate({ path: "exam", populate: { path: "subject" } })
                .populate("hall")
                .populate("seat");
        }

        // Strategy 2: Find by studentId + examId
        if (!allocation && studentIdCandidate && (parsed?.examId || activeExamId)) {
            const targetExamId = parsed?.examId || activeExamId;
            allocation = await Allocation.findOne({ student: studentIdCandidate, exam: targetExamId })
                .populate({
                    path: "student",
                    populate: [
                        { path: "branch", select: "branchCode branchName" },
                        { path: "registeredSubjects", select: "subjectCode subjectName semester" }
                    ]
                })
                .populate({ path: "exam", populate: { path: "subject" } })
                .populate("hall")
                .populate("seat");
        }

        // Strategy 3: Find by PRN or raw text matching Student
        let matchedStudent = null;
        if (!allocation) {
            if (prnCandidate) {
                matchedStudent = await Student.findOne({ PRN: prnCandidate })
                    .populate("branch", "branchCode branchName")
                    .populate("registeredSubjects", "subjectCode subjectName semester");
            }

            if (!matchedStudent && rawText) {
                matchedStudent = await Student.findOne({
                    $or: [
                        { PRN: rawText },
                        { rollNumber: rawText },
                        { collegeId: rawText }
                    ]
                })
                .populate("branch", "branchCode branchName")
                .populate("registeredSubjects", "subjectCode subjectName semester");
            }

            if (matchedStudent) {
                // If active exam specified, look for allocation in that exam first
                if (activeExamId) {
                    allocation = await Allocation.findOne({ student: matchedStudent._id, exam: activeExamId })
                        .populate({
                            path: "student",
                            populate: [
                                { path: "branch", select: "branchCode branchName" },
                                { path: "registeredSubjects", select: "subjectCode subjectName semester" }
                            ]
                        })
                        .populate({ path: "exam", populate: { path: "subject" } })
                        .populate("hall")
                        .populate("seat");
                }

                // If still not found in activeExamId, check if student has ANY allocation
                if (!allocation) {
                    const anyAlloc = await Allocation.findOne({ student: matchedStudent._id })
                        .populate({
                            path: "student",
                            populate: [
                                { path: "branch", select: "branchCode branchName" },
                                { path: "registeredSubjects", select: "subjectCode subjectName semester" }
                            ]
                        })
                        .populate({ path: "exam", populate: { path: "subject" } })
                        .populate("hall")
                        .populate("seat");

                    if (anyAlloc) {
                        if (activeExamId && anyAlloc.exam?._id.toString() !== activeExamId.toString()) {
                            return res.status(400).json({
                                valid: false,
                                code: "EXAM_MISMATCH",
                                message: `Subject Mismatch! Candidate ${matchedStudent.name} (PRN: ${matchedStudent.PRN}) is assigned for '${anyAlloc.exam?.subject?.subjectName}' (${anyAlloc.exam?.subject?.subjectCode}), not the currently active examination '${activeExamObj?.subject?.subjectName || "Active Exam"}' (${activeExamObj?.subject?.subjectCode || "N/A"}). Both current scheduled exam and active exam must match.`,
                                student: matchedStudent,
                                isExamMatched: false,
                                candidateScheduledExam: {
                                    _id: anyAlloc.exam?._id,
                                    subjectCode: anyAlloc.exam?.subject?.subjectCode,
                                    subjectName: anyAlloc.exam?.subject?.subjectName,
                                    examDate: anyAlloc.exam?.examDate,
                                    startTime: anyAlloc.exam?.startTime,
                                    endTime: anyAlloc.exam?.endTime,
                                    hallNumber: anyAlloc.hall?.hallNumber,
                                    seatNumber: anyAlloc.seat?.seatNumber
                                },
                                activeProctoredExam: activeExamObj ? {
                                    _id: activeExamObj._id,
                                    subjectCode: activeExamObj.subject?.subjectCode,
                                    subjectName: activeExamObj.subject?.subjectName,
                                    examDate: activeExamObj.examDate,
                                    startTime: activeExamObj.startTime,
                                    endTime: activeExamObj.endTime
                                } : null,
                                examMatchDetails: {
                                    matched: false,
                                    candidateSubject: `${anyAlloc.exam?.subject?.subjectCode} - ${anyAlloc.exam?.subject?.subjectName}`,
                                    activeSubject: activeExamObj ? `${activeExamObj.subject?.subjectCode} - ${activeExamObj.subject?.subjectName}` : "Active Session",
                                    verdict: "MISMATCH: Candidate is not scheduled for this active examination paper. Both current scheduled exam and active exam must match."
                                },
                                allocationDetails: {
                                    subject: anyAlloc.exam?.subject?.subjectName,
                                    subjectCode: anyAlloc.exam?.subject?.subjectCode,
                                    date: anyAlloc.exam?.examDate,
                                    hall: anyAlloc.hall?.hallNumber,
                                    seat: anyAlloc.seat?.seatNumber
                                }
                            });
                        } else {
                            allocation = anyAlloc;
                        }
                    } else {
                        // Student exists but is not allocated (e.g. enrolled in Java, not DBMS)
                        return res.status(400).json({
                            valid: false,
                            code: "NO_ALLOCATION",
                            message: `Candidate ${matchedStudent.name} (PRN: ${matchedStudent.PRN}) is enrolled in ${matchedStudent.branch?.branchCode || "Engineering"}, but has no allocated seat for this exam. Registered subjects: ${matchedStudent.registeredSubjects?.map(s => `${s.subjectCode} - ${s.subjectName}`).join(", ") || "None"}.`,
                            student: matchedStudent,
                            isExamMatched: false,
                            activeProctoredExam: activeExamObj ? {
                                _id: activeExamObj._id,
                                subjectCode: activeExamObj.subject?.subjectCode,
                                subjectName: activeExamObj.subject?.subjectName,
                                examDate: activeExamObj.examDate,
                                startTime: activeExamObj.startTime,
                                endTime: activeExamObj.endTime
                            } : null,
                            examMatchDetails: {
                                matched: false,
                                candidateSubject: "None Allocated",
                                activeSubject: activeExamObj ? `${activeExamObj.subject?.subjectCode} - ${activeExamObj.subject?.subjectName}` : "Active Session",
                                verdict: "NO ALLOCATION: Candidate does not have an allocated seat for this active examination."
                            }
                        });
                    }
                }
            }
        }

        if (!allocation) {
            return res.status(404).json({
                valid: false,
                message: `No seating allocation found for candidate QR payload: "${rawText || prnCandidate || "Unknown"}". Ensure student has been allocated via Seating Allocation page.`
            });
        }

        // 1. Check Exam / Subject match
        if (activeExamId && allocation.exam?._id.toString() !== activeExamId.toString()) {
            return res.status(400).json({
                valid: false,
                code: "EXAM_MISMATCH",
                message: `Subject mismatch! Candidate ${allocation.student?.name} is scheduled for '${allocation.exam?.subject?.subjectName || "Another Subject"}' (${allocation.exam?.subject?.subjectCode}), not the currently active examination '${activeExamObj?.subject?.subjectName || "Active Exam"}' (${activeExamObj?.subject?.subjectCode || "N/A"}). Both current scheduled exam and active exam must match.`,
                student: allocation.student,
                isExamMatched: false,
                candidateScheduledExam: {
                    _id: allocation.exam._id,
                    subjectCode: allocation.exam.subject?.subjectCode,
                    subjectName: allocation.exam.subject?.subjectName,
                    examDate: allocation.exam.examDate,
                    startTime: allocation.exam.startTime,
                    endTime: allocation.exam.endTime,
                    hallNumber: allocation.hall?.hallNumber,
                    seatNumber: allocation.seat?.seatNumber
                },
                activeProctoredExam: activeExamObj ? {
                    _id: activeExamObj._id,
                    subjectCode: activeExamObj.subject?.subjectCode,
                    subjectName: activeExamObj.subject?.subjectName,
                    examDate: activeExamObj.examDate,
                    startTime: activeExamObj.startTime,
                    endTime: activeExamObj.endTime
                } : null,
                examMatchDetails: {
                    matched: false,
                    candidateSubject: `${allocation.exam?.subject?.subjectCode} - ${allocation.exam?.subject?.subjectName}`,
                    activeSubject: activeExamObj ? `${activeExamObj.subject?.subjectCode} - ${activeExamObj.subject?.subjectName}` : "Active Session",
                    verdict: "MISMATCH: Candidate is not scheduled for this active examination paper. Both current scheduled exam and active exam must match."
                },
                allocationDetails: {
                    subject: allocation.exam?.subject?.subjectName,
                    subjectCode: allocation.exam?.subject?.subjectCode,
                    date: allocation.exam?.examDate,
                    hall: allocation.hall?.hallNumber,
                    seat: allocation.seat?.seatNumber
                }
            });
        }

        // 2. Check Hall match
        let hallWarning = null;
        if (activeHallId && allocation.hall?._id.toString() !== activeHallId.toString()) {
            hallWarning = `Wrong Hall! ${allocation.student?.name} is assigned to ${allocation.hall?.hallNumber} (Desk ${allocation.seat?.seatNumber}), not this proctored hall.`;
        }

        // 3. Check existing attendance record
        const existingAttendance = await Attendance.findOne({
            exam: allocation.exam._id,
            student: allocation.student._id
        });

        // 4. Fetch all allocations and recorded attendances for this student to know every subject they must present for
        const studentAllocations = await Allocation.find({ student: allocation.student._id })
            .populate({ path: "exam", populate: { path: "subject" } })
            .populate("hall")
            .populate("seat")
            .sort({ "exam.examDate": 1 });

        const studentAttendances = await Attendance.find({ student: allocation.student._id })
            .populate({ path: "exam", populate: { path: "subject" } });

        const allSubjectAttendances = studentAllocations.map((allocItem) => {
            const att = studentAttendances.find((a) => a.exam?._id?.toString() === allocItem.exam?._id?.toString());
            const isCurrentExam = allocItem.exam?._id?.toString() === allocation.exam?._id?.toString();
            return {
                examId: allocItem.exam?._id,
                allocationId: allocItem._id,
                subjectCode: allocItem.exam?.subject?.subjectCode || "N/A",
                subjectName: allocItem.exam?.subject?.subjectName || "Examination Paper",
                semester: allocItem.exam?.semester || allocItem.exam?.subject?.semester,
                examDate: allocItem.exam?.examDate,
                startTime: allocItem.exam?.startTime,
                endTime: allocItem.exam?.endTime,
                hallNumber: allocItem.hall?.hallNumber,
                seatNumber: allocItem.seat?.seatNumber,
                status: att ? att.status : (isCurrentExam && existingAttendance ? existingAttendance.status : "Pending"),
                verifiedAt: att ? att.verifiedAt : null,
                invigilatorName: att ? att.invigilatorName : null,
                verificationMethod: att ? att.verificationMethod : null,
                remarks: att ? att.remarks : "",
                isCurrentExam
            };
        });

        res.json({
            valid: true,
            isExamMatched: true,
            examMatchStatus: "MATCHED",
            examMatchDetails: {
                matched: true,
                candidateSubject: `${allocation.exam.subject?.subjectCode || "N/A"} - ${allocation.exam.subject?.subjectName || "Subject"}`,
                activeSubject: `${activeExamObj?.subject?.subjectCode || allocation.exam.subject?.subjectCode} - ${activeExamObj?.subject?.subjectName || allocation.exam.subject?.subjectName}`,
                verdict: "MATCH CONFIRMED: Both current scheduled exam and active proctored examination match perfectly."
            },
            candidateScheduledExam: {
                _id: allocation.exam._id,
                subjectCode: allocation.exam.subject?.subjectCode,
                subjectName: allocation.exam.subject?.subjectName,
                examDate: allocation.exam.examDate,
                startTime: allocation.exam.startTime,
                endTime: allocation.exam.endTime,
                hallNumber: allocation.hall?.hallNumber,
                seatNumber: allocation.seat?.seatNumber
            },
            activeProctoredExam: {
                _id: activeExamObj?._id || allocation.exam._id,
                subjectCode: activeExamObj?.subject?.subjectCode || allocation.exam.subject?.subjectCode,
                subjectName: activeExamObj?.subject?.subjectName || allocation.exam.subject?.subjectName,
                examDate: activeExamObj?.examDate || allocation.exam.examDate,
                startTime: activeExamObj?.startTime || allocation.exam.startTime,
                endTime: activeExamObj?.endTime || allocation.exam.endTime
            },
            allocationId: allocation._id,
            student: {
                _id: allocation.student._id,
                name: allocation.student.name,
                PRN: allocation.student.PRN,
                rollNumber: allocation.student.rollNumber,
                collegeId: allocation.student.collegeId || allocation.student.PRN,
                branch: allocation.student.branch,
                photo: allocation.student.photo,
                semester: allocation.student.semester,
                division: allocation.student.division,
                email: allocation.student.email,
                registeredSubjects: allocation.student.registeredSubjects || []
            },
            exam: {
                _id: allocation.exam._id,
                subjectName: allocation.exam.subject?.subjectName,
                subjectCode: allocation.exam.subject?.subjectCode,
                examDate: allocation.exam.examDate,
                startTime: allocation.exam.startTime,
                endTime: allocation.exam.endTime,
                semester: allocation.exam.semester
            },
            hall: {
                _id: allocation.hall._id,
                hallNumber: allocation.hall.hallNumber,
                building: allocation.hall.building,
                floor: allocation.hall.floor
            },
            seat: {
                _id: allocation.seat._id,
                seatNumber: allocation.seat.seatNumber,
                row: allocation.seat.row,
                column: allocation.seat.column
            },
            hallWarning,
            isAlreadyMarked: !!existingAttendance,
            currentStatus: existingAttendance ? existingAttendance.status : "Pending",
            existingAttendance,
            allSubjectAttendances
        });
    } catch (error) {
        res.status(500).json({ valid: false, message: error.message });
    }
};

// @desc    Record or Update Attendance
// @route   POST /api/attendance/mark
// @access  Private (Invigilator / Admin)
const markAttendance = async (req, res) => {
    try {
        const {
            examId,
            studentId,
            hallId,
            seatId,
            allocationId,
            status = "Present",
            verificationMethod = "QR_SCAN",
            remarks = "",
            photoVerified = true
        } = req.body;

        let targetExamId = examId;
        let targetStudentId = studentId;
        let targetHallId = hallId;
        let targetSeatId = seatId;

        if (allocationId && (!targetExamId || !targetStudentId || !targetHallId || !targetSeatId)) {
            const alloc = await Allocation.findById(allocationId);
            if (alloc) {
                if (!targetExamId) targetExamId = alloc.exam;
                if (!targetStudentId) targetStudentId = alloc.student;
                if (!targetHallId) targetHallId = alloc.hall;
                if (!targetSeatId) targetSeatId = alloc.seat;
            }
        }

        if (!targetExamId || !targetStudentId) {
            return res.status(400).json({ message: "Missing required examId or studentId" });
        }

        if (status !== "Invalid" && (!targetHallId || !targetSeatId)) {
            return res.status(400).json({ message: "Missing hallId or seatId for valid attendance status" });
        }

        const updateData = {
            exam: targetExamId,
            student: targetStudentId,
            status,
            verifiedAt: new Date(),
            verifiedBy: req.user?._id,
            invigilatorName: req.user?.name || "Exam Invigilator",
            verificationMethod,
            photoVerified,
            remarks: remarks || (status === "Invalid" ? "Barred / Invalid Candidate Attempt" : "")
        };

        if (targetHallId) updateData.hall = targetHallId;
        if (targetSeatId) updateData.seat = targetSeatId;
        if (allocationId) updateData.allocation = allocationId;

        const attendance = await Attendance.findOneAndUpdate(
            { exam: targetExamId, student: targetStudentId },
            updateData,
            { upsert: true, returnDocument: 'after', runValidators: true }
        ).populate("student", "name PRN rollNumber photo");

        res.status(200).json({
            message: `Attendance marked as ${status}`,
            attendance
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Sync Offline Recorded Attendances (IndexedDB -> Server)
// @route   POST /api/attendance/sync-offline
// @access  Private (Invigilator / Admin)
const syncOfflineAttendances = async (req, res) => {
    try {
        const { records } = req.body;

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: "No records to sync" });
        }

        let syncedCount = 0;
        const errors = [];

        for (const item of records) {
            try {
                await Attendance.findOneAndUpdate(
                    { exam: item.examId, student: item.studentId },
                    {
                        exam: item.examId,
                        student: item.studentId,
                        hall: item.hallId,
                        seat: item.seatId,
                        allocation: item.allocationId,
                        status: item.status || "Present",
                        verifiedAt: new Date(),
                        verifiedBy: req.user?._id,
                        invigilatorName: req.user?.name || "Offline Invigilator",
                        verificationMethod: "OFFLINE_SYNC",
                        photoVerified: item.photoVerified !== false,
                        isOfflineSync: true,
                        offlineRecordedAt: item.recordedAt ? new Date(item.recordedAt) : new Date(),
                        remarks: item.remarks ? `[Offline Sync] ${item.remarks}` : "[Offline Sync]"
                    },
                    { upsert: true, new: true }
                );
                syncedCount++;
            } catch (err) {
                errors.push({ studentId: item.studentId, error: err.message });
            }
        }

        res.json({
            message: `Successfully synchronized ${syncedCount} offline attendance records`,
            syncedCount,
            totalSubmitted: records.length,
            errors
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Hall Attendance Roster (for invigilator view & offline caching)
// @route   GET /api/attendance/hall-roster/:examId/:hallId
// @access  Private
const getHallAttendanceRoster = async (req, res) => {
    try {
        const { examId, hallId } = req.params;

        // 1. Get all allocations for this hall and exam with exam and subject populated
        const allocations = await Allocation.find({ exam: examId, hall: hallId })
            .populate({
                path: "student",
                populate: [
                    { path: "branch", select: "branchCode branchName" },
                    { path: "registeredSubjects", select: "subjectCode subjectName" }
                ]
            })
            .populate({ path: "exam", populate: { path: "subject", select: "subjectCode subjectName semester" } })
            .populate("seat")
            .sort({ "seat.row": 1, "seat.column": 1 });

        // 2. Get any recorded attendance for this exam and hall
        const attendances = await Attendance.find({ exam: examId, hall: hallId });
        const attendanceMap = new Map();
        for (const att of attendances) {
            attendanceMap.set(att.student.toString(), att);
        }

        // 3. Merge data (filtering out any orphaned allocations where student was deleted)
        const validAllocations = allocations.filter(alloc => Boolean(alloc.student));
        const roster = validAllocations.map((alloc) => {
            const att = alloc.student ? attendanceMap.get(alloc.student._id.toString()) : null;
            return {
                allocationId: alloc._id,
                student: alloc.student,
                seat: alloc.seat,
                subject: alloc.exam?.subject ? {
                    subjectCode: alloc.exam.subject.subjectCode,
                    subjectName: alloc.exam.subject.subjectName,
                    semester: alloc.exam.subject.semester
                } : null,
                exam: alloc.exam ? {
                    _id: alloc.exam._id,
                    startTime: alloc.exam.startTime,
                    endTime: alloc.exam.endTime,
                    examDate: alloc.exam.examDate
                } : null,
                status: att ? att.status : "Pending",
                verifiedAt: att ? att.verifiedAt : null,
                verificationMethod: att ? att.verificationMethod : null,
                isOfflineSync: att ? att.isOfflineSync : false,
                remarks: att ? att.remarks : ""
            };
        });

        // 4. Fetch the exam subject details for high-level summary
        const currentExam = allocations[0]?.exam || await Exam.findById(examId).populate("subject");

        res.json({
            examInfo: currentExam ? {
                subjectCode: currentExam.subject?.subjectCode,
                subjectName: currentExam.subject?.subjectName,
                startTime: currentExam.startTime,
                endTime: currentExam.endTime,
                examDate: currentExam.examDate,
                semester: currentExam.semester
            } : null,
            totalAllocated: allocations.length,
            markedPresent: roster.filter((r) => r.status === "Present").length,
            markedAbsent: roster.filter((r) => r.status === "Absent").length,
            flagged: roster.filter((r) => r.status === "Malpractice Flagged").length,
            markedInvalid: roster.filter((r) => r.status === "Invalid").length,
            pending: roster.filter((r) => r.status === "Pending").length,
            roster
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate Attendance and Examination Reports
// @route   GET /api/attendance/report/:examId
// @access  Private
const getExamAttendanceReport = async (req, res) => {
    try {
        const { examId } = req.params;

        const exam = await Exam.findById(examId)
            .populate({ path: "subject", populate: { path: "branches" } });

        if (!exam) return res.status(404).json({ message: "Exam not found" });

        // All allocations
        const allocations = await Allocation.find({ exam: examId })
            .populate({ path: "student", populate: { path: "branch", select: "branchCode branchName" } })
            .populate("hall")
            .populate("seat")
            .sort({ "hall.hallNumber": 1, "seat.seatNumber": 1 });

        // All attendances
        const attendances = await Attendance.find({ exam: examId });
        const attMap = new Map();
        for (const a of attendances) {
            attMap.set(a.student.toString(), a);
        }

        // Summary stats
        let presentCount = 0;
        let absentCount = 0;
        let flaggedCount = 0;
        let pendingCount = 0;

        // Group by Hall
        const hallMap = {};
        // Group by Branch
        const branchMap = {};

        const detailedList = allocations.map((alloc) => {
            const att = alloc.student ? attMap.get(alloc.student._id.toString()) : null;
            const status = att ? att.status : "Absent (Not Marked)";

            if (status === "Present") presentCount++;
            else if (status === "Malpractice Flagged") flaggedCount++;
            else if (status === "Absent") absentCount++;
            else pendingCount++;

            // Hall stats
            const hallName = alloc.hall ? alloc.hall.hallNumber : "Unassigned";
            if (!hallMap[hallName]) {
                hallMap[hallName] = { hallNumber: hallName, total: 0, present: 0, absent: 0, flagged: 0 };
            }
            hallMap[hallName].total++;
            if (status === "Present") hallMap[hallName].present++;
            else if (status === "Malpractice Flagged") hallMap[hallName].flagged++;
            else hallMap[hallName].absent++;

            // Branch stats
            const branchName = alloc.student?.branch?.branchName || "Unknown";
            if (!branchMap[branchName]) {
                branchMap[branchName] = { branchName, total: 0, present: 0, absent: 0 };
            }
            branchMap[branchName].total++;
            if (status === "Present") branchMap[branchName].present++;
            else branchMap[branchName].absent++;

            return {
                studentName: alloc.student?.name,
                PRN: alloc.student?.PRN,
                rollNumber: alloc.student?.rollNumber,
                branch: alloc.student?.branch?.branchName,
                hall: alloc.hall?.hallNumber,
                seat: alloc.seat?.seatNumber,
                status,
                verifiedAt: att?.verifiedAt || null,
                method: att?.verificationMethod || "None",
                isOfflineSync: att?.isOfflineSync || false,
                remarks: att?.remarks || ""
            };
        });

        const totalAllocated = allocations.length;
        const totalPresent = presentCount;
        const attendanceRate = totalAllocated > 0 ? ((totalPresent / totalAllocated) * 100).toFixed(1) : 0;

        res.json({
            exam: {
                _id: exam._id,
                subjectName: exam.subject?.subjectName,
                subjectCode: exam.subject?.subjectCode,
                examDate: exam.examDate,
                startTime: exam.startTime,
                endTime: exam.endTime,
                semester: exam.semester,
                status: exam.status
            },
            summary: {
                totalAllocated,
                presentCount,
                absentCount: absentCount + pendingCount,
                flaggedCount,
                attendanceRate: `${attendanceRate}%`
            },
            hallBreakdown: Object.values(hallMap),
            branchBreakdown: Object.values(branchMap),
            students: detailedList
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    verifyQRCode,
    markAttendance,
    syncOfflineAttendances,
    getHallAttendanceRoster,
    getExamAttendanceReport
};
