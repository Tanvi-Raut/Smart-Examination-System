import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.jpeg';
import { 
    ShieldCheck, 
    Wifi, 
    WifiOff, 
    User, 
    LogOut, 
    Sparkles, 
    GraduationCap, 
    QrCode, 
    FileText, 
    Users, 
    Building2, 
    BookOpen, 
    Calendar, 
    Layers, 
    BarChart3, 
    RefreshCw,
    Menu,
    X,
    KeyRound,
    Shield
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

const Navbar = ({ activeTab, setActiveTab }) => {
    const { user, logout, isOfflineMode, toggleOfflineMode, networkOnline } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Admin Dashboard', icon: BarChart3, roles: ['admin'] },
        { id: 'invigilator-dashboard', label: 'Invigilator Center', icon: ShieldCheck, roles: ['admin', 'invigilator'] },
        { id: 'student-dashboard', label: 'Student Portal & QR', icon: GraduationCap, roles: ['admin', 'student'] },
        { id: 'bulk-upload', label: 'Bulk Upload (Excel/CSV)', icon: FileText, roles: ['admin'] },
        { id: 'students', label: 'Students', icon: Users, roles: ['admin'] },
        { id: 'halls', label: 'Halls & Seats', icon: Building2, roles: ['admin'] },
        { id: 'subjects', label: 'Subjects & Depts', icon: BookOpen, roles: ['admin'] },
        { id: 'exams', label: 'Exam Schedules', icon: Calendar, roles: ['admin'] },
        { id: 'allocation', label: 'Seating Allocation', icon: Layers, roles: ['admin'] },
        { id: 'tickets', label: 'Hall Tickets & QR', icon: FileText, roles: ['admin', 'student', 'invigilator'] },
        { id: 'scanner', label: 'QR Camera Scan', icon: QrCode, roles: ['admin', 'invigilator'] },
        { id: 'offline-sync', label: 'Offline Sync (IndexedDB)', icon: RefreshCw, roles: ['admin', 'invigilator'] },
        { id: 'reports', label: 'Attendance Reports', icon: ShieldCheck, roles: ['admin', 'invigilator'] },
        { id: 'staff', label: 'Staff & Roles', icon: Users, roles: ['admin'] },
    ];


    const allowedItems = navItems.filter(item => 
        !user || item.roles.includes(user.role)
    );

    return (
        <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
            {/* Top Bar: Institute Branding & System Status */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 sm:h-20 border-b border-slate-800/80">
                    {/* Left: College Logo & Title */}
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white p-1 border border-slate-700/60 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 overflow-hidden">
                            <img 
                                src={logoImg} 
                                alt="Government College of Engineering, Amravati Logo" 
                                className="w-full h-full object-contain" 
                            />
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                                    Government College of Engineering, Amravati
                                </span>
                                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Autonomous
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 hidden sm:block">
                                Smart Examination Management System • QR Student Verification & Seating Allocation
                            </p>
                        </div>
                    </div>

                    {/* Right: Offline Status, Role Switcher & User Profile */}
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        {/* Offline Mode Toggle Button (Key Synopsis Feature!) */}
                        <button
                            onClick={toggleOfflineMode}
                            title="Toggle Offline Examination Mode"
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                isOfflineMode
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            }`}
                        >
                            {isOfflineMode ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
                            <span className="hidden md:inline">
                                {isOfflineMode ? 'Offline Mode (IndexedDB)' : 'Online Connected'}
                            </span>
                        </button>


                        {/* User Profile / Logout */}
                        {user ? (
                            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                                <div className="hidden lg:block text-right">
                                    <p className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">{user.name}</p>
                                    <p className="text-[10px] text-slate-400">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => setShowPasswordModal(true)}
                                    title="Change Password"
                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                >
                                    <KeyRound className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={logout}
                                    title="Logout"
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md"
                            >
                                Login
                            </button>
                        )}

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-slate-400 hover:text-white"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Sub Navigation Bar: Module Tabs */}
                <nav className="hidden md:flex space-x-1 py-2 overflow-x-auto no-scrollbar">
                    {allowedItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="md:hidden px-4 pt-2 pb-4 space-y-1 bg-slate-950 border-b border-slate-800">
                    {allowedItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                    {user && (
                        <button
                            onClick={() => {
                                setShowPasswordModal(true);
                                setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                        >
                            <KeyRound className="w-5 h-5 text-blue-400" />
                            <span>Change Password</span>
                        </button>
                    )}
                </div>
            )}

            {/* Global Change Password Modal */}
            <ChangePasswordModal 
                isOpen={showPasswordModal} 
                onClose={() => setShowPasswordModal(false)} 
            />
        </header>
    );
};

export default Navbar;
