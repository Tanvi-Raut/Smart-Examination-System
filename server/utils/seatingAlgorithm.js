/**
 * Smart Seating Algorithm — Branch-wise Mixing Strategy
 *
 * Strategy: Interleave students from different branches so no two
 * adjacent students are from the same branch (anti-copying measure).
 *
 * Steps:
 * 1. Group students by branch
 * 2. Sort each group by roll number
 * 3. Round-robin interleave across branches
 * 4. Assign to seats sequentially
 */

/**
 * Shuffle array (Fisher-Yates)
 */
const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * Interleave students from multiple branches (round-robin)
 * so adjacent seats have different branches.
 *
 * @param {Object} branchGroups - { branchId: [student, ...], ... }
 * @returns {Array} - Interleaved student list
 */
const interleaveByBranch = (branchGroups) => {
    const groups = Object.values(branchGroups).map((g) => [...g]);
    const result = [];

    let hasMore = true;
    while (hasMore) {
        hasMore = false;
        for (const group of groups) {
            if (group.length > 0) {
                result.push(group.shift());
                hasMore = true;
            }
        }
    }

    return result;
};

/**
 * Main allocation algorithm
 *
 * @param {Array} students  - Array of student documents
 * @param {Array} seats     - Array of seat documents (sorted row, col)
 * @param {String} strategy - "branch-mix" | "random" | "sequential"
 * @returns {Array}         - Array of { student, seat } pairs
 */
const allocateSeats = (students, seats, strategy = "branch-mix") => {
    if (students.length > seats.length) {
        throw new Error(
            `Insufficient seating capacity: ${students.length} eligible students require desks, but only ${seats.length} seats are available in the selected halls. Please select additional halls.`
        );
    }

    let orderedStudents = [];

    if (strategy === "branch-mix") {
        // Group by branch, sort each group by rollNumber / PRN
        const branchGroups = {};
        for (const student of students) {
            const key = student.branch?._id ? student.branch._id.toString() : (student.branch?.toString() || "default");
            if (!branchGroups[key]) branchGroups[key] = [];
            branchGroups[key].push(student);
        }
        for (const key in branchGroups) {
            branchGroups[key].sort((a, b) => (a.rollNumber || a.PRN || "").localeCompare(b.rollNumber || b.PRN || ""));
        }
        orderedStudents = interleaveByBranch(branchGroups);

    } else if (strategy === "random") {
        orderedStudents = shuffleArray([...students]);

    } else {
        // sequential — sort by PRN / Roll Number
        orderedStudents = [...students].sort((a, b) => (a.rollNumber || a.PRN || "").localeCompare(b.rollNumber || b.PRN || ""));
    }

    // Pair students with unique seats across selected halls
    const allocations = orderedStudents.map((student, index) => ({
        student: student._id,
        seat: seats[index]._id,
        hall: seats[index].hall?._id || seats[index].hall
    }));

    return allocations;
};

module.exports = { allocateSeats };
