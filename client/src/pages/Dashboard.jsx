import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Users, 
    Building2, 
    BookOpen, 
    Calendar, 
    Layers, 
    CheckCircle2, 
    QrCode, 
    FileText, 
    Sparkles, 
    ArrowRight,
    GraduationCap,
    Clock,
    AlertCircle
} from 'lucide-react';

const Dashboard = ({ setActiveTab }) => {
    const [stats, setStats] = useState({
        studentsCount: 0,
        hallsCount: 0,
        examsCount: 0,
        branchesCount: 0,
        allocationsCount: 0,
        verifiedAttendanceCount: 0
    });
    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const [studentsRes, hallsRes, examsRes, branchesRes] = await Promise.all([
                    api.get('/students'),
                    api.get('/halls'),
                    api.get('/exams'),
                    api.get('/branches')
                ]);

                const examsData = examsRes.data || [];
                const hallsData = hallsRes.data || [];
                const studentsData = studentsRes.data || [];
                const branchesData = branchesRes.data || [];

                setExams(examsData);
                setHalls(hallsData);

                // Fetch allocation & attendance count for active exam if available
                let allocCount = 0;
                let attCount = 0;
                if (examsData.length > 0) {
                    try {
                        const allocRes = await api.get(`/allocations/exam/${examsData[0]._id}`);
                        allocCount = allocRes.data?.length || 0;
                        const reportRes = await api.get(`/attendance/report/${examsData[0]._id}`);
                        attCount = reportRes.data?.summary?.presentCount || 0;
                    } catch (e) {
                        console.warn('Dashboard alloc fetch error:', e);
                    }
                }

                setStats({
                    studentsCount: studentsData.length,
                    hallsCount: hallsData.length,
                    examsCount: examsData.length,
                    branchesCount: branchesData.length,
                    allocationsCount: allocCount,
                    verifiedAttendanceCount: attCount
                });
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const statCards = [
        { label: 'Registered Students', value: stats.studentsCount, icon: Users, color: 'from-blue-600 to-indigo-600', link: 'students' },
        { label: 'Examination Halls', value: stats.hallsCount, icon: Building2, color: 'from-emerald-600 to-teal-600', link: 'halls' },
        { label: 'Scheduled Exams', value: stats.examsCount, icon: Calendar, color: 'from-purple-600 to-violet-600', link: 'exams' },
        { label: 'Seats Allocated', value: stats.allocationsCount, icon: Layers, color: 'from-amber-600 to-orange-600', link: 'allocation' },
        { label: 'Active Branches', value: stats.branchesCount, icon: BookOpen, color: 'from-pink-600 to-rose-600', link: 'subjects' },
        { label: 'Verified Attendance', value: stats.verifiedAttendanceCount, icon: CheckCircle2, color: 'from-cyan-600 to-blue-600', link: 'reports' },
    ];

    return (
        <div className="space-y-8 pb-12">
            {/* ================= DASHBOARD HEADER ================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-3">
                        <GraduationCap className="w-8 h-8 text-blue-500" />
                        <span>Examination Control Dashboard</span>
                    </h1>
                </div>
                <div className="flex items-center space-x-2.5">
                    <button
                        onClick={() => setActiveTab('allocation')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
                    >
                        <Layers className="w-4 h-4" />
                        <span>Allocate Seats</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1.5"
                    >
                        <FileText className="w-4 h-4" />
                        <span>Reports</span>
                    </button>
                </div>
            </div>

            {/* ================= STATS METRIC GRID ================= */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={idx}
                            onClick={() => setActiveTab(card.link)}
                            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-400 truncate">{card.label}</span>
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-md`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                    {loading ? '...' : card.value}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ================= QUICK ACTIONS CARDS ================= */}
            <div>
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    <span>Quick Examination Workflows</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Automated Seating Allocation */}
                    <div
                        onClick={() => setActiveTab('allocation')}
                        className="bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-indigo-900/40 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                            Automated Seating Allocation
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Run branch-mixing algorithm to interleave students and prevent copying during examination.
                        </p>
                        <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                            <span>Launch Engine</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* 2. Invigilator QR Scanner */}
                    <div
                        onClick={() => setActiveTab('scanner')}
                        className="bg-gradient-to-br from-slate-900 to-emerald-950/60 border border-emerald-900/40 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <QrCode className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                            Invigilator QR Scanner
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Camera verification of candidate photo and college identity card against subject-specific QR.
                        </p>
                        <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                            <span>Open Scanner</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* 3. Subject-Specific Hall Tickets */}
                    <div
                        onClick={() => setActiveTab('tickets')}
                        className="bg-gradient-to-br from-slate-900 to-purple-950/60 border border-purple-900/40 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                            Digital PDF Hall Tickets
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Generate and download official PDF admission cards containing embedded unique subject QR codes.
                        </p>
                        <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
                            <span>Generate Tickets</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>

                    {/* 4. Offline Attendance Sync */}
                    <div
                        onClick={() => setActiveTab('offline-sync')}
                        className="bg-gradient-to-br from-slate-900 to-amber-950/60 border border-amber-900/40 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl cursor-pointer hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                            Offline Mode (IndexedDB)
                        </h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Proctor without internet inside halls and synchronize attendance to central server when online.
                        </p>
                        <div className="mt-4 flex items-center space-x-1 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                            <span>Manage Sync</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= ACTIVE EXAMS & HALL ROSTER OVERVIEW ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scheduled Exams List */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <h3 className="text-base font-bold text-white">Upcoming Examinations</h3>
                        </div>
                        <button
                            onClick={() => setActiveTab('exams')}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 cursor-pointer"
                        >
                            <span>View All Exams</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {exams.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            No examinations scheduled currently.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {exams.map((exam) => (
                                <div
                                    key={exam._id}
                                    className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-white text-sm">
                                                {exam.subject?.subjectCode}: {exam.subject?.subjectName}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                Sem {exam.semester}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                                            <span className="flex items-center space-x-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{new Date(exam.examDate).toLocaleDateString()}</span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{exam.startTime} - {exam.endTime}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setActiveTab('allocation')}
                                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
                                        >
                                            Allocate
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('reports')}
                                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold"
                                        >
                                            Report
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Examination Halls Capacity Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2 mb-4">
                            <Building2 className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-base font-bold text-white">Examination Halls</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">
                            Halls configured with seating capacity and grid layouts for automated allocation.
                        </p>

                        <div className="space-y-3">
                            {halls.slice(0, 4).map((hall) => (
                                <div key={hall._id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-sm text-white">{hall.hallNumber}</span>
                                        <p className="text-[11px] text-slate-400">{hall.building} (Floor {hall.floor})</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                                            {hall.totalSeats} Seats
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setActiveTab('halls')}
                        className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                        <span>Manage Halls & Seat Layouts</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
