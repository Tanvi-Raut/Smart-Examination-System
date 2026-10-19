# Smart Examination Management System with QR-Based Student Verification and Automated Seating Allocation

### Academic Programme: B.Tech. Computer Science & Engineering
**Institute:** Government College of Engineering, Amravati  
**Team Members:**
1. Harshali Villhekar (PRN: 23005059)
2. Vaishnavi Jadhav (PRN: 24105008)
3. Tanvi Raut (PRN: 24105009)

**Project Guide:** Dr. Naresh G. Gadge  

---

## 📖 Overview
The **Smart Examination Management System** automates the entire examination cycle in engineering colleges. It replaces error-prone manual paper registers and vulnerable conventional hall tickets with:
1. **Automated Anti-Cheating Seating Allocation:** Implements a branch-wise round-robin interleaving strategy so adjacent students do not write the same subject or belong to the same department.
2. **Subject-Specific QR Codes:** Cryptographically generates a unique QR code per student per subject:
   $$\text{Student} + \text{Subject} + \text{Exam} \longrightarrow \text{Unique QR Code}$$
   A QR issued for one subject cannot be reused for another subject.
3. **Digital PDF Hall Tickets:** Generates official admission cards containing student photo, complete schedule, assigned hall & seat numbers, and embedded unique subject QR codes with 1-click PDF download.
4. **Camera-Enabled Invigilator Verification:** Camera scanning verifies student identity and presents the official registered photograph to the invigilator for comparison against the student's physical College ID card before marking attendance (`Present`, `Absent`, or `Malpractice Flagged`).
5. **Offline Attendance Mechanism (IndexedDB):** In halls without Wi-Fi or cellular coverage, invigilators proctor using locally cached rosters in browser IndexedDB. Once connectivity is restored, attendance records synchronize to the central database with one click.
6. **Attendance & Examination Reports:** Comprehensive analytical reports by exam, hall, and department with CSV export.

---

## 🛠️ Technology Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons, jsPDF, html2canvas, html5-qrcode, Canvas-Confetti
- **Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT, bcryptjs, qrcode, xlsx
- **Offline Storage:** Browser IndexedDB (`SmartExamOfflineDB`)
- **Authentication:** Role-Based Access Control (Admin, Invigilator, Student) with JWT

---

## 🚀 Running the Application

### 1. Backend Server
```bash
cd server
npm start
# Server runs on http://localhost:5000
```

### 2. Frontend Application
```bash
cd client
npm run dev
# Frontend runs on http://127.0.0.1:5173
```

### 3. Re-seed Demo Database
```bash
cd server
node utils/seedData.js
```

---

## 🔑 Demo Login Accounts

| Role | Email ID | Password | Portal Features |
| :--- | :--- | :--- | :--- |
| **👑 Admin (Exam Cell)** | `admin@gcoea.ac.in` | `admin123` | Dashboard, Students, Halls, Subjects, Schedules, Seating Allocation, Reports |
| **📷 Hall Invigilator** | `invigilator@gcoea.ac.in` | `invigilator123` | Camera QR scanner, photo ID card verification, live hall roster, offline sync |
| **🎓 Student (Harshali Villhekar)** | `student@gcoea.ac.in` | `student123` | Digital admission card, timetable, subject-specific QR codes, desk assignment |

*(One-click quick demo buttons are provided on both the Login page and Navbar for rapid switching).*
