const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../models/User");
const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Hall = require("../models/Hall");
const Seat = require("../models/Seat");
const Student = require("../models/Student");
const Exam = require("../models/Exam");
const Allocation = require("../models/Allocation");
const Attendance = require("../models/Attendance");
const { allocateSeats } = require("./seatingAlgorithm");

const seedDatabase = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully! Starting seed...");

        // 1. Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Branch.deleteMany({}),
            Subject.deleteMany({}),
            Hall.deleteMany({}),
            Seat.deleteMany({}),
            Student.deleteMany({}),
            Exam.deleteMany({}),
            Allocation.deleteMany({}),
            Attendance.deleteMany({})
        ]);
        console.log("Cleaned old records.");

        // 2. Users (Admin, Invigilator, Student)
        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash("admin123", salt);
        const invigilatorPassword = await bcrypt.hash("invigilator123", salt);
        const studentPassword = await bcrypt.hash("student123", salt);

        const admin = await User.create({
            name: "College Exam Controller",
            email: "admin@gcoea.ac.in",
            username: "admin@gcoea.ac.in",
            password: adminPassword,
            role: "admin",
            accountStatus: "active"
        });

        const invigilator = await User.create({
            name: "Prof. S. K. Sharma (Hall Invigilator)",
            email: "invigilator@gcoea.ac.in",
            username: "invigilator@gcoea.ac.in",
            password: invigilatorPassword,
            role: "invigilator",
            accountStatus: "active"
        });

        console.log("Created Admin and Invigilator Users.");

        // 3. Branches
        const cse = await Branch.create({ branchCode: "CSE", branchName: "Computer Science & Engineering" });
        const it = await Branch.create({ branchCode: "IT", branchName: "Information Technology" });
        const entc = await Branch.create({ branchCode: "ENTC", branchName: "Electronics & Telecommunication (ECE)" });
        const mech = await Branch.create({ branchCode: "MECH", branchName: "Mechanical Engineering" });
        const civil = await Branch.create({ branchCode: "CIVIL", branchName: "Civil Engineering" });

        console.log("Created Branches: CSE, IT, ENTC, MECH, CIVIL.");

        // 4. Subjects across Semesters
        // Semester 5 Subjects:
        const subDBMS = await Subject.create({
            subjectCode: "CS501",
            subjectName: "Database Management Systems",
            semester: 5,
            branches: [cse._id, it._id]
        });

        const subJava = await Subject.create({
            subjectCode: "CS502",
            subjectName: "Advanced Java Programming",
            semester: 5,
            branches: [cse._id]
        });

        const subDE = await Subject.create({
            subjectCode: "ET501",
            subjectName: "Digital Electronics & Logic Design",
            semester: 5,
            branches: [entc._id]
        });

        const subCN = await Subject.create({
            subjectCode: "IT501",
            subjectName: "Computer Networks & Cloud",
            semester: 5,
            branches: [it._id]
        });

        // Semester 3 Subject:
        const subDS = await Subject.create({
            subjectCode: "CS301",
            subjectName: "Data Structures & Algorithms",
            semester: 3,
            branches: [cse._id, it._id]
        });

        // Semester 6 Subjects:
        const subDAA = await Subject.create({
            subjectCode: "CS601",
            subjectName: "Design & Analysis of Algorithms",
            semester: 6,
            branches: [cse._id, it._id]
        });

        const subOS = await Subject.create({
            subjectCode: "CS602",
            subjectName: "Operating Systems & System Programming",
            semester: 6,
            branches: [cse._id]
        });

        console.log("Created Subjects for Semesters 3, 5, and 6.");

        // 5. Halls & Seats
        const hall1 = await Hall.create({
            hallNumber: "LH-101",
            building: "Main Academic Complex",
            floor: 1,
            totalSeats: 30
        });

        const hall2 = await Hall.create({
            hallNumber: "LH-102",
            building: "Diamond Jubilee Wing",
            floor: 1,
            totalSeats: 24
        });

        const hall3 = await Hall.create({
            hallNumber: "LH-201",
            building: "Computer Science Block",
            floor: 2,
            totalSeats: 36
        });

        // Generate seats for Hall 1 (5 rows x 6 cols = 30)
        const hall1Seats = [];
        for (let r = 1; r <= 5; r++) {
            for (let c = 1; c <= 6; c++) {
                hall1Seats.push({
                    hall: hall1._id,
                    seatNumber: `H1-R${r}C${c}`,
                    row: r,
                    column: c
                });
            }
        }
        await Seat.insertMany(hall1Seats);

        // Generate seats for Hall 2 (4 rows x 6 cols = 24)
        const hall2Seats = [];
        for (let r = 1; r <= 4; r++) {
            for (let c = 1; c <= 6; c++) {
                hall2Seats.push({
                    hall: hall2._id,
                    seatNumber: `H2-R${r}C${c}`,
                    row: r,
                    column: c
                });
            }
        }
        await Seat.insertMany(hall2Seats);

        // Generate seats for Hall 3 (6 rows x 6 cols = 36)
        const hall3Seats = [];
        for (let r = 1; r <= 6; r++) {
            for (let c = 1; c <= 6; c++) {
                hall3Seats.push({
                    hall: hall3._id,
                    seatNumber: `H3-R${r}C${c}`,
                    row: r,
                    column: c
                });
            }
        }
        await Seat.insertMany(hall3Seats);

        console.log("Created 3 Halls & generated 90 seats.");

        // 6. Comprehensive Student Dataset
        // Specifically includes:
        // - Rahul: CSE, Sem 5, DBMS
        // - Priya: IT, Sem 5, DBMS
        // - Amit: CSE, Sem 5, Java (NOT DBMS!)
        // - Sneha: ENTC/ECE, Sem 5, Digital Electronics
        // - Neha: CSE, Sem 3, Data Structures
        const studentsData = [
            // --- User's Specific Example Students ---
            {
                name: "Rahul Sharma",
                PRN: "23005081",
                rollNumber: "CSE-23-81",
                collegeId: "GCOEA/CS/23005081",
                branch: cse._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "rahul@gcoea.ac.in",
                registeredSubjects: [subDBMS._id],
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Priya Verma",
                PRN: "23006082",
                rollNumber: "IT-23-82",
                collegeId: "GCOEA/IT/23006082",
                branch: it._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "priya@gcoea.ac.in",
                registeredSubjects: [subDBMS._id, subCN._id],
                photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Amit Kumar",
                PRN: "23005083",
                rollNumber: "CSE-23-83",
                collegeId: "GCOEA/CS/23005083",
                branch: cse._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "amit@gcoea.ac.in",
                registeredSubjects: [subJava._id], // Taking Java, NOT DBMS!
                photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Sneha Patil",
                PRN: "23007084",
                rollNumber: "ENTC-23-84",
                collegeId: "GCOEA/ET/23007084",
                branch: entc._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "sneha.p@gcoea.ac.in",
                registeredSubjects: [subDE._id], // Taking Digital Electronics!
                photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Neha Deshmukh",
                PRN: "24005085",
                rollNumber: "CSE-24-85",
                collegeId: "GCOEA/CS/24005085",
                branch: cse._id,
                year: "Second Year",
                semester: 3,
                division: "A",
                email: "neha.d@gcoea.ac.in",
                registeredSubjects: [subDS._id], // Taking Data Structures in Sem 3!
                photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
            },

            // --- Additional Semester 5 Students (for branch mixing tests) ---
            {
                name: "Rohan Joshi",
                PRN: "23005086",
                rollNumber: "CSE-23-86",
                collegeId: "GCOEA/CS/23005086",
                branch: cse._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "rohan.j@gcoea.ac.in",
                registeredSubjects: [subDBMS._id, subJava._id],
                photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Kavita Mehta",
                PRN: "23006087",
                rollNumber: "IT-23-87",
                collegeId: "GCOEA/IT/23006087",
                branch: it._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "kavita.m@gcoea.ac.in",
                registeredSubjects: [subDBMS._id, subCN._id],
                photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Arjun Nair",
                PRN: "23005088",
                rollNumber: "CSE-23-88",
                collegeId: "GCOEA/CS/23005088",
                branch: cse._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "arjun.n@gcoea.ac.in",
                registeredSubjects: [subDBMS._id],
                photo: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Pooja Shinde",
                PRN: "23006089",
                rollNumber: "IT-23-89",
                collegeId: "GCOEA/IT/23006089",
                branch: it._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "pooja.s@gcoea.ac.in",
                registeredSubjects: [subDBMS._id],
                photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Vikas Yadav",
                PRN: "23005090",
                rollNumber: "CSE-23-90",
                collegeId: "GCOEA/CS/23005090",
                branch: cse._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "vikas.y@gcoea.ac.in",
                registeredSubjects: [subJava._id], // Taking Java, NOT DBMS!
                photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Aniket Rao",
                PRN: "23007091",
                rollNumber: "ENTC-23-91",
                collegeId: "GCOEA/ET/23007091",
                branch: entc._id,
                year: "Third Year",
                semester: 5,
                division: "A",
                email: "aniket.r@gcoea.ac.in",
                registeredSubjects: [subDE._id],
                photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
            },

            // --- Additional Semester 3 Students ---
            {
                name: "Shruti Kulkarni",
                PRN: "24005092",
                rollNumber: "CSE-24-92",
                collegeId: "GCOEA/CS/24005092",
                branch: cse._id,
                year: "Second Year",
                semester: 3,
                division: "A",
                email: "shruti.k@gcoea.ac.in",
                registeredSubjects: [subDS._id],
                photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Manish Tiwari",
                PRN: "24006093",
                rollNumber: "IT-24-93",
                collegeId: "GCOEA/IT/24006093",
                branch: it._id,
                year: "Second Year",
                semester: 3,
                division: "A",
                email: "manish.t@gcoea.ac.in",
                registeredSubjects: [subDS._id],
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
            },

            // --- Semester 6 Cohort ---
            {
                name: "Harshali Villhekar",
                PRN: "23005059",
                rollNumber: "CSE-23-01",
                collegeId: "GCOEA/CS/23005059",
                branch: cse._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "student@gcoea.ac.in",
                registeredSubjects: [subDAA._id, subOS._id],
                photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Vaishnavi Jadhav",
                PRN: "24105008",
                rollNumber: "CSE-24-02",
                collegeId: "GCOEA/CS/24105008",
                branch: cse._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "vaishnavi@gcoea.ac.in",
                registeredSubjects: [subDAA._id, subOS._id],
                photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Tanvi Raut",
                PRN: "24105009",
                rollNumber: "CSE-24-03",
                collegeId: "GCOEA/CS/24105009",
                branch: cse._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "tanvi@gcoea.ac.in",
                registeredSubjects: [subDAA._id, subOS._id],
                photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Aditya Kulkarni",
                PRN: "23005012",
                rollNumber: "CSE-23-04",
                collegeId: "GCOEA/CS/23005012",
                branch: cse._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "aditya.k@gcoea.ac.in",
                registeredSubjects: [subDAA._id],
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Prathamesh Joshi",
                PRN: "23006014",
                rollNumber: "IT-23-02",
                collegeId: "GCOEA/IT/23006014",
                branch: it._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "prathamesh.j@gcoea.ac.in",
                registeredSubjects: [subDAA._id],
                photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Ananya Sharma",
                PRN: "23006028",
                rollNumber: "IT-23-03",
                collegeId: "GCOEA/IT/23006028",
                branch: it._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "ananya.s@gcoea.ac.in",
                registeredSubjects: [subDAA._id],
                photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80"
            }
        ];

        const createdStudents = await Student.insertMany(studentsData);
        console.log(`Created ${createdStudents.length} Students across Semesters 3, 5, and 6.`);

        // Provision User login accounts for all students (enabling PRN-based login with formula Student@<PRN>)
        for (const st of createdStudents) {
            const individualHash = await bcrypt.hash(`Student@${st.PRN}`, salt);
            const u = await User.create({
                name: st.name,
                email: st.email,
                username: st.PRN,
                password: individualHash,
                role: "student",
                accountStatus: "active",
                PRN: st.PRN,
                studentProfile: st._id,
                mustChangePassword: true
            });
            st.user = u._id;
            await st.save();
        }
        console.log("Provisioned User accounts for all students with Student@<PRN> credentials.");

        // 7. Examinations
        // Exam 1: DBMS · Semester 5 (Eligible: CSE & IT registered for DBMS)
        const examDBMS = await Exam.create({
            subject: subDBMS._id,
            examDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            startTime: "10:30 AM",
            endTime: "01:30 PM",
            semester: 5,
            status: "Scheduled"
        });

        // Exam 2: Java · Semester 5
        const examJava = await Exam.create({
            subject: subJava._id,
            examDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            startTime: "10:30 AM",
            endTime: "01:30 PM",
            semester: 5,
            status: "Scheduled"
        });

        // Exam 3: Digital Electronics · Semester 5
        const examDE = await Exam.create({
            subject: subDE._id,
            examDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            startTime: "10:30 AM",
            endTime: "01:30 PM",
            semester: 5,
            status: "Scheduled"
        });

        // Exam 4: Data Structures · Semester 3
        const examDS = await Exam.create({
            subject: subDS._id,
            examDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
            startTime: "10:30 AM",
            endTime: "01:30 PM",
            semester: 3,
            status: "Scheduled"
        });

        // Exam 5: DAA · Semester 6
        const examDAA = await Exam.create({
            subject: subDAA._id,
            examDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            startTime: "10:30 AM",
            endTime: "01:30 PM",
            semester: 6,
            status: "Scheduled"
        });

        console.log("Created 5 Examinations across Semesters 3, 5, and 6.");

        // 8. Generate Proper Initial Seating Allocation for Exam 1 (DBMS · Semester 5)
        // Order followed:
        // Step 1: Select Exam (DBMS · Semester 5)
        // Step 2: Match Student Eligibility (Branch + Semester + Registered Subject: DBMS)
        //   -> Rahul (CSE), Priya (IT), Rohan (CSE), Kavita (IT), Arjun (CSE), Pooja (IT) matched!
        //   -> Amit (Java), Sneha (DE), Neha (Sem 3) correctly excluded!
        // Step 3: Check Hall Availability (LH-101 has 30 seats, 6 students needed)
        // Step 4: Allocate Unique Seats with Branch Interleaving
        // Step 5: Save to MongoDB
        const eligibleForDBMS = createdStudents.filter(s => 
            s.semester === 5 && 
            (s.branch.toString() === cse._id.toString() || s.branch.toString() === it._id.toString()) &&
            s.registeredSubjects.some(sub => sub.toString() === subDBMS._id.toString())
        );

        console.log(`Eligible for DBMS Exam: ${eligibleForDBMS.length} students (${eligibleForDBMS.map(s => `${s.name} [${s.rollNumber}]`).join(', ')})`);

        const allHall1Seats = await Seat.find({ hall: hall1._id }).sort({ row: 1, column: 1 });
        const pairs = allocateSeats(eligibleForDBMS, allHall1Seats, "branch-mix");

        const allocations = await Allocation.insertMany(
            pairs.map((p) => ({
                student: p.student,
                exam: examDBMS._id,
                hall: p.hall,
                seat: p.seat,
                status: "Allocated"
            }))
        );

        console.log(`Generated ${allocations.length} Seating Allocations for DBMS Exam in LH-101.`);

        // 9. Initial Sample Attendance for the first student (Rahul)
        const firstAlloc = allocations[0];
        await Attendance.create({
            exam: examDBMS._id,
            student: firstAlloc.student,
            hall: firstAlloc.hall,
            seat: firstAlloc.seat,
            allocation: firstAlloc._id,
            status: "Present",
            verifiedAt: new Date(),
            verifiedBy: invigilator._id,
            invigilatorName: invigilator.name,
            verificationMethod: "QR_SCAN",
            photoVerified: true,
            remarks: "QR code verified; Candidate registered for DBMS; Photo matches physical College ID."
        });

        console.log("Recorded 1 sample attendance for Rahul Sharma.");
        console.log("🎉 Database Seeding Completed Successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding Error:", error);
        process.exit(1);
    }
};

seedDatabase();
