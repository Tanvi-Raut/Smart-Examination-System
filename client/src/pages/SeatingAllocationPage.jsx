import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Layers, 
    Sparkles, 
    Play, 
    Trash2, 
    Search, 
    Building2, 
    CheckCircle2, 
    AlertTriangle,
    QrCode,
    RefreshCw,
    User,
    CheckCircle,
    Info,
    Calendar,
    Clock,
    ShieldCheck,
    Download
} from 'lucide-react';

const SeatingAllocationPage = ({ selectedExamForAction, setActiveTab }) => {
    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [selectedExam, setSelectedExam] = useState(selectedExamForAction || '');
    const [selectedHalls, setSelectedHalls] = useState([]);
    const [strategy, setStrategy] = useState('sequential');
    
    const [allocations, setAllocations] = useState([]);
    const [eligibilityData, setEligibilityData] = useState(null);
    const [showEligibilityDetails, setShowEligibilityDetails] = useState(false);
    const [loading, setLoading] = useState(false);
    const [allocating, setAllocating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterHall, setFilterHall] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const [eRes, hRes] = await Promise.all([
                    api.get('/exams'),
                    api.get('/halls')
                ]);
                const examList = eRes.data || [];
                const hallList = hRes.data || [];
                setExams(examList);
                setHalls(hallList);

                // Default select first exam and all halls
                const examId = selectedExamForAction || (examList[0]?._id || '');
                setSelectedExam(examId);
                setSelectedHalls(hallList.map(h => h._id));

                if (examId) {
                    fetchAllocationsAndEligibility(examId);
                }
            } catch (err) {
                console.error('Init allocation page error:', err);
            }
        };
        init();
    }, [selectedExamForAction]);

    const fetchAllocationsAndEligibility = async (examId) => {
        if (!examId) return;
        try {
            setLoading(true);
            const [allocRes, eligRes] = await Promise.all([
                api.get(`/allocations/exam/${examId}`),
                api.get(`/allocations/eligibility/${examId}`)
            ]);
            setAllocations(allocRes.data || []);
            setEligibilityData(eligRes.data || null);
        } catch (err) {
            console.error('Fetch allocations/eligibility error:', err);
            setAllocations([]);
            setEligibilityData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleExamChange = (examId) => {
        setSelectedExam(examId);
        fetchAllocationsAndEligibility(examId);
    };

    const toggleHallSelection = (hallId) => {
        if (selectedHalls.includes(hallId)) {
            setSelectedHalls(selectedHalls.filter(id => id !== hallId));
        } else {
            setSelectedHalls([...selectedHalls, hallId]);
        }
    };

    const handleRunAllocation = async () => {
        if (!selectedExam) {
            alert('Please select an examination first.');
            return;
        }
        if (selectedHalls.length === 0) {
            alert('Please select at least one examination hall.');
            return;
        }

        try {
            setAllocating(true);
            const res = await api.post('/allocations/generate', {
                examId: selectedExam,
                hallIds: selectedHalls,
                strategy
            });
            alert(res.data?.message || 'Seating allocation completed!');
            fetchAllocationsAndEligibility(selectedExam);
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            if (msg.includes('Allocations already exist')) {
                if (window.confirm('Allocations already exist for this exam. Do you want to delete and regenerate?')) {
                    await api.delete(`/allocations/exam/${selectedExam}`);
                    handleRunAllocation();
                }
            } else {
                alert(msg);
            }
        } finally {
            setAllocating(false);
        }
    };

    const handleClearAllocation = async () => {
        if (!window.confirm('Are you sure you want to delete all allocations for this exam?')) return;
        try {
            await api.delete(`/allocations/exam/${selectedExam}`);
            setAllocations([]);
            alert('Allocations cleared successfully.');
            fetchAllocationsAndEligibility(selectedExam);
        } catch (err) {
            alert(err.response?.data?.message || 'Error clearing allocations');
        }
    };

    const handleDeleteSingleAllocation = async (allocationId, seatName, studentName) => {
        if (!window.confirm(`Release desk ${seatName || 'assignment'}${studentName ? ` allocated to ${studentName}` : ''}?`)) return;
        try {
            await api.delete(`/allocations/${allocationId}`);
            setAllocations(prev => prev.filter(a => a._id !== allocationId));
            fetchAllocationsAndEligibility(selectedExam);
        } catch (err) {
            alert(err.response?.data?.message || 'Error releasing seat');
        }
    };

    // Download Seating Allocation Chart as CSV File
    const handleDownloadSeatingCSV = () => {
        if (!allocations || allocations.length === 0) {
            alert("No seating allocations available to export.");
            return;
        }

        const activeObj = exams.find(e => e._id === selectedExam);
        const headers = ["Hall Number", "Desk Number", "Candidate Name", "PRN", "Roll Number", "Branch", "Semester", "Exam Subject", "Subject Code", "Exam Date"];
        const rows = filteredAllocations.map(alloc => [
            `"${alloc.hall?.hallNumber || 'LH-101'}"`,
            `"${alloc.seat?.seatNumber || ''}"`,
            `"${alloc.student?.name || ''}"`,
            `"${alloc.student?.PRN || ''}"`,
            `"${alloc.student?.rollNumber || ''}"`,
            `"${alloc.student?.branch?.branchCode || (typeof alloc.student?.branch === 'string' ? alloc.student.branch : 'ENG')}"`,
            `"${alloc.student?.semester || 5}"`,
            `"${activeObj?.subject?.subjectName || 'Exam'}"`,
            `"${activeObj?.subject?.subjectCode || ''}"`,
            `"${activeObj ? new Date(activeObj.examDate).toLocaleDateString() : ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `GCOEA_Seating_Allocation_${activeObj?.subject?.subjectCode || 'Exam'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter out any orphaned allocations where the student was deleted
    const validAllocations = allocations.filter(a => Boolean(a && a.student && a.student.name));

    const filteredAllocations = validAllocations.filter(a => {
        const name = a.student?.name?.toLowerCase() || '';
        const prn = a.student?.PRN || '';
        const seat = a.seat?.seatNumber?.toLowerCase() || '';
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || prn.includes(searchTerm) || seat.includes(searchTerm.toLowerCase());
        const matchesHall = !filterHall || (a.hall?._id === filterHall || a.hall === filterHall);
        return matchesSearch && matchesHall;
    });

    const activeExamObj = exams.find(e => e._id === selectedExam);
    const totalCapacity = halls
        .filter(h => selectedHalls.includes(h._id))
        .reduce((sum, h) => sum + (h.totalSeats || 0), 0);

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                    <Layers className="w-6 h-6 text-blue-500" />
                    <span>Automated Seating Allocation Engine</span>
                </h1>
            </div>

            {/* Allocation Setup Control Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Select Exam */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Step 1: Select Examination
                        </label>
                        <select
                            value={selectedExam}
                            onChange={(e) => handleExamChange(e.target.value)}
                            className="w-full px-3.5 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                        >
                            {exams.map(e => (
                                <option key={e._id} value={e._id}>
                                    {e.subject?.subjectCode}: {e.subject?.subjectName} (Sem {e.semester})
                                </option>
                            ))}
                        </select>
                        {activeExamObj && (
                            <p className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                <span>{new Date(activeExamObj.examDate).toLocaleDateString()}</span>
                                <span>•</span>
                                <Clock className="w-3.5 h-3.5 text-blue-400" />
                                <span>{activeExamObj.startTime} - {activeExamObj.endTime}</span>
                            </p>
                        )}
                    </div>

                    {/* 2. Select Available Halls */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Step 3: Examination Halls ({selectedHalls.length} Selected • {totalCapacity} Desks)
                        </label>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/80">
                            {halls.map(h => (
                                <label key={h._id} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer p-1 hover:bg-slate-700/50 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedHalls.includes(h._id)}
                                            onChange={() => toggleHallSelection(h._id)}
                                            className="rounded border-slate-700 text-blue-600 focus:ring-0"
                                        />
                                        <span className="font-semibold text-white">{h.hallNumber}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{h.totalSeats} seats</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 3. Seating Strategy & Action */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Step 4: Seating Strategy
                        </label>
                        <select
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value)}
                            className="w-full px-3.5 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-medium mb-3"
                        >
                            <option value="sequential">Sequential (Roll Number / PRN Order)</option>
                            <option value="random">Randomized Shuffle</option>
                        </select>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleRunAllocation}
                                disabled={allocating}
                                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                            >
                                {allocating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                                <span>{allocating ? 'Allocating...' : 'Run Allocation'}</span>
                            </button>

                            {allocations.length > 0 && (
                                <button
                                    onClick={handleClearAllocation}
                                    className="p-3 rounded-2xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 transition-colors"
                                    title="Clear Allocations"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 2: Student Eligibility Matching & Verification Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
                            2
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                                <span>Student Eligibility Matching</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Branch + Semester + Registered Subject
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Student registered subjects are checked so only candidates taking this exact course are allocated.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{eligibilityData?.eligibleCount || 0} Eligible Students</span>
                        </span>
                        {eligibilityData?.ineligibleCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowEligibilityDetails(!showEligibilityDetails)}
                                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                            >
                                {showEligibilityDetails ? 'Hide Filtered' : `View ${eligibilityData.ineligibleCount} Filtered Candidates`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Cohort Eligibility Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                        <span className="text-slate-400 block text-[11px]">Examination Subject:</span>
                        <span className="text-white font-bold">{eligibilityData?.exam?.subjectCode}: {eligibilityData?.exam?.subjectName}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                        <span className="text-slate-400 block text-[11px]">Eligible Branches:</span>
                        <span className="text-blue-400 font-bold">{eligibilityData?.exam?.eligibleBranches?.join(', ') || 'All'}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                        <span className="text-slate-400 block text-[11px]">Hall Capacity Status:</span>
                        <span className={`font-bold ${totalCapacity >= (eligibilityData?.eligibleCount || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                            {totalCapacity} Desks Available ({totalCapacity >= (eligibilityData?.eligibleCount || 0) ? 'Capacity Sufficient' : 'Needs More Halls'})
                        </span>
                    </div>
                </div>

                {/* Expandable filtered student reasons (e.g. Amit taking Java, Sneha taking DE, Neha in Sem 3) */}
                {showEligibilityDetails && eligibilityData?.ineligibleStudents && (
                    <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-2">
                            Filtered Candidates (Subject / Semester / Branch Mismatch):
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {eligibilityData.ineligibleStudents.map(s => (
                                <div key={s._id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-white">{s.name}</span>
                                        <span className="text-slate-400 text-[11px] ml-2">({s.branch} • Sem {s.semester})</span>
                                    </div>
                                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                        {s.reasons?.[0] || 'Ineligible'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {loading ? (
                <div className="text-center py-12 text-slate-400 text-xs">Loading seating records...</div>
            ) : allocations.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-xl">
                    <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white">No Seating Allocated Yet</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Select halls above and click "Run Allocation" to automatically interleave eligible students across examination desks.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Allocation Stats Header & Filters */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <span className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
                                {validAllocations.length} Students Allocated
                            </span>
                            <span className="text-xs text-slate-400">
                                Across {new Set(validAllocations.map(a => a.hall?._id || a.hall)).size} Examination Halls
                            </span>
                        </div>

                        <div className="flex items-center space-x-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by student, PRN, or seat..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                                />
                            </div>

                            <select
                                value={filterHall}
                                onChange={(e) => setFilterHall(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                            >
                                <option value="">All Halls</option>
                                {halls.map(h => (
                                    <option key={h._id} value={h._id}>{h.hallNumber}</option>
                                ))}
                            </select>

                            <button
                                onClick={handleDownloadSeatingCSV}
                                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition-all shadow-md shrink-0"
                                title="Download official seating allocation plan file (CSV)"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download Seating Plan (CSV)</span>
                            </button>
                        </div>
                    </div>

                    {/* Allocations Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                    <tr>
                                        <th className="px-6 py-4">Seat Assignment</th>
                                        <th className="px-6 py-4">Candidate Name</th>
                                        <th className="px-6 py-4">PRN Number</th>
                                        <th className="px-6 py-4">Roll Number</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Hall</th>
                                        <th className="px-6 py-4 text-center">QR Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredAllocations.map((alloc) => (
                                        <tr key={alloc._id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    {alloc.seat?.seatNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-white flex items-center space-x-2">
                                                {alloc.student?.photo && (
                                                    <img
                                                        src={alloc.student.photo}
                                                        alt={alloc.student.name}
                                                        className="w-7 h-7 rounded-full object-cover border border-slate-700"
                                                    />
                                                )}
                                                <span>{alloc.student?.name}</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-blue-400 font-semibold">
                                                {alloc.student?.PRN}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 font-mono">
                                                {alloc.student?.rollNumber}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                    {alloc.student?.branch?.branchCode || (typeof alloc.student?.branch === 'string' ? alloc.student.branch : 'ENG')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-200">
                                                {alloc.hall?.hallNumber || 'LH-101'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                                                    <QrCode className="w-3.5 h-3.5" />
                                                    <span>Verified QR</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSingleAllocation(alloc._id, alloc.seat?.seatNumber, alloc.student?.name)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                    title="Release desk allocation"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
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

export default SeatingAllocationPage;
