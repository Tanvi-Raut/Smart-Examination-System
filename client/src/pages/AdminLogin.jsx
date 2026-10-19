import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.jpeg';
import gateImg from '../assets/gate.jpeg';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
    GraduationCap,
    ShieldCheck,
    Lock,
    Mail,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    QrCode,
    Shield,
    Upload,
    Camera,
    UserPlus,
    User,
    Sparkles,
    Check,
    Send
} from 'lucide-react';

const AdminLogin = () => {
    const { login } = useAuth();

    // Mode: 'login' | 'register' (Step 1: Student Registration Form)
    const [authMode, setAuthMode] = useState('login');

    // Selected role guidance tab: 'student' | 'invigilator' | 'admin'
    const [selectedRole, setSelectedRole] = useState('student');

    // Login Form State (Clean empty fields with placeholders)
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isResendingInvitation, setIsResendingInvitation] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Dynamic Branches from MongoDB
    const [branches, setBranches] = useState([]);

    // Registration Form State (Step 1)
    const [regData, setRegData] = useState({
        name: '',
        PRN: '',
        rollNumber: '',
        branch: '',
        year: 'Third Year',
        semester: 6,
        division: 'A',
        email: ''
    });
    const [regPhotoFile, setRegPhotoFile] = useState(null);
    const [regPhotoPreview, setRegPhotoPreview] = useState('');
    const [regPhotoError, setRegPhotoError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get('/branches');
                const list = res.data || [];
                setBranches(list);
                if (list.length > 0 && !regData.branch) {
                    setRegData(prev => ({ ...prev, branch: list[0]._id }));
                }
            } catch (err) {
                console.error('Failed to load branches:', err);
            }
        };
        fetchBranches();

        // Check if redirected from Password Setup
        const prefillEmail = localStorage.getItem('prefill_email');
        const prefillRole = localStorage.getItem('prefill_role');
        if (prefillEmail) {
            setLoginIdentifier(prefillEmail);
            setSelectedRole(prefillRole || 'invigilator');
            setSuccessMessage('Password configured successfully! Please enter your new password to sign in.');
            localStorage.removeItem('prefill_email');
            localStorage.removeItem('prefill_role');
        }
    }, []);

    // Step 1: Validate and accept student photograph strictly in JPEG format
    const handleRegPhotoChange = (e) => {
        const file = e.target.files[0];
        setRegPhotoError('');
        if (file) {
            const isJpegMime = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/pjpeg';
            const isJpegExt = /\.(jpg|jpeg)$/i.test(file.name);

            if (!isJpegMime && !isJpegExt) {
                setRegPhotoError('Invalid Format: Please upload photograph strictly in JPEG (.jpg, .jpeg) format.');
                e.target.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                setRegPhotoError('Size Limit Exceeded: Photo file size must be less than 5MB.');
                e.target.value = '';
                return;
            }

            setRegPhotoFile(file);
            setRegPhotoPreview(URL.createObjectURL(file));
        }
    };

    // Handle Login Submit
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            await login(loginIdentifier.trim(), loginPassword);
        } catch (err) {
            const msg = err.response?.data?.message || 'Invalid Credentials. Please check your Email / PRN and password.';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // Public/Invigilator self-service resend setup email
    const handleResendInvigilatorEmail = async (emailOverride) => {
        const targetEmail = (emailOverride || loginIdentifier || '').trim();
        if (!targetEmail) {
            setError('Please enter your registered invigilator email address.');
            return;
        }

        try {
            setIsResendingInvitation(true);
            setError('');
            setSuccessMessage('');
            const res = await api.post('/auth/resend-setup-email', { email: targetEmail });
            setSuccessMessage(res.data?.message || `A fresh invitation email has been dispatched to ${targetEmail}. Please check your inbox.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend setup email. Please verify your email or contact the administrator.');
        } finally {
            setIsResendingInvitation(false);
        }
    };

    // Step 2: Send Data to Backend via FormData (Pipes JPEG photo to Multer -> Cloudinary)
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setRegPhotoError('');

        if (!regData.name.trim() || !regData.PRN.trim() || !regData.branch) {
            setError('Please fill in your Full Name, PRN, and select your Branch.');
            return;
        }

        if (!regPhotoFile) {
            setRegPhotoError('Please select and upload your official passport photograph in JPEG format.');
            return;
        }

        setIsRegistering(true);
        try {
            const formData = new FormData();
            formData.append('name', regData.name.trim());
            formData.append('PRN', regData.PRN.trim());
            formData.append('rollNumber', regData.rollNumber.trim() || regData.PRN.trim());
            formData.append('branch', regData.branch);
            formData.append('year', regData.year);
            formData.append('semester', regData.semester);
            formData.append('division', regData.division);
            formData.append('email', (regData.email || `${regData.PRN.trim()}@gcoea.ac.in`).toLowerCase().trim());
            formData.append('photo', regPhotoFile); // JPEG File sent to backend Multer & Cloudinary

            const res = await api.post('/students/register', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage(res.data?.message || 'Registration successful! Photo stored in Cloudinary. Please sign in with your default password.');
            setLoginIdentifier(regData.PRN.trim());
            setSelectedRole('student');
            setAuthMode('login');

            // Reset registration fields
            setRegData({
                name: '',
                PRN: '',
                rollNumber: '',
                branch: branches[0]?._id || '',
                year: 'Third Year',
                semester: 6,
                division: 'A',
                email: ''
            });
            setRegPhotoFile(null);
            setRegPhotoPreview('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to register student.');
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div
            className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white"
            style={{
                background: 'linear-gradient(135deg, #0b1528 0%, #112347 35%, #1e3a6d 55%, #e8eef8 80%, #ffffff 100%)'
            }}
        >
            {/* Ambient Lighting Layers matching Login Dashboard Colors */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {/* Deep Dashboard Navy (slate-900 / indigo-950) Atmosphere */}
                <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-[#0b1528] rounded-full blur-[120px] opacity-90" />

                {/* Pure White Dashboard Accent Illumination */}
                <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-white rounded-full blur-[140px] opacity-80" />

                {/* Subtle Blue Glow Accent */}
                <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[400px] h-[400px] bg-blue-700/15 rounded-full blur-[100px]" />

                {/* Modern Radial Dot Mesh */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:28px_28px] opacity-15" />
            </div>

            {/* Main Container Card */}
            <div className="relative z-10 w-full max-w-5xl bg-white/95 border border-white/40 rounded-3xl overflow-hidden shadow-[0_25px_65px_-15px_rgba(11,21,40,0.45)] flex flex-col md:flex-row backdrop-blur-xl">

                {/* Left Side: Institutional Info & Campus Gate */}
                <div className="w-full md:w-5/12 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-7 sm:p-8 flex flex-col justify-between text-white border-b md:border-b-0 md:border-r border-slate-800">
                    <div>
                        {/* Institute Badge with Official Logo */}
                        <div className="flex items-center space-x-3.5 mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 border border-white/20 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
                                <img
                                    src={logoImg}
                                    alt="Government College of Engineering, Amravati Logo"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                                    Autonomous Institute
                                </span>
                                <div className="text-[11px] text-slate-300 font-medium">Govt. of Maharashtra</div>
                            </div>
                        </div>

                        {/* Title & Subtitle */}
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                            Government College of Engineering, Amravati
                        </h2>
                        <p className="text-blue-200/80 text-xs mt-1.5 font-medium leading-relaxed">
                            Smart Examination Management System
                        </p>

                        {/* Main Campus Entrance Photo (Original Color - No Overlay or Tint) */}
                        <div className="mt-5 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
                            <img
                                src={gateImg}
                                alt="Government College of Engineering, Amravati Campus Gate"
                                className="w-full h-52 sm:h-60 object-cover object-center block"
                            />
                        </div>
                    </div>

                    {/* Diamond Jubilee Footer */}
                    <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-blue-200/60 flex items-center justify-between">
                        <span>Diamond Jubilee • 1964–2024</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">60 Years of Excellence</span>
                    </div>
                </div>

                {/* Right Side: Auth Form (Sign In or Student Registration) */}
                <div className="w-full md:w-7/12 p-8 sm:p-10 flex flex-col justify-center bg-white max-h-[92vh] overflow-y-auto">
                    {/* Header */}
                    <div className="border-b border-slate-200 pb-4 mb-5">
                        <div className="flex items-center space-x-2 text-blue-600 mb-1">
                            {authMode === 'login' ? <ShieldCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {authMode === 'login' ? 'Secure Access' : 'Cloudinary Student Onboarding'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            {authMode === 'login' ? 'Sign In to Portal' : 'Student Registration'}
                        </h1>
                        <p className="text-slate-500 text-xs mt-1">
                            {authMode === 'login'
                                ? 'Enter your credentials to access your role-specific dashboard'
                                : 'Register your details and upload your official photograph in JPEG format'}
                        </p>
                    </div>

                    {/* Alert Notifications */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                <span>{error}</span>
                            </div>
                            {error.includes('Account activation required') && (
                                <button
                                    type="button"
                                    onClick={() => handleResendInvigilatorEmail()}
                                    disabled={isResendingInvitation}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm transition-all flex items-center space-x-1 shrink-0 cursor-pointer disabled:opacity-60"
                                >
                                    {isResendingInvitation ? (
                                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    ) : (
                                        <Send className="w-3 h-3" />
                                    )}
                                    <span>Resend Setup Email</span>
                                </button>
                            )}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* ================= MODE A: SIGN IN FORM ================= */}
                    {authMode === 'login' && (
                        <>
                            {/* Role Selector Tabs (Switches Input Placeholders) */}
                            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('admin')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${selectedRole === 'admin'
                                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>Admin</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('invigilator')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${selectedRole === 'invigilator'
                                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Invigilator</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('student')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${selectedRole === 'student'
                                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                >
                                    <GraduationCap className="w-3.5 h-3.5" />
                                    <span>Student</span>
                                </button>
                            </div>

                            {/* SIGN IN FORM */}
                            <form onSubmit={handleLoginSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        {selectedRole === 'student'
                                            ? 'University PRN or Registered Email'
                                            : selectedRole === 'invigilator'
                                                ? 'Invigilator Email or Username'
                                                : 'Administrator Email or Username'}
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={loginIdentifier}
                                            onChange={(e) => setLoginIdentifier(e.target.value)}
                                            placeholder={
                                                selectedRole === 'student'
                                                    ? 'Enter University PRN (e.g. 23005081)'
                                                    : selectedRole === 'invigilator'
                                                        ? 'Enter Invigilator Email (e.g. invigilator@gcoea.ac.in)'
                                                        : 'Enter Admin Email (e.g. admin@gcoea.ac.in)'
                                            }
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            placeholder={
                                                selectedRole === 'student'
                                                    ? 'Default: Student@<PRN> (e.g. Student@23005081)'
                                                    : selectedRole === 'invigilator'
                                                        ? 'Enter invigilator password'
                                                        : 'Enter admin password'
                                            }
                                            required
                                            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {selectedRole === 'student' && (
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                        <span>Student Password Formula:</span>
                                        <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                            Student@{loginIdentifier.trim() || '<Your-PRN>'}
                                        </span>
                                    </div>
                                )}

                                {selectedRole === 'invigilator' && (
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                        <span>First time or missing setup link?</span>
                                        <button
                                            type="button"
                                            onClick={() => handleResendInvigilatorEmail()}
                                            disabled={isResendingInvitation}
                                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                                        >
                                            {isResendingInvitation ? (
                                                <span className="w-2.5 h-2.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></span>
                                            ) : (
                                                <Send className="w-3 h-3" />
                                            )}
                                            <span>Resend Setup Email</span>
                                        </button>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center space-x-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            <span>Authenticating & Verifying Role...</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center space-x-1.5">
                                            <span>Sign In & Open Dashboard</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </span>
                                    )}
                                </button>
                            </form>

                            {/* Link to Student Registration Form (Step 1) */}
                            <div className="mt-5 pt-4 border-t border-slate-200 text-center">
                                <p className="text-xs text-slate-500">
                                    New student without credentials?{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode('register');
                                            setError('');
                                            setSuccessMessage('');
                                        }}
                                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center space-x-1"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        <span>Register & Upload Photo</span>
                                    </button>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ================= MODE B: STUDENT REGISTRATION FORM (Steps 1 & 2) ================= */}
                    {authMode === 'register' && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                            {/* Full Name & PRN */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            value={regData.name}
                                            onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                                            placeholder="e.g. Tanvi Raut"
                                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        University PRN <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={regData.PRN}
                                        onChange={(e) => setRegData({ ...regData, PRN: e.target.value })}
                                        placeholder="e.g. 24105009"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Branch & Roll Number */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Branch / Department <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={regData.branch}
                                        onChange={(e) => setRegData({ ...regData, branch: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="">Select Branch</option>
                                        {branches.map(b => (
                                            <option key={b._id} value={b._id}>
                                                {b.branchCode} - {b.branchName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Roll Number
                                    </label>
                                    <input
                                        type="text"
                                        value={regData.rollNumber}
                                        onChange={(e) => setRegData({ ...regData, rollNumber: e.target.value })}
                                        placeholder="e.g. CSE-24-09"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                                    />
                                </div>
                            </div>

                            {/* Year, Semester & Division */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Year</label>
                                    <select
                                        value={regData.year}
                                        onChange={(e) => setRegData({ ...regData, year: e.target.value })}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900"
                                    >
                                        <option value="First Year">1st Year</option>
                                        <option value="Second Year">2nd Year</option>
                                        <option value="Third Year">3rd Year</option>
                                        <option value="Final Year">Final Year</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Semester</label>
                                    <select
                                        value={regData.semester}
                                        onChange={(e) => setRegData({ ...regData, semester: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                            <option key={s} value={s}>Sem {s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Division</label>
                                    <select
                                        value={regData.division}
                                        onChange={(e) => setRegData({ ...regData, division: e.target.value })}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900"
                                    >
                                        <option value="A">Div A</option>
                                        <option value="B">Div B</option>
                                        <option value="C">Div C</option>
                                    </select>
                                </div>
                            </div>

                            {/* STEP 1: OFFICIAL CANDIDATE PHOTOGRAPH IN JPEG FORMAT */}
                            <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-900">
                                        Upload Photograph <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                                        JPEG Only (.jpg / .jpeg)
                                    </span>
                                </div>

                                <div className="flex items-center space-x-3.5">
                                    {/* Live Preview */}
                                    <div className="w-16 h-20 rounded-xl overflow-hidden border-2 border-blue-500 bg-white shadow-sm flex items-center justify-center shrink-0">
                                        {regPhotoPreview ? (
                                            <img
                                                src={regPhotoPreview}
                                                alt="Uploaded Candidate Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Camera className="w-6 h-6 text-slate-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all">
                                            <Upload className="w-3.5 h-3.5" />
                                            <span>{regPhotoFile ? 'Change JPEG Photo' : 'Select JPEG Photo'}</span>
                                            <input
                                                type="file"
                                                accept=".jpg,.jpeg,image/jpeg"
                                                onChange={handleRegPhotoChange}
                                                className="hidden"
                                                required={!regPhotoFile}
                                            />
                                        </label>
                                        <p className="text-[11px] text-slate-600 font-medium">
                                            {regPhotoFile
                                                ? `${regPhotoFile.name} (${Math.round(regPhotoFile.size / 1024)} KB)`
                                                : 'Passport size, white/light background, max 5MB.'}
                                        </p>
                                    </div>
                                </div>

                                {regPhotoError && (
                                    <p className="text-[11px] font-bold text-red-600 bg-red-100 p-2 rounded-lg border border-red-200">
                                        {regPhotoError}
                                    </p>
                                )}
                            </div>

                            {/* Submit Registration via FormData (Steps 1 & 2) */}
                            <button
                                type="submit"
                                disabled={isRegistering}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                            >
                                {isRegistering ? (
                                    <span className="flex items-center space-x-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Validating Multer & Uploading to Cloudinary...</span>
                                    </span>
                                ) : (
                                    <span className="flex items-center space-x-1.5">
                                        <Check className="w-4 h-4" />
                                        <span>Complete Registration & Upload to Cloudinary</span>
                                    </span>
                                )}
                            </button>

                            {/* Back to Sign In Link */}
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMode('login');
                                        setError('');
                                        setSuccessMessage('');
                                    }}
                                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                                >
                                    Already registered? Return to Sign In
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;