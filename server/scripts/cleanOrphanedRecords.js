require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Allocation = require("../models/Allocation");
const Attendance = require("../models/Attendance");
const Hall = require("../models/Hall");
const Seat = require("../models/Seat");
const Student = require("../models/Student");

async function cleanAllBrokenAllocations() {
    try {
        await connectDB();
        console.log("Connected to MongoDB.");

        const halls = await Hall.find();
        const validHallIds = new Set(halls.map(h => h._id.toString()));

        const seats = await Seat.find();
        const validSeatIds = new Set(seats.map(s => s._id.toString()));

        const students = await Student.find();
        const validStudentIds = new Set(students.map(s => s._id.toString()));

        const allAllocations = await Allocation.find();
        console.log(`Total allocations before cleanup: ${allAllocations.length}`);

        const toDeleteIds = [];
        for (const a of allAllocations) {
            const hasValidHall = a.hall && validHallIds.has(a.hall.toString());
            const hasValidSeat = a.seat && validSeatIds.has(a.seat.toString());
            const hasValidStudent = a.student && validStudentIds.has(a.student.toString());

            if (!hasValidHall || !hasValidSeat || !hasValidStudent) {
                toDeleteIds.push(a._id);
            }
        }

        console.log(`Allocations to remove due to deleted hall/seat/student: ${toDeleteIds.length}`);
        if (toDeleteIds.length > 0) {
            const delRes = await Allocation.deleteMany({ _id: { $in: toDeleteIds } });
            console.log(`Successfully deleted ${delRes.deletedCount} broken allocations.`);

            const delAtt = await Attendance.deleteMany({ allocation: { $in: toDeleteIds } });
            console.log(`Successfully deleted ${delAtt.deletedCount} broken attendance records.`);
        }

        console.log("Cleanup complete!");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup error:", err);
        process.exit(1);
    }
}

cleanAllBrokenAllocations();
