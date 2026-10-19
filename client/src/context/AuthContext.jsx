import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const transferToken = params.get('auth_token');
            const transferUser = params.get('auth_user');
            if (transferToken && transferUser) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(transferUser));
                    localStorage.setItem('token', transferToken);
                    localStorage.setItem('user', JSON.stringify(parsed));
                    params.delete('auth_token');
                    params.delete('auth_user');
                    const newSearch = params.toString() ? `?${params.toString()}` : '';
                    window.history.replaceState({}, '', `${window.location.pathname}${newSearch}${window.location.hash}`);
                    return parsed;
                } catch (e) {
                    console.warn('Failed to parse transferred user session:', e);
                }
            }
        }
        const saved = localStorage.getItem('user');
        if (!saved) return null;
        try {
            const parsed = JSON.parse(saved);
            // Sanitize: staff (admin, invigilator) must never have a PRN, and students cannot have an email as PRN
            if (parsed && (parsed.role !== 'student' || (parsed.PRN && parsed.PRN.includes('@')))) {
                parsed.PRN = null;
                localStorage.setItem('user', JSON.stringify(parsed));
            }
            return parsed;
        } catch (e) {
            return null;
        }
    });
    const [token, setToken] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const transferToken = params.get('auth_token');
            if (transferToken) {
                return transferToken;
            }
        }
        return localStorage.getItem('token') || '';
    });
    const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
    const [networkOnline, setNetworkOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setNetworkOnline(true);
        const handleOffline = () => {
            setNetworkOnline(false);
            setIsOfflineMode(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const login = async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const data = response.data;
        const isStudent = data.role === 'student';
        const userData = {
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.role,
            PRN: isStudent && data.PRN && !data.PRN.includes('@') ? data.PRN : null,
            mustChangePassword: Boolean(data.mustChangePassword)
        };
        setUser(userData);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', data.token);
        return data;
    };

    const changePassword = async (newPassword, currentPassword) => {
        const response = await api.post('/auth/change-password', { newPassword, currentPassword });
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, mustChangePassword: false };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
        return response.data;
    };

    const register = async (registerData) => {
        const response = await api.post('/auth/register', registerData);
        const data = response.data;
        const isStudent = data.role === 'student';
        const userData = {
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.role,
            PRN: isStudent && data.PRN && !data.PRN.includes('@') ? data.PRN : null,
            mustChangePassword: Boolean(data.mustChangePassword)
        };
        setUser(userData);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', data.token);
        return data;
    };

    const loginDemo = async (roleType) => {
        let creds = { email: 'admin@gcoea.ac.in', password: 'admin123' };
        if (roleType === 'invigilator') {
            creds = { email: 'invigilator@gcoea.ac.in', password: 'invigilator123' };
        } else if (roleType === 'student') {
            creds = { email: '23005081', password: 'Student@23005081' };
        }
        return await login(creds.email, creds.password);
    };

    const loginWithToken = (userData, userToken) => {
        const isStudent = userData.role === 'student';
        const formattedUser = {
            _id: userData._id,
            name: userData.name,
            email: userData.email,
            role: (userData.role || 'invigilator').toLowerCase(),
            accountStatus: userData.accountStatus || 'active',
            assignedExam: userData.assignedExam,
            assignedHall: userData.assignedHall,
            PRN: isStudent && userData.PRN && !userData.PRN.includes('@') ? userData.PRN : null,
            mustChangePassword: Boolean(userData.mustChangePassword)
        };
        setUser(formattedUser);
        setToken(userToken);
        localStorage.setItem('user', JSON.stringify(formattedUser));
        localStorage.setItem('token', userToken);
        return formattedUser;
    };

    const logout = () => {
        setUser(null);
        setToken('');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    const toggleOfflineMode = () => {
        setIsOfflineMode(prev => !prev);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                loginWithToken,
                register,
                loginDemo,
                logout,
                changePassword,
                isOfflineMode,
                toggleOfflineMode,
                networkOnline,
                isAdmin: user?.role === 'admin',
                isInvigilator: user?.role === 'invigilator' || user?.role === 'admin',
                isStudent: user?.role === 'student'
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
