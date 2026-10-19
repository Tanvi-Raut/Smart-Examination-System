import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import emailjs from '@emailjs/browser';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { 
    Lock, 
    Eye, 
    EyeOff, 
    CheckCircle2, 
    AlertCircle, 
    Building2, 
    Calendar, 
    Clock, 
    ShieldCheck, 
    ArrowRight, 
    Sparkles, 
    Mail, 
    User, 
    GraduationCap,
    Check,
    X,
    Send,
    RefreshCw,
    KeyRound
} from 'lucide-react';

const PasswordSetupPage = ({ onComplete, initialToken }) => {
    const { loginWithToken, logout } = useAuth ? useAuth() : {};

    // Robust token extraction
    const getQueryToken = () => {
        if (initialToken) return initialToken.trim();
        try {
            const params = new URLSearchParams(window.location.search);
            let t = params.get('token');
            if (t) return t.trim();

            if (window.location.hash) {
                const hashQ = window.location.hash.indexOf('?');
                if (hashQ !== -1) {
                    t = new URLSearchParams(window.location.hash.substring(hashQ)).get('token');
                    if (t) return t.trim();
                }
            }

            const match = window.location.href.match(/[?&]token=([^&#]+)/);
            if (match && match[1]) {
                return decodeURIComponent(match[1]).trim();
            }
        } catch (e) {
            console.error(e);
        }
        return '';
    };

    const [token, setToken] = useState(getQueryToken());
    const [invitationData, setInvitationData] = useState(null);
    const [verifying, setVerifying] = useState(true);
    const [verifyError, setVerifyError] = useState('');
    const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);

    // Resend email self-service states
    const [resendEmail, setResendEmail] = useState('');
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState('');
    const [resendError, setResendError] = useState('');

    // Form inputs
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleResendSelfService = async (e) => {
        e.preventDefault();
        setResendError('');
        setResendSuccess('');
        if (!resendEmail || !resendEmail.trim()) {
            setResendError('Please enter your institutional email address.');
            return;
        }

        try {
            setResending(true);
            const res = await api.post('/auth/resend-setup-email', { email: resendEmail.trim() });
            const msg = res.data?.message || 'Fresh invitation email dispatched!';
            setResendSuccess(msg);

            // Client-side fallback if non-browser API is restricted in EmailJS dashboard
            const emailResult = res.data?.emailResult;
            if (emailResult && !emailResult.delivered && emailResult.emailjsConfig && emailResult.templateParams) {
                try {
                    const cfg = emailResult.emailjsConfig;
                    await emailjs.send(cfg.serviceId, cfg.templateId, emailResult.templateParams, cfg.publicKey);
                    setResendSuccess(`Fresh invitation email dispatched to ${resendEmail} via EmailJS!`);
                } catch (browserEmailErr) {
                    console.warn('Browser EmailJS dispatch fallback notice:', browserEmailErr);
                }
            }
        } catch (err) {
            setResendError(err.response?.data?.message || 'Failed to resend invitation email. Please verify your email or contact the Exam Cell.');
        } finally {
            setResending(false);
        }
    };

    // Verify token on mount
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setVerifying(false);
                setVerifyError('No invitation token was found in the link. Please open the complete link received in your email.');
                return;
            }

            try {
                setVerifying(true);
                const res = await api.get(`/auth/verify-invitation/${token}`);
                if (res.data?.valid) {
                    setInvitationData(res.data.user);
                } else {
                    setVerifyError(res.data?.message || 'Invalid or expired invitation link.');
                }
            } catch (err) {
                const data = err.response?.data;
                if (data?.alreadyUsed) {
                    setIsAlreadyUsed(true);
                }
                setVerifyError(data?.message || 'This invitation link is invalid or has expired.');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    // Password validation rules
    const passwordRequirements = [
        { label: 'At least 6 characters', valid: password.length >= 6 },
        { label: 'Contains a number or special character', valid: /[0-9!@#$%^&*]/.test(password) },
        { label: 'Passwords match', valid: password && password === confirmPassword }
    ];

    const isFormValid = password.length >= 6 && password === confirmPassword;

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        const trimmedPassword = (password || '').trim();
        const trimmedConfirm = (confirmPassword || '').trim();

        if (!trimmedPassword || trimmedPassword.length < 6) {
            setSubmitError('Password must be at least 6 characters long.');
            return;
        }

        if (trimmedPassword !== trimmedConfirm) {
            setSubmitError('Passwords do not match. Please ensure both fields are identical.');
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post('/auth/setup-password', {
                token: (token || '').trim(),
                password: trimmedPassword
            });

            setIsSuccess(true);
            try {
                confetti({
                    particleCount: 90,
                    spread: 75,
                    origin: { y: 0.6 }
                });
            } catch (cErr) {
                // confetti optional
            }

            // Immediately log in with new JWT token in AuthContext
            if (loginWithToken && res.data?.token) {
                loginWithToken(res.data.user, res.data.token);
            }
        } catch (err) {
            setSubmitError(err.response?.data?.message || 'Failed to setup password. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleProceedToDashboard = () => {
        window.history.replaceState({}, document.title, '/');
        if (onComplete) {
            onComplete();
        } else {
            window.location.href = '/';
        }
    };

    const handleGoToLogin = (emailToPrefill) => {
        const email = emailToPrefill || invitationData?.email || '';
        if (email) {
            localStorage.setItem('prefill_email', email);
            localStorage.setItem('prefill_role', 'invigilator');
        }
        if (logout) {
            logout();
        }
        window.history.replaceState({}, document.title, '/');
        if (onComplete) {
            onComplete();
        } else {
            window.location.href = '/';
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-lg z-10">
                {/* Institutional College Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 mb-4 ring-1 ring-white/20">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                        Government College of Engineering, Amravati
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mt-1">
                        Examination Cell • Invigilator Account Activation
                    </p>
                </div>

                {/* State 1: Verifying Token */}
                {verifying && (
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
                        <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <h3 className="text-base font-bold text-white mb-1">Verifying Invitation Token...</h3>
                        <p className="text-xs text-slate-400">Validating your institutional authorization and duty assignment.</p>
                    </div>
                )}

                {/* State 2: Verification Failed / Expired */}
                {!verifying && verifyError && (
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-7 h-7" />
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">
                            {isAlreadyUsed ? 'Account Already Activated' : 'Invitation Link Invalid or Expired'}
                        </h2>
                        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                            {verifyError}
                        </p>

                        {!isAlreadyUsed && (
                            <div className="mb-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-left">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                                    <Mail className="w-4 h-4" />
                                    <span>Resend Invitation Email</span>
                                </h4>
                                <p className="text-xs text-slate-400 mb-3">
                                    Enter your registered invigilator email address below to receive a fresh password setup link (valid for 48 hours).
                                </p>
                                <form onSubmit={handleResendSelfService} className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="email"
                                            value={resendEmail}
                                            onChange={(e) => setResendEmail(e.target.value)}
                                            placeholder="Enter your email (e.g. invigilator@gcoea.ac.in)"
                                            required
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={resending}
                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-60 cursor-pointer shrink-0"
                                    >
                                        {resending ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <span>Sending...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Resend Setup Email</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {resendSuccess && (
                                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span>{resendSuccess}</span>
                                    </div>
                                )}
                                {resendError && (
                                    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{resendError}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={handleGoToLogin}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                            >
                                <span>Go to Invigilator Sign In</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* State 3: Password Successfully Set */}
                {!verifying && isSuccess && (
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Account Successfully Activated</span>
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">
                            Password Successfully Configured!
                        </h2>
                        <p className="text-sm text-slate-300 mb-6 leading-relaxed max-w-md mx-auto">
                            Your password has been encrypted and secured. Your invigilator account is now active and authenticated.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={handleProceedToDashboard}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                            >
                                <span>Proceed to Invigilator Dashboard</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleGoToLogin(invitationData?.email)}
                                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                                <span>Sign In with New Password</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* State 4: Valid Token - Password Setup Form */}
                {!verifying && !verifyError && !isSuccess && invitationData && (
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
                        {/* Invigilator Assignment Details Card */}
                        <div className="mb-6 p-4 rounded-xl bg-blue-950/40 border border-blue-800/40">
                            <div className="flex items-center space-x-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm">
                                    {invitationData.name?.charAt(0) || 'I'}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white">{invitationData.name}</div>
                                    <div className="text-xs text-blue-300 flex items-center space-x-1">
                                        <Mail className="w-3 h-3" />
                                        <span>{invitationData.email}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-800/30">
                                <div className="flex items-center space-x-1.5 text-slate-300">
                                    <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                    <span>Hall: <strong className="text-white">Hall {invitationData.assignedHall?.hallNumber || 'Assigned Hall'}</strong></span>
                                </div>
                                <div className="flex items-center space-x-1.5 text-slate-300">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                    <span className="truncate">Exam: <strong className="text-white">{invitationData.assignedExam?.subject?.subjectCode || 'Active Exam'}</strong></span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                                <ShieldCheck className="w-5 h-5 text-blue-400" />
                                <span>Create Your Secure Password</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Please choose a private secret password for your invigilator account. This password will be securely encrypted with bcrypt.
                            </p>
                        </div>

                        {submitError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{submitError}</span>
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            {/* New Password */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password (min. 6 characters)"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-type your new password"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Live Requirement Checklist */}
                            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1.5">
                                {passwordRequirements.map((req, idx) => (
                                    <div key={idx} className="flex items-center space-x-2 text-xs">
                                        {req.valid ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                        ) : (
                                            <X className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                        )}
                                        <span className={req.valid ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                            >
                                {submitting ? (
                                    <span className="flex items-center space-x-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Encrypting & Storing Password...</span>
                                    </span>
                                ) : (
                                    <span className="flex items-center space-x-2">
                                        <KeyRound className="w-4 h-4 text-blue-200" />
                                        <span>Set Your Password</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </span>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PasswordSetupPage;
