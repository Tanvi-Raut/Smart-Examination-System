import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import StudentsPage from './pages/StudentsPage';
import HallsPage from './pages/HallsPage';
import BranchesSubjectsPage from './pages/BranchesSubjectsPage';
import ExamsPage from './pages/ExamsPage';
import SeatingAllocationPage from './pages/SeatingAllocationPage';
import HallTicketsPage from './pages/HallTicketsPage';
import InvigilatorScannerPage from './pages/InvigilatorScannerPage';
import OfflineSyncPage from './pages/OfflineSyncPage';
import StudentDashboard from './pages/StudentDashboard';
import InvigilatorDashboard from './pages/InvigilatorDashboard';
import BulkUploadPage from './pages/BulkUploadPage';
import ReportsPage from './pages/ReportsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PasswordSetupPage from './pages/PasswordSetupPage';
import ErrorBoundary from './components/ErrorBoundary';
import { GraduationCap } from 'lucide-react';


const MainLayout = () => {
    const { user } = useAuth();

    // Robust detection of invigilator password setup URL and token
    const extractSetupToken = () => {
        try {
            const searchParams = new URLSearchParams(window.location.search);
            let t = searchParams.get('token');
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
            console.error('Error reading token from URL:', e);
        }
        return '';
    };

    const setupToken = extractSetupToken();
    const isSetupRoute = window.location.pathname.includes('setup-password') || Boolean(setupToken);

    if (isSetupRoute) {
        return (
            <PasswordSetupPage 
                initialToken={setupToken}
                onComplete={() => {
                    window.history.replaceState({}, document.title, '/');
                    window.location.href = '/';
                }} 
            />
        );
    }

    const [activeTab, setActiveTab] = useState(
        user?.role === 'invigilator' ? 'invigilator-dashboard' : user?.role === 'student' ? 'student-dashboard' : 'dashboard'
    );
    const [selectedExamForAction, setSelectedExamForAction] = useState('');
    const [proctorExamId, setProctorExamId] = useState(
        () => localStorage.getItem('smart_exam_active_exam') || ''
    );
    const [proctorHallId, setProctorHallId] = useState(
        () => localStorage.getItem('smart_exam_active_hall') || ''
    );

    const handleProctorExamChange = (id) => {
        setProctorExamId(id);
        if (id) localStorage.setItem('smart_exam_active_exam', id);
    };

    const handleProctorHallChange = (id) => {
        setProctorHallId(id);
        if (id) localStorage.setItem('smart_exam_active_hall', id);
    };

    React.useEffect(() => {
        if (user?.role === 'invigilator') {
            setActiveTab('invigilator-dashboard');
        } else if (user?.role === 'student') {
            setActiveTab('student-dashboard');
        } else if (user?.role === 'admin') {
            setActiveTab('dashboard');
        }
    }, [user?.role]);

    if (!user) {
        return <AdminLogin />;
    }


    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
            {/* Global College Navigation Header */}
            <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Main Application Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <ErrorBoundary onReset={() => setActiveTab(user?.role === 'invigilator' ? 'invigilator-dashboard' : user?.role === 'student' ? 'student-dashboard' : 'dashboard')}>
                    {activeTab === 'dashboard' && (
                        <Dashboard setActiveTab={setActiveTab} />
                    )}
                    {activeTab === 'invigilator-dashboard' && (
                        <InvigilatorDashboard 
                            setActiveTab={setActiveTab} 
                            activeExamId={proctorExamId}
                            setActiveExamId={handleProctorExamChange}
                            activeHallId={proctorHallId}
                            setActiveHallId={handleProctorHallChange}
                        />
                    )}
                    {activeTab === 'student-dashboard' && (
                        <StudentDashboard setActiveTab={setActiveTab} />
                    )}
                    {activeTab === 'bulk-upload' && (
                        <BulkUploadPage />
                    )}
                    {activeTab === 'students' && (
                        <StudentsPage />
                    )}
                    {activeTab === 'halls' && (
                        <HallsPage />
                    )}
                    {activeTab === 'subjects' && (
                        <BranchesSubjectsPage />
                    )}
                    {activeTab === 'exams' && (
                        <ExamsPage 
                            setActiveTab={setActiveTab} 
                            setSelectedExamForAction={setSelectedExamForAction} 
                        />
                    )}
                    {activeTab === 'allocation' && (
                        <SeatingAllocationPage 
                            selectedExamForAction={selectedExamForAction} 
                            setActiveTab={setActiveTab} 
                        />
                    )}
                    {activeTab === 'tickets' && (
                        <HallTicketsPage />
                    )}
                    {activeTab === 'scanner' && (
                        <InvigilatorScannerPage 
                            activeExamId={proctorExamId}
                            setActiveExamId={handleProctorExamChange}
                            activeHallId={proctorHallId}
                            setActiveHallId={handleProctorHallChange}
                        />
                    )}
                    {activeTab === 'offline-sync' && (
                        <OfflineSyncPage />
                    )}
                    {activeTab === 'reports' && (
                        <ReportsPage />
                    )}
                    {activeTab === 'staff' && (
                        <StaffManagementPage />
                    )}
                </ErrorBoundary>
            </main>


            {/* Footer with Synopsis & Academic Credits */}
            <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <GraduationCap className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold text-slate-300">
                            Government College of Engineering, Amravati
                        </span>
                        <span>•</span>
                        <span>Department of Computer Science and Engineering</span>
                    </div>

                    <div className="text-center sm:text-right text-[11px] text-slate-400">
                        <span>Project by: Harshali Villhekar • Vaishnavi Jadhav • Tanvi Raut</span>
                        <span className="block text-slate-400">Under the Guidance of Dr. Naresh G. Gadge</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <MainLayout />
        </AuthProvider>
    );
}

export default App;