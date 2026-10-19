import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
    getPendingOfflineAttendances, 
    clearSyncedAttendances,
    cacheHallRosterOffline,
    downloadFullExamPackage,
    getCachedExams,
    getCachedHalls
} from '../utils/offlineStorage';
import { 
    RefreshCw, 
    Wifi, 
    WifiOff, 
    Database, 
    DownloadCloud, 
    UploadCloud, 
    CheckCircle2, 
    Clock, 
    Radio
} from 'lucide-react';

const OfflineSyncPage = () => {
    const { isOfflineMode, toggleOfflineMode, user } = useAuth();

    // Data states
    const [pendingRecords, setPendingRecords] = useState([]);
    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedHall, setSelectedHall] = useState('');

    // Operational loading states
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [caching, setCaching] = useState(false);
    const [packageProgress, setPackageProgress] = useState(null);
    const [syncMessage, setSyncMessage] = useState('');

    // Load local storage overview & pending sync records
    const loadStorageState = async () => {
        try {
            setLoading(true);
            const pendingList = await getPendingOfflineAttendances();
            setPendingRecords(pendingList || []);
        } catch (err) {
            console.error('Error fetching offline pending records:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load initial metadata (exams, halls)
    useEffect(() => {
        loadStorageState();

        const initOnlineData = async () => {
            try {
                if (navigator.onLine && !isOfflineMode) {
                    const [eRes, hRes] = await Promise.all([
                        api.get('/exams').catch(() => ({ data: [] })),
                        api.get('/halls').catch(() => ({ data: [] }))
                    ]);
                    setExams(eRes.data || []);
                    setHalls(hRes.data || []);

                    if (eRes.data?.length > 0) setSelectedExam(eRes.data[0]._id);
                    if (hRes.data?.length > 0) setSelectedHall(hRes.data[0]._id);
                } else {
                    // Load cached exams and halls from IndexedDB
                    const [cExams, cHalls] = await Promise.all([
                        getCachedExams(),
                        getCachedHalls()
                    ]);
                    setExams(cExams || []);
                    setHalls(cHalls || []);
                    if (cExams?.length > 0) setSelectedExam(cExams[0]._id);
                    if (cHalls?.length > 0) setSelectedHall(cHalls[0]._id);
                }
            } catch (err) {
                console.error('Error init online/offline data:', err);
            }
        };

        initOnlineData();
    }, [isOfflineMode]);

    // 1-Click: Download Complete Offline Examination Package
    const handleDownloadCompletePackage = async () => {
        if (!selectedExam) {
            alert('Please select an active examination paper first.');
            return;
        }

        try {
            setCaching(true);
            setPackageProgress({ step: 1, text: 'Connecting to server and compiling offline package...' });

            const targetHalls = selectedHall ? [selectedHall] : halls.map(h => h._id);

            const result = await downloadFullExamPackage(
                api,
                selectedExam,
                targetHalls,
                user,
                (p) => setPackageProgress(p)
            );

            await loadStorageState();
            alert(`Pre-Exam Package Successfully Saved!\n• Exams Cached: ${result.examsCount}\n• Halls Cached: ${result.hallsCount}\n• Rosters: ${result.rostersCount}\n• Total Students Cached: ${result.totalCachedStudents}\n\nYour device is now 100% prepared for classroom jammers.`);
        } catch (err) {
            alert('Failed to download complete offline package: ' + (err.response?.data?.message || err.message));
        } finally {
            setCaching(false);
            setPackageProgress(null);
        }
    };

    // Cache single selected hall roster
    const handleDownloadSingleRoster = async () => {
        if (!selectedExam || !selectedHall) return;
        try {
            setCaching(true);
            const res = await api.get(`/attendance/hall-roster/${selectedExam}/${selectedHall}`);
            await cacheHallRosterOffline(selectedExam, selectedHall, res.data);
            await loadStorageState();
            alert(`Hall roster (${res.data.totalAllocated} students) saved to browser IndexedDB for offline proctoring.`);
        } catch (err) {
            alert('Failed to cache roster: ' + (err.response?.data?.message || err.message));
        } finally {
            setCaching(false);
        }
    };

    // Push local IndexedDB attendances to central MongoDB backend
    const handleSynchronize = async () => {
        if (pendingRecords.length === 0) {
            alert('No offline attendance records pending sync.');
            return;
        }

        try {
            setSyncing(true);
            setSyncMessage('');
            const res = await api.post('/attendance/sync-offline', {
                records: pendingRecords
            });

            setSyncMessage(res.data?.message || `Successfully pushed ${pendingRecords.length} records to MongoDB.`);
            // Clear synced from IndexedDB
            const ids = pendingRecords.map(p => p.id);
            await clearSyncedAttendances(ids);
            await loadStorageState();
        } catch (err) {
            alert('Sync failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <Database className="w-7 h-7 text-amber-400" />
                        <span>Offline Architecture & Jammer Management Center</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        In-Hall Offline Proctoring & Jammer-Resistant Attendance Workflow
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={loadStorageState}
                        disabled={loading}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh Storage</span>
                    </button>

                    <button
                        onClick={toggleOfflineMode}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md ${
                            isOfflineMode
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                    >
                        {isOfflineMode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
                        <span>{isOfflineMode ? 'Jammer Simulation: ON' : 'Jammer Simulation: OFF'}</span>
                    </button>
                </div>
            </div>

            {/* 3-STEP IN-HALL JAMMER WORKFLOW */}
            <div className="space-y-6">
                {/* Operational Phases Visual Timeline */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center space-x-2">
                        <Radio className="w-4 h-4 text-blue-400" />
                        <span>Examination Operational Lifecycle under Signal Jammers</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                        {/* Phase 1 */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 relative">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                                    1
                                </div>
                                <h4 className="text-xs font-bold text-white">Before Entering Hall</h4>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold mb-2 inline-block">
                                Internet Connected
                            </span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Invigilator logs in while connected to campus network. Web app files (PWA) cache automatically. Invigilator clicks "Download Complete Package" to cache student rosters into IndexedDB.
                            </p>
                        </div>

                        {/* Phase 2 */}
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 relative">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-xs">
                                    2
                                </div>
                                <h4 className="text-xs font-bold text-amber-300">Inside Hall (Jammed)</h4>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold mb-2 inline-block animate-pulse">
                                RF Jammers Active
                            </span>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                PWA opens from local cache. Device camera & client-side QR scanner verify candidate credentials against IndexedDB. Attendance marks are stored safely on the device.
                            </p>
                        </div>

                        {/* Phase 3 */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 relative">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                                    3
                                </div>
                                <h4 className="text-xs font-bold text-white">After Leaving Hall</h4>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold mb-2 inline-block">
                                Connectivity Restored
                            </span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Invigilator returns to Exam Control Cell or leaves jammer zone. App uploads pending attendance records to central Express server and updates MongoDB with official timestamps.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pre-Exam Preparation & Post-Exam Sync Panels */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. Pre-Exam Download Control */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <DownloadCloud className="w-5 h-5 text-blue-400" />
                                    <h3 className="text-base font-bold text-white">Step 1: Pre-Exam Offline Preparation</h3>
                                </div>
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold border border-blue-500/30">
                                    Run while connected
                                </span>
                            </div>

                            <p className="text-xs text-slate-400 mb-4">
                                Select the examination paper and room to download all assigned student records, seating coordinates, and biometric data to this browser before entering the jammed classroom.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Examination Subject</label>
                                    <select
                                        value={selectedExam}
                                        onChange={(e) => setSelectedExam(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                                    >
                                        {exams.map(e => (
                                            <option key={e._id} value={e._id}>
                                                {e.subject?.subjectCode}: {e.subject?.subjectName} ({e.examDate ? new Date(e.examDate).toLocaleDateString() : 'Active'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Examination Hall</label>
                                    <select
                                        value={selectedHall}
                                        onChange={(e) => setSelectedHall(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                                    >
                                        <option value="">All Assigned Examination Halls</option>
                                        {halls.map(h => (
                                            <option key={h._id} value={h._id}>{h.hallNumber} — {h.building} ({h.capacity} seats)</option>
                                        ))}
                                    </select>
                                </div>

                                {packageProgress && (
                                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center space-x-2">
                                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                        <span>{packageProgress.text}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleDownloadCompletePackage}
                                disabled={caching || !selectedExam}
                                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                            >
                                {caching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                                <span>Download Full Exam Package (1-Click)</span>
                            </button>

                            <button
                                onClick={handleDownloadSingleRoster}
                                disabled={caching || !selectedExam || !selectedHall}
                                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 disabled:opacity-50"
                                title="Download only the selected hall"
                            >
                                Single Hall
                            </button>
                        </div>
                    </div>

                    {/* 2. Post-Exam Sync Control */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <UploadCloud className="w-5 h-5 text-emerald-400" />
                                    <h3 className="text-base font-bold text-white">Step 3: Post-Exam MongoDB Synchronization</h3>
                                </div>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                                    Run after exam
                                </span>
                            </div>

                            <p className="text-xs text-slate-400 mb-4">
                                When leaving the examination hall or reconnecting to the campus Wi-Fi, synchronize all offline recorded attendance timestamps and malpractice logs with the central MongoDB database.
                            </p>

                            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Database Engine:</span>
                                    <span className="font-semibold text-white">IndexedDB (SmartExamOfflineDB)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Unsynced Hall Records:</span>
                                    <span className="font-bold text-amber-400 font-mono">{pendingRecords.length} records in queue</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Backend Endpoint:</span>
                                    <span className="font-mono text-slate-300 text-[11px]">POST /api/attendance/sync-offline</span>
                                </div>
                            </div>

                            {syncMessage && (
                                <div className="mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{syncMessage}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-800/80">
                            <button
                                onClick={handleSynchronize}
                                disabled={syncing || pendingRecords.length === 0}
                                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                            >
                                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                <span>{syncing ? 'Synchronizing to MongoDB...' : `Synchronize ${pendingRecords.length} Offline Records`}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pending Records Inspection Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center space-x-2">
                                <Database className="w-4 h-4 text-amber-400" />
                                <span>Pending Attendance Records in Device Queue</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Records saved in IndexedDB during in-hall offline proctoring awaiting central cloud validation.
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {pendingRecords.length} pending
                        </span>
                    </div>

                    {pendingRecords.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800/60">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                            <span>No pending offline attendances. All in-hall records are synchronized with the central database.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                    <tr>
                                        <th className="px-4 py-3">Queue ID</th>
                                        <th className="px-4 py-3">Student Ref</th>
                                        <th className="px-4 py-3">Assigned Status</th>
                                        <th className="px-4 py-3">Offline Timestamp</th>
                                        <th className="px-4 py-3">Verification Method</th>
                                        <th className="px-4 py-3 text-right">Server Sync</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                    {pendingRecords.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-mono text-slate-400">#{item.id}</td>
                                            <td className="px-4 py-3 font-mono text-blue-400 font-semibold">{item.studentId}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.status === 'Present'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : item.status === 'Absent'
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">
                                                {item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString() : 'Just now'}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                                                {item.verificationMethod || 'OFFLINE_SYNC'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-amber-400 text-[11px]">
                                                <span className="inline-flex items-center space-x-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>Pending Upload</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineSyncPage;
