import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Users, 
    Plus, 
    Search, 
    Filter, 
    Upload, 
    Trash2, 
    Edit2, 
    User, 
    Check, 
    X,
    FileSpreadsheet,
    Eye,
    Camera,
    Download,
    Sparkles,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

const StudentsPage = () => {
    const [students, setStudents] = useState([]);
    const [branches, setBranches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('');

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalTab, setModalTab] = useState('single'); // 'single' | 'import' | 'bulk'
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        PRN: '',
        rollNumber: '',
        collegeId: '',
        branch: '',
        year: 'Third Year',
        semester: 6,
        division: 'A',
        email: '',
        photo: '',
        registeredSubjects: []
    });

    // File upload state for CSV / Excel
    const [importFile, setImportFile] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importStatus, setImportStatus] = useState(null);

    // Photo preview & file upload for Cloudinary (Steps 1 & 2)
    const [photoPreview, setPhotoPreview] = useState('');
    const [photoFile, setPhotoFile] = useState(null);

    const samplePhotos = [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
    ];

    const fetchStudentsAndBranches = async () => {
        try {
            setLoading(true);
            const [studRes, branchRes, subjRes] = await Promise.all([
                api.get('/students'),
                api.get('/branches'),
                api.get('/subjects')
            ]);
            setStudents(studRes.data || []);
            setBranches(branchRes.data || []);
            setSubjects(subjRes.data || []);
            if (branchRes.data?.length > 0 && !formData.branch) {
                setFormData(prev => ({ ...prev, branch: branchRes.data[0]._id }));
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudentsAndBranches();
    }, []);

    // Handle Local Image File Upload (validates strictly JPEG format for Cloudinary)
    const handlePhotoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const isJpegMime = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/pjpeg';
            const isJpegExt = /\.(jpg|jpeg)$/i.test(file.name);

            if (!isJpegMime && !isJpegExt) {
                alert('Invalid format! Please upload photograph strictly in JPEG (.jpg, .jpeg) format.');
                e.target.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('File size exceeds 5MB limit! Please upload a smaller JPEG photo.');
                e.target.value = '';
                return;
            }

            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    // Step 2: Send student details and JPEG image via FormData to backend
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (key !== 'photo' && key !== 'registeredSubjects' && formData[key] !== undefined && formData[key] !== null) {
                    data.append(key, formData[key]);
                }
            });

            if (formData.registeredSubjects && formData.registeredSubjects.length > 0) {
                data.append('registeredSubjects', JSON.stringify(formData.registeredSubjects));
            } else {
                data.append('registeredSubjects', JSON.stringify([]));
            }

            if (photoFile) {
                data.append('photo', photoFile); // Multer validates JPEG and pipes to Cloudinary
            } else if (formData.photo) {
                data.append('photo', formData.photo);
            }

            if (isEditing && selectedStudent) {
                await api.put(`/students/${selectedStudent._id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/students', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            setShowAddModal(false);
            setIsEditing(false);
            setSelectedStudent(null);
            setPhotoFile(null);
            resetForm();
            fetchStudentsAndBranches();
            alert(`Student ${isEditing ? 'updated' : 'registered'} successfully with photograph!`);
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving student');
        }
    };

    // Handle Excel / CSV Import
    const handleImportSubmit = async (e) => {
        e.preventDefault();
        if (!importFile) {
            alert('Please select an Excel or CSV file.');
            return;
        }

        try {
            setImportLoading(true);
            setImportStatus(null);
            const data = new FormData();
            data.append('file', importFile);

            const res = await api.post('/students/import', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportStatus(res.data);
            fetchStudentsAndBranches();
            alert(res.data?.message || 'Import completed!');
        } catch (err) {
            alert(err.response?.data?.message || 'Import failed. Check file format.');
        } finally {
            setImportLoading(false);
        }
    };

    // Download Sample CSV Template
    const handleDownloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,name,PRN,rollNumber,collegeId,branch,semester,division,email\n" +
            "Aarav Mehta,24105050,CSE-24-50,GCOEA/CS/24105050,CSE,6,A,aarav.m@gcoea.ac.in\n" +
            "Diya Sharma,24105051,CSE-24-51,GCOEA/CS/24105051,CSE,6,A,diya.s@gcoea.ac.in\n" +
            "Rohan Verma,24106050,IT-24-50,GCOEA/IT/24106050,IT,6,B,rohan.v@gcoea.ac.in";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "GCOEA_Students_Import_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 1-Click Batch Onboarding (Demonstrates adding new students without seed scripts)
    const handleAddSampleBatch = async () => {
        const newBatch = [
            {
                name: "Kunal Shinde",
                PRN: `24${Math.floor(100000 + Math.random() * 900000)}`,
                rollNumber: `CSE-24-${Math.floor(10 + Math.random() * 80)}`,
                collegeId: `GCOEA/CS/24${Math.floor(10000 + Math.random() * 90000)}`,
                branch: branches[0]?._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "kunal.s@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Pooja Wankhede",
                PRN: `24${Math.floor(100000 + Math.random() * 900000)}`,
                rollNumber: `IT-24-${Math.floor(10 + Math.random() * 80)}`,
                collegeId: `GCOEA/IT/24${Math.floor(10000 + Math.random() * 90000)}`,
                branch: branches[1]?._id || branches[0]?._id,
                year: "Third Year",
                semester: 6,
                division: "B",
                email: "pooja.w@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Amitabh More",
                PRN: `24${Math.floor(100000 + Math.random() * 900000)}`,
                rollNumber: `ENTC-24-${Math.floor(10 + Math.random() * 80)}`,
                collegeId: `GCOEA/ET/24${Math.floor(10000 + Math.random() * 90000)}`,
                branch: branches[2]?._id || branches[0]?._id,
                year: "Third Year",
                semester: 6,
                division: "A",
                email: "amitabh.m@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
            }
        ];

        try {
            await api.post('/students/bulk', { students: newBatch });
            fetchStudentsAndBranches();
            setShowAddModal(false);
            alert('Batch of 3 new students added successfully!');
        } catch (err) {
            alert('Failed to add batch: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this student record?')) return;
        try {
            await api.delete(`/students/${id}`);
            fetchStudentsAndBranches();
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting student');
        }
    };

    const openEditModal = (student) => {
        setSelectedStudent(student);
        setIsEditing(true);
        setModalTab('single');
        setPhotoFile(null);
        setFormData({
            name: student.name,
            PRN: student.PRN,
            rollNumber: student.rollNumber,
            collegeId: student.collegeId || student.PRN,
            branch: student.branch?._id || student.branch,
            year: student.year || 'Third Year',
            semester: student.semester || 6,
            division: student.division || 'A',
            email: student.email || '',
            photo: student.photo || '',
            registeredSubjects: student.registeredSubjects ? student.registeredSubjects.map(s => s._id || s) : []
        });
        setPhotoPreview(student.photo || '');
        setShowAddModal(true);
    };

    const resetForm = () => {
        setPhotoFile(null);
        setFormData({
            name: '',
            PRN: '',
            rollNumber: '',
            collegeId: '',
            branch: branches[0]?._id || '',
            year: 'Third Year',
            semester: 6,
            division: 'A',
            email: '',
            photo: samplePhotos[0],
            registeredSubjects: []
        });
        setPhotoPreview(samplePhotos[0]);
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = 
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.PRN.includes(searchTerm) ||
            student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = !branchFilter || (student.branch?._id === branchFilter || student.branch === branchFilter);
        const matchesSemester = !semesterFilter || student.semester === Number(semesterFilter);
        return matchesSearch && matchesBranch && matchesSemester;
    });

    return (
        <div className="space-y-6 pb-12">
            {/* Header & Quick Action Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <Users className="w-6 h-6 text-blue-500" />
                        <span>Student Management & Enrollment</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Register individual students, upload official photo ID cards, or import class rosters via Excel/CSV.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => {
                            resetForm();
                            setIsEditing(false);
                            setModalTab('import');
                            setShowAddModal(true);
                        }}
                        className="flex items-center space-x-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Import Excel / CSV</span>
                    </button>

                    <button
                        onClick={() => {
                            resetForm();
                            setIsEditing(false);
                            setModalTab('single');
                            setShowAddModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Student</span>
                    </button>
                </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by student name, PRN, or roll number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => (
                            <option key={b._id} value={b._id}>{b.branchCode} - {b.branchName}</option>
                        ))}
                    </select>

                    <select
                        value={semesterFilter}
                        onChange={(e) => setSemesterFilter(e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Student Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Enrolled Students ({filteredStudents.length} Records)
                    </span>
                    <span className="text-xs text-slate-400">
                        Click Edit / Delete to manage candidate credentials
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                            <tr>
                                <th className="px-6 py-4">Student</th>
                                <th className="px-6 py-4">PRN / College ID</th>
                                <th className="px-6 py-4">Roll Number</th>
                                <th className="px-6 py-4">Branch & Sem</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading student records...</td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No students found.</td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => (
                                    <tr key={student._id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <img
                                                    src={student.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                                                    alt={student.name}
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-md"
                                                />
                                                <div>
                                                    <span className="font-bold text-white text-sm block">{student.name}</span>
                                                    <span className="text-[10px] text-slate-400">Div: {student.division || 'A'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-semibold text-blue-400">{student.PRN}</span>
                                            <span className="block text-[10px] text-slate-400">{student.collegeId || student.PRN}</span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-300">
                                            {student.rollNumber}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                {student.branch?.branchCode || 'ENG'} • Sem {student.semester}
                                            </span>
                                            {student.registeredSubjects && student.registeredSubjects.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {student.registeredSubjects.map(sub => (
                                                        <span key={sub._id || sub} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                                                            {sub.subjectCode || sub.subjectName || 'Sub'}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-1.5">
                                                    <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                        0 Subjects • No Hall Ticket
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {student.email || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => openEditModal(student)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(student._id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================= ADD / EDIT / IMPORT MODAL ================= */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Modal Tabs */}
                        {!isEditing && (
                            <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-3">
                                <button
                                    onClick={() => setModalTab('single')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        modalTab === 'single' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Single Student Form
                                </button>
                                <button
                                    onClick={() => setModalTab('import')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        modalTab === 'import' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Import Excel / CSV File
                                </button>
                            </div>
                        )}

                        {/* TAB 1: SINGLE STUDENT FORM */}
                        {modalTab === 'single' && (
                            <>
                                <h2 className="text-lg font-bold text-white mb-4">
                                    {isEditing ? 'Edit Student Details' : 'Add New Student Record'}
                                </h2>

                                <form onSubmit={handleFormSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g. Tanvi Raut"
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Permanent Reg. Number (PRN)</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.PRN}
                                                onChange={(e) => setFormData({ ...formData, PRN: e.target.value })}
                                                placeholder="e.g. 24105009"
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Roll Number</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.rollNumber}
                                                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                                                placeholder="CSE-24-03"
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">College ID</label>
                                            <input
                                                type="text"
                                                value={formData.collegeId}
                                                onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
                                                placeholder="GCOEA/CS/24105009"
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Division</label>
                                            <input
                                                type="text"
                                                value={formData.division}
                                                onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                                                placeholder="A"
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Branch / Department</label>
                                            <select
                                                required
                                                value={formData.branch}
                                                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {branches.map(b => (
                                                    <option key={b._id} value={b._id}>{b.branchCode} - {b.branchName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Semester</label>
                                            <select
                                                value={formData.semester}
                                                onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                                    <option key={s} value={s}>Semester {s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">College Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="student@gcoea.ac.in"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    {/* ENROLLED EXAMINATION SUBJECTS */}
                                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-slate-200">
                                                Enrolled Examination Subjects
                                            </label>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                formData.registeredSubjects?.length > 0 
                                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            }`}>
                                                {formData.registeredSubjects?.length || 0} Enrolled {(!formData.registeredSubjects || formData.registeredSubjects.length === 0) && '• Hall Ticket Blocked'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                            Select all course subjects this student is registered to take. If a student is not enrolled for any subject, their hall ticket cannot be generated.
                                        </p>
                                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 pt-1">
                                            {subjects.length === 0 ? (
                                                <div className="text-xs text-slate-500 py-2">No subjects found in system. Add subjects in Subjects & Depts tab.</div>
                                            ) : (
                                                subjects.map(sub => {
                                                    const isChecked = (formData.registeredSubjects || []).includes(sub._id);
                                                    return (
                                                        <label
                                                            key={sub._id}
                                                            className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                                                isChecked 
                                                                    ? 'bg-blue-600/15 border-blue-500/50 text-white' 
                                                                    : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:bg-slate-900'
                                                            }`}
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        const current = formData.registeredSubjects || [];
                                                                        if (e.target.checked) {
                                                                            setFormData({ ...formData, registeredSubjects: [...current, sub._id] });
                                                                        } else {
                                                                            setFormData({ ...formData, registeredSubjects: current.filter(id => id !== sub._id) });
                                                                        }
                                                                    }}
                                                                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                                                                />
                                                                <span className="font-mono font-bold text-blue-400">{sub.subjectCode}</span>
                                                                <span className="font-medium">{sub.subjectName}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-mono">Sem {sub.semester}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* CANDIDATE PHOTOGRAPH OPTIONS */}
                                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                                        <label className="block text-xs font-bold text-slate-200">
                                            Official Candidate Photograph
                                        </label>

                                        <div className="flex items-center space-x-4">
                                            {/* Preview Thumbnail */}
                                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500 bg-slate-900 flex-shrink-0">
                                                <img
                                                    src={photoPreview || formData.photo || samplePhotos[0]}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="flex-1 space-y-1">
                                                <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                                                    <Camera className="w-3.5 h-3.5" />
                                                    <span>{photoFile ? 'Change JPEG Photo' : 'Upload JPEG Photo'}</span>
                                                    <input
                                                        type="file"
                                                        accept=".jpg,.jpeg,image/jpeg"
                                                        onChange={handlePhotoFileChange}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <p className="text-[10px] text-slate-400">Strictly JPEG (.jpg, .jpeg) passport photo up to 5MB (Stores in Cloudinary).</p>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <span className="text-[10px] text-slate-400 block mb-1">Or choose a sample official avatar:</span>
                                            <div className="flex items-center space-x-2">
                                                {samplePhotos.map((p, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={p}
                                                        alt="preset"
                                                        onClick={() => {
                                                            setFormData({ ...formData, photo: p });
                                                            setPhotoPreview(p);
                                                        }}
                                                        className={`w-8 h-8 rounded-full object-cover cursor-pointer border-2 transition-all ${
                                                            formData.photo === p ? 'border-blue-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
                                        >
                                            {isEditing ? 'Save Changes' : 'Enroll Student'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                        {/* TAB 2: EXCEL / CSV IMPORT */}
                        {modalTab === 'import' && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold text-white">Import Students from Excel or CSV</h2>
                                <p className="text-xs text-slate-400">
                                    Upload class spreadsheets containing columns: <code>name</code>, <code>PRN</code>, <code>rollNumber</code>, <code>branch</code>, <code>semester</code>.
                                </p>

                                <form onSubmit={handleImportSubmit} className="space-y-4">
                                    <div className="p-6 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl bg-slate-800/40 text-center cursor-pointer">
                                        <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                                        <label className="cursor-pointer block text-xs font-bold text-white mb-1">
                                            {importFile ? importFile.name : 'Click to select Excel (.xlsx) or CSV file'}
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls, .csv"
                                                onChange={(e) => setImportFile(e.target.files[0])}
                                                className="hidden"
                                            />
                                        </label>
                                        <p className="text-[10px] text-slate-400">Supported formats: .xlsx, .xls, .csv</p>
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-2">
                                        <button
                                            type="button"
                                            onClick={handleDownloadTemplate}
                                            className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Download Sample CSV Template</span>
                                        </button>
                                    </div>

                                    {importStatus && (
                                        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl font-bold">
                                            {importStatus.message}
                                        </div>
                                    )}

                                    <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={importLoading || !importFile}
                                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                                        >
                                            {importLoading ? 'Processing File...' : 'Upload & Import Students'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentsPage;
