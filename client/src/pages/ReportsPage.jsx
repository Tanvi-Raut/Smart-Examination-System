import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    ShieldCheck, 
    Download, 
    Printer, 
    Calendar, 
    Building2, 
    BookOpen, 
    Users, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle,
    BarChart3
} from 'lucide-react';

const ReportsPage = () => {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchExams = async () => {
            try {
                const res = await api.get('/exams');
                const list = res.data || [];
                setExams(list);
                if (list.length > 0) {
                    setSelectedExamId(list[0]._id);
                }
            } catch (err) {
                console.error('Fetch exams error:', err);
            }
        };
        fetchExams();
    }, []);

    const fetchReport = async (examId) => {
        if (!examId) return;
        try {
            setLoading(true);
            const res = await api.get(`/attendance/report/${examId}`);
            setReport(res.data);
        } catch (err) {
            console.error('Fetch report error:', err);
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedExamId) {
            fetchReport(selectedExamId);
        }
    }, [selectedExamId]);

    const handleExportCSV = () => {
        if (!report || !report.students) return;

        const headers = ["Student Name", "PRN", "Roll Number", "Branch", "Scheduled Subject Code", "Scheduled Subject Name", "Hall", "Seat", "Attendance Status", "Verification Method", "Timestamp"];
        const rows = report.students.map(s => [
            `"${s.studentName || ''}"`,
            `"${s.PRN || ''}"`,
            `"${s.rollNumber || ''}"`,
            `"${s.branch || ''}"`,
            `"${report.exam?.subjectCode || ''}"`,
            `"${report.exam?.subjectName || ''}"`,
            `"${s.hall || ''}"`,
            `"${s.seat || ''}"`,
            `"${s.status || ''}"`,
            `"${s.method || ''}"`,
            `"${s.verifiedAt ? new Date(s.verifiedAt).toLocaleString() : 'N/A'}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `GCOEA_Attendance_Report_${report.exam?.subjectCode || 'Exam'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <ShieldCheck className="w-6 h-6 text-cyan-500" />
                        <span>Examination & Attendance Reports</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Comprehensive post-examination analytics, hall-wise breakdowns, and attendance audit trails.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handlePrint}
                        disabled={!report}
                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Report</span>
                    </button>

                    <button
                        onClick={handleExportCSV}
                        disabled={!report}
                        className="flex items-center space-x-1.5 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/30 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Exam Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Examination:</span>
                <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                >
                    {exams.map(e => (
                        <option key={e._id} value={e._id}>
                            {e.subject?.subjectCode}: {e.subject?.subjectName} ({new Date(e.examDate).toLocaleDateString()})
                        </option>
                    ))}
                </select>
            </div>

            {/* REPORT BODY */}
            {loading ? (
                <div className="text-center py-16 text-slate-400 text-xs">Generating report...</div>
            ) : !report ? (
                <div className="text-center py-16 text-slate-400 text-xs">No report data found.</div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Banner */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Total Allocated</span>
                            <div className="mt-2 text-2xl font-bold text-white">{report.summary?.totalAllocated}</div>
                            <span className="text-[10px] text-slate-500">Eligible enrolled candidates</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Marked Present</span>
                            <div className="mt-2 text-2xl font-bold text-emerald-400">{report.summary?.presentCount}</div>
                            <span className="text-[10px] text-emerald-400/80">Attendance Rate: {report.summary?.attendanceRate}</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Absent / Unmarked</span>
                            <div className="mt-2 text-2xl font-bold text-slate-400">{report.summary?.absentCount}</div>
                            <span className="text-[10px] text-slate-500">Non-attending candidates</span>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                            <span className="text-xs font-medium text-slate-400">Malpractice Flagged</span>
                            <div className="mt-2 text-2xl font-bold text-red-400">{report.summary?.flaggedCount}</div>
                            <span className="text-[10px] text-red-400/80">Requires disciplinary review</span>
                        </div>
                    </div>

                    {/* Hall-Wise & Branch-Wise Summary Grids */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Hall Breakdown */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                            <div className="flex items-center space-x-2 mb-4">
                                <Building2 className="w-5 h-5 text-emerald-400" />
                                <h3 className="text-base font-bold text-white">Hall-by-Hall Distribution</h3>
                            </div>

                            <div className="space-y-3">
                                {report.hallBreakdown?.map((h, idx) => (
                                    <div key={idx} className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-white text-sm">{h.hallNumber}</span>
                                            <span className="text-xs text-slate-400 block">{h.total} Candidates Allocated</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                                                {h.present} Present
                                            </span>
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 font-bold text-xs">
                                                {h.absent} Absent
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Branch Breakdown */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                            <div className="flex items-center space-x-2 mb-4">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                                <h3 className="text-base font-bold text-white">Department / Branch Breakdown</h3>
                            </div>

                            <div className="space-y-3">
                                {report.branchBreakdown?.map((b, idx) => (
                                    <div key={idx} className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-white text-sm">{b.branchName}</span>
                                            <span className="text-xs text-slate-400 block">{b.total} Enrolled</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-xs">
                                                {b.present} Present
                                            </span>
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 font-bold text-xs">
                                                {b.absent} Absent
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Candidate Attendance Register */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-white">Complete Candidate Attendance Register</h3>
                            <span className="text-xs text-slate-400">Total {report.students?.length} Records</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                    <tr>
                                        <th className="px-5 py-3">Desk</th>
                                        <th className="px-5 py-3">Student Name</th>
                                        <th className="px-5 py-3">PRN</th>
                                        <th className="px-5 py-3">Branch</th>
                                        <th className="px-5 py-3">Scheduled Subject</th>
                                        <th className="px-5 py-3">Hall</th>
                                        <th className="px-5 py-3">Attendance Status</th>
                                        <th className="px-5 py-3">Verification Method</th>
                                        <th className="px-5 py-3 text-right">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {report.students?.map((s, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/40">
                                            <td className="px-5 py-3 font-mono font-bold text-emerald-400">{s.seat}</td>
                                            <td className="px-5 py-3 font-bold text-white">{s.studentName}</td>
                                            <td className="px-5 py-3 font-mono text-blue-400">{s.PRN}</td>
                                            <td className="px-5 py-3">{s.branch}</td>
                                            <td className="px-5 py-3">
                                                <span className="font-mono font-bold text-xs text-cyan-400">
                                                    {report.exam?.subjectCode}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                                                    {report.exam?.subjectName}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">{s.hall}</td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    s.status === 'Present'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : s.status === 'Malpractice Flagged'
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                                }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                                                {s.method}
                                            </td>
                                            <td className="px-5 py-3 text-right text-slate-400">
                                                {s.verifiedAt ? new Date(s.verifiedAt).toLocaleTimeString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsPage;
