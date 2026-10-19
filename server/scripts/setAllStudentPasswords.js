require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Student = require("../models/Student");
const User = require("../models/User");

async function setAllStudentPasswords() {
    try {
        await connectDB();
        console.log("\n=======================================================");
        console.log(" Setting All Student Passwords to: Student@<assigned_id>");
        console.log("=======================================================\n");

        const students = await Student.find();
        console.log(`Found ${students.length} student records in Student collection.`);

        let updatedCount = 0;
        let createdUserCount = 0;

        for (const st of students) {
            const cleanPRN = String(st.PRN || "").trim();
            if (!cleanPRN) {
                console.warn(`[Skip] Student ${st.name} has no PRN.`);
                continue;
            }

            const formulaPassword = `Student@${cleanPRN}`;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(formulaPassword, salt);

            // Find matching user account
            let user = await User.findOne({
                $or: [
                    { studentProfile: st._id },
                    { PRN: cleanPRN },
                    ...(st.email ? [{ email: st.email.toLowerCase().trim() }] : []),
                    { username: cleanPRN }
                ]
            });

            if (user) {
                user.password = hashedPassword;
                user.role = "student";
                user.accountStatus = "active";
                user.PRN = cleanPRN;
                user.username = cleanPRN;
                user.name = st.name;
                user.studentProfile = st._id;
                user.mustChangePassword = false;
                await user.save();

                st.user = user._id;
                await st.save();

                updatedCount++;
                console.log(`[Updated] ${st.name} | PRN: ${cleanPRN} | Password: ${formulaPassword}`);
            } else {
                // Auto-create missing User account for this student
                const studentEmail = (st.email || `${cleanPRN}@gcoea.ac.in`).toLowerCase().trim();
                const newUser = await User.create({
                    name: st.name,
                    email: studentEmail,
                    username: cleanPRN,
                    password: hashedPassword,
                    role: "student",
                    accountStatus: "active",
                    PRN: cleanPRN,
                    studentProfile: st._id,
                    mustChangePassword: false
                });

                st.user = newUser._id;
                await st.save();

                createdUserCount++;
                console.log(`[Created & Set] ${st.name} | PRN: ${cleanPRN} | Password: ${formulaPassword}`);
            }
        }

        // Also check if any User with role 'student' doesn't have studentProfile but has PRN
        const standaloneStudentUsers = await User.find({ role: "student" });
        let standaloneUpdated = 0;

        for (const u of standaloneStudentUsers) {
            const cleanPRN = String(u.PRN || u.username || "").trim();
            if (cleanPRN && !cleanPRN.includes("@")) {
                const formulaPassword = `Student@${cleanPRN}`;
                const salt = await bcrypt.genSalt(10);
                u.password = await bcrypt.hash(formulaPassword, salt);
                u.accountStatus = "active";
                u.mustChangePassword = false;
                await u.save();
                standaloneUpdated++;
            }
        }

        console.log("\n=======================================================");
        console.log(` SUCCESS!`);
        console.log(` - Updated existing user accounts: ${updatedCount}`);
        console.log(` - Created missing user accounts:  ${createdUserCount}`);
        console.log(` - Total student users verified:   ${standaloneStudentUsers.length}`);
        console.log(` All students now have password: Student@<assigned_id>`);
        console.log("=======================================================\n");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error setting student passwords:", error);
        process.exit(1);
    }
}

setAllStudentPasswords();
