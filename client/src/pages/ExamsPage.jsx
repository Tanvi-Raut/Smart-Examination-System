import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Calendar, 
    Plus, 
    Clock, 
    Layers, 
    FileText, 
    Trash2, 
    X,
    BookOpen,
    CheckCircle2
} from 'lucide-react';

const ExamsPage = ({ setActiveTab, setSelectedExamForAction }) => {
    const [exams, setExams] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const [form, setForm] = useState({
        subject: '',
        examDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        startTime: '10:30 AM',
        endTime: '01:30 PM',
        semester: 6,
        status: 'Scheduled'
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eRes, sRes] = await Promise.all([
                api.get('/exams'),
                api.get('/subjects')
            ]);
            setExams(eRes.data || []);
            setSubjects(sRes.data || []);
            if (sRes.data?.length > 0 && !form.subject) {
                setForm(prev => ({ ...prev, subject: sRes.data[0]._id, semester: sRes.data[0].semester }));
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/exams', form);
            setShowAddModal(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating exam');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this examination schedule and associated allocations?')) return;
        try {
            await api.delete(`/exams/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error');
        }
    };

    const handleSubjectChange = (subjectId) => {
        const found = subjects.find(s => s._id === subjectId);
        setForm({
            ...form,
            subject: subjectId,
            semester: found ? found.semester : form.semester
        });
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <Calendar className="w-6 h-6 text-purple-500" />
                        <span>Examination Schedules</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Schedule institute theory & practical examinations, assign academic subjects, and set time slots.
                    </p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30"
                >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Exam</span>
                </button>
            </div>

            {/* Exams Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                    <div className="col-span-3 text-center py-12 text-slate-400 text-xs">Loading examinations...</div>
                ) : exams.length === 0 ? (
                    <div className="col-span-3 text-center py-12 text-slate-400 text-xs">No examinations scheduled yet.</div>
                ) : (
                    exams.map((exam) => (
                        <div key={exam._id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-purple-400 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        {exam.subject?.subjectCode}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {exam.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mt-3 leading-snug">
                                    {exam.subject?.subjectName}
                                </h3>

                                <div className="mt-4 space-y-2 text-xs text-slate-300 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-purple-400" />
                                        <span>Date: <strong className="text-white">{new Date(exam.examDate).toDateString()}</strong></span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-4 h-4 text-purple-400" />
                                        <span>Timing: <strong className="text-white">{exam.startTime} – {exam.endTime}</strong></span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <BookOpen className="w-4 h-4 text-purple-400" />
                                        <span>Academic Term: <strong>Semester {exam.semester}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => {
                                            if (setSelectedExamForAction) setSelectedExamForAction(exam._id);
                                            setActiveTab('allocation');
                                        }}
                                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                                    >
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>Allocate Seats</span>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('tickets')}
                                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Tickets</span>
                                    </button>
                                </div>

                                <button
                                    onClick={() => handleDelete(exam._id)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                    title="Delete Exam"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Schedule Exam Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-4">Schedule Examination</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                                <select
                                    required
                                    value={form.subject}
                                    onChange={(e) => handleSubjectChange(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                >
                                    {subjects.map(s => (
                                        <option key={s._id} value={s._id}>
                                            {s.subjectCode} - {s.subjectName} (Sem {s.semester})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Examination Date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.examDate}
                                    onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.startTime}
                                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                                        placeholder="10:30 AM"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">End Time</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.endTime}
                                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                                        placeholder="01:30 PM"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Semester</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="8"
                                        value={form.semester}
                                        onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                                >
                                    Schedule Exam
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamsPage;
