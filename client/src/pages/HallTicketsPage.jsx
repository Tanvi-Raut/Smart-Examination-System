import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { downloadElementAsPDF, downloadElementAsImage, generateNativeHallTicketPDF, generateNativeHallTicketImage } from '../utils/pdfGenerator';
import { 
    FileText, 
    Download, 
    Printer, 
    Search, 
    QrCode, 
    GraduationCap, 
    ShieldCheck, 
    Calendar,
    Clock,
    Building2,
    CheckCircle2,
    AlertCircle,
    XCircle
} from 'lucide-react';
import StudentSearchCombobox from '../components/StudentSearchCombobox';

const HallTicketsPage = () => {
    const { user } = useAuth();
    const isStudent = user?.role === 'student';

    const [students, setStudents] = useState([]);
    const [selectedStudentPRN, setSelectedStudentPRN] = useState(() => {
        if (isStudent && user?.PRN && !user.PRN.includes('@')) {
            return user.PRN;
        }
        return '';
    });
    const [hallTicketData, setHallTicketData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [ticketError, setTicketError] = useState('');

    const ticketRef = useRef(null);

    useEffect(() => {
        const fetchStudents = async () => {
            if (isStudent) {
                // Students are strictly locked to their own PRN
                if (user?.PRN && !user.PRN.includes('@')) {
                    setSelectedStudentPRN(user.PRN);
                    return;
                }
                try {
                    const res = await api.get('/students');
                    const list = res.data || [];
                    const match = list.find(s => 
                        s.email?.toLowerCase() === user?.email?.toLowerCase() || 
                        s.name?.toLowerCase() === user?.name?.toLowerCase()
                    );
                    if (match) {
                        setSelectedStudentPRN(match.PRN);
                    } else if (list.length > 0) {
                        setSelectedStudentPRN(list[0].PRN);
                    }
                } catch (err) {
                    console.error('Fetch students error:', err);
                }
                return;
            }

            // Only Admins / Invigilators can search across all students
            try {
                const res = await api.get('/students');
                const list = res.data || [];
                setStudents(list);
                if (list.length > 0) {
                    setSelectedStudentPRN(prev => {
                        if (prev && !prev.includes('@') && list.some(s => s.PRN === prev)) {
                            return prev;
                        }
                        return list[0].PRN;
                    });
                }
            } catch (err) {
                console.error('Fetch students error:', err);
            }
        };
        fetchStudents();
    }, [user, isStudent]);

    const fetchTicket = async (prn) => {
        const effectivePRN = isStudent ? (user?.PRN && !user.PRN.includes('@') ? user.PRN : selectedStudentPRN || prn) : prn;
        if (!effectivePRN || effectivePRN.includes('@')) {
            setHallTicketData(null);
            return;
        }
        try {
            setLoading(true);
            setTicketError('');
            const res = await api.get(`/allocations/hall-ticket/${effectivePRN}`);
            setHallTicketData(res.data);
        } catch (err) {
            console.error('Fetch ticket error:', err);
            setHallTicketData(null);
            setTicketError(err.response?.data?.message || 'Error fetching hall ticket');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedStudentPRN && !selectedStudentPRN.includes('@')) {
            fetchTicket(selectedStudentPRN);
        }
    }, [selectedStudentPRN]);

    const isEnrolled = hallTicketData?.isEnrolled !== undefined
        ? hallTicketData.isEnrolled
        : Boolean(hallTicketData?.student?.registeredSubjects && hallTicketData.student.registeredSubjects.length > 0);
    const hasAllocations = Boolean(hallTicketData?.allocations && hallTicketData.allocations.length > 0);
    const isHallTicketGenerated = Boolean(
        hallTicketData &&
        (hallTicketData.hallTicketGenerated !== undefined ? hallTicketData.hallTicketGenerated : (isEnrolled && hasAllocations))
    );

    const handleDownloadPDF = async () => {
        if (!hallTicketData) {
            alert('Hall ticket data is still loading.');
            return;
        }
        if (!isHallTicketGenerated) {
            alert(!isEnrolled 
                ? 'Hall ticket cannot be generated: Candidate is not enrolled for any examination subjects.'
                : 'Hall ticket cannot be generated: No examination seating allocations found for this candidate.'
            );
            return;
        }
        try {
            setDownloading(true);
            await downloadElementAsPDF(
                ticketRef.current,
                `GCOEA_HallTicket_${selectedStudentPRN || 'Student'}.pdf`,
                'a4',
                hallTicketData
            );
        } catch (error) {
            console.warn('PDF export fallback to native generator:', error);
            generateNativeHallTicketPDF(
                hallTicketData.student,
                hallTicketData.allocations,
                `GCOEA_HallTicket_${selectedStudentPRN || 'Student'}.pdf`
            );
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadImage = async () => {
        if (!hallTicketData) return;
        if (!isHallTicketGenerated) {
            alert(!isEnrolled 
                ? 'Hall ticket cannot be generated: Candidate is not enrolled for any examination subjects.'
                : 'Hall ticket cannot be generated: No examination seating allocations found for this candidate.'
            );
            return;
        }
        try {
            setDownloading(true);
            await downloadElementAsImage(
                ticketRef.current,
                `GCOEA_HallTicket_${selectedStudentPRN || 'Student'}.png`,
                hallTicketData
            );
        } catch (error) {
            console.warn('Image generation fallback to native generator:', error);
            await generateNativeHallTicketImage(
                hallTicketData.student,
                hallTicketData.allocations,
                `GCOEA_HallTicket_${selectedStudentPRN || 'Student'}.png`
            );
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = () => {
        if (!isHallTicketGenerated) {
            alert(!isEnrolled 
                ? 'Hall ticket cannot be printed: Candidate is not enrolled for any examination subjects.'
                : 'Hall ticket cannot be printed: No examination seating allocations found for this candidate.'
            );
            return;
        }
        window.print();
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <FileText className="w-6 h-6 text-purple-500" />
                        <span>Digital PDF Hall Tickets & QR Admission Cards</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Download and print verified admission cards containing unique subject-specific QR codes for each candidate.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handlePrint}
                        disabled={!isHallTicketGenerated}
                        className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={!isHallTicketGenerated ? (!isEnrolled ? 'Hall ticket not generated: Candidate is not enrolled for any subject' : 'Hall ticket not generated: No exam seating allocations') : 'Print or Save as PDF'}
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print</span>
                    </button>

                    <button
                        onClick={handleDownloadImage}
                        disabled={!isHallTicketGenerated || downloading}
                        className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={!isHallTicketGenerated ? (!isEnrolled ? 'Hall ticket not generated: Candidate is not enrolled for any subject' : 'Hall ticket not generated: No exam seating allocations') : 'Download hall ticket as PNG image'}
                    >
                        <Download className="w-4 h-4" />
                        <span>Download PNG</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={!isHallTicketGenerated || downloading}
                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={!isHallTicketGenerated ? (!isEnrolled ? 'Hall ticket not generated: Candidate is not enrolled for any subject' : 'Hall ticket not generated: No exam seating allocations') : 'Download hall ticket as PDF document'}
                    >
                        <Download className="w-4 h-4" />
                        <span>{downloading ? 'Exporting PDF...' : 'Download PDF'}</span>
                    </button>
                </div>
            </div>

            {/* Student Selector Card - Only visible to Admins & Invigilators */}
            {!isStudent ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <div className="w-full">
                        <StudentSearchCombobox
                            students={students}
                            selectedPRN={selectedStudentPRN}
                            onSelectStudent={(prn) => setSelectedStudentPRN(prn)}
                            label="Select Student:"
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-white block">
                                My Official Examination Hall Ticket
                            </span>
                            <span className="text-[11px] text-slate-400">
                                Candidate: <strong className="text-blue-300">{hallTicketData?.student?.name || user?.name}</strong> • PRN: <span className="font-mono text-emerald-400 font-bold">{selectedStudentPRN}</span>
                            </span>
                        </div>
                    </div>
                    {isHallTicketGenerated ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Verified Student Admission Card
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Admission Card Blocked • {!isEnrolled ? 'No Subjects Enrolled' : 'No Allocations'}</span>
                        </span>
                    )}
                </div>
            )}

            {/* Inline Error Alert Banner */}
            {ticketError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-4 text-xs flex items-center justify-between shadow-lg">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="font-bold">Notice:</span>
                        <span>{ticketError}</span>
                    </div>
                    <button 
                        onClick={() => setTicketError('')} 
                        className="text-red-400 hover:text-white font-bold px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* THE OFFICIAL PRINTABLE HALL TICKET CARD OR NON-GENERATION WARNING */}
            {loading ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span>Loading official hall ticket...</span>
                </div>
            ) : !hallTicketData ? (
                <div className="text-center py-16 text-slate-400 text-xs">No hall ticket data available for this student.</div>
            ) : !isHallTicketGenerated ? (
                /* Card: Hall Ticket Not Generated */
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <span className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>HALL TICKET STATUS: NOT GENERATED</span>
                            </span>

                            <span className="text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800">
                                PRN: <strong className="text-amber-300">{hallTicketData.student?.PRN}</strong>
                            </span>
                        </div>

                        {/* Main Warning Heading */}
                        <div className="space-y-2 mb-6">
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2.5">
                                <span>Admission Card Cannot Be Generated</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                {!isEnrolled ? (
                                    <>
                                        Candidate <strong className="text-white">{hallTicketData.student?.name}</strong> is <span className="text-amber-400 font-bold underline">not enrolled for any examination subjects</span> for this academic session. According to Autonomous Examination Regulations, hall tickets with verified QR admission tokens can only be issued to candidates who are enrolled in active course papers.
                                    </>
                                ) : (
                                    <>
                                        Candidate <strong className="text-white">{hallTicketData.student?.name}</strong> is enrolled in <strong className="text-blue-300">{hallTicketData.student?.registeredSubjects?.length || 0} subject(s)</strong>, but no examination seating allocations have been generated yet for this student.
                                    </>
                                )}
                            </p>
                        </div>

                        {/* Candidate Bio Snapshot Box */}
                        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 mb-6">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                <div className="w-20 h-24 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shrink-0 shadow-md">
                                    <img
                                        crossOrigin="anonymous"
                                        src={hallTicketData.student?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                                        alt={hallTicketData.student?.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs flex-1 w-full">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Candidate Name:</span>
                                        <strong className="text-white text-sm">{hallTicketData.student?.name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Permanent Reg. Number:</span>
                                        <strong className="text-blue-400 font-mono text-sm">{hallTicketData.student?.PRN}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Department / Programme:</span>
                                        <span className="text-slate-200 font-semibold">{hallTicketData.student?.branch?.branchName || 'Civil Engineering'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Academic Term:</span>
                                        <span className="text-slate-200 font-semibold">Semester {hallTicketData.student?.semester} • B.Tech</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Enrolled Examination Subjects:</span>
                                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-bold mt-0.5 ${
                                            isEnrolled 
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {isEnrolled ? `${hallTicketData.student.registeredSubjects.length} Registered` : '0 Subjects Enrolled (Blocked)'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Seating Allocations:</span>
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 mt-0.5">
                                            {hallTicketData.allocations?.length || 0} Scheduled Papers
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Institutional Instructions / Regulation Requirement */}
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-2">
                            <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                                <ShieldCheck className="w-4 h-4 text-amber-400" />
                                <span>Examination Ordinance Requirement</span>
                            </span>
                            <p className="leading-relaxed text-[11px]">
                                {!isEnrolled ? (
                                    <>
                                        Students must be enrolled in their semester curriculum subjects through the College Academic Management Portal before an official Examination Admission Card can be generated. Digital QR tokens cannot be cryptographically signed without bound course codes.
                                    </>
                                ) : (
                                    <>
                                        Subject registration is confirmed, but examination hall seating allocations have not been generated yet. The admission card will become available once seating allocation for the examination session is processed.
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex justify-center">
                    <div
                        ref={ticketRef}
                        className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-200 font-sans"
                        style={{ minHeight: '800px' }}
                    >
                        {/* 1. Official College Header */}
                        <div className="text-center border-b-2 border-slate-800 pb-5">
                            <div className="flex items-center justify-center space-x-3 mb-1">
                                <GraduationCap className="w-8 h-8 text-blue-900" />
                                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                                    Government College of Engineering, Amravati
                                </h2>
                            </div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                (An Autonomous Institute of Government of Maharashtra) • Estd. 1964
                            </p>
                            <div className="inline-block mt-2 px-4 py-1 rounded-full bg-slate-900 text-white font-bold text-xs uppercase tracking-widest shadow-sm">
                                Examination Admission Card / Hall Ticket
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                Summer / Winter End Semester Examinations
                            </p>
                        </div>

                        {/* 2. Candidate Bio & Photo Section */}
                        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs flex-1">
                                <div>
                                    <span className="text-slate-500 font-medium block">Candidate Name:</span>
                                    <span className="font-bold text-slate-900 text-sm">{hallTicketData.student?.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-medium block">Permanent Reg. No (PRN):</span>
                                    <span className="font-mono font-bold text-slate-900 text-sm text-blue-900">{hallTicketData.student?.PRN}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-medium block">Roll Number / Div:</span>
                                    <span className="font-semibold text-slate-900">{hallTicketData.student?.rollNumber} (Div {hallTicketData.student?.division || 'A'})</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-medium block">College ID:</span>
                                    <span className="font-mono font-semibold text-slate-900">{hallTicketData.student?.collegeId || hallTicketData.student?.PRN}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-medium block">Department / Programme:</span>
                                    <span className="font-semibold text-slate-900">{hallTicketData.student?.branch?.branchName || 'Computer Science & Engineering'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-medium block">Academic Term:</span>
                                    <span className="font-semibold text-slate-900">Semester {hallTicketData.student?.semester} • B.Tech</span>
                                </div>
                            </div>

                            {/* Candidate Photograph */}
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-28 border-2 border-slate-800 rounded-lg overflow-hidden shadow-md bg-white">
                                    <img
                                        crossOrigin="anonymous"
                                        src={hallTicketData.student?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                                        alt="Official Candidate Photo"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-[9px] text-slate-500 font-medium mt-1 uppercase">Official Photo</span>
                            </div>
                        </div>

                        {/* 3. Examination Timetable & Subject-Specific QR Codes */}
                        <div className="mt-6">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center space-x-1.5">
                                <QrCode className="w-4 h-4 text-blue-900" />
                                <span>Subject-Specific Examination Schedule & Verification QR Codes</span>
                            </h3>

                            <div className="overflow-x-auto border border-slate-300 rounded-xl">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-300">
                                        <tr>
                                            <th className="p-3">Subject</th>
                                            <th className="p-3">Exam Date & Time</th>
                                            <th className="p-3 text-center">Attendance Status</th>
                                            <th className="p-3 text-center">Subject QR Code</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {hallTicketData.allocations?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-3">
                                                    <span className="font-mono font-bold text-blue-900 text-xs block">
                                                        {item.exam?.subject?.subjectCode}
                                                    </span>
                                                    <span className="font-semibold text-slate-800">
                                                        {item.exam?.subject?.subjectName}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-700 font-medium">
                                                    <div className="flex items-center space-x-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{new Date(item.exam?.examDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <span>{item.exam?.startTime} - {item.exam?.endTime}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                                        item.attendance?.status === 'Present'
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                            : item.attendance?.status === 'Absent'
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                    }`}>
                                                        {item.attendance?.status === 'Present' ? (
                                                            <>
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                <span>Present</span>
                                                            </>
                                                        ) : item.attendance?.status === 'Absent' ? (
                                                            <>
                                                                <XCircle className="w-3 h-3 text-rose-600" />
                                                                <span>Absent</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock className="w-3 h-3 text-amber-600" />
                                                                <span>Scheduled</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <img
                                                            src={item.qrCode}
                                                            alt="Subject QR Code"
                                                            className="w-16 h-16 border border-slate-300 rounded p-1 shadow-sm bg-white"
                                                        />
                                                        <span className="text-[8px] text-slate-500 font-mono mt-0.5">Valid CS-QR</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 4. Instructions to Candidate */}
                        <div className="mt-6 p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-slate-700 space-y-1">
                            <span className="font-bold text-amber-900 block mb-1">Important Instructions for Candidates:</span>
                            <ul className="list-disc pl-4 space-y-0.5">
                                <li>The candidate must carry this printed Hall Ticket along with their official physical College Identity Card to the examination hall.</li>
                                <li>Each QR code on this ticket is <strong>strictly subject-specific</strong>. The invigilator will scan the subject QR with the web application camera.</li>
                                <li>Candidates must occupy only their designated desk as directed by the examination invigilators upon entry verification.</li>
                                <li>Possession of mobile phones, smartwatches, or unauthorized study material in the examination hall is strictly prohibited.</li>
                            </ul>
                        </div>

                        {/* 5. Signatures Footer */}
                        <div className="mt-8 pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
                            <div>
                                <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-36"></div>
                                <span className="font-medium text-slate-600 block mt-1">Candidate's Signature</span>
                            </div>
                            <div>
                                <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-36"></div>
                                <span className="font-medium text-slate-600 block mt-1">Hall Invigilator's Sign</span>
                            </div>
                            <div>
                                <div className="h-10 flex items-center justify-center mx-auto w-36">
                                    <span className="font-serif italic font-bold text-blue-950 text-sm">Dr. N. G. Gadge</span>
                                </div>
                                <span className="font-bold text-slate-900 block mt-1">Controller of Examinations</span>
                                <span className="text-[10px] text-slate-500">GCOEA Amravati</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HallTicketsPage;
