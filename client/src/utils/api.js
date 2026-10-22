import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Attach JWT token to requests if available
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Global response error handler
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        return Promise.reject(error);
    }
);

export default api;
