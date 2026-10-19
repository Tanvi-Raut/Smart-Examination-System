import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import emailjs from '@emailjs/browser';
import { 
    ShieldCheck, 
    UserPlus, 
    Users, 
    Mail, 
    Lock, 
    User, 
    CheckCircle2, 
    AlertCircle, 
    KeyRound, 
    GraduationCap, 
    QrCode, 
    RefreshCw,
    Download,
    Building2,
    Calendar,
    Send,
    Copy,
    Check,
    ExternalLink,
    Sparkles
} from 'lucide-react';

const StaffManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [lastSetupLink, setLastSetupLink] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [resendingId, setResendingId] = useState(null);

    // Form to provision staff
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'invigilator', // 'invigilator' | 'admin'
        assignedExam: '',
        assignedHall: ''
    });

    const [roleFilter, setRoleFilter] = useState('all');

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [uRes, eRes, hRes] = await Promise.all([
                api.get('/auth/users'),
                api.get('/exams').catch(() => ({ data: [] })),
                api.get('/halls').catch(() => ({ data: [] }))
            ]);
            setUsers(uRes.data || []);
            setExams(eRes.data || []);
            setHalls(hRes.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load user accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLastSetupLink('');
        setCopiedLink(false);

        if (!formData.name || !formData.email) {
            setError('Please provide staff name and institutional email.');
            return;
        }

        if (formData.role === 'admin' && !formData.password) {
            setError('Please provide a password for administrator accounts.');
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post('/auth/staff', formData);
            
            const msg = res.data?.message || 'Staff member provisioned successfully!';
            setSuccess(msg);
            if (res.data?.setupLink) {
                setLastSetupLink(res.data.setupLink);
            }

            const emailResult = res.data?.emailResult;
            if (emailResult?.delivered) {
                setSuccess(`Invigilator account provisioned! EmailJS invitation email successfully sent to ${formData.email} (Status 200 OK).`);
            } else if (emailResult && !emailResult.delivered && emailResult.emailjsConfig && emailResult.templateParams) {
                try {
                    const cfg = emailResult.emailjsConfig;
                    await emailjs.send(cfg.serviceId, cfg.templateId, emailResult.templateParams, cfg.publicKey);
                    setSuccess(`Invigilator account provisioned! EmailJS invitation email successfully delivered to ${formData.email}.`);
                } catch (browserEmailErr) {

                    const errDetail = browserEmailErr.text || browserEmailErr.message || 'Unknown EmailJS error';
                    console.warn('Browser EmailJS dispatch notice:', errDetail);
                    if (errDetail.includes('insufficient authentication scopes')) {
                        setError(`Invigilator provisioned! However, Gmail blocked sending: "Request had insufficient authentication scopes". In your EmailJS dashboard, reconnect your Gmail service and check the box "Send email on your behalf". Meanwhile, you can copy the setup link below.`);
                    } else if (errDetail.includes('recipients address is empty')) {
                        setError(`EmailJS notice: In your EmailJS template settings, set the "To Email" field to {{to_email}} or {{email}}.`);
                    } else {
                        setError(`Invigilator provisioned, but EmailJS notice: ${errDetail}. Use the copy link below to send the link directly.`);
                    }
                }
            }

            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'invigilator',
                assignedExam: '',
                assignedHall: ''
            });
            fetchInitialData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to provision staff member.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResendInvitation = async (userId, userEmail) => {
        try {
            setResendingId(userId);
            setError('');
            setSuccess('');
            const res = await api.post(`/auth/users/${userId}/resend-invitation`);
            setSuccess(`Fresh invitation token generated for ${userEmail}!`);
            if (res.data?.setupLink) {
                setLastSetupLink(res.data.setupLink);
            }

            // Client-side EmailJS dispatch fallback
            const emailResult = res.data?.emailResult;
            if (emailResult?.delivered) {
                setSuccess(`Invitation email successfully dispatched to ${userEmail} via EmailJS (Status 200 OK)!`);
            } else if (emailResult && !emailResult.delivered && emailResult.emailjsConfig && emailResult.templateParams) {
                try {
                    const cfg = emailResult.emailjsConfig;
                    await emailjs.send(cfg.serviceId, cfg.templateId, emailResult.templateParams, cfg.publicKey);
                    setSuccess(`Invitation email successfully dispatched to ${userEmail} via EmailJS!`);
                } catch (browserEmailErr) {
                    const errDetail = browserEmailErr.text || browserEmailErr.message || 'Unknown EmailJS error';
                    console.warn('Browser EmailJS dispatch notice:', errDetail);
                    if (errDetail.includes('insufficient authentication scopes')) {
                        setError(`Gmail blocked sending: "Request had insufficient authentication scopes". In your EmailJS dashboard, reconnect your Gmail service and check the box "Send email on your behalf".`);
                    } else {
                        setError(`EmailJS notice: ${errDetail}. You can copy the setup link below.`);
                    }
                }
            }

            fetchInitialData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend invitation email.');
        } finally {
            setResendingId(null);
        }
    };

    const handleCopyLink = (link) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
    };

    const filteredUsers = users.filter(u => {
        if (roleFilter === 'all') return true;
        return u.role === roleFilter;
    });

    const handleVerifyStudent = async (userId) => {
        try {
            const res = await api.put(`/auth/users/${userId}/verify`);
            setSuccess(res.data?.message || 'Student verified successfully!');
            fetchInitialData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to verify student.');
        }
    };

    // Download Staff and Invigilators Roster as CSV File
    const handleDownloadStaffCSV = () => {
        if (!users || users.length === 0) {
            alert("No user records available to download.");
            return;
        }

        const headers = ["Staff Name", "Official Email", "Assigned Role", "Status", "Assigned Hall", "Assigned Exam", "Created Date"];
        const rows = users.map(u => [
            `"${u.name || ''}"`,
            `"${u.email || ''}"`,
            `"${u.role || ''}"`,
            `"${u.accountStatus || 'active'}"`,
            `"${u.assignedHall?.hallNumber || 'N/A'}"`,
            `"${u.assignedExam?.subject?.subjectCode || 'N/A'}"`,
            `"${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `GCOEA_Staff_Accounts_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <KeyRound className="w-4 h-4" />
                        <span>Confidential Exam Cell Administration</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Invigilator & Staff Access Control</h1>
                    <p className="text-slate-400 text-xs mt-1">
                        Provision Invigilators with assigned halls & exams. Secure password setup invitations are dispatched via EmailJS with 48-hour activation tokens.
                    </p>

                </div>
                <div className="flex items-center space-x-2 self-start md:self-auto">
                    <button
                        onClick={handleDownloadStaffCSV}
                        className="flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                        title="Download staff and invigilator accounts as CSV"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Staff CSV</span>
                    </button>
                    <button
                        onClick={fetchInitialData}
                        className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {/* Live Setup Link Card (for quick demonstration / testing) */}
            {lastSetupLink && (
                <div className="p-4 bg-blue-950/40 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-blue-400 font-bold">
                            <Sparkles className="w-4 h-4" />
                            <span>Password Setup Link Generated (48h Token)</span>
                        </div>
                        <p className="text-slate-300 font-mono text-[11px] truncate max-w-lg">
                            {lastSetupLink}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                        <button
                            onClick={() => handleCopyLink(lastSetupLink)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center space-x-1.5 transition-all shadow-md"
                        >
                            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                        </button>
                        <a
                            href={lastSetupLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center space-x-1.5 transition-all"
                        >
                            <span>Open Setup Page</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Provision New Staff */}
                <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
                            <UserPlus className="w-5 h-5 text-blue-400" />
                            <h2 className="text-base font-bold text-white">Provision Account</h2>
                        </div>
                        <p className="text-slate-400 text-xs mb-5">
                            Enter the invigilator's name, email, and assigned hall/exam. EmailJS will dispatch an invitation link for secure password setup.
                        </p>


                        <form onSubmit={handleCreateStaff} className="space-y-4">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assign Role</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, role: 'invigilator' }))}
                                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                                            formData.role === 'invigilator'
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <QrCode className="w-4 h-4" />
                                        <span>Invigilator</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
                                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                                            formData.role === 'admin'
                                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Administrator</span>
                                    </button>
                                </div>
                            </div>

                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                                <div className="relative">
                                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Prof. Aniket Sharma"
                                        required
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Institutional Email</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="sharma@gcoea.ac.in"
                                        required
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Invigilator Duty Assignments */}
                            {formData.role === 'invigilator' && (
                                <>
                                    {/* Assigned Exam */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                                            <span>Assigned Examination</span>
                                            <span className="text-[10px] text-blue-400 font-normal">Step 1</span>
                                        </label>
                                        <div className="relative">
                                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <select
                                                value={formData.assignedExam}
                                                onChange={(e) => setFormData(prev => ({ ...prev, assignedExam: e.target.value }))}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                                            >
                                                <option value="">Select Scheduled Exam (Optional)</option>
                                                {exams.map(ex => (
                                                    <option key={ex._id} value={ex._id}>
                                                        {ex.subject?.subjectCode} - {ex.subject?.subjectName} ({new Date(ex.examDate).toLocaleDateString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Assigned Hall */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                                            <span>Assigned Examination Hall</span>
                                            <span className="text-[10px] text-blue-400 font-normal">Step 1</span>
                                        </label>
                                        <div className="relative">
                                            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <select
                                                value={formData.assignedHall}
                                                onChange={(e) => setFormData(prev => ({ ...prev, assignedHall: e.target.value }))}
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                                            >
                                                <option value="">Select Examination Hall (Optional)</option>
                                                {halls.map(hl => (
                                                    <option key={hl._id} value={hl._id}>
                                                        Hall {hl.hallNumber} {hl.building ? `(${hl.building})` : ''} — {hl.totalSeats} seats
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-[11px] text-blue-300 flex items-start space-x-2">
                                        <Mail className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                                        <span>
                                            <strong>Password Invitation:</strong> A secure setup link will be emailed using EmailJS. The invigilator will set their private password upon opening the link.
                                        </span>
                                    </div>

                                </>
                            )}

                            {/* Password input for Administrator (or optional override) */}
                            {formData.role === 'admin' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Administrator Password</label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="Minimum 6 characters"
                                            required
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                            >
                                {submitting ? (
                                    <span className="flex items-center space-x-2">
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Provisioning & Dispatching Invitation...</span>
                                    </span>
                                ) : (
                                    <span>
                                        {formData.role === 'invigilator' ? 'Provision & Send Setup Email' : 'Provision Administrator'}
                                    </span>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed flex items-start space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>Staff accounts are granted direct access to confidential examination modules. Invigilator passwords are time-limited and encrypted with bcrypt.</span>
                    </div>
                </div>

                {/* Right Column: User Accounts Table */}
                <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                        <div className="flex items-center space-x-2">
                            <Users className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-base font-bold text-white">Registered Accounts ({filteredUsers.length})</h2>
                        </div>
                        {/* Filter by Role */}
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 self-start sm:self-auto">
                            {[
                                { key: 'all', label: 'All' },
                                { key: 'admin', label: 'Admins' },
                                { key: 'invigilator', label: 'Invigilators' },
                                { key: 'student', label: 'Students' }
                            ].map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setRoleFilter(f.key)}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                        roleFilter === f.key
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading registered users from database...</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 text-xs">
                            No accounts found for selected filter.
                        </div>
                    ) : (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-3 px-3">User & Email</th>
                                        <th className="py-3 px-3">Role</th>
                                        <th className="py-3 px-3">Assigned Duty</th>
                                        <th className="py-3 px-3">Status</th>
                                        <th className="py-3 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredUsers.map((u) => {
                                        const roleColors = {
                                            admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                                            invigilator: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                            student: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        };
                                        const RoleIcon = u.role === 'admin' ? ShieldCheck : u.role === 'invigilator' ? QrCode : GraduationCap;
                                        const isPendingVerification = u.accountStatus === 'pending_verification';
                                        const isPendingSetup = u.accountStatus === 'pending_setup';

                                        return (
                                            <tr key={u._id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-white">{u.name}</div>
                                                    <div className="text-[11px] text-slate-400">{u.email}</div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${roleColors[u.role] || 'bg-slate-700 text-slate-300'}`}>
                                                        <RoleIcon className="w-3 h-3" />
                                                        <span>{u.role}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3">
                                                    {u.role === 'invigilator' ? (
                                                        <div className="space-y-0.5">
                                                            {u.assignedHall ? (
                                                                <div className="flex items-center space-x-1 text-slate-300 font-medium">
                                                                    <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                                                                    <span>Hall {u.assignedHall.hallNumber}</span>
                                                                </div>
                                                            ) : null}
                                                            {u.assignedExam ? (
                                                                <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                                                                    <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                                                                    <span>{u.assignedExam.subject?.subjectCode || 'Exam'}</span>
                                                                </div>
                                                            ) : null}
                                                            {!u.assignedHall && !u.assignedExam && (
                                                                <span className="text-slate-500 italic">Not Assigned</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 font-mono text-[11px]">{u.PRN || '—'}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isPendingSetup
                                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                            : isPendingVerification 
                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    }`}>
                                                        {isPendingSetup ? 'Invitation Sent' : isPendingVerification ? 'Pending Verify' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {isPendingVerification && (
                                                            <button
                                                                onClick={() => handleVerifyStudent(u._id)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                                                            >
                                                                Verify
                                                            </button>
                                                        )}
                                                        {u.role === 'invigilator' && (
                                                            <button
                                                                onClick={() => handleResendInvitation(u._id, u.email)}
                                                                disabled={resendingId === u._id}
                                                                className="px-2.5 py-1 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-700/60 text-[11px] font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                                                                title={`Resend password setup invitation email to ${u.email}`}
                                                            >
                                                                {resendingId === u._id ? (
                                                                    <>
                                                                        <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></span>
                                                                        <span>Sending...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Send className="w-3 h-3 text-blue-400" />
                                                                        <span>Resend Email</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffManagementPage;
