import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
    cacheHallRosterOffline, 
    getCachedHallRoster, 
    saveOfflineAttendance 
} from '../utils/offlineStorage';
import confetti from 'canvas-confetti';
import { 
    QrCode, 
    Camera, 
    Building2, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    User, 
    DownloadCloud, 
    UploadCloud, 
    Printer, 
    Sparkles, 
    WifiOff, 
    Wifi, 
    ShieldAlert, 
    ArrowRight,
    Users,
    GraduationCap
} from 'lucide-react';

const InvigilatorDashboard = ({ 
    setActiveTab,
    activeExamId,
    setActiveExamId,
    activeHallId,
    setActiveHallId
}) => {
    const { user, isOfflineMode, toggleOfflineMode } = useAuth();

    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [localExamId, setLocalExamId] = useState('');
    const [localHallId, setLocalHallId] = useState('');

    const selectedExamId = activeExamId || localExamId;
    const setSelectedExamId = (val) => {
        if (setActiveExamId) setActiveExamId(val);
        setLocalExamId(val);
    };

    const selectedHallId = activeHallId || localHallId;
    const setSelectedHallId = (val) => {
        if (setActiveHallId) setActiveHallId(val);
        setLocalHallId(val);
    };

    const [rosterData, setRosterData] = useState({
        totalAllocated: 0,
        markedPresent: 0,
        markedAbsent: 0,
        flagged: 0,
        pending: 0,
        roster: []
    });
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [quickVerification, setQuickVerification] = useState(null);

    // Fetch initial exams & halls
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                const [eRes, hRes] = await Promise.all([
                    api.get('/exams'),
                    api.get('/halls')
                ]);
                const examList = eRes.data || [];
                const hallList = hRes.data || [];
                setExams(examList);
                setHalls(hallList);

                const assignedExamId = typeof user?.assignedExam === 'object' ? user?.assignedExam?._id : user?.assignedExam;
                const assignedHallId = typeof user?.assignedHall === 'object' ? user?.assignedHall?._id : user?.assignedHall;

                if (user?.role === 'invigilator' && assignedExamId) {
                    setSelectedExamId(assignedExamId);
                } else if (examList.length > 0) {
                    const validExam = examList.some(e => e._id === (activeExamId || localExamId));
                    if (!validExam) {
                        setSelectedExamId(examList[0]._id);
                    }
                }

                if (user?.role === 'invigilator' && assignedHallId) {
                    setSelectedHallId(assignedHallId);
                } else if (hallList.length > 0) {
                    const validHall = hallList.some(h => h._id === (activeHallId || localHallId));
                    if (!validHall) {
                        setSelectedHallId(hallList[0]._id);
                    }
                }
            } catch (err) {
                console.error('Error init invigilator dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Keep selectedHallId and selectedExamId synchronized if halls/exams change
    useEffect(() => {
        if (halls.length > 0 && selectedHallId) {
            const exists = halls.some(h => h._id === selectedHallId);
            if (!exists) {
                setSelectedHallId(halls[0]._id);
            }
        }
    }, [halls, selectedHallId]);

    useEffect(() => {
        if (exams.length > 0 && selectedExamId) {
            const exists = exams.some(e => e._id === selectedExamId);
            if (!exists) {
                setSelectedExamId(exams[0]._id);
            }
        }
    }, [exams, selectedExamId]);

    // Load Hall Roster
    const loadRoster = async () => {
        if (!selectedExamId || !selectedHallId) return;
        try {
            if (isOfflineMode) {
                const cached = await getCachedHallRoster(selectedExamId, selectedHallId);
                if (cached) setRosterData(cached);
            } else {
                const res = await api.get(`/attendance/hall-roster/${selectedExamId}/${selectedHallId}`);
                setRosterData(res.data);
                await cacheHallRosterOffline(selectedExamId, selectedHallId, res.data);
            }
        } catch (err) {
            console.error('Error loading roster:', err);
        }
    };

    useEffect(() => {
        loadRoster();
    }, [selectedExamId, selectedHallId, isOfflineMode]);

    // Fast In-Dashboard Verification Simulation
    const handleQuickVerifyPRN = async (prn) => {
        if (!prn) return;
        try {
            setVerifying(true);
            const res = await api.post('/attendance/verify-qr', {
                qrData: prn,
                activeExamId: selectedExamId,
                activeHallId: selectedHallId
            });
            setQuickVerification(res.data);
        } catch (err) {
            alert(err.response?.data?.message || 'Verification error');
        } finally {
            setVerifying(false);
        }
    };

    const handleMarkAttendance = async (status) => {
        if (!quickVerification || !quickVerification.student) return;

        const payload = {
            examId: selectedExamId,
            studentId: quickVerification.student._id,
            hallId: selectedHallId,
            seatId: quickVerification.seat._id,
            allocationId: quickVerification.allocationId,
            status,
            verificationMethod: isOfflineMode ? 'OFFLINE_SYNC' : 'QR_SCAN',
            photoVerified: true,
            remarks: 'Verified on Invigilator Dashboard'
        };

        try {
            if (isOfflineMode) {
                await saveOfflineAttendance(payload);
                alert(`Saved to local IndexedDB (Offline): ${status}`);
            } else {
                await api.post('/attendance/mark', payload);
                if (status === 'Present') {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                }
            }
            setQuickVerification(null);
            loadRoster();
        } catch (err) {
            alert(err.response?.data?.message || 'Error recording attendance');
        }
    };

    const selectedExam = exams.find(e => e._id === selectedExamId);
    const selectedHall = halls.find(h => h._id === selectedHallId);
    const presentPercent = rosterData.totalAllocated > 0 
        ? Math.round((rosterData.markedPresent / rosterData.totalAllocated) * 100) 
        : 0;

    return (
        <div className="space-y-6 pb-16">
            {/* ================= INVIGILATOR PROCTORING HEADER ================= */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-6 sm:p-8 shadow-2xl">
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                            <Camera className="w-3.5 h-3.5" />
                            <span>Hall Proctoring & Verification Portal</span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Invigilator Duty Command Center
                        </h1>
                        {user?.assignedHall && (
                            <div className="mt-2 inline-flex items-center space-x-2 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold">
                                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Official Duty Assignment: Hall {user.assignedHall?.hallNumber || 'Assigned'}</span>
                                {user.assignedExam?.subject?.subjectCode && (
                                    <>
                                        <span>•</span>
                                        <span>Exam: {user.assignedExam.subject.subjectCode}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Offline Indicator & Camera Launch */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setActiveTab('scanner')}
                            className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
                        >
                            <QrCode className="w-4 h-4" />
                            <span>Open Camera QR Scanner</span>
                        </button>
                    </div>
                </div>

                {/* PROCTORING CONTROLS: ACTIVE EXAM & HALL SELECTOR */}
                <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Select Current Scheduled Examination
                        </label>
                        <select
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                        >
                            {exams.map(e => (
                                <option key={e._id} value={e._id}>
                                    {e.subject?.subjectCode}: {e.subject?.subjectName} ({new Date(e.examDate).toLocaleDateString()} • {e.startTime})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Select Assigned Examination Hall
                        </label>
                        <select
                            value={selectedHallId}
                            onChange={(e) => setSelectedHallId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                        >
                            {halls.map(h => (
                                <option key={h._id} value={h._id}>
                                    {h.hallNumber} - {h.building} (Floor {h.floor} • {h.totalSeats} Desks)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ================= PROCTORING METRICS GRID ================= */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <span className="text-xs font-medium text-slate-400">Total Hall Candidates</span>
                    <div className="mt-1 text-2xl font-bold text-white">{rosterData.totalAllocated}</div>
                    <span className="text-[10px] text-slate-500">Allocated in {selectedHall?.hallNumber || 'Hall'}</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <span className="text-xs font-medium text-slate-400">Verified Present</span>
                    <div className="mt-1 text-2xl font-bold text-emerald-400">{rosterData.markedPresent}</div>
                    <span className="text-[10px] text-emerald-400/80">{presentPercent}% attendance verified</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <span className="text-xs font-medium text-slate-400">Pending Verification</span>
                    <div className="mt-1 text-2xl font-bold text-amber-400">
                        {rosterData.pending || (rosterData.totalAllocated - rosterData.markedPresent)}
                    </div>
                    <span className="text-[10px] text-slate-500">Awaiting QR scan</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <span className="text-xs font-medium text-slate-400">Flagged Cases</span>
                    <div className="mt-1 text-2xl font-bold text-red-400">{rosterData.flagged || 0}</div>
                    <span className="text-[10px] text-red-400/80">Impersonation / Malpractice</span>
                </div>
            </div>

            {/* ================= QUICK PROCTORING ACTION CARDS ================= */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Live Camera QR Verification */}
                <div
                    onClick={() => setActiveTab('scanner')}
                    className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Camera className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                        Camera Student Verification
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Scan student hall tickets, match official photo with physical college ID card, and log attendance.
                    </p>
                    <div className="mt-3 flex items-center space-x-1 text-xs font-bold text-emerald-400">
                        <span>Launch Camera</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                </div>

                {/* 2. Offline Hall Mode Cache */}
                <div
                    onClick={() => setActiveTab('offline-sync')}
                    className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <DownloadCloud className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                        Offline Mode & Sync (IndexedDB)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Cache hall student roster to device storage before proctoring in halls without Wi-Fi connectivity.
                    </p>
                    <div className="mt-3 flex items-center space-x-1 text-xs font-bold text-blue-400">
                        <span>Offline Settings</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                </div>

                {/* 3. Examination Attendance Reports */}
                <div
                    onClick={() => setActiveTab('reports')}
                    className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Printer className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        Attendance Audit Reports
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Review verified candidates, print official hall registers, or export CSV files for the examination cell.
                    </p>
                    <div className="mt-3 flex items-center space-x-1 text-xs font-bold text-purple-400">
                        <span>View Hall Audit</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>

            {/* ================= INSTANT VERIFICATION MODAL / QUICK VERIFY ================= */}
            {quickVerification && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setQuickVerification(null)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>

                        <h3 className="text-base font-bold text-white mb-4">
                            Candidate Verification & ID Card Comparison
                        </h3>

                        <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-3">
                            <img
                                src={quickVerification.student?.photo}
                                alt="Student"
                                className="w-20 h-24 rounded-xl object-cover border-2 border-emerald-500 shadow-md"
                            />
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white">{quickVerification.student?.name}</h4>
                                <p className="font-mono text-xs text-blue-400">PRN: {quickVerification.student?.PRN}</p>
                                <p className="text-xs text-slate-300">Roll: {quickVerification.student?.rollNumber}</p>
                                <div className="mt-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs inline-block">
                                    Desk: {quickVerification.seat?.seatNumber}
                                </div>
                            </div>
                        </div>

                        {/* Scheduled Subject Information */}
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-3 text-xs space-y-1">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                                Scheduled Examination Paper
                            </span>
                            <div className="font-bold text-white text-sm">
                                {selectedExam?.subject?.subjectCode}: {selectedExam?.subject?.subjectName}
                            </div>
                            <div className="text-slate-400 text-[11px] flex items-center space-x-2">
                                <span className="flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{selectedExam?.startTime} – {selectedExam?.endTime}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center space-x-1">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{selectedHall?.hallNumber}</span>
                                </span>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs rounded-xl mb-4">
                            <strong>Face Match Prompt:</strong> Compare official photograph above against student's physical College Identity Card before confirming admission for this subject.
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleMarkAttendance('Present')}
                                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center space-x-1 cursor-pointer"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Present</span>
                            </button>
                            <button
                                onClick={() => handleMarkAttendance('Absent')}
                                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center space-x-1 cursor-pointer"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Absent</span>
                            </button>
                            <button
                                onClick={() => handleMarkAttendance('Malpractice Flagged')}
                                className="py-2.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 text-red-300 font-bold text-xs border border-red-500/30 flex items-center justify-center space-x-1 cursor-pointer"
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Flag Case</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= LIVE HALL SEATING REGISTER TABLE ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center space-x-2">
                            <Building2 className="w-5 h-5 text-blue-400" />
                            <span>Proctored Seating Register: {selectedHall?.hallNumber || 'Hall'}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Click any candidate to verify photo or click "Open Camera QR Scanner" to scan admission cards.
                        </p>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            {rosterData.markedPresent} Present
                        </span>
                        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-bold">
                            {rosterData.pending || (rosterData.totalAllocated - rosterData.markedPresent)} Pending
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                            <tr>
                                <th className="px-5 py-3">Desk Number</th>
                                <th className="px-5 py-3">Student Name</th>
                                <th className="px-5 py-3">PRN</th>
                                <th className="px-5 py-3">Branch</th>
                                <th className="px-5 py-3">Scheduled Subject</th>
                                <th className="px-5 py-3">Verification Status</th>
                                <th className="px-5 py-3 text-right">Quick Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {rosterData.roster?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40">
                                    <td className="px-5 py-3 font-mono font-bold text-emerald-400">
                                        {item.seat?.seatNumber || (item.seat ? (typeof item.seat === 'string' ? item.seat : 'Assigned') : 'Pending')}
                                    </td>
                                    <td className="px-5 py-3 font-bold text-white flex items-center space-x-2">
                                        {item.student?.photo && (
                                            <img
                                                src={item.student.photo}
                                                alt="avatar"
                                                className="w-6 h-6 rounded-full object-cover border border-slate-700"
                                            />
                                        )}
                                        <span>{item.student?.name}</span>
                                    </td>
                                    <td className="px-5 py-3 font-mono text-blue-400 font-semibold">
                                        {item.student?.PRN}
                                    </td>
                                    <td className="px-5 py-3">
                                        {item.student?.branch?.branchCode || 'CSE'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="font-mono font-bold text-xs text-blue-400">
                                            {item.subject?.subjectCode || selectedExam?.subject?.subjectCode || 'CS501'}
                                        </div>
                                        <div className="text-[11px] text-slate-300 font-medium truncate max-w-[150px]">
                                            {item.subject?.subjectName || selectedExam?.subject?.subjectName || 'Database Management Systems'}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            item.status === 'Present'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : item.status === 'Malpractice Flagged'
                                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => handleQuickVerifyPRN(item.student?.PRN)}
                                            className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold text-[11px] transition-colors"
                                        >
                                            Verify Student
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InvigilatorDashboard;
