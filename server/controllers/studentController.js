const Student = require("../models/Student");
const User = require("../models/User");
const Branch = require("../models/Branch");
const Allocation = require("../models/Allocation");
const Attendance = require("../models/Attendance");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const path = require("path");
const { uploadStudentImage, deleteStudentImage } = require("../config/cloudinary");

// @desc    Get all students (with filters)
// @route   GET /api/students
// @access  Private
const getStudents = async (req, res) => {
    try {
        const { branch, year, semester, division, search, q } = req.query;
        const filter = {};
        if (branch) filter.branch = branch;
        if (year) filter.year = year;
        if (semester) filter.semester = Number(semester);
        if (division) filter.division = division;

        const queryTerm = (search || q || "").trim();
        if (queryTerm) {
            const regex = new RegExp(queryTerm, "i");
            filter.$or = [
                { name: regex },
                { PRN: regex },
                { rollNumber: regex },
                { email: regex },
                { collegeId: regex }
            ];
        }

        const students = await Student.find(filter)
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester")
            .populate("user", "email role accountStatus")
            .sort({ rollNumber: 1 });
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
const getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester")
            .populate("user", "email role accountStatus");
        if (!student) return res.status(404).json({ message: "Student not found" });
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create student & automatically provision User login account
// @route   POST /api/students
// @access  Private/Admin
const createStudent = async (req, res) => {
    try {
        const { name, PRN, rollNumber, branch, year, semester, division, email, collegeId, registeredSubjects, photo: photoBody } = req.body;

        const cleanPRN = String(PRN || "").trim();
        const exists = await Student.findOne({ PRN: cleanPRN });
        if (exists) return res.status(400).json({ message: `Student with PRN ${cleanPRN} already exists in database.` });

        // Step 4 & 5: Upload JPEG to Cloudinary (or local fallback)
        let photo = photoBody || "";
        let photoPublicId = "";
        if (req.file) {
            const uploadResult = await uploadStudentImage(req.file.buffer, req.file.originalname, "smart_exam_students");
            photo = uploadResult.url;
            photoPublicId = uploadResult.public_id;
        }

        const normalizedEmail = (email || `${cleanPRN}@gcoea.ac.in`).toLowerCase().trim();

        // 1. Provision or link login account in User collection
        let existingUser = await User.findOne({
            $or: [
                { PRN: cleanPRN },
                { email: normalizedEmail }
            ]
        });

        let userId = null;
        if (existingUser) {
            existingUser.name = name;
            existingUser.role = "student";
            existingUser.accountStatus = "active";
            existingUser.PRN = cleanPRN;
            if (!existingUser.password) {
                const salt = await bcrypt.genSalt(10);
                existingUser.password = await bcrypt.hash(`Student@${cleanPRN}`, salt);
            }
            await existingUser.save();
            userId = existingUser._id;
        } else {
            const salt = await bcrypt.genSalt(10);
            const defaultPassword = `Student@${cleanPRN}`;
            const hashedPassword = await bcrypt.hash(defaultPassword, salt);

            const newUser = await User.create({
                name: name.trim(),
                email: normalizedEmail,
                username: cleanPRN,
                password: hashedPassword,
                role: "student",
                accountStatus: "active",
                PRN: cleanPRN,
                mustChangePassword: true
            });
            userId = newUser._id;
        }

        let parsedSubjects = [];
        if (registeredSubjects) {
            if (typeof registeredSubjects === "string") {
                try {
                    parsedSubjects = JSON.parse(registeredSubjects);
                } catch (e) {
                    parsedSubjects = registeredSubjects.split(",").map(s => s.trim()).filter(Boolean);
                }
            } else if (Array.isArray(registeredSubjects)) {
                parsedSubjects = registeredSubjects;
            }
        }

        // 2. Step 6: Create official Student profile in MongoDB with image URL and Cloudinary public ID
        const student = await Student.create({
            name: name.trim(),
            PRN: cleanPRN,
            rollNumber,
            branch,
            year: year || "Third Year",
            semester: Number(semester || 6),
            division: division || "A",
            email: normalizedEmail,
            collegeId: collegeId || `GCOEA/${cleanPRN}`,
            photo,
            photoPublicId,
            registeredSubjects: parsedSubjects,
            user: userId,
            isVerified: true,
            verificationStatus: "verified"
        });

        // 3. Link back student profile in User document
        if (userId) {
            await User.findByIdAndUpdate(userId, { studentProfile: student._id });
        }

        const populated = await Student.findById(student._id)
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester");
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student (Step 10: Manage and update photo in Cloudinary)
// @route   PUT /api/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: "Student not found" });

        const updateData = { ...req.body };

        if (updateData.registeredSubjects !== undefined) {
            if (typeof updateData.registeredSubjects === "string") {
                try {
                    updateData.registeredSubjects = JSON.parse(updateData.registeredSubjects);
                } catch (e) {
                    updateData.registeredSubjects = updateData.registeredSubjects.split(",").map(s => s.trim()).filter(Boolean);
                }
            }
        }

        // Step 10: If a new photo is uploaded, delete old photo from Cloudinary & upload new JPEG
        if (req.file) {
            if (student.photoPublicId) {
                await deleteStudentImage(student.photoPublicId);
            }
            const uploadResult = await uploadStudentImage(req.file.buffer, req.file.originalname, "smart_exam_students");
            updateData.photo = uploadResult.url;
            updateData.photoPublicId = uploadResult.public_id;
        }

        const updatedStudent = await Student.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        })
            .populate("branch", "branchCode branchName")
            .populate("registeredSubjects", "subjectCode subjectName semester");

        // Update corresponding User record if email or name changed
        if (updatedStudent.user) {
            await User.findByIdAndUpdate(updatedStudent.user, {
                name: updatedStudent.name,
                email: updatedStudent.email
            });
        }

        res.json(updatedStudent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete student (Step 10: Delete photo from Cloudinary & remove MongoDB record)
// @route   DELETE /api/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Step 10: Remove image from Cloudinary if public ID exists
        if (student.photoPublicId) {
            await deleteStudentImage(student.photoPublicId);
        }

        await Student.findByIdAndDelete(req.params.id);

        if (student.user) {
            await User.findByIdAndDelete(student.user);
        } else if (student.PRN) {
            await User.findOneAndDelete({ PRN: student.PRN });
        }

        // Cascade delete allocations & attendance records linked to this student
        await Allocation.deleteMany({ student: student._id });
        await Attendance.deleteMany({ student: student._id });

        res.json({ message: "Student and photograph removed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Public student self-registration endpoint (Step 1 & 2)
// @route   POST /api/students/register
// @access  Public
const registerStudent = async (req, res) => {
    try {
        const { name, PRN, rollNumber, branch, year, semester, division, email, collegeId } = req.body;

        if (!name || !PRN || !branch) {
            return res.status(400).json({ message: "Please enter your Name, PRN, and select your Branch." });
        }

        const cleanPRN = String(PRN || "").trim();
        const exists = await Student.findOne({ PRN: cleanPRN });
        if (exists) {
            return res.status(400).json({ message: `Student with PRN ${cleanPRN} is already registered.` });
        }

        // Upload JPEG image to Cloudinary (Steps 4 & 5)
        let photo = "";
        let photoPublicId = "";
        if (req.file) {
            const uploadResult = await uploadStudentImage(req.file.buffer, req.file.originalname, "smart_exam_students");
            photo = uploadResult.url;
            photoPublicId = uploadResult.public_id;
        }

        const normalizedEmail = (email || `${cleanPRN}@gcoea.ac.in`).toLowerCase().trim();

        // Step 6: Provision User login credentials
        const salt = await bcrypt.genSalt(10);
        const defaultPassword = `Student@${cleanPRN}`;
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        let user = await User.findOne({
            $or: [{ PRN: cleanPRN }, { email: normalizedEmail }]
        });

        if (user) {
            user.name = name.trim();
            user.role = "student";
            user.accountStatus = "active";
            user.PRN = cleanPRN;
            if (!user.password) {
                user.password = hashedPassword;
            }
            await user.save();
        } else {
            user = await User.create({
                name: name.trim(),
                email: normalizedEmail,
                username: cleanPRN,
                password: hashedPassword,
                role: "student",
                accountStatus: "active",
                PRN: cleanPRN,
                mustChangePassword: true
            });
        }

        // Step 6: Store details, Cloudinary image URL and public ID in MongoDB
        const student = await Student.create({
            name: name.trim(),
            PRN: cleanPRN,
            rollNumber: rollNumber || cleanPRN,
            branch,
            year: year || "Third Year",
            semester: Number(semester || 6),
            division: division || "A",
            email: normalizedEmail,
            collegeId: collegeId || `GCOEA/${cleanPRN}`,
            photo,
            photoPublicId,
            user: user._id,
            isVerified: true,
            verificationStatus: "verified"
        });

        await User.findByIdAndUpdate(user._id, { studentProfile: student._id });

        const populated = await student.populate("branch", "branchCode branchName");

        res.status(201).json({
            message: "Registration successful! Your photograph and profile have been registered. You can now log in.",
            student: populated
        });
    } catch (error) {
        console.error("Student registration error:", error);
        res.status(500).json({ message: error.message || "Failed to register student." });
    }
};


// @desc    Import students from Excel/CSV with comprehensive validation and duplicate detection
// @route   POST /api/students/import
// @access  Private/Admin
const importStudents = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No Excel or CSV file uploaded" });

        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return res.status(400).json({ message: "Excel workbook has no sheets" });
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: "No data rows found in uploaded file" });
        }

        const branches = await Branch.find();
        const defaultBranch = branches[0];

        const insertedRecords = [];
        const skippedDuplicates = [];
        const failedRecords = [];
        const seenPRNsInFile = new Set();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // Excel row numbering (1-indexed + 1 for header)

            // Flexible field extraction supporting various naming conventions
            const name = String(row.name || row.Name || row["Student Name"] || row["student_name"] || "").trim();
            const prn = String(row.PRN || row.prn || row["PRN Number"] || row["prn_number"] || "").trim();
            const rollNumber = String(row.rollNumber || row.RollNumber || row["Roll Number"] || row["roll_number"] || prn).trim();
            const collegeId = String(row.collegeId || row.CollegeId || row["College ID"] || `GCOEA/${prn}`).trim();
            const branchVal = String(row.branch || row.Branch || row.Department || row.department || "").trim();
            const semester = Number(row.semester || row.Semester || 6);
            const division = String(row.division || row.Division || row.Div || "A").trim();
            const email = String(row.email || row.Email || `${prn}@gcoea.ac.in`).trim();
            const photo = String(row.photo || row.Photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80").trim();

            // 1. Validation of required fields
            const errors = [];
            if (!name) errors.push("Missing student name");
            if (!prn) errors.push("Missing PRN");
            if (!rollNumber) errors.push("Missing roll number");

            if (errors.length > 0) {
                failedRecords.push({
                    row: rowNum,
                    PRN: prn || "N/A",
                    name: name || "N/A",
                    reason: errors.join(", ")
                });
                continue;
            }

            // 2. Intra-file duplicate check
            if (seenPRNsInFile.has(prn)) {
                skippedDuplicates.push({
                    row: rowNum,
                    PRN: prn,
                    name,
                    reason: "Duplicate PRN found within this spreadsheet"
                });
                continue;
            }
            seenPRNsInFile.add(prn);

            // 3. Database duplicate check
            const exists = await Student.findOne({ PRN: prn });
            if (exists) {
                skippedDuplicates.push({
                    row: rowNum,
                    PRN: prn,
                    name,
                    reason: "PRN already enrolled in system database"
                });
                continue;
            }

            // 4. Smart Branch matching
            let branchId = defaultBranch?._id;
            if (branchVal) {
                if (require("mongoose").Types.ObjectId.isValid(branchVal)) {
                    branchId = branchVal;
                } else {
                    const matched = branches.find(b => 
                        b.branchCode.toLowerCase() === branchVal.toLowerCase() ||
                        b.branchName.toLowerCase().includes(branchVal.toLowerCase())
                    );
                    if (matched) branchId = matched._id;
                }
            }

            // 5. Create Student record and provision login account
            try {
                // Provision User account
                const salt = await bcrypt.genSalt(10);
                const defaultPassword = `Student@${prn}`;
                const hashedPassword = await bcrypt.hash(defaultPassword, salt);

                let existingUser = await User.findOne({
                    $or: [{ PRN: prn }, { email }]
                });

                let userId = null;
                if (existingUser) {
                    existingUser.accountStatus = "active";
                    existingUser.PRN = prn;
                    if (!existingUser.password) {
                        existingUser.password = hashedPassword;
                    }
                    await existingUser.save();
                    userId = existingUser._id;
                } else {
                    const newUser = await User.create({
                        name,
                        email,
                        username: prn,
                        password: hashedPassword,
                        role: "student",
                        accountStatus: "active",
                        PRN: prn,
                        mustChangePassword: true
                    });
                    userId = newUser._id;
                }

                const created = await Student.create({
                    name,
                    PRN: prn,
                    rollNumber,
                    collegeId,
                    branch: branchId,
                    year: String(row.year || row.Year || "Third Year").trim(),
                    semester: isNaN(semester) ? 6 : semester,
                    division,
                    email,
                    photo,
                    user: userId,
                    isVerified: true,
                    verificationStatus: "verified"
                });

                if (userId) {
                    await User.findByIdAndUpdate(userId, { studentProfile: created._id });
                }

                insertedRecords.push({
                    id: created._id,
                    name: created.name,
                    PRN: created.PRN,
                    rollNumber: created.rollNumber,
                    branch: branches.find(b => b._id.toString() === branchId?.toString())?.branchCode || "CSE"
                });
            } catch (err) {
                failedRecords.push({
                    row: rowNum,
                    PRN: prn,
                    name,
                    reason: err.message
                });
            }
        }

        res.json({
            message: `Bulk processing complete: ${insertedRecords.length} successfully enrolled & provisioned login accounts, ${skippedDuplicates.length} duplicates skipped, ${failedRecords.length} failed.`,
            totalProcessed: rows.length,
            successCount: insertedRecords.length,
            duplicatesCount: skippedDuplicates.length,
            failedCount: failedRecords.length,
            insertedRecords,
            skippedDuplicates,
            failedRecords
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk create students from JSON array with auto User provisioning
// @route   POST /api/students/bulk
// @access  Private/Admin
const bulkCreateStudents = async (req, res) => {
    try {
        const { students: studentList } = req.body;
        if (!Array.isArray(studentList) || studentList.length === 0) {
            return res.status(400).json({ message: "Please provide an array of students" });
        }

        const results = { inserted: 0, skipped: 0, errors: [] };
        const defaultBranch = await Branch.findOne();
        const salt = await bcrypt.genSalt(10);

        for (const item of studentList) {
            try {
                const prn = String(item.PRN || "").trim();
                if (!prn) continue;

                const exists = await Student.findOne({ PRN: prn });
                if (exists) {
                    results.skipped++;
                    continue;
                }

                let branchId = item.branch || defaultBranch?._id;
                if (typeof branchId === 'string' && !require("mongoose").Types.ObjectId.isValid(branchId)) {
                    const found = await Branch.findOne({
                        $or: [
                            { branchCode: new RegExp(`^${branchId}$`, "i") },
                            { branchName: new RegExp(branchId, "i") }
                        ]
                    });
                    if (found) branchId = found._id;
                    else branchId = defaultBranch?._id;
                }

                const email = (item.email || `${prn}@gcoea.ac.in`).toLowerCase().trim();
                const defaultPassword = `Student@${prn}`;
                const hashedPassword = await bcrypt.hash(defaultPassword, salt);

                let existingUser = await User.findOne({
                    $or: [{ PRN: prn }, { email }]
                });

                let userId = null;
                if (existingUser) {
                    existingUser.accountStatus = "active";
                    existingUser.PRN = prn;
                    if (!existingUser.password) {
                        existingUser.password = hashedPassword;
                    }
                    await existingUser.save();
                    userId = existingUser._id;
                } else {
                    const newUser = await User.create({
                        name: item.name,
                        email,
                        username: prn,
                        password: hashedPassword,
                        role: "student",
                        accountStatus: "active",
                        PRN: prn,
                        mustChangePassword: true
                    });
                    userId = newUser._id;
                }

                const created = await Student.create({
                    name: item.name,
                    PRN: prn,
                    rollNumber: item.rollNumber || prn,
                    collegeId: item.collegeId || `GCOEA/${prn}`,
                    branch: branchId,
                    year: item.year || "Third Year",
                    semester: Number(item.semester || 6),
                    division: item.division || "A",
                    email,
                    photo: item.photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
                    user: userId,
                    isVerified: true,
                    verificationStatus: "verified"
                });

                if (userId) {
                    await User.findByIdAndUpdate(userId, { studentProfile: created._id });
                }

                results.inserted++;
            } catch (err) {
                results.errors.push({ PRN: item.PRN, error: err.message });
            }
        }

        res.status(201).json({
            message: `Bulk creation complete: ${results.inserted} added and provisioned login accounts, ${results.skipped} duplicates skipped`,
            inserted: results.inserted,
            skipped: results.skipped,
            errors: results.errors
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    getStudents, 
    getStudentById, 
    createStudent, 
    updateStudent, 
    deleteStudent, 
    importStudents,
    bulkCreateStudents,
    registerStudent
};

