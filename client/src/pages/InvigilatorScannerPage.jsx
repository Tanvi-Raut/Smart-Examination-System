import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
    cacheHallRosterOffline, 
    getCachedHallRoster, 
    saveOfflineAttendance,
    getCachedExams,
    cacheExamsOffline,
    getCachedHalls,
    cacheHallsOffline,
    updateStudentAttendanceInCachedRoster
} from '../utils/offlineStorage';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';

import { decodeQRFromImageFile } from '../utils/qrDecoder';
import { 
    QrCode, 
    Camera, 
    CameraOff, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    User, 
    Building2, 
    Calendar, 
    Sparkles, 
    WifiOff, 
    RefreshCw,
    ShieldAlert,
    Upload,
    Search,
    Users,
    Printer,
    FileText,
    Check,
    Copy,
    ArrowRight,
    X,
    Clock,
    FileCheck,
    Download,
    RotateCcw,
    BookOpen,
    ExternalLink,
    Scale
} from 'lucide-react';
import { downloadElementAsPDF, downloadElementAsImage } from '../utils/pdfGenerator';
import ErrorBoundary from '../components/ErrorBoundary';

const InvigilatorScannerPage = ({
    activeExamId: propActiveExamId,
    setActiveExamId: propSetActiveExamId,
    activeHallId: propActiveHallId,
    setActiveHallId: propSetActiveHallId
}) => {
    const { isOfflineMode, user } = useAuth();

    const [exams, setExams] = useState([]);
    const [halls, setHalls] = useState([]);
    const [localExamId, setLocalExamId] = useState('');
    const [localHallId, setLocalHallId] = useState('');

    const activeExamId = propActiveExamId || localExamId;
    const setActiveExamId = (val) => {
        if (propSetActiveExamId) propSetActiveExamId(val);
        setLocalExamId(val);
    };

    const activeHallId = propActiveHallId || localHallId;
    const setActiveHallId = (val) => {
        if (propSetActiveHallId) propSetActiveHallId(val);
        setLocalHallId(val);
    };

    // Scanner state
    const [scannerActive, setScannerActive] = useState(false);
    const [scanError, setScanError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [isRetryingCamera, setIsRetryingCamera] = useState(false);
    const [cameraPermissionStatus, setCameraPermissionStatus] = useState('unknown');

    // Detect whether current origin is insecure (HTTP IP address like 192.168.x.x)
    const isInsecureOrigin = typeof window !== 'undefined' && !(
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'https:'
    );

    const getLocalhostUrl = () => {
        if (typeof window === 'undefined') return 'http://localhost:5173/invigilator-scanner';
        const port = window.location.port || '5173';
        const path = window.location.pathname || '/invigilator-scanner';
        const token = localStorage.getItem('token') || '';
        const userStr = localStorage.getItem('user') || '';
        const params = new URLSearchParams(window.location.search);
        if (token) params.set('auth_token', token);
        if (userStr) params.set('auth_user', encodeURIComponent(userStr));
        const qs = params.toString() ? `?${params.toString()}` : '';
        return `http://localhost:${port}${path}${qs}`;
    };

    const handleSwitchToLocalhost = () => {
        window.location.href = getLocalhostUrl();
    };

    // Input mode tabs: 'camera' | 'upload' | 'prn' | 'selector'
    const [inputMode, setInputMode] = useState('camera');
    const [manualPRN, setManualPRN] = useState('');
    const [selectedStudentPRN, setSelectedStudentPRN] = useState('');
    const [selectorSearchQuery, setSelectorSearchQuery] = useState('');
    const [tableSearch, setTableSearch] = useState('');
    const [copiedPRN, setCopiedPRN] = useState(false);

    // Malpractice Modal State
    const [showMalpracticeModal, setShowMalpracticeModal] = useState(false);
    const [malpracticeReason, setMalpracticeReason] = useState('Mobile phone / Smart device detected');
    const [malpracticeRemarks, setMalpracticeRemarks] = useState('');

    // Print Entry Slip Modal State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    // Live hall roster
    const [rosterData, setRosterData] = useState({
        totalAllocated: 0,
        markedPresent: 0,
        markedAbsent: 0,
        flagged: 0,
        pending: 0,
        roster: []
    });

    const html5QrCodeRef = useRef(null);
    const fileInputRef = useRef(null);
    const isProcessingScanRef = useRef(false);
    const lastScannedTimeRef = useRef(0);
    const videoScanLoopRef = useRef(false);
    const isStartingScannerRef = useRef(false);

    // Audio feedback tone on successful QR scan
    const playScanBeep = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch {}
    };

    // Global Paste (Ctrl+V) listener: paste any QR screenshot to instantly verify
    useEffect(() => {
        const handlePaste = async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        setVerifying(true);
                        setScanError('');
                        try {
                            const decoded = await decodeQRFromImageFile(blob);
                            if (decoded) {
                                playScanBeep();
                                await handleQRScanned(decoded);
                            } else {
                                setScanError("No QR code detected in the pasted image. Please ensure the QR code is clearly visible.");
                            }
                        } catch (err) {
                            setScanError(`Failed to decode pasted image: ${err.message}`);
                        } finally {
                            setVerifying(false);
                        }
                    }
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [activeExamId, activeHallId, isOfflineMode]);

    // Fetch initial exams and halls with automatic IndexedDB offline fallback
    useEffect(() => {
        const fetchInitial = async () => {
            try {
                if (isOfflineMode || !navigator.onLine) {
                    const [cExams, cHalls] = await Promise.all([
                        getCachedExams(),
                        getCachedHalls()
                    ]);
                    if (cExams?.length > 0) {
                        setExams(cExams);
                        if (!propActiveExamId) setActiveExamId(cExams[0]._id);
                    }
                    if (cHalls?.length > 0) {
                        setHalls(cHalls);
                        if (!propActiveHallId) setActiveHallId(cHalls[0]._id);
                    }
                    return;
                }

                const [eRes, hRes] = await Promise.all([
                    api.get('/exams'),
                    api.get('/halls')
                ]);
                const examList = eRes.data || [];
                const hallList = hRes.data || [];
                setExams(examList);
                setHalls(hallList);

                // Auto cache in IndexedDB for potential in-hall jammer usage
                cacheExamsOffline(examList).catch(() => {});
                cacheHallsOffline(hallList).catch(() => {});

                if (examList.length > 0) {
                    const validExam = examList.some(e => e._id === (propActiveExamId || localExamId));
                    if (!validExam) setActiveExamId(examList[0]._id);
                }
                if (hallList.length > 0) {
                    const validHall = hallList.some(h => h._id === (propActiveHallId || localHallId));
                    if (!validHall) setActiveHallId(hallList[0]._id);
                }
            } catch (err) {
                console.warn('Online fetch exams/halls error, falling back to IndexedDB:', err);
                const [cExams, cHalls] = await Promise.all([
                    getCachedExams(),
                    getCachedHalls()
                ]);
                if (cExams?.length > 0) {
                    setExams(cExams);
                    const validExam = cExams.some(e => e._id === (propActiveExamId || localExamId));
                    if (!validExam) setActiveExamId(cExams[0]._id);
                }
                if (cHalls?.length > 0) {
                    setHalls(cHalls);
                    const validHall = cHalls.some(h => h._id === (propActiveHallId || localHallId));
                    if (!validHall) setActiveHallId(cHalls[0]._id);
                }
            }
        };
        fetchInitial();
    }, [isOfflineMode]);

    // Keep activeHallId and activeExamId synchronized if halls/exams change
    useEffect(() => {
        if (halls.length > 0 && activeHallId) {
            const exists = halls.some(h => h._id === activeHallId);
            if (!exists) {
                setActiveHallId(halls[0]._id);
            }
        }
    }, [halls, activeHallId]);

    useEffect(() => {
        if (exams.length > 0 && activeExamId) {
            const exists = exams.some(e => e._id === activeExamId);
            if (!exists) {
                setActiveExamId(exams[0]._id);
            }
        }
    }, [exams, activeExamId]);

    // Enumerate Available Camera Devices on Mount
    useEffect(() => {
        const getCameras = async () => {
            try {
                if (navigator?.mediaDevices?.enumerateDevices) {
                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length > 0) {
                        setAvailableCameras(devices);
                        // Prefer back camera if available, otherwise first camera
                        const rearCam = devices.find(d => 
                            /back|rear|environment/i.test(d.label)
                        );
                        setSelectedCameraId(rearCam ? rearCam.id : devices[0].id);
                    }
                }
            } catch (err) {
                console.warn('Unable to enumerate cameras on mount:', err);
            }
        };
        getCameras();
    }, []);

    // Monitor browser camera permissions in real-time
    useEffect(() => {
        let permStatus = null;
        if (typeof navigator !== 'undefined' && navigator?.permissions?.query) {
            navigator.permissions.query({ name: 'camera' })
                .then(status => {
                    permStatus = status;
                    setCameraPermissionStatus(status.state);
                    status.onchange = () => {
                        setCameraPermissionStatus(status.state);
                    };
                })
                .catch(err => {
                    console.warn('Camera permissions query note:', err);
                });
        }
        return () => {
            if (permStatus) {
                permStatus.onchange = null;
            }
        };
    }, []);

    // Load Hall Roster whenever exam or hall changes
    const loadHallRoster = async () => {
        if (!activeExamId || !activeHallId) return;
        try {
            if (isOfflineMode || !navigator.onLine) {
                const cached = await getCachedHallRoster(activeExamId, activeHallId);
                if (cached) {
                    setRosterData(cached);
                }
            } else {
                const res = await api.get(`/attendance/hall-roster/${activeExamId}/${activeHallId}`);
                setRosterData(res.data);
                await cacheHallRosterOffline(activeExamId, activeHallId, res.data);
            }
        } catch (err) {
            console.warn('Network error loading roster, attempting IndexedDB fallback:', err);
            const cached = await getCachedHallRoster(activeExamId, activeHallId);
            if (cached) {
                setRosterData(cached);
            }
        }
    };

    useEffect(() => {
        loadHallRoster();
    }, [activeExamId, activeHallId, isOfflineMode]);

    // Switch active verification method and cleanly stop camera if moving away
    const handleModeChange = (mode) => {
        if (scannerActive && mode !== 'camera') {
            stopScanner();
        }
        setInputMode(mode);
        setScanError('');
    };

    // Handle Camera Start / Stop with multi-tier fallback and explicit permission checking
    const startScanner = async (cameraIdOverride) => {
        if (isStartingScannerRef.current) {
            console.warn("Scanner initialization already in progress, skipping duplicate call.");
            return;
        }
        isStartingScannerRef.current = true;
        setIsRetryingCamera(true);
        setScanError('');
        setInputMode('camera');

        // Micro-pause to ensure DOM viewfinder is mounted if switching modes
        await new Promise(r => setTimeout(r, 60));

        try {
            // Step A: If already running or previous instance exists, cleanly stop and clear
            if (html5QrCodeRef.current) {
                try {
                    if (html5QrCodeRef.current.isScanning) {
                        await html5QrCodeRef.current.stop();
                    }
                    html5QrCodeRef.current.clear();
                } catch (cleanErr) {
                    console.warn("Clean up previous scanner note:", cleanErr);
                }
                html5QrCodeRef.current = null;
            }

            // Ensure viewfinder element is ready in DOM and clear leftover canvas/video
            const container = document.getElementById("qr-camera-viewfinder");
            if (!container) {
                throw new Error("Webcam viewport element not found in DOM");
            }
            container.innerHTML = "";

            // Step B.1: Check Secure Context (WebRTC requires HTTPS or localhost)
            const isSecureContext = typeof window !== 'undefined' && (
                window.isSecureContext ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'https:'
            );

            if (!isSecureContext) {
                setCameraPermissionStatus('denied');
                const port = window.location.port || '5173';
                throw new Error(`Insecure Origin (${window.location.hostname}): Browsers strictly block camera hardware on HTTP IP addresses. Please click "Switch to http://localhost:${port}" below or use Upload QR Image.`);
            }

            // Step B.2: Query permission status in supported browsers (for UI diagnostics)
            if (typeof navigator !== 'undefined' && navigator?.permissions?.query) {
                try {
                    const p = await navigator.permissions.query({ name: 'camera' });
                    setCameraPermissionStatus(p.state);
                } catch (queryErr) {
                    console.warn("Permissions query check note:", queryErr);
                }
            }

            // Step C: Trigger browser permission prompt / test media stream
            if (navigator?.mediaDevices?.getUserMedia) {
                try {
                    const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    // Permission granted! Stop temporary test tracks immediately
                    testStream.getTracks().forEach(t => t.stop());
                    setCameraPermissionStatus('granted');
                    // 200ms grace period so Windows DirectShow / Media Foundation hardware driver releases cleanly
                    await new Promise(r => setTimeout(r, 200));
                } catch (userMediaErr) {
                    console.warn("Direct getUserMedia test error:", userMediaErr);
                    if (userMediaErr.name === 'NotAllowedError' || userMediaErr.name === 'PermissionDeniedError') {
                        setCameraPermissionStatus('denied');
                        throw new Error(`Camera permission is currently blocked in your browser for ${window.location.host}. Click the tune/lock icon in your address bar, set Camera to "Allow", and reload.`);
                    } else if (userMediaErr.name === 'NotFoundError' || userMediaErr.name === 'DevicesNotFoundError') {
                        throw new Error("No physical camera or webcam detected on this device. You can verify candidates directly below.");
                    } else if (userMediaErr.name === 'NotReadableError' || userMediaErr.name === 'TrackStartError') {
                        throw new Error("Webcam is already in use by another application (Teams, Zoom, Meet) or another browser tab.");
                    } else {
                        throw userMediaErr;
                    }
                }
            } else {
                throw new Error(`MediaDevices API not supported on this origin (${window.location.origin}). Please switch to http://localhost:${window.location.port || '5173'}.`);
            }

            // Step D: Refresh device list with updated permissions
            let targetCam = cameraIdOverride || selectedCameraId;
            try {
                const cams = await Html5Qrcode.getCameras();
                if (cams && cams.length > 0) {
                    setAvailableCameras(cams);
                    if (!targetCam) {
                        const back = cams.find(c => /back|rear|environment/i.test(c.label));
                        targetCam = back ? back.id : cams[0].id;
                        setSelectedCameraId(targetCam);
                    }
                }
            } catch (camErr) {
                console.warn('Camera enumeration note:', camErr);
            }

            const qrScanner = new Html5Qrcode("qr-camera-viewfinder", {
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                verbose: false
            });
            html5QrCodeRef.current = qrScanner;

            // Wide viewport scan configuration
            const config = {
                fps: 30,
                aspectRatio: undefined,
                qrbox: (viewfinderWidth, viewfinderHeight) => ({
                    width: Math.floor(viewfinderWidth * 0.95),
                    height: Math.floor(viewfinderHeight * 0.95)
                })
            };

            const onScanSuccess = (decodedText) => {
                const now = Date.now();
                if (isProcessingScanRef.current || (now - lastScannedTimeRef.current < 2500)) {
                    return;
                }
                isProcessingScanRef.current = true;
                lastScannedTimeRef.current = now;
                playScanBeep();
                handleQRScanned(decodedText);
            };

            // Multi-pass start attempts:
            let started = false;
            let lastError = null;

            // Strategy 1: Specific target camera deviceId
            if (targetCam) {
                try {
                    await qrScanner.start(targetCam, config, onScanSuccess, () => {});
                    started = true;
                } catch (e) {
                    console.warn("Specific camera ID start failed, attempting user camera...", e);
                    lastError = e;
                }
            }

            // Strategy 2: Laptop / desktop front user webcam
            if (!started) {
                try {
                    await qrScanner.start({ facingMode: "user" }, config, onScanSuccess, () => {});
                    started = true;
                } catch (e) {
                    console.warn("User camera start failed, attempting environment camera...", e);
                    lastError = e;
                }
            }

            // Strategy 3: Environment / rear camera (mobile devices)
            if (!started) {
                try {
                    await qrScanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
                    started = true;
                } catch (e) {
                    console.warn("Environment camera start failed, attempting first enumerated device...", e);
                    lastError = e;
                }
            }

            // Strategy 4: First available camera device ID
            if (!started && availableCameras.length > 0) {
                try {
                    await qrScanner.start(availableCameras[0].id, config, onScanSuccess, () => {});
                    started = true;
                } catch (e) {
                    lastError = e;
                }
            }

            if (!started) {
                throw lastError || new Error("Unable to start video feed from any webcam on this device.");
            }

            // Ensure strictly only ONE video element is kept in the viewfinder
            const videos = container.querySelectorAll('video');
            if (videos.length > 1) {
                for (let i = 1; i < videos.length; i++) {
                    videos[i].remove();
                }
            }

            // Hardware-accelerated frame scanner loop: directly analyze the raw <video> element with native C++ BarcodeDetector
            videoScanLoopRef.current = true;
            if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                try {
                    const hwDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    const runHardwareScanLoop = async () => {
                        if (!videoScanLoopRef.current) return;
                        const v = container.querySelector('video');
                        if (v && v.readyState >= 2 && !v.paused) {
                            try {
                                const codes = await hwDetector.detect(v);
                                if (codes && codes.length > 0 && codes[0].rawValue) {
                                    onScanSuccess(codes[0].rawValue);
                                }
                            } catch {}
                        }
                        if (videoScanLoopRef.current) {
                            requestAnimationFrame(runHardwareScanLoop);
                        }
                    };
                    requestAnimationFrame(runHardwareScanLoop);
                } catch (hwErr) {
                    console.warn("Hardware scanner loop note:", hwErr);
                }
            }

            setScannerActive(true);
        } catch (err) {
            console.error('Camera start error:', err);
            setScanError(`Camera access notice: ${err.message || 'Camera is in use or permissions not granted'}.`);
            setScannerActive(false);
        } finally {
            setIsRetryingCamera(false);
            isStartingScannerRef.current = false;
        }
    };

    const stopScanner = async () => {
        videoScanLoopRef.current = false;
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
            } catch (err) {
                console.warn('Stop scanner note:', err);
            }
            html5QrCodeRef.current = null;
        }
        const container = document.getElementById("qr-camera-viewfinder");
        if (container) {
            container.innerHTML = "";
        }
        setScannerActive(false);
    };

    useEffect(() => {
        return () => {
            videoScanLoopRef.current = false;
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    html5QrCodeRef.current.stop().catch(() => {});
                }
            }
        };
    }, []);

    // Handle Uploaded QR Image File Scan (Uses jsQR + Multi-pass preprocessing)
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanError('');
        setVerifying(true);
        try {
            const decodedText = await decodeQRFromImageFile(file);
            if (decodedText) {
                await handleQRScanned(decodedText);
            } else {
                setScanError("No QR code detected in the uploaded image. Please ensure the QR code is clearly visible, or click one of the instant candidate simulators below.");
            }
        } catch (err) {
            console.error('File scan error:', err);
            setScanError(`Unable to process image: ${err.message || 'Decode error'}. You can also select the candidate directly from the list below.`);
        } finally {
            setVerifying(false);
            if (e.target) e.target.value = '';
        }
    };

    // Verify Scanned QR Payload or Student PRN
    const handleQRScanned = async (qrData) => {
        if (!qrData) return;
        setVerifying(true);
        setScanError('');
        try {
            if (isOfflineMode) {
                // Offline verification against IndexedDB roster
                let parsed = null;
                let rawText = '';
                if (typeof qrData === 'object' && qrData !== null) {
                    parsed = qrData;
                } else if (typeof qrData === 'string') {
                    rawText = qrData.trim();
                    try {
                        parsed = JSON.parse(rawText);
                    } catch {
                        parsed = null;
                    }
                }

                const prnToMatch = parsed?.student?.PRN || parsed?.PRN || rawText;
                const cached = await getCachedHallRoster(activeExamId, activeHallId);
                const matchingRoster = cached?.roster?.find(r => 
                    r.student?.PRN === prnToMatch || 
                    (parsed?.allocationId && r.allocationId === parsed.allocationId)
                );

                if (!matchingRoster) {
                    setVerificationResult({
                        valid: false,
                        message: `Candidate (${prnToMatch}) not found in this offline hall roster. Check hall assignment or sync centrally.`
                    });
                } else {
                    setVerificationResult({
                        valid: true,
                        isOffline: true,
                        allocationId: matchingRoster.allocationId,
                        student: matchingRoster.student,
                        seat: matchingRoster.seat,
                        hall: halls.find(h => h._id === activeHallId) || { hallNumber: 'Current Hall' },
                        exam: exams.find(e => e._id === activeExamId),
                        existingAttendance: matchingRoster.status !== 'Pending' ? { status: matchingRoster.status, verifiedAt: matchingRoster.verifiedAt } : null
                    });
                }
            } else {
                // Online verification via robust backend
                const res = await api.post('/attendance/verify-qr', {
                    qrData,
                    activeExamId,
                    activeHallId
                });
                setVerificationResult(res.data);
                if (res.data?.valid) {
                    playScanBeep();
                }
            }
        } catch (err) {
            const errData = err.response?.data;
            setVerificationResult({
                valid: false,
                code: errData?.code,
                message: errData?.message || 'Verification failed. Invalid or unrecognized examination QR code.',
                student: errData?.student,
                isExamMatched: false,
                candidateScheduledExam: errData?.candidateScheduledExam,
                activeProctoredExam: errData?.activeProctoredExam,
                examMatchDetails: errData?.examMatchDetails,
                allocationDetails: errData?.allocationDetails
            });
        } finally {
            setVerifying(false);
            isProcessingScanRef.current = false;
        }
    };

    // Verify candidate selected directly from dropdown
    const handleVerifySelectedCandidate = () => {
        if (!selectedStudentPRN) return;
        handleQRScanned(selectedStudentPRN);
    };

    // Verify candidate entered via manual PRN input
    const handleManualVerify = (e) => {
        e?.preventDefault();
        if (!manualPRN.trim()) return;
        handleQRScanned(manualPRN.trim());
    };

    // Action: Mark Attendance (Present / Absent / Invalid / Malpractice)
    const handleRecordAttendance = async (status, customRemarks = '') => {
        if (!verificationResult || !verificationResult.student) return;

        const payload = {
            examId: activeExamId || verificationResult.exam?._id,
            studentId: verificationResult.student._id,
            hallId: activeHallId || verificationResult.hall?._id,
            seatId: verificationResult.seat?._id,
            allocationId: verificationResult.allocationId,
            status,
            verificationMethod: isOfflineMode ? 'OFFLINE_SYNC' : 'QR_SCAN',
            photoVerified: true,
            remarks: customRemarks || (status === 'Invalid' ? 'Candidate marked as Invalid by Invigilator' : status === 'Malpractice Flagged' ? 'Flagged during physical proctoring' : 'Verified via QR Scan & Official Photo Match')
        };

        try {
            if (isOfflineMode || !navigator.onLine) {
                await saveOfflineAttendance(payload);
                if (activeExamId && activeHallId && verificationResult.student?._id) {
                    await updateStudentAttendanceInCachedRoster(
                        activeExamId,
                        activeHallId,
                        verificationResult.student._id,
                        status
                    );
                    const updatedRoster = await getCachedHallRoster(activeExamId, activeHallId);
                    if (updatedRoster) setRosterData(updatedRoster);
                }
                alert(`Offline Attendance Recorded: Marked as ${status} in IndexedDB.`);
            } else {
                await api.post('/attendance/mark', payload);
                if (status === 'Present') {
                    confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
                }
            }

            // Update verification result view to reflect the new marked status
            setVerificationResult(prev => {
                if (!prev) return prev;
                const updatedSubjectAttendances = (prev.allSubjectAttendances || []).map(sub => {
                    if (sub.isCurrentExam || sub.examId === activeExamId) {
                        return {
                            ...sub,
                            status,
                            verifiedAt: new Date().toISOString(),
                            invigilatorName: user?.name || 'Exam Invigilator'
                        };
                    }
                    return sub;
                });
                return {
                    ...prev,
                    isAlreadyMarked: true,
                    currentStatus: status,
                    existingAttendance: {
                        status,
                        verifiedAt: new Date().toISOString(),
                        invigilatorName: user?.name || 'Exam Invigilator',
                        remarks: payload.remarks
                    },
                    allSubjectAttendances: updatedSubjectAttendances
                };
            });

            // Refresh Hall Roster & Counters
            loadHallRoster();
            setShowMalpracticeModal(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Error recording attendance');
        }
    };

    // Submit Malpractice Report
    const handleConfirmMalpractice = () => {
        const combinedRemarks = `${malpracticeReason}${malpracticeRemarks ? ': ' + malpracticeRemarks : ''}`;
        handleRecordAttendance('Malpractice Flagged', combinedRemarks);
    };

    // Copy PRN to Clipboard helper
    const handleCopyPRN = (prn) => {
        if (!prn) return;
        navigator.clipboard.writeText(prn);
        setCopiedPRN(true);
        setTimeout(() => setCopiedPRN(false), 2000);
    };

    // Download Entry Slip as Official PDF File
    const handleDownloadEntrySlipPDF = async () => {
        const element = document.getElementById("printable-entry-slip");
        if (!element || !verificationResult) return;
        try {
            setDownloadingPDF(true);
            await downloadElementAsPDF(
                element,
                `GCOEA_EntrySlip_${verificationResult.student?.PRN || 'Candidate'}.pdf`,
                'a5'
            );
        } catch (err) {
            console.error("PDF download error:", err);
            alert("Error downloading entry slip PDF");
        } finally {
            setDownloadingPDF(false);
        }
    };

    // Download Entry Slip as High-Res PNG Image
    const handleDownloadEntrySlipImage = async () => {
        const element = document.getElementById("printable-entry-slip");
        if (!element || !verificationResult) return;
        try {
            setDownloadingPDF(true);
            await downloadElementAsImage(
                element,
                `GCOEA_EntrySlip_${verificationResult.student?.PRN || 'Candidate'}.png`
            );
        } catch (err) {
            console.error("Image download error:", err);
            alert("Error downloading entry slip image");
        } finally {
            setDownloadingPDF(false);
        }
    };

    // Download Live Hall Attendance Register as CSV File
    const handleDownloadHallRegisterCSV = () => {
        if (!rosterData.roster || rosterData.roster.length === 0) {
            alert("No candidate records available to export for this hall.");
            return;
        }

        const headers = ["Desk Number", "Student Name", "PRN", "Roll Number", "Branch", "Semester", "Scheduled Subject Code", "Scheduled Subject Name", "Attendance Status", "Verification Method", "Verification Time", "Invigilator Remarks"];
        const rows = rosterData.roster.map(item => [
            `"${item.seat?.seatNumber || ''}"`,
            `"${item.student?.name || ''}"`,
            `"${item.student?.PRN || ''}"`,
            `"${item.student?.rollNumber || ''}"`,
            `"${item.student?.branch?.branchCode || 'CSE'}"`,
            `"${item.student?.semester || 5}"`,
            `"${item.subject?.subjectCode || currentExam?.subject?.subjectCode || 'N/A'}"`,
            `"${item.subject?.subjectName || currentExam?.subject?.subjectName || 'N/A'}"`,
            `"${item.status || 'Pending'}"`,
            `"${item.verificationMethod || (item.verifiedAt ? 'QR_SCAN' : 'N/A')}"`,
            `"${item.verifiedAt ? new Date(item.verifiedAt).toLocaleString() : 'N/A'}"`,
            `"${(item.remarks || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `GCOEA_Hall_${currentHall?.hallNumber || 'LH'}_${currentExam?.subject?.subjectCode || 'Exam'}_Attendance_Register.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Active Exam and Hall Objects
    const currentExam = exams.find(e => e._id === activeExamId);
    const currentHall = halls.find(h => h._id === activeHallId);

    // Filter Hall Roster
    const filteredRoster = rosterData.roster?.filter(item => {
        if (!tableSearch) return true;
        const q = tableSearch.toLowerCase();
        return (
            item.student?.name?.toLowerCase().includes(q) ||
            item.student?.PRN?.toLowerCase().includes(q) ||
            item.seat?.seatNumber?.toLowerCase().includes(q) ||
            item.student?.branch?.branchCode?.toLowerCase().includes(q)
        );
    }) || [];

    // Helper to render dual examination match verification card
    const renderDualExamMatchCard = (result) => {
        if (!result) return null;
        const isMatched = result.isExamMatched !== false && result.valid;
        const candExamCode = result.candidateScheduledExam?.subjectCode || result.exam?.subjectCode || result.allocationDetails?.subjectCode || 'N/A';
        const candExamName = result.candidateScheduledExam?.subjectName || result.exam?.subjectName || result.allocationDetails?.subject || 'Scheduled Paper';
        const candSlot = result.candidateScheduledExam?.startTime || result.exam?.startTime || '10:30 AM';
        const candDesk = result.candidateScheduledExam?.seatNumber || result.seat?.seatNumber || result.allocationDetails?.seat || 'Assigned Desk';
        const candHall = result.candidateScheduledExam?.hallNumber || result.hall?.hallNumber || result.allocationDetails?.hall || 'Hall';

        const actExamCode = result.activeProctoredExam?.subjectCode || currentExam?.subject?.subjectCode || 'ACTIVE';
        const actExamName = result.activeProctoredExam?.subjectName || currentExam?.subject?.subjectName || 'Active Session';
        const actSlot = result.activeProctoredExam?.startTime || currentExam?.startTime || '10:30 AM';
        const actHall = currentHall?.hallNumber || 'Proctored Hall';

        return (
            <div className={`p-4 rounded-2xl border transition-all shadow-lg ${
                isMatched
                    ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-gradient-to-r from-red-950/60 via-slate-900 to-rose-950/60 border-red-500/50 text-red-200'
            }`}>
                {/* Header / Verdict */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                        <Scale className={`w-4 h-4 ${isMatched ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Dual Examination Match Verification
                        </span>
                    </div>
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isMatched
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                    }`}>
                        {isMatched ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-red-400" />}
                        <span>{isMatched ? 'Dual Exam Match Confirmed' : 'Subject Mismatch Detected'}</span>
                    </span>
                </div>

                {/* Side-by-side Dual Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {/* 1. Candidate Current Scheduled Exam */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>1. Candidate Scheduled Exam:</span>
                            <span className="font-mono text-[11px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                                {candExamCode}
                            </span>
                        </div>
                        <div className="text-xs font-extrabold text-white truncate" title={candExamName}>
                            {candExamName}
                        </div>
                        <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                            <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Slot: {candSlot}</span>
                            </span>
                            <span className="text-emerald-400 font-semibold">
                                {candHall} — Desk {candDesk}
                            </span>
                        </div>
                    </div>

                    {/* 2. Active Hall Examination */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>2. Active Hall Examination:</span>
                            <span className="font-mono text-[11px] font-black text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {actExamCode}
                            </span>
                        </div>
                        <div className="text-xs font-extrabold text-white truncate" title={actExamName}>
                            {actExamName}
                        </div>
                        <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                            <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Slot: {actSlot}</span>
                            </span>
                            <span className="text-blue-300 font-semibold">
                                Venue: {actHall}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Verdict Note */}
                <div className={`mt-3 pt-2.5 border-t text-xs font-semibold flex items-center space-x-2 ${
                    isMatched
                        ? 'border-emerald-500/20 text-emerald-300'
                        : 'border-red-500/20 text-red-300'
                }`}>
                    {isMatched ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>
                        {result.examMatchDetails?.verdict || 
                            (isMatched 
                                ? 'Both current scheduled exam and active exam match. Candidate is authorized for admission.' 
                                : `Mismatch: Candidate is scheduled for ${candExamCode}, but active exam is ${actExamCode}. Both must match!`)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <QrCode className="w-7 h-7 text-emerald-400" />
                        <span>Candidate QR Verification & Action Portal</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Scan admission QR codes or verify specific students in real-time, inspect registered identity photo, and log actionable attendance.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    {(isOfflineMode || !navigator.onLine) && (
                        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold animate-pulse">
                            <WifiOff className="w-4 h-4" />
                            <span>Jammer-Safe Mode (IndexedDB)</span>
                        </div>
                    )}
                    <button
                        onClick={loadHallRoster}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Refresh Hall Roster"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* In-Hall Jammer Notice Banner */}
            {(isOfflineMode || !navigator.onLine) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
                        </div>
                        <div>
                            <span className="font-bold text-amber-300 block">Classroom Jammer Active — 100% Offline Proctoring Engaged</span>
                            <span className="text-slate-300 text-[11px]">
                                Application files loaded from PWA Cache. Candidate records verified against device IndexedDB. Camera & QR decoding function without internet.
                            </span>
                        </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[11px] font-bold">
                        Zero Internet Required
                    </span>
                </div>
            )}

            {/* Examination & Proctored Hall Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>Active Examination Subject (Current Session)</span>
                        </span>
                    </label>
                    <select
                        value={activeExamId}
                        onChange={(e) => {
                            setActiveExamId(e.target.value);
                            setVerificationResult(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                        {exams.map(e => (
                            <option key={e._id} value={e._id}>
                                {e.subject?.subjectCode}: {e.subject?.subjectName} ({new Date(e.examDate).toLocaleDateString()} • {e.startTime})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Proctored Examination Hall</span>
                        </span>
                    </label>
                    <select
                        value={activeHallId}
                        onChange={(e) => {
                            setActiveHallId(e.target.value);
                            setVerificationResult(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                        {halls.map(h => (
                            <option key={h._id} value={h._id}>
                                {h.hallNumber} ({h.building} • Floor {h.floor} • {h.totalSeats} Desks)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* HIGH-VISIBILITY ACTIVE EXAMINATION & SUBJECT HERO BANNER */}
            {currentExam && (
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/40">
                                    {currentExam.subject?.subjectCode || 'PAPER'}
                                </span>
                                <h2 className="text-base sm:text-lg font-black text-white">
                                    {currentExam.subject?.subjectName}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Semester {currentExam.semester || 5}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
                                <span className="flex items-center space-x-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>Date: <strong className="text-white">{new Date(currentExam.examDate).toLocaleDateString()}</strong></span>
                                </span>
                                <span className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>Slot: <strong className="text-white">{currentExam.startTime} – {currentExam.endTime}</strong></span>
                                </span>
                                <span className="flex items-center space-x-1">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    <span>Hall: <strong className="text-emerald-400">{currentHall?.hallNumber || 'LH'}</strong> ({rosterData.totalAllocated} Allocated)</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-end">
                        <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Attendance Status</span>
                            <span className="text-sm font-extrabold text-emerald-300">
                                {rosterData.markedPresent} <span className="text-xs font-normal text-slate-400">/ {rosterData.totalAllocated} Present</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN SCANNER AND ACTIONABLE VERIFICATION GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* ================= LEFT COLUMN: MULTI-METHOD SCANNER ================= */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                    {/* Mode Selector Tabs */}
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Verification Method:
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-bold">
                            <button
                                onClick={() => handleModeChange('camera')}
                                className={`py-2 px-2 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                                    inputMode === 'camera' 
                                        ? 'bg-emerald-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Camera className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Camera</span>
                            </button>

                            <button
                                onClick={() => handleModeChange('upload')}
                                className={`py-2 px-2 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                                    inputMode === 'upload' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Upload className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Upload QR</span>
                            </button>

                            <button
                                onClick={() => handleModeChange('selector')}
                                className={`py-2 px-2 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                                    inputMode === 'selector' 
                                        ? 'bg-purple-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Select Student</span>
                            </button>

                            <button
                                onClick={() => handleModeChange('prn')}
                                className={`py-2 px-2 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                                    inputMode === 'prn' 
                                        ? 'bg-amber-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Search className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Enter PRN</span>
                            </button>
                        </div>
                    </div>

                    {/* MODE 1: LIVE CAMERA VIEW (Always mounted in DOM to prevent detachment) */}
                    <div className={`space-y-4 ${inputMode === 'camera' ? 'block' : 'hidden'}`}>
                        {/* Camera Device Selector if multiple cameras exist */}
                        {availableCameras.length > 1 && (
                            <div className="flex items-center space-x-2">
                                <label className="text-[11px] font-semibold text-slate-400 shrink-0">
                                    Camera Device:
                                </label>
                                <select
                                    value={selectedCameraId}
                                    onChange={(e) => {
                                        setSelectedCameraId(e.target.value);
                                        if (scannerActive) {
                                            startScanner(e.target.value);
                                        }
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                                >
                                    {availableCameras.map(cam => (
                                        <option key={cam.id} value={cam.id}>
                                            {cam.label || `Camera ${cam.id.substring(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Camera Viewfinder Box */}
                        <div className="relative overflow-hidden rounded-2xl bg-black border-2 border-slate-800 min-h-[320px] h-[320px] flex items-center justify-center">
                            <style>{`
                                #qr-camera-viewfinder video {
                                    width: 100% !important;
                                    height: 100% !important;
                                    object-fit: cover !important;
                                    border-radius: 0.75rem !important;
                                }
                                #qr-camera-viewfinder video:not(:first-of-type) {
                                    display: none !important;
                                }
                                #qr-camera-viewfinder canvas {
                                    display: none !important;
                                }
                                #qr-camera-viewfinder {
                                    border: none !important;
                                }
                                #qr-camera-viewfinder img, #qr-camera-viewfinder span {
                                    display: none !important;
                                }
                            `}</style>
                            <div 
                                id="qr-camera-viewfinder" 
                                style={{ width: '100%', height: '100%', minHeight: '320px' }}
                                className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl"
                            ></div>

                            {/* Active Scanning Crosshairs and Laser Reticle */}
                            {scannerActive && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                                    <div className="relative w-56 h-56 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_25px_rgba(52,211,153,0.35)] flex items-center justify-center">
                                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-pulse"></div>
                                    </div>
                                    <p className="text-[11px] font-bold text-emerald-300 mt-3 bg-black/75 px-3.5 py-1 rounded-full backdrop-blur-md border border-emerald-500/40 shadow-lg">
                                        Webcam Active • Hold QR Code in Green Frame
                                    </p>
                                </div>
                            )}

                            {/* Standby Overlay when Scanner is not running */}
                            {!scannerActive && (
                                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 text-slate-400 z-10">
                                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-emerald-400/70 shadow-inner">
                                        <Camera className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-200">Webcam Scanner Ready</p>
                                    {isInsecureOrigin ? (
                                        <div className="mt-2 space-y-2 max-w-sm">
                                            <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold inline-flex items-center space-x-1.5">
                                                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
                                                <span>Insecure IP Origin ({typeof window !== 'undefined' ? window.location.hostname : 'IP'})</span>
                                            </div>
                                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                                Browsers prohibit webcam hardware on HTTP IP addresses. Switch to localhost for 1-click instant camera access.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleSwitchToLocalhost}
                                                className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 inline-flex items-center space-x-1.5 transition-all cursor-pointer"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span>Switch to http://localhost:{typeof window !== 'undefined' ? (window.location.port || '5173') : '5173'}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                                            Click "Activate Webcam Scanner" below to scan students' printed or mobile QR codes.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={scannerActive ? stopScanner : () => startScanner()}
                            disabled={isRetryingCamera}
                            className={`w-full py-3.5 rounded-2xl font-bold text-xs shadow-lg flex items-center justify-center space-x-2 transition-all ${
                                scannerActive
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                                    : isRetryingCamera
                                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed shadow-none'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                            }`}
                        >
                            {scannerActive ? (
                                <CameraOff className="w-4 h-4" />
                            ) : isRetryingCamera ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : (
                                <Camera className="w-4 h-4" />
                            )}
                            <span>
                                {scannerActive 
                                    ? 'Stop Webcam Scanner' 
                                    : isRetryingCamera 
                                    ? 'Initializing Webcam...' 
                                    : 'Activate Webcam Scanner'}
                            </span>
                        </button>
                    </div>

                    {/* MODE 2: UPLOAD QR IMAGE FILE */}
                    {inputMode === 'upload' && (
                        <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Upload QR Code Image or Screenshot</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                    Upload any PNG or JPEG hall ticket QR code image for instantaneous 100% accurate decoding via jsQR.
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={verifying}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/20 inline-flex items-center space-x-2"
                            >
                                <Upload className="w-4 h-4" />
                                <span>{verifying ? 'Decoding QR...' : 'Choose QR Image File'}</span>
                            </button>

                            <div className="pt-3 border-t border-slate-800/80">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                    Or verify candidate directly:
                                </span>
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleQRScanned('23005081')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-blue-300 font-semibold border border-slate-700"
                                        title="Rahul Sharma - CSE - DBMS"
                                    >
                                        Rahul (23005081)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQRScanned('23006082')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-blue-300 font-semibold border border-slate-700"
                                        title="Priya Verma - IT - DBMS"
                                    >
                                        Priya (23006082)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQRScanned('23005083')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 font-semibold border border-slate-700"
                                        title="Amit Kumar - CSE - Java"
                                    >
                                        Amit (23005083)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQRScanned('23007084')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-purple-300 font-semibold border border-slate-700"
                                        title="Sneha Patil - ENTC - Digital Electronics"
                                    >
                                        Sneha (23007084)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQRScanned('24005085')}
                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-300 font-semibold border border-slate-700"
                                        title="Neha Deshmukh - CSE - Data Structures"
                                    >
                                        Neha (24005085)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODE 3: SELECT SPECIFIC STUDENT (1-CLICK ACTIONABLE) */}
                    {inputMode === 'selector' && (
                        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                            <div className="flex items-center space-x-2">
                                <Users className="w-4 h-4 text-purple-400" />
                                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                    Select Candidate in {currentHall?.hallNumber || 'This Hall'}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400">
                                Select any candidate assigned to this hall to inspect their registered photo and take immediate attendance action:
                            </p>

                            {/* Live Search Input */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={selectorSearchQuery}
                                    onChange={(e) => setSelectorSearchQuery(e.target.value)}
                                    placeholder="Filter by student name, PRN, desk #..."
                                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                                />
                                {selectorSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectorSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <select
                                value={selectedStudentPRN}
                                onChange={(e) => setSelectedStudentPRN(e.target.value)}
                                className="w-full px-3.5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                            >
                                <option value="">
                                    -- Choose Candidate ({
                                        (rosterData.roster || []).filter(item => {
                                            if (!selectorSearchQuery.trim()) return true;
                                            const q = selectorSearchQuery.toLowerCase();
                                            return (
                                                String(item.student?.name || '').toLowerCase().includes(q) ||
                                                String(item.student?.PRN || '').toLowerCase().includes(q) ||
                                                String(item.seat?.seatNumber || '').toLowerCase().includes(q)
                                            );
                                        }).length
                                    } matches) --
                                </option>
                                {(rosterData.roster || [])
                                    .filter(item => {
                                        if (!selectorSearchQuery.trim()) return true;
                                        const q = selectorSearchQuery.toLowerCase();
                                        return (
                                            String(item.student?.name || '').toLowerCase().includes(q) ||
                                            String(item.student?.PRN || '').toLowerCase().includes(q) ||
                                            String(item.seat?.seatNumber || '').toLowerCase().includes(q)
                                        );
                                    })
                                    .map((item, idx) => (
                                        <option key={idx} value={item.student?.PRN}>
                                            [Desk {item.seat?.seatNumber}] {item.student?.name} (PRN: {item.student?.PRN}) • {item.subject?.subjectCode || currentExam?.subject?.subjectCode || 'Paper'} • {item.status}
                                        </option>
                                    ))}
                            </select>

                            <button
                                onClick={handleVerifySelectedCandidate}
                                disabled={!selectedStudentPRN}
                                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center justify-center space-x-2 transition-all"
                            >
                                <FileCheck className="w-4 h-4" />
                                <span>Verify & Open Action Card</span>
                            </button>
                        </div>
                    )}

                    {/* MODE 4: MANUAL PRN SEARCH INPUT */}
                    {inputMode === 'prn' && (
                        <form onSubmit={handleManualVerify} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                            <div className="flex items-center space-x-2">
                                <Search className="w-4 h-4 text-amber-400" />
                                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                    Manual PRN / Roll Number Lookup
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400">
                                Enter student's Permanent Registration Number (PRN) or Roll Number:
                            </p>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={manualPRN}
                                    onChange={(e) => setManualPRN(e.target.value)}
                                    placeholder="e.g. 23005086 (Rohan) or 23005081"
                                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md"
                                >
                                    Verify
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Camera Permission & Scanner Assistance Card */}
                    {scanError && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3 shadow-lg">
                            <div className="flex items-start space-x-2.5">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                        <span className="font-bold text-amber-300 block text-sm">
                                            Webcam Access Assistance
                                        </span>
                                        {isInsecureOrigin ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                Insecure HTTP IP ({typeof window !== 'undefined' ? window.location.hostname : 'IP'})
                                            </span>
                                        ) : cameraPermissionStatus === 'denied' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                                Permission Blocked in Browser
                                            </span>
                                        ) : cameraPermissionStatus === 'granted' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                Permission Granted
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                                        {scanError}
                                    </p>
                                </div>
                            </div>

                            {/* INSECURE ORIGIN GUIDANCE & 1-CLICK LOCALHOST SWITCH */}
                            {isInsecureOrigin ? (
                                <div className="p-3.5 bg-slate-900/95 rounded-xl border border-amber-500/30 text-[11px] text-slate-300 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                                            <span>Root Cause: Browser Security Policy on HTTP IP</span>
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                            Instant Fix Available
                                        </span>
                                    </div>
                                    <p className="text-slate-300 leading-relaxed">
                                        Modern browsers (Brave, Chrome, Edge) restrict camera hardware (<code className="text-emerald-400 font-mono">getUserMedia</code>) exclusively to <strong>HTTPS</strong> or <strong>localhost</strong>. Because this page is opened via <code className="text-amber-300 font-mono">{typeof window !== 'undefined' ? window.location.host : 'LAN IP'}</code>, the browser blocks camera hardware access.
                                    </p>
                                    
                                    {/* 1-Click Redirect Button */}
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={handleSwitchToLocalhost}
                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>Switch to http://localhost:{typeof window !== 'undefined' ? (window.location.port || '5173') : '5173'} (Webcam Works Instantly)</span>
                                        </button>
                                        <span className="text-[10px] text-slate-400 block mt-1.5">
                                            Your active invigilator session and hall selection will automatically be preserved.
                                        </span>
                                    </div>

                                    {/* Remote LAN Tablet / Mobile Options */}
                                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                                        <span className="font-bold text-slate-300 block">Using a phone or remote laptop over college LAN?</span>
                                        <div className="flex items-start space-x-1.5">
                                            <span className="text-emerald-400 font-bold">•</span>
                                            <span>Use <strong>"Upload QR Image"</strong> or <strong>"Select Student Directly"</strong> below (0 camera permissions required).</span>
                                        </div>
                                        <div className="flex items-start space-x-1.5">
                                            <span className="text-emerald-400 font-bold">•</span>
                                            <span>Or in Brave / Chrome, open <code className="text-amber-300 font-mono bg-slate-800 px-1 py-0.5 rounded">brave://flags/#unsafely-treat-insecure-origin-as-secure</code>, add <code className="text-amber-300 font-mono bg-slate-800 px-1 py-0.5 rounded">http://{typeof window !== 'undefined' ? window.location.host : '192.168.56.1:5173'}</code>, and relaunch browser.</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Browser Permission Steps on Localhost / HTTPS */
                                <div className="p-3.5 bg-slate-900/95 rounded-xl border border-amber-500/20 text-[11px] text-slate-300 space-y-2">
                                    <div className="font-bold text-amber-300 flex items-center justify-between">
                                        <span>How to enable webcam in Brave / Chrome / Edge:</span>
                                        <span className="text-[10px] text-slate-400 font-normal">3 Quick Steps</span>
                                    </div>
                                    <div className="space-y-1.5 text-slate-400 text-[11px]">
                                        <div className="flex items-start space-x-2">
                                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                                            <span>Click the <strong>Tune / Site info</strong> or <strong>Lock</strong> icon at the far left of your address bar (left of <code className="text-emerald-400 font-mono bg-slate-800 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.host : 'localhost:5173'}</code>).</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                                            <span>Set <strong>Camera</strong> toggle to <strong className="text-emerald-400">"Allow" / "On"</strong>. (In Brave, also ensure Shields is not blocking permissions).</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                                            <span>Click <strong>"Reload Page to Apply"</strong> or <strong>"Retry Webcam"</strong> below.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {isInsecureOrigin && (
                                    <button
                                        type="button"
                                        onClick={handleSwitchToLocalhost}
                                        className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Switch to Localhost</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => startScanner()}
                                    disabled={isRetryingCamera}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingCamera ? 'animate-spin text-emerald-300' : ''}`} />
                                    <span>{isRetryingCamera ? 'Checking Camera...' : 'Retry Webcam'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
                                    title="Reloads the page to apply newly saved browser camera permissions"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reload Page to Apply</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('upload')}
                                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload QR Image</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('selector')}
                                    className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Select Student Directly</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 1-Click Presentation Simulators */}
                    <div className="pt-4 border-t border-slate-800">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Instant Candidate Simulators (1-Click):</span>
                            <span className="text-[10px] text-emerald-400 font-semibold">Active Roster & Subject Eligibility</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleQRScanned('23005086')}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-left truncate border border-slate-700 hover:border-emerald-500/50 flex items-center space-x-1.5"
                                title="Rohan Joshi - CSE - Scheduled for CS501 DBMS in LH-101 (Match)"
                            >
                                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="truncate">Rohan Joshi (CS501 • Matched)</span>
                            </button>
                            <button
                                onClick={() => handleQRScanned('23005081')}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-left truncate border border-slate-700 hover:border-emerald-500/50 flex items-center space-x-1.5"
                                title="Rahul Sharma - CSE - Scheduled for CS501 DBMS in LH-101 (Match)"
                            >
                                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="truncate">Rahul Sharma (CS501 • Matched)</span>
                            </button>
                            <button
                                onClick={() => handleQRScanned('23006082')}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-left truncate border border-slate-700 hover:border-emerald-500/50 flex items-center space-x-1.5"
                                title="Priya Verma - IT - Scheduled for CS501 DBMS in LH-101 (Match)"
                            >
                                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="truncate">Priya Verma (CS501 • Matched)</span>
                            </button>
                            <button
                                onClick={() => handleQRScanned('23005083')}
                                className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold text-left truncate border border-amber-500/30 flex items-center space-x-1.5"
                                title="Amit is enrolled in CS502 Java, not CS501 DBMS - demonstrates subject mismatch rejection"
                            >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">Amit Kumar (CS502 • Mismatch)</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ================= RIGHT COLUMN: ACTIONABLE CANDIDATE CARD ================= */}
                <ErrorBoundary onReset={() => setVerificationResult(null)}>
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[520px]">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>Candidate Verification Profile</span>
                            </h3>

                            {verificationResult?.valid && (
                                <button
                                    onClick={() => setVerificationResult(null)}
                                    className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>

                        {verifying ? (
                            <div className="text-center py-24 text-slate-400 text-xs">
                                <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-emerald-500" />
                                <span className="font-semibold text-slate-300">Verifying QR code & seating database...</span>
                            </div>
                        ) : !verificationResult ? (
                            <div className="text-center py-24 text-slate-500 text-xs space-y-3">
                                <QrCode className="w-16 h-16 mx-auto text-slate-700 opacity-60" />
                                <p className="font-medium text-slate-400">No student scanned yet.</p>
                                <p className="text-[11px] text-slate-600 max-w-xs mx-auto">
                                    Point the camera at an admission card QR code, upload a QR image, or choose a candidate to open their actionable profile.
                                </p>
                            </div>
                        ) : !verificationResult.valid ? (
                            /* Verification Error / Invalid Candidate Enforcement Card */
                            <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-4">
                                <div className="flex items-center space-x-3 text-red-400">
                                    <ShieldAlert className="w-8 h-8 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-red-200">
                                            {verificationResult.code === 'EXAM_MISMATCH' 
                                                ? 'Subject / Examination Mismatch' 
                                                : verificationResult.code === 'NO_ALLOCATION'
                                                ? 'Candidate Not Allocated for this Exam'
                                                : 'Invalid QR Code / Access Denied'}
                                        </h4>
                                        <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">
                                            {verificationResult.message}
                                        </p>
                                    </div>
                                </div>

                                {/* If student identity was recognized (e.g. Amit Kumar) */}
                                {verificationResult.student && (
                                    <div className="p-4 rounded-xl bg-slate-900/90 border border-red-500/30 flex items-center space-x-4">
                                        <div className="w-16 h-20 rounded-xl overflow-hidden border border-red-400/50 bg-slate-800 shrink-0">
                                            <img 
                                                src={verificationResult.student.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'} 
                                                alt="Identified Candidate"
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="font-bold text-white text-sm">
                                                {verificationResult.student.name}
                                            </div>
                                            <div className="font-mono text-red-300 font-semibold">
                                                PRN: {verificationResult.student.PRN}
                                            </div>
                                            <div className="text-slate-400">
                                                Branch: {verificationResult.student.branch?.branchCode || 'Engg'} • Sem {verificationResult.student.semester || 5}
                                            </div>
                                            {verificationResult.currentStatus && (
                                                <div className="pt-1">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                                        Status: {verificationResult.currentStatus}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* DUAL EXAMINATION MATCH VERIFICATION CARD FOR MISMATCH */}
                                {renderDualExamMatchCard(verificationResult)}

                                {/* ACTION BUTTONS FOR INVALID CANDIDATE */}
                                <div className="space-y-2 pt-2 border-t border-red-500/20">
                                    <div className="text-[11px] font-bold text-red-300 uppercase tracking-wider">
                                        Invigilator Enforcement Actions:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {verificationResult.student && (
                                            <button
                                                onClick={() => handleRecordAttendance('Invalid', `Barred Entry: ${verificationResult.message}`)}
                                                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/30 flex items-center justify-center space-x-1.5 transition-all"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                <span>Mark as Invalid</span>
                                            </button>
                                        )}
                                        {verificationResult.student && (
                                            <button
                                                onClick={() => setShowMalpracticeModal(true)}
                                                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-300 text-xs font-semibold border border-red-500/40 flex items-center justify-center space-x-1.5"
                                            >
                                                <ShieldAlert className="w-4 h-4 text-red-400" />
                                                <span>Flag Malpractice</span>
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setVerificationResult(null)}
                                        className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 mt-1"
                                    >
                                        Dismiss & Scan Next Student
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* SUCCESS: OFFICIAL ACTIONABLE CANDIDATE PROFILE */
                            <div className="space-y-4">
                                {/* Hall Warning Banner (if wrong hall) */}
                                {verificationResult.hallWarning && (
                                    <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center space-x-2.5">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                                        <span>{verificationResult.hallWarning}</span>
                                    </div>
                                )}

                                {/* Candidate Official Profile Card */}
                                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-center gap-5">
                                    {/* Large Official Photograph */}
                                    <div className="flex flex-col items-center shrink-0">
                                        <div className="w-28 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl bg-slate-900">
                                            <img
                                                src={verificationResult.student.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                                                alt="Official registered student"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span className="text-[10px] text-emerald-400 font-bold mt-1 uppercase tracking-wider">
                                            Registered Photo
                                        </span>
                                    </div>

                                    {/* Candidate Info Details */}
                                    <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                            <h4 className="text-lg font-bold text-white truncate">
                                                {verificationResult.student.name}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                verificationResult.currentStatus === 'Present'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : verificationResult.currentStatus === 'Invalid'
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    : verificationResult.currentStatus === 'Malpractice Flagged'
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    : verificationResult.currentStatus === 'Absent'
                                                    ? 'bg-slate-700 text-slate-300'
                                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            }`}>
                                                {verificationResult.currentStatus || 'Pending'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start space-x-2 text-xs font-mono text-blue-400 font-bold">
                                            <span>PRN: {verificationResult.student.PRN}</span>
                                            <button
                                                onClick={() => handleCopyPRN(verificationResult.student.PRN)}
                                                className="text-slate-400 hover:text-white"
                                                title="Copy PRN"
                                            >
                                                {copiedPRN ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>

                                        <p className="text-xs text-slate-300">
                                            Roll: {verificationResult.student.rollNumber} • {verificationResult.student.collegeId}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            Branch: <strong className="text-slate-200">{verificationResult.student.branch?.branchCode || 'CSE'}</strong> • Sem {verificationResult.student.semester}
                                        </p>

                                        {/* Highlighted Desk Assignment */}
                                        <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between">
                                            <span>Assigned Desk:</span>
                                            <span className="font-mono text-sm bg-emerald-500/20 px-2 py-0.5 rounded-lg text-white">
                                                {verificationResult.hall?.hallNumber} — Desk {verificationResult.seat?.seatNumber}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* DUAL EXAMINATION MATCH VERIFICATION CARD */}
                                {renderDualExamMatchCard(verificationResult)}

                                {/* SUBJECT-SPECIFIC ATTENDANCE CONFIRMATION CALLOUT */}
                                <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-md transition-all ${
                                    verificationResult.currentStatus === 'Present'
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-emerald-500/5'
                                        : verificationResult.currentStatus === 'Absent'
                                        ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                                        : verificationResult.currentStatus === 'Invalid'
                                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                                        : verificationResult.currentStatus === 'Malpractice Flagged'
                                        ? 'bg-red-500/20 border-red-500/40 text-red-200'
                                        : 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                                }`}>
                                    <div className="flex items-center space-x-2.5">
                                        {verificationResult.currentStatus === 'Present' ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                        ) : verificationResult.currentStatus === 'Absent' ? (
                                            <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
                                        ) : verificationResult.currentStatus === 'Malpractice Flagged' || verificationResult.currentStatus === 'Invalid' ? (
                                            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                                        )}
                                        <div>
                                            <div className="font-bold text-xs sm:text-sm text-white">
                                                {verificationResult.currentStatus === 'Present' ? (
                                                    <span>Marked Present for <span className="text-emerald-400 font-mono font-bold">{verificationResult.exam?.subjectCode || 'Paper'}</span></span>
                                                ) : verificationResult.currentStatus === 'Absent' ? (
                                                    <span>Marked Absent for <span className="text-slate-300 font-mono font-bold">{verificationResult.exam?.subjectCode || 'Paper'}</span></span>
                                                ) : (
                                                    <span>Awaiting Attendance for <span className="text-amber-400 font-mono font-bold">{verificationResult.exam?.subjectCode || 'Paper'}</span></span>
                                                )}
                                            </div>
                                            {verificationResult.existingAttendance?.verifiedAt ? (
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    Verified at {new Date(verificationResult.existingAttendance.verifiedAt).toLocaleTimeString()} by {verificationResult.existingAttendance.invigilatorName || 'Invigilator'}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    Click "Mark Present" below to admit candidate to this paper
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs tracking-wider uppercase ${
                                        verificationResult.currentStatus === 'Present'
                                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                            : verificationResult.currentStatus === 'Absent'
                                            ? 'bg-slate-700 text-slate-300'
                                            : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    }`}>
                                        {verificationResult.currentStatus || 'Pending'}
                                    </span>
                                </div>

                                {/* COMPLETE SUBJECT SCHEDULE & ATTENDANCE MATRIX FOR THIS USER */}
                                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 shadow-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                            <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                            <span>Subject Examination Schedule & Attendance Records:</span>
                                        </div>
                                        <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 font-medium">
                                            {verificationResult.allSubjectAttendances?.length || 1} Registered Papers
                                        </span>
                                    </div>

                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {(verificationResult.allSubjectAttendances || [
                                            {
                                                subjectCode: verificationResult.exam?.subjectCode || currentExam?.subject?.subjectCode || 'CS501',
                                                subjectName: verificationResult.exam?.subjectName || currentExam?.subject?.subjectName || 'Database Management Systems',
                                                examDate: verificationResult.exam?.examDate || currentExam?.examDate,
                                                hallNumber: verificationResult.hall?.hallNumber,
                                                seatNumber: verificationResult.seat?.seatNumber,
                                                status: verificationResult.currentStatus || 'Pending',
                                                isCurrentExam: true
                                            }
                                        ]).map((subItem, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-2.5 rounded-xl text-xs flex items-center justify-between border transition-all ${
                                                    subItem.isCurrentExam
                                                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-200'
                                                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-mono font-bold text-white text-[11px] bg-slate-800 px-1.5 py-0.5 rounded">
                                                            {subItem.subjectCode}
                                                        </span>
                                                        <span className="truncate font-semibold text-slate-200 text-[11px]">
                                                            {subItem.subjectName}
                                                        </span>
                                                        {subItem.isCurrentExam && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/30 text-blue-300 border border-blue-500/40 shrink-0">
                                                                Current Slot
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 flex-wrap">
                                                        <span className="flex items-center space-x-1">
                                                            <Calendar className="w-3 h-3 text-slate-400" />
                                                            <span>{new Date(subItem.examDate).toLocaleDateString()}</span>
                                                        </span>
                                                        <span>•</span>
                                                        <span>{subItem.hallNumber ? `${subItem.hallNumber} (Desk ${subItem.seatNumber})` : 'Assigned Desk'}</span>
                                                        {subItem.verifiedAt && (
                                                            <span className="text-emerald-400 font-medium">
                                                                • Verified {new Date(subItem.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                    subItem.status === 'Present'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : subItem.status === 'Absent'
                                                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                                        : subItem.status === 'Malpractice Flagged'
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                }`}>
                                                    {subItem.status === 'Present' ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                            <span>Present</span>
                                                        </>
                                                    ) : subItem.status === 'Absent' ? (
                                                        <>
                                                            <X className="w-3 h-3 text-slate-400" />
                                                            <span>Absent</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3 h-3 text-amber-400" />
                                                            <span>Pending</span>
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Registered Semester Subjects Badges */}
                                    {verificationResult.student?.registeredSubjects && verificationResult.student.registeredSubjects.length > 0 && (
                                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10px]">
                                            <span className="text-slate-400 font-semibold">Registered Curriculum:</span>
                                            {verificationResult.student.registeredSubjects.map((sub, sIdx) => (
                                                <span key={sIdx} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                                                    {sub.subjectCode || sub.subjectName}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Visual Verification Prompt */}
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center space-x-2">
                                    <Sparkles className="w-4 h-4 flex-shrink-0 text-blue-400" />
                                    <span>
                                        <strong>Face Match Checklist:</strong> Compare student's face with official photo above and confirm candidate is presenting for <strong className="text-white underline">{verificationResult.exam?.subjectName || currentExam?.subject?.subjectName}</strong>.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ACTIONABLE BUTTONS PANEL */}
                    {verificationResult && verificationResult.valid && (
                        <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Actions for {verificationResult.student.name}:
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <button
                                    onClick={() => handleRecordAttendance('Present')}
                                    className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-1.5 transition-all active:scale-95"
                                >
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Mark Present</span>
                                </button>

                                <button
                                    onClick={() => handleRecordAttendance('Absent')}
                                    className="py-3 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-1.5 transition-all"
                                >
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    <span>Mark Absent</span>
                                </button>

                                <button
                                    onClick={() => handleRecordAttendance('Invalid', 'Candidate marked as Invalid by Invigilator')}
                                    className="py-3 px-2 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center justify-center space-x-1.5 transition-all"
                                >
                                    <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Mark Invalid</span>
                                </button>

                                <button
                                    onClick={() => setShowMalpracticeModal(true)}
                                    className="py-3 px-2 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-bold border border-red-500/40 flex items-center justify-center space-x-1.5 transition-all"
                                >
                                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                                    <span>Flag Case</span>
                                </button>
                            </div>

                            <div className="flex items-center space-x-2 pt-1">
                                <button
                                    onClick={() => setShowPrintModal(true)}
                                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-1.5"
                                >
                                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Print Entry Pass</span>
                                </button>

                                <button
                                    onClick={() => setVerificationResult(null)}
                                    className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1"
                                >
                                    <span>Scan Next</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </ErrorBoundary>
            </div>

            {/* ================= LIVE HALL ATTENDANCE ROSTER & QUICK ACTION REGISTER ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center space-x-2">
                            <Building2 className="w-5 h-5 text-emerald-400" />
                            <span>Proctored Seating Register: {currentHall?.hallNumber || 'Hall'} ({rosterData.totalAllocated} Allocated)</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Real-time seat-by-seat hall register. Click "Verify & Act" on any candidate to inspect their official profile.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            {rosterData.markedPresent} Present
                        </span>
                        <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                            {rosterData.pending || (rosterData.totalAllocated - rosterData.markedPresent)} Pending
                        </span>
                        {rosterData.flagged > 0 && (
                            <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                                {rosterData.flagged} Flagged
                            </span>
                        )}
                        {rosterData.markedInvalid > 0 && (
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                {rosterData.markedInvalid} Invalid
                            </span>
                        )}
                        <button
                            onClick={handleDownloadHallRegisterCSV}
                            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all font-bold ml-1"
                            title="Export live hall attendance register file"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Register (CSV)</span>
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex items-center space-x-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="Filter hall register by Student Name, PRN, Branch, or Desk..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    {tableSearch && (
                        <button
                            onClick={() => setTableSearch('')}
                            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Candidates Roster Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                            <tr>
                                <th className="px-5 py-3">Desk Number</th>
                                <th className="px-5 py-3">Student Name</th>
                                <th className="px-5 py-3">PRN</th>
                                <th className="px-5 py-3">Branch</th>
                                <th className="px-5 py-3">Scheduled Subject</th>
                                <th className="px-5 py-3">Attendance Status</th>
                                <th className="px-5 py-3">Verification Info</th>
                                <th className="px-5 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {filteredRoster.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-5 py-8 text-center text-slate-500">
                                        No candidates found matching filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredRoster.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-5 py-3 font-mono font-bold text-emerald-400">
                                            {item.seat?.seatNumber}
                                        </td>
                                        <td className="px-5 py-3 font-bold text-white flex items-center space-x-2.5">
                                            {item.student?.photo && (
                                                <img
                                                    src={item.student.photo}
                                                    alt="avatar"
                                                    className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                                                />
                                            )}
                                            <span>{item.student?.name}</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-blue-400 font-semibold">
                                            {item.student?.PRN}
                                        </td>
                                        <td className="px-5 py-3">
                                            {item.student?.branch?.branchCode || 'CSE'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-mono font-bold text-xs text-blue-400">
                                                {item.subject?.subjectCode || currentExam?.subject?.subjectCode || 'CS501'}
                                            </div>
                                            <div className="text-[11px] text-slate-300 font-medium truncate max-w-[150px]">
                                                {item.subject?.subjectName || currentExam?.subject?.subjectName || 'Database Management Systems'}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                item.status === 'Present'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : item.status === 'Invalid'
                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                    : item.status === 'Malpractice Flagged'
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    : item.status === 'Absent'
                                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-[11px] text-slate-400">
                                            {item.verifiedAt ? (
                                                <span>{new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • QR</span>
                                            ) : (
                                                <span className="text-slate-500">Pending scan</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    handleQRScanned(item.student?.PRN);
                                                    window.scrollTo({ top: 180, behavior: 'smooth' });
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold text-xs border border-blue-500/30 transition-all"
                                            >
                                                Verify & Act
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================= MODAL: FLAG MALPRACTICE ================= */}
            {showMalpracticeModal && verificationResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
                        <button
                            onClick={() => setShowMalpracticeModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center space-x-2 text-red-400">
                            <ShieldAlert className="w-6 h-6" />
                            <h3 className="text-base font-bold text-white">Record Malpractice Incident</h3>
                        </div>

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                            Candidate: <strong>{verificationResult.student.name}</strong> (PRN: {verificationResult.student.PRN}) • Desk {verificationResult.seat.seatNumber}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                                    Incident Category
                                </label>
                                <select
                                    value={malpracticeReason}
                                    onChange={(e) => setMalpracticeReason(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-red-500"
                                >
                                    <option value="Mobile phone / Smart device detected">Mobile phone / Smart device detected</option>
                                    <option value="Unauthorized handwritten chits / paper">Unauthorized handwritten chits / paper</option>
                                    <option value="Impersonation / Student face mismatch with registered ID">Impersonation / Face mismatch with ID</option>
                                    <option value="Copying / Communication with other candidates">Copying / Communication with peers</option>
                                    <option value="Misbehavior with examination proctor">Misbehavior with proctor</option>
                                    <option value="Other / Custom infraction">Other / Custom infraction</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                                    Invigilator Remarks & Evidence Details
                                </label>
                                <textarea
                                    value={malpracticeRemarks}
                                    onChange={(e) => setMalpracticeRemarks(e.target.value)}
                                    rows="3"
                                    placeholder="Enter physical observations, confiscated material serials, or witness details..."
                                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-red-500"
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                            <button
                                onClick={() => setShowMalpracticeModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmMalpractice}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30"
                            >
                                Confirm Malpractice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL: PRINT CANDIDATE DESK SLIP / ENTRY PASS ================= */}
            {showPrintModal && verificationResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative space-y-4">
                        <button
                            onClick={() => setShowPrintModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center space-x-2 text-white">
                            <Printer className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-base font-bold">Candidate Examination Entry Slip</h3>
                        </div>

                        {/* Printable Ticket Slip Content */}
                        <div id="printable-entry-slip" className="p-6 bg-white text-slate-900 rounded-2xl border-2 border-slate-300 space-y-4 shadow-inner">
                            <div className="text-center border-b border-slate-300 pb-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                                    Government College of Engineering, Amravati
                                </span>
                                <h4 className="text-base font-black text-slate-900 mt-0.5">
                                    Official Examination Desk Entry Slip
                                </h4>
                                <span className="text-xs text-slate-600 font-semibold">
                                    {verificationResult.exam?.subjectName} ({verificationResult.exam?.subjectCode})
                                </span>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="w-20 h-24 rounded-lg overflow-hidden border border-slate-400 bg-slate-100 shrink-0">
                                    <img
                                        src={verificationResult.student.photo}
                                        alt="Student"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="text-sm font-bold text-slate-900">{verificationResult.student.name}</div>
                                    <div className="font-mono font-bold text-blue-700">PRN: {verificationResult.student.PRN}</div>
                                    <div>Roll No: {verificationResult.student.rollNumber}</div>
                                    <div>Branch: {verificationResult.student.branch?.branchCode || 'CSE'} • Sem {verificationResult.student.semester}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 rounded-xl text-xs font-semibold border border-slate-200">
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Allocated Hall</span>
                                    <span className="font-bold text-slate-900">{verificationResult.hall?.hallNumber}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Assigned Desk</span>
                                    <span className="font-bold text-emerald-700 text-sm">{verificationResult.seat?.seatNumber}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Date & Time</span>
                                    <span>{new Date(verificationResult.exam?.examDate).toLocaleDateString()} • {verificationResult.exam?.startTime}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Verification Status</span>
                                    <span className="font-bold text-emerald-600">Verified & Admitted</span>
                                </div>
                            </div>

                            <div className="pt-2 text-[10px] text-slate-500 flex justify-between items-center border-t border-slate-200">
                                <span>Verified by Invigilator: {user?.name || 'Exam Officer'}</span>
                                <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold text-center"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleDownloadEntrySlipPDF}
                                disabled={downloadingPDF}
                                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center space-x-1.5 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                <span>{downloadingPDF ? 'Generating...' : 'Download PDF'}</span>
                            </button>
                            <button
                                onClick={handleDownloadEntrySlipImage}
                                disabled={downloadingPDF}
                                className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center justify-center space-x-1.5 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download PNG</span>
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center space-x-1.5 transition-all"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print Slip</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvigilatorScannerPage;
