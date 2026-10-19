import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    BookOpen, 
    Layers, 
    Plus, 
    Trash2, 
    Edit2, 
    X, 
    Check,
    GraduationCap
} from 'lucide-react';

const BranchesSubjectsPage = () => {
    const [activeTab, setActiveTab] = useState('subjects');
    const [branches, setBranches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [showSubjectModal, setShowSubjectModal] = useState(false);

    // Forms
    const [branchForm, setBranchForm] = useState({ branchCode: '', branchName: '' });
    const [subjectForm, setSubjectForm] = useState({
        subjectCode: '',
        subjectName: '',
        semester: 6,
        branches: []
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [bRes, sRes] = await Promise.all([
                api.get('/branches'),
                api.get('/subjects')
            ]);
            setBranches(bRes.data || []);
            setSubjects(sRes.data || []);
        } catch (error) {
            console.error('Error fetching branches/subjects:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleBranchSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/branches', branchForm);
            setShowBranchModal(false);
            setBranchForm({ branchCode: '', branchName: '' });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving branch');
        }
    };

    const handleSubjectSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subjects', subjectForm);
            setShowSubjectModal(false);
            setSubjectForm({ subjectCode: '', subjectName: '', semester: 6, branches: [] });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving subject');
        }
    };

    const handleDeleteBranch = async (id) => {
        if (!window.confirm('Delete branch?')) return;
        try {
            await api.delete(`/branches/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error');
        }
    };

    const handleDeleteSubject = async (id) => {
        if (!window.confirm('Delete subject?')) return;
        try {
            await api.delete(`/subjects/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error');
        }
    };

    const toggleBranchInSubject = (bId) => {
        const cur = [...subjectForm.branches];
        if (cur.includes(bId)) {
            setSubjectForm({ ...subjectForm, branches: cur.filter(id => id !== bId) });
        } else {
            setSubjectForm({ ...subjectForm, branches: [...cur, bId] });
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <BookOpen className="w-6 h-6 text-pink-500" />
                        <span>Academic Departments & Curriculum Subjects</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Manage engineering branches, curriculum course subjects, and eligible branch mappings.
                    </p>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('subjects')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            activeTab === 'subjects' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Subjects ({subjects.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('branches')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            activeTab === 'branches' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Departments / Branches ({branches.length})
                    </button>
                </div>
            </div>

            {/* SUBJECTS TAB */}
            {activeTab === 'subjects' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setSubjectForm({
                                    subjectCode: '',
                                    subjectName: '',
                                    semester: 6,
                                    branches: branches.slice(0, 2).map(b => b._id)
                                });
                                setShowSubjectModal(true);
                            }}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-pink-600/30"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Subject</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjects.map((sub) => (
                            <div key={sub._id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-bold text-pink-400 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                            {sub.subjectCode}
                                        </span>
                                        <span className="text-xs font-bold text-slate-300">
                                            Semester {sub.semester}
                                        </span>
                                    </div>

                                    <h3 className="text-base font-bold text-white mt-3 leading-snug">
                                        {sub.subjectName}
                                    </h3>

                                    <div className="mt-4">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1.5">
                                            Eligible Branches:
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {sub.branches && sub.branches.length > 0 ? (
                                                sub.branches.map(b => (
                                                    <span key={b._id} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                                        {b.branchCode}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-500">All Branches</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end">
                                    <button
                                        onClick={() => handleDeleteSubject(sub._id)}
                                        className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                                        title="Delete Subject"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* BRANCHES TAB */}
            {activeTab === 'branches' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setBranchForm({ branchCode: '', branchName: '' });
                                setShowBranchModal(true);
                            }}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Department</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {branches.map((b) => (
                            <div key={b._id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center font-mono text-sm">
                                        {b.branchCode}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">{b.branchName}</h3>
                                        <span className="text-[11px] text-slate-400 font-mono">Code: {b.branchCode}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDeleteBranch(b._id)}
                                    className="text-slate-400 hover:text-red-400 p-1.5 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Subject Modal */}
            {showSubjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowSubjectModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-4">Add Curriculum Subject</h2>

                        <form onSubmit={handleSubjectSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Subject Code</label>
                                <input
                                    type="text"
                                    required
                                    value={subjectForm.subjectCode}
                                    onChange={(e) => setSubjectForm({ ...subjectForm, subjectCode: e.target.value })}
                                    placeholder="CS601"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-pink-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Subject Name</label>
                                <input
                                    type="text"
                                    required
                                    value={subjectForm.subjectName}
                                    onChange={(e) => setSubjectForm({ ...subjectForm, subjectName: e.target.value })}
                                    placeholder="Design and Analysis of Algorithms"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-pink-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Semester</label>
                                <select
                                    value={subjectForm.semester}
                                    onChange={(e) => setSubjectForm({ ...subjectForm, semester: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-pink-500"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Eligible Branches</label>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                    {branches.map(b => (
                                        <label key={b._id} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={subjectForm.branches.includes(b._id)}
                                                onChange={() => toggleBranchInSubject(b._id)}
                                                className="rounded border-slate-700 text-pink-600 focus:ring-0"
                                            />
                                            <span>{b.branchCode} - {b.branchName}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowSubjectModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold"
                                >
                                    Create Subject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Branch Modal */}
            {showBranchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowBranchModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-4">Add Department / Branch</h2>

                        <form onSubmit={handleBranchSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Branch Code</label>
                                <input
                                    type="text"
                                    required
                                    value={branchForm.branchCode}
                                    onChange={(e) => setBranchForm({ ...branchForm, branchCode: e.target.value.toUpperCase() })}
                                    placeholder="CSE"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Department Name</label>
                                <input
                                    type="text"
                                    required
                                    value={branchForm.branchName}
                                    onChange={(e) => setBranchForm({ ...branchForm, branchName: e.target.value })}
                                    placeholder="Computer Science & Engineering"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowBranchModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                                >
                                    Create Branch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchesSubjectsPage;
