import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { downloadElementAsPDF, generateNativeHallTicketPDF, triggerFileDownload } from '../utils/pdfGenerator';
import { 
    GraduationCap, 
    QrCode, 
    Calendar, 
    Clock, 
    Building2, 
    FileText, 
    Download, 
    Printer, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle, 
    Maximize2, 
    X, 
    Search,
    User,
    Sparkles,
    ArrowUpRight,
    KeyRound,
    Lock,
    Eye,
    EyeOff,
    Shield,
    Mail
} from 'lucide-react';
import StudentSearchCombobox from '../components/StudentSearchCombobox';

const StudentDashboard = ({ setActiveTab }) => {
    const { user, changePassword } = useAuth();
    const [students, setStudents] = useState([]);
    const [selectedPRN, setSelectedPRN] = useState(() => {
        if (user?.role === 'student') {
            return user?.PRN || user?.email || '';
        }
        return '';
    });
    const [ticketData, setTicketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fullscreenQR, setFullscreenQR] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const ticketPrintRef = useRef(null);

    // First login / self-service password change states
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');
    const [savingPass, setSavingPass] = useState(false);

    // Auto-prompt modal on first login
    useEffect(() => {
        if (user?.role === 'student' && user?.mustChangePassword) {
            setShowPasswordModal(true);
        }
    }, [user]);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        if (!newPassword || newPassword.trim().length < 6) {
            setPassError('Password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPassError('Passwords do not match.');
            return;
        }
        if (user?.PRN && newPassword.trim() === `Student@${user.PRN.trim()}`) {
            setPassError('Please pick a new secret password rather than the default formula.');
            return;
        }

        try {
            setSavingPass(true);
            const res = await changePassword(newPassword.trim());
            setPassSuccess(res?.message || 'Your private password has been saved successfully!');
            setTimeout(() => {
                setShowPasswordModal(false);
                setNewPassword('');
                setConfirmPassword('');
            }, 1200);
        } catch (err) {
            const serverMsg = err.response?.data?.message;
            const textMsg = typeof err.response?.data === 'string' && err.response.data.includes('<pre>')
                ? err.response.data.replace(/<[^>]+>/g, '').trim()
                : null;
            setPassError(serverMsg || textMsg || err.message || 'Failed to update password.');
        } finally {
            setSavingPass(false);
        }
    };

    // Fetch all students for the switcher (admin/staff only)
    useEffect(() => {
        let isMounted = true;
        const fetchStudents = async () => {
            try {
                if (user?.role === 'student') {
                    const identifier = user.PRN || user.email;
                    if (identifier && isMounted) {
                        setSelectedPRN(identifier);
                    }
                    return;
                }
                const res = await api.get('/students');
                const list = res.data || [];
                if (!isMounted) return;
                setStudents(list);

                // Admin / Staff preview: ensure selectedPRN is a valid, existing student
                if (list.length > 0) {
                    setSelectedPRN(prev => {
                        if (prev && list.some(s => String(s.PRN) === String(prev))) {
                            return prev;
                        }
                        return list[0].PRN;
                    });
                } else {
                    setSelectedPRN('');
                }
            } catch (err) {
                console.error('Error fetching students:', err);
            }
        };
        fetchStudents();
        return () => { isMounted = false; };
    }, [user]);

    // Keep selectedPRN valid when students list changes (e.g. after a student is deleted)
    useEffect(() => {
        if (user?.role !== 'student') {
            if (students.length > 0) {
                const exists = students.some(s => String(s.PRN) === String(selectedPRN));
                if (!exists) {
                    setSelectedPRN(students[0].PRN);
                }
            } else if (students.length === 0) {
                setSelectedPRN('');
            }
        }
    }, [students, selectedPRN, user]);

    // Fetch student allocations and QR codes whenever selectedPRN or user changes
    const fetchStudentData = async (prn) => {
        const effectiveIdentifier = user?.role === 'student' ? (user.PRN || user.email || selectedPRN || prn) : prn;
        if (!effectiveIdentifier) {
            setTicketData(null);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await api.get(`/allocations/hall-ticket/${effectiveIdentifier}`);
            setTicketData(res.data);
            if (res.data?.student?.PRN && selectedPRN !== res.data.student.PRN) {
                setSelectedPRN(res.data.student.PRN);
            }
        } catch (err) {
            console.error('Error fetching student dashboard data:', err);
            setTicketData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'student') {
            const id = user.PRN || user.email || selectedPRN;
            if (id) {
                fetchStudentData(id);
            } else {
                setTicketData(null);
                setLoading(false);
            }
        } else if (selectedPRN) {
            fetchStudentData(selectedPRN);
        } else {
            setTicketData(null);
            setLoading(false);
        }
    }, [selectedPRN, user]);

    const student = ticketData?.student;
    const allocations = ticketData?.allocations || [];
    const isEnrolled = ticketData?.isEnrolled !== undefined
        ? ticketData.isEnrolled
        : Boolean(student?.registeredSubjects && student.registeredSubjects.length > 0);
    const hasAllocations = allocations.length > 0;
    const isHallTicketGenerated = Boolean(
        ticketData &&
        (ticketData.hallTicketGenerated !== undefined ? ticketData.hallTicketGenerated : (isEnrolled && hasAllocations))
    );

    const handleDownloadPDF = async () => {
        if (!ticketData) return;
        if (!isHallTicketGenerated) {
            alert(!isEnrolled 
                ? 'Hall ticket cannot be generated: You are not enrolled for any examination subjects.'
                : 'Hall ticket cannot be generated: No examination seating allocations found.'
            );
            return;
        }
        try {
            setDownloading(true);
            await downloadElementAsPDF(
                ticketPrintRef.current,
                `GCOEA_HallTicket_${selectedPRN}.pdf`,
                'a4',
                ticketData
            );
        } catch (error) {
            console.warn('PDF export fallback to native generator:', error);
            generateNativeHallTicketPDF(
                ticketData.student,
                ticketData.allocations,
                `GCOEA_HallTicket_${selectedPRN}.pdf`
            );
        } finally {
            setDownloading(false);
        }
    };

    // Download QR Code as PNG Image File
    const handleDownloadQRImage = (dataUrl, subjectCode) => {
        if (!dataUrl) return;
        triggerFileDownload(
            dataUrl,
            `GCOEA_QR_${student?.PRN || selectedPRN}_${subjectCode || 'Exam'}.png`
        );
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Top Bar: Candidate Identity / Admin Switcher */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {user?.role === 'student' ? (
                        <div className="flex items-center space-x-2">
                            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <GraduationCap className="w-4 h-4" />
                            </span>
                            <div>
                                <span className="text-xs font-bold text-white block">
                                    Student Examination Portal
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    Logged in as: <strong className="text-blue-400 font-mono">{student?.PRN || user.PRN}</strong> • {student?.name || user.name}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <StudentSearchCombobox
                            students={students}
                            selectedPRN={selectedPRN}
                            onSelectStudent={(prn) => setSelectedPRN(prn)}
                            label="Preview Student Ticket:"
                        />
                    )}
                </div>


                <div className="flex items-center space-x-2">
                    {user?.role === 'student' && (
                        <button
                            onClick={() => {
                                setPassError('');
                                setPassSuccess('');
                                setShowPasswordModal(true);
                            }}
                            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                            title="Change your secret password"
                        >
                            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                            <span>Change Password</span>
                        </button>
                    )}
                    <button
                        onClick={handleDownloadPDF}
                        disabled={!isHallTicketGenerated || downloading}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!isHallTicketGenerated ? (!isEnrolled ? 'Hall ticket not generated: Candidate is not enrolled for any subject' : 'Hall ticket not generated: No exam seating allocations') : 'Download Official Hall Ticket'}
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloading ? 'Exporting PDF...' : 'Download Official Hall Ticket'}</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!isHallTicketGenerated) {
                                alert(!isEnrolled 
                                    ? 'Hall ticket cannot be printed: Candidate is not enrolled for any examination subjects.'
                                    : 'Hall ticket cannot be printed: No exam seating allocations found.'
                                );
                                return;
                            }
                            window.print();
                        }}
                        disabled={!isHallTicketGenerated}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!isHallTicketGenerated ? 'Hall ticket not generated' : 'Print'}
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* First-Login Alert Banner */}
            {user?.role === 'student' && user?.mustChangePassword && (
                <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
                    <div className="flex items-center space-x-3">
                        <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                            <Lock className="w-5 h-5" />
                        </span>
                        <div>
                            <span className="text-xs font-bold text-white block">
                                Action Required: Set Your Private Secret Password
                            </span>
                            <span className="text-[11px] text-amber-300/90 leading-relaxed block mt-0.5">
                                You logged in using the default formula (<code className="bg-amber-950/70 px-1.5 py-0.5 rounded text-amber-200 font-mono">Student@{user.PRN}</code>). Please set your unique secret password to prevent anyone else from accessing your account.
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setPassError('');
                            setPassSuccess('');
                            setShowPasswordModal(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-all shrink-0 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                        Set Private Password
                    </button>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span>Loading student examination profile...</span>
                </div>
            ) : user?.role !== 'student' && (!selectedPRN || students.length === 0) ? (
                <div className="text-center py-20 text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300">No student profiles found</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        There are currently no students registered in the system. Add or import students from the Students tab to view examination hall tickets.
                    </p>
                </div>
            ) : !student ? (
                <div className="text-center py-16 text-slate-400 space-y-4 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">Student Profile Not Found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            The student profile for <code className="text-amber-400 font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded">{selectedPRN || user?.PRN || user?.email}</code> does not exist or may have been deleted.
                        </p>
                    </div>
                    {user?.role !== 'student' && students.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedPRN(students[0].PRN)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                        >
                            Switch to {students[0].name} ({students[0].PRN})
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* ================= STUDENT IDENTITY CARD BANNER ================= */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
                        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
                            {/* Candidate Photograph */}
                            <div className="relative group flex-shrink-0">
                                <div className="w-28 h-32 sm:w-32 sm:h-36 rounded-2xl overflow-hidden border-2 border-blue-500/60 shadow-2xl bg-slate-800">
                                    <img
                                        src={student.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                                        alt={student.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-slate-950 uppercase shadow-md flex items-center space-x-1">
                                    <CheckCircle2 className="w-3 h-3 text-slate-950" />
                                    <span>Verified Student</span>
                                </span>
                            </div>

                            {/* Candidate Bio & Details */}
                            <div className="flex-1 text-center md:text-left space-y-2">
                                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
                                    <GraduationCap className="w-3.5 h-3.5" />
                                    <span>Government College of Engineering, Amravati</span>
                                </div>

                                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                                    {student.name}
                                </h2>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-slate-300">
                                    <span>PRN: <strong className="font-mono text-blue-400">{student.PRN}</strong></span>
                                    <span>•</span>
                                    <span>Roll: <strong className="text-white">{student.rollNumber}</strong></span>
                                    <span>•</span>
                                    <span>College ID: <strong className="font-mono text-slate-300">{student.collegeId || student.PRN}</strong></span>
                                </div>

                                <p className="text-xs text-slate-400">
                                    Department of {student.branch?.branchName || 'Computer Science & Engineering'} • Semester {student.semester} (Div {student.division || 'A'})
                                </p>

                                <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-2">
                                    <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300 flex items-center space-x-1.5">
                                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                                        <span>{student.email || `${student.PRN}@gcoea.ac.in`}</span>
                                    </span>
                                    <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300 flex items-center space-x-1.5">
                                        <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                                        <span>B.Tech Candidate</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ================= STUDENT QUICK STATS ================= */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Scheduled Exams</span>
                            <div className="mt-1 text-2xl font-bold text-white">{allocations.length}</div>
                            <span className="text-[10px] text-slate-500">Upcoming papers</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Candidate Status</span>
                            <div className={`mt-1 text-xl font-bold truncate ${isEnrolled ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {isEnrolled ? 'Verified & Enrolled' : 'Not Enrolled in Subjects'}
                            </div>
                            <span className={`text-[10px] ${isEnrolled ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                                {isEnrolled ? `${student?.registeredSubjects?.length || 0} Registered Course(s)` : 'Curriculum Registration Required'}
                            </span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Admission Card</span>
                            <div className={`mt-1 text-xl font-bold ${isHallTicketGenerated ? 'text-blue-400' : 'text-rose-400'}`}>
                                {isHallTicketGenerated ? 'Issued & Valid' : 'Not Generated'}
                            </div>
                            <span className={`text-[10px] ${isHallTicketGenerated ? 'text-blue-400/80' : 'text-rose-400/80'}`}>
                                {isHallTicketGenerated ? 'Digital PDF Ready' : (!isEnrolled ? 'Blocked • Zero Subjects' : 'Seating Allocation Pending')}
                            </span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Subject QR Codes</span>
                            <div className={`mt-1 text-xl font-bold ${isHallTicketGenerated ? 'text-purple-400' : 'text-slate-500'}`}>
                                {isHallTicketGenerated ? 'Unique / Verified' : 'None Available'}
                            </div>
                            <span className={`text-[10px] ${isHallTicketGenerated ? 'text-purple-400/80' : 'text-slate-500'}`}>
                                {isHallTicketGenerated ? 'Anti-Tamper HMAC' : (!isEnrolled ? 'Enrollment Required' : 'Allocation Pending')}
                            </span>
                        </div>
                    </div>

                    {/* ================= EXAMINATION SCHEDULE & ASSIGNED DESKS ================= */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center space-x-2">
                                <Calendar className="w-5 h-5 text-blue-400" />
                                <span>My Examination Schedule & Admission Pass</span>
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">
                                Summer / Winter End Semester
                            </span>
                        </div>

                        {!isHallTicketGenerated ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div className="max-w-md mx-auto space-y-1.5">
                                    <p className="text-sm font-bold text-white">
                                        {!isEnrolled ? "Hall Ticket Not Generated: No Examination Subjects Enrolled" : "Seating Allocations Pending"}
                                    </p>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        {!isEnrolled 
                                            ? `Candidate ${student?.name} is not enrolled for any examination subjects for this session. In accordance with examination regulations, hall tickets and subject QR codes are only generated for students who have registered examination subjects.`
                                            : `Candidate ${student?.name} is registered for ${student?.registeredSubjects?.length || 0} subject(s), but examination seating allocations have not been generated yet.`
                                        }
                                    </p>
                                    {isEnrolled && student?.registeredSubjects && student.registeredSubjects.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-800/80 text-left">
                                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">Registered Examination Courses:</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {student.registeredSubjects.map(sub => (
                                                    <div key={sub._id} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                                                        <div>
                                                            <span className="font-mono text-xs font-bold text-blue-400 block">{sub.subjectCode}</span>
                                                            <span className="text-xs text-slate-200">{sub.subjectName}</span>
                                                        </div>
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">Sem {sub.semester}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {!isEnrolled && (
                                        <div className="pt-2">
                                            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                                Please contact the Examination Cell to register your semester subjects
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {allocations.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all group"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-blue-400 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                    {item.exam?.subject?.subjectCode}
                                                </span>
                                                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.attendance?.status === 'Present'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                        : item.attendance?.status === 'Absent'
                                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                }`}>
                                                    {item.attendance?.status === 'Present' ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                            <span>Present for Paper</span>
                                                        </>
                                                    ) : item.attendance?.status === 'Absent' ? (
                                                        <>
                                                            <X className="w-3 h-3 text-rose-400" />
                                                            <span>Marked Absent</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3 h-3 text-amber-400" />
                                                            <span>Awaiting Scan</span>
                                                        </>
                                                    )}
                                                </span>
                                            </div>

                                            <h4 className="text-base font-bold text-white mt-3 leading-snug">
                                                {item.exam?.subject?.subjectName}
                                            </h4>

                                            {/* Date, Time & Hall Callout */}
                                            <div className="mt-4 space-y-2 text-xs text-slate-300 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                                                <div className="flex items-center space-x-2">
                                                    <Calendar className="w-4 h-4 text-purple-400" />
                                                    <span>Date: <strong className="text-white">{new Date(item.exam?.examDate).toDateString()}</strong></span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Clock className="w-4 h-4 text-purple-400" />
                                                    <span>Time: <strong className="text-white">{item.exam?.startTime} – {item.exam?.endTime}</strong></span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Building2 className="w-4 h-4 text-emerald-400" />
                                                    <span>Campus Center: <strong className="text-white">{item.hall?.building || 'Main Academic Complex'}</strong> (Floor {item.hall?.floor || 1})</span>
                                                </div>
                                            </div>


                                            {/* Subject Attendance Status Tracker */}
                                            <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                                                item.attendance?.status === 'Present'
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                    : item.attendance?.status === 'Absent'
                                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                                            }`}>
                                                <div className="flex items-center space-x-2">
                                                    <CheckCircle2 className={`w-3.5 h-3.5 ${item.attendance?.status === 'Present' ? 'text-emerald-400' : 'text-slate-500'}`} />
                                                    <span>Subject Attendance: <strong className={item.attendance?.status === 'Present' ? 'text-emerald-300' : 'text-slate-300'}>{item.attendance?.status || 'Pending'}</strong></span>
                                                </div>
                                                {item.attendance?.verifiedAt && (
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(item.attendance.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Subject-Specific QR Code Section */}
                                        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <img
                                                    src={item.qrCode}
                                                    alt="QR"
                                                    className="w-12 h-12 rounded-lg bg-white p-1 border border-slate-700 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => setFullscreenQR(item)}
                                                />
                                                <div>
                                                    <span className="text-xs font-bold text-white block">Subject-Specific QR</span>
                                                    <span className="text-[10px] text-slate-400">Unique for {item.exam?.subject?.subjectCode}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setFullscreenQR(item)}
                                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5" />
                                                <span>Scan View</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ================= CANDIDATE EXAMINATION RULES & GUIDELINES ================= */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                        <div className="flex items-center space-x-2">
                            <ShieldCheck className="w-5 h-5 text-amber-400" />
                            <h3 className="text-base font-bold text-white">Instructions for GCOEA Examination Candidates</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                                <span className="font-bold text-white block">1. Identity Verification</span>
                                <p className="text-slate-400">
                                    You must bring both this admission card and your physical College Identity Card. The invigilator will scan your subject QR code and compare your face against your registered photograph.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                                <span className="font-bold text-white block">2. Single-Subject Bound QR</span>
                                <p className="text-slate-400">
                                    Each QR code is cryptographically unique to one specific subject. Attempting to scan a QR code from another subject will trigger an instant invigilator error alert.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                                <span className="font-bold text-white block">3. Seating Discipline</span>
                                <p className="text-slate-400">
                                    Occupy strictly your allocated desk (e.g. {allocations[0]?.seat?.seatNumber || 'assigned desk'}). Adjacent desks are interleaved with different branches to prevent malpractice.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                                <span className="font-bold text-white block">4. Reporting Time</span>
                                <p className="text-slate-400">
                                    Arrive at the examination hall at least 15 minutes before the scheduled start time for digital QR verification.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* PRINTABLE CONTAINER FOR PDF GENERATION (Rendered off-screen only when hall ticket is generated) */}
                    {isHallTicketGenerated && (
                        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px', pointerEvents: 'none', opacity: 0 }}>
                            <div ref={ticketPrintRef} className="p-8 bg-white text-slate-900 font-sans max-w-3xl">
                                <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
                                    <h1 className="text-xl font-black uppercase text-slate-950">Government College of Engineering, Amravati</h1>
                                    <p className="text-xs text-slate-600 uppercase font-semibold">Autonomous Institute of Govt. of Maharashtra • Estd. 1964</p>
                                    <div className="mt-2 text-sm font-bold bg-slate-900 text-white px-3 py-0.5 rounded inline-block uppercase">
                                        Official Examination Admission Card
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border border-slate-300 p-4 rounded-lg mb-4 text-xs">
                                    <div>
                                        <p><strong>Candidate:</strong> {student.name}</p>
                                        <p><strong>PRN:</strong> {student.PRN}</p>
                                        <p><strong>Roll No:</strong> {student.rollNumber}</p>
                                        <p><strong>Branch:</strong> {student.branch?.branchName || 'Computer Science & Engineering'}</p>
                                        <p><strong>Semester:</strong> Semester {student.semester}</p>
                                    </div>
                                    <img
                                        crossOrigin="anonymous"
                                        src={student.photo}
                                        alt="photo"
                                        className="w-20 h-24 object-cover border border-slate-400 rounded"
                                    />
                                </div>

                                <table className="w-full text-left text-xs border border-slate-300 mb-6">
                                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                                        <tr>
                                            <th className="p-2">Subject</th>
                                            <th className="p-2">Date & Time</th>
                                            <th className="p-2 text-center">Subject QR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allocations.map((a, i) => (
                                            <tr key={i} className="border-b border-slate-200">
                                                <td className="p-2 font-semibold">{a.exam?.subject?.subjectCode}: {a.exam?.subject?.subjectName}</td>
                                                <td className="p-2">{new Date(a.exam?.examDate).toLocaleDateString()} • {a.exam?.startTime}</td>
                                                <td className="p-2 text-center">
                                                    <img src={a.qrCode} alt="qr" className="w-14 h-14 mx-auto" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* FULLSCREEN QR SCAN VIEW MODAL */}
            {fullscreenQR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-center">
                        <button
                            onClick={() => setFullscreenQR(null)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-4">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                                GCOEA Digital Admission Token
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                {fullscreenQR.exam?.subject?.subjectName}
                            </h3>
                            <span className="font-mono text-xs text-slate-400">
                                {fullscreenQR.exam?.subject?.subjectCode}
                            </span>
                        </div>

                        {/* Large High Contrast QR for Invigilator Scanning */}
                        <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border-4 border-emerald-500 mb-4">
                            <img
                                src={fullscreenQR.qrCode}
                                alt="High Contrast QR Code"
                                className="w-56 h-56 mx-auto"
                            />
                        </div>

                        <div className="space-y-1 text-xs">
                            <p className="font-bold text-white">{student?.name}</p>
                            <p className="font-mono text-blue-400 font-semibold">PRN: {student?.PRN}</p>
                            <div className="inline-block mt-1 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 font-bold">
                                Official Candidate Pass
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                            <button
                                onClick={() => handleDownloadQRImage(fullscreenQR.qrCode, fullscreenQR.exam?.subject?.subjectCode)}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition-all"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download QR (PNG)</span>
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloading}
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                            >
                                <Download className="w-3.5 h-3.5 text-blue-400" />
                                <span>{downloading ? 'Exporting...' : 'Download Pass (PDF)'}</span>
                            </button>
                        </div>

                        <p className="text-[11px] text-slate-400 mt-3">
                            Show this high-contrast QR code to the hall invigilator for digital verification and attendance logging.
                        </p>
                    </div>
                </div>
            )}

            {/* PASSWORD CHANGE MODAL */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
                    <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-white">
                        {/* Close button only if student has already set a custom password before */}
                        {!user?.mustChangePassword && (
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="absolute right-4 top-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">
                                    {user?.mustChangePassword ? 'First Login: Secure Your Account' : 'Change Secret Password'}
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    {user?.mustChangePassword 
                                        ? 'Set your confidential secret password to complete account activation.'
                                        : 'Update your login password anytime for personal privacy.'}
                                </p>
                            </div>
                        </div>

                        {user?.mustChangePassword && (
                            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed flex items-start space-x-2">
                                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <span>
                                    <strong>Zero Leakage Policy:</strong> You are currently using the institutional default formula (<code className="font-mono text-amber-200">Student@{user?.PRN}</code>). Once you set a new secret password, nobody else will ever be able to access your hall ticket or dashboard.
                                </span>
                            </div>
                        )}

                        {passError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{passError}</span>
                            </div>
                        )}

                        {passSuccess && (
                            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{passSuccess}</span>
                            </div>
                        )}

                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    New Secret Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        required
                                        className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Confirm Secret Password
                                </label>
                                <input
                                    type={showNewPass ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-type new password"
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-mono"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={savingPass}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                            >
                                {savingPass ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Saving & Encrypting Password...</span>
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        <span>Save Private Password</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
