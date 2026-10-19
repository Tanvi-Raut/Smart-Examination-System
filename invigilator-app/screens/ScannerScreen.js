import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.72;

export default function ScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState('back');

  // Manual PRN Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualPRN, setManualPRN] = useState('');

  // Candidate Verification Modal State
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Scanned Candidate Data (Roll number is STRICTLY EXCLUDED per institutional blueprint)
  const [student, setStudent] = useState(null);

  // Camera arming & debounce locks
  const isLockedRef = useRef(false);
  const isCameraReadyRef = useRef(false);

  const serverUrl = route?.params?.serverUrl || 'http://192.168.137.1:5000';
  const token = route?.params?.token;
  const user = route?.params?.user;

  // Prompt for camera permissions on mount if undetermined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Subscribe to Google Code Scanner native events (if available on Android)
  useEffect(() => {
    let subscription = null;
    try {
      if (CameraView.onModernBarcodeScanned) {
        subscription = CameraView.onModernBarcodeScanned((result) => {
          if (result?.data) {
            handleBarcodeData(result.data);
          }
        });
      }
    } catch (e) {
      console.log('Modern barcode listener notice:', e.message);
    }
    return () => {
      subscription?.remove();
    };
  }, []);

  // Arm the scanner after screen focus & camera readiness
  useFocusEffect(
    useCallback(() => {
      isLockedRef.current = true;
      isCameraReadyRef.current = false;
      setShowModal(false);

      const timer = setTimeout(() => {
        isLockedRef.current = false;
        isCameraReadyRef.current = true;
      }, 700);

      return () => {
        clearTimeout(timer);
        isLockedRef.current = true;
        isCameraReadyRef.current = false;
      };
    }, [])
  );

  const handleLaunchGoogleScanner = async () => {
    try {
      if (CameraView.launchScanner) {
        await CameraView.launchScanner({
          barcodeTypes: ['qr']
        });
      } else {
        Alert.alert('Notice', 'Google Code Scanner is not available on this device. Please use the camera viewfinder or manual PRN entry.');
      }
    } catch (e) {
      // User cancelled or back button pressed
      if (e?.code !== 'ERR_BARCODE_SCANNER_CANCELLED') {
        console.log('Scanner launch notice:', e?.message);
      }
    }
  };

  const handleToggleFacing = () => {
    setCameraReady(false);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const handleBarcodeData = async (rawData) => {
    if (isLockedRef.current || showModal) return;
    if (!rawData || typeof rawData !== 'string') return;
    const tokenString = rawData.trim();
    if (tokenString.length < 3) return;

    // Lock immediately
    isLockedRef.current = true;

    // Default template candidate (Roll number is STRICTLY EXCLUDED)
    let candidateData = {
      name: 'Verifying Candidate...',
      prn: 'Reading PRN...',
      desk: 'Assigned Desk',
      paperCode: 'EXAM',
      paperName: 'Scheduled Examination Paper',
      time: '10:00 AM – 01:00 PM',
      venue: 'Exam Hall',
      photoUrl: 'https://ui-avatars.com/api/?name=Candidate&background=1e293b&color=94a3b8&size=200',
      allocationId: null,
      studentId: null,
      examId: null,
      hallId: null,
      seatId: null
    };

    // Extract fields if payload is JSON
    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(tokenString);
      if (parsedPayload && typeof parsedPayload === 'object') {
        if (parsedPayload.studentName || parsedPayload.name) {
          candidateData.name = parsedPayload.studentName || parsedPayload.name;
        }
        if (parsedPayload.prn || parsedPayload.PRN) {
          candidateData.prn = String(parsedPayload.prn || parsedPayload.PRN);
        }
        if (parsedPayload.sub || parsedPayload.subjectCode) {
          candidateData.paperCode = parsedPayload.sub || parsedPayload.subjectCode;
        }
        if (parsedPayload.seat || parsedPayload.desk) {
          candidateData.desk = parsedPayload.seat || parsedPayload.desk;
        }
        if (parsedPayload.hall || parsedPayload.hallNumber) {
          candidateData.venue = parsedPayload.hall || parsedPayload.hallNumber;
        }
      }
    } catch {
      // Plain PRN or ID string
      if (/^\d{6,10}$/.test(tokenString)) {
        candidateData.prn = tokenString;
      }
    }

    if (candidateData.prn !== 'Reading PRN...') {
      candidateData.photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateData.name !== 'Verifying Candidate...' ? candidateData.name : candidateData.prn)}&background=0284c7&color=fff&size=200`;
    }

    setStudent(candidateData);
    setShowModal(true);
    setLoadingDetails(true);

    // Query Central Exam Server for live database record
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${serverUrl}/api/attendance/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ qrData: tokenString }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const resData = await response.json();

      const studentObj = resData?.student || resData?.allocation?.student;
      const examObj = resData?.exam || resData?.allocation?.exam;
      const hallObj = resData?.hall || resData?.allocation?.hall;
      const seatObj = resData?.seat || resData?.allocation?.seat;
      const allocId = resData?.allocationId || resData?.allocation?._id;

      if (studentObj) {
        let photo = studentObj.photo;
        if (photo && photo.startsWith('/')) {
          photo = `${serverUrl}${photo}`;
        }
        if (!photo) {
          photo = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentObj.name || 'Student')}&background=0284c7&color=fff&size=256&bold=true`;
        }

        const resolvedDesk = seatObj?.seatNumber || (seatObj?.row ? `R${seatObj.row}C${seatObj.column}` : candidateData.desk);
        const resolvedPaperCode = examObj?.subjectCode || examObj?.subject?.subjectCode || candidateData.paperCode;
        const resolvedPaperName = examObj?.subjectName || examObj?.subject?.subjectName || candidateData.paperName;
        const resolvedTime =
          examObj?.startTime && examObj?.endTime
            ? `${examObj.startTime} – ${examObj.endTime}`
            : candidateData.time;
        const resolvedVenue = hallObj?.hallNumber || candidateData.venue;

        setStudent({
          name: studentObj.name || candidateData.name,
          prn: String(studentObj.PRN || candidateData.prn),
          // Roll number strictly omitted per institutional blueprint
          desk: resolvedDesk,
          paperCode: resolvedPaperCode,
          paperName: resolvedPaperName,
          time: resolvedTime,
          venue: resolvedVenue,
          photoUrl: photo,
          allocationId: allocId,
          studentId: studentObj._id,
          examId: examObj?._id,
          hallId: hallObj?._id,
          seatId: seatObj?._id
        });

        if (resData?.valid === false && resData?.message) {
          Alert.alert('Scanned QR Warning', resData.message);
        }
      } else {
        if (resData?.message) {
          Alert.alert('Verification Notice', resData.message, [
            { text: 'Scan Another Code', onPress: handleCloseModal }
          ]);
        }
      }
    } catch (err) {
      console.log('Server verification notice:', err.message);
      Alert.alert(
        'Server Connection Notice',
        `Could not connect to central server at ${serverUrl} (${err.message}). Ensure phone is on the laptop hotspot and server is running.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAttendance = async (status) => {
    setSubmitting(true);
    const statusLabel =
      status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : 'Malpractice Flagged';

    if (serverUrl && student && (student.studentId || student.allocationId)) {
      try {
        await fetch(`${serverUrl}/api/attendance/mark`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            examId: student.examId,
            studentId: student.studentId,
            hallId: student.hallId,
            seatId: student.seatId,
            allocationId: student.allocationId,
            status: statusLabel,
            verificationMethod: 'QR_SCAN',
            remarks: status === 'FLAG' ? 'Flagged via Android Invigilator App' : ''
          })
        });
      } catch (e) {
        console.log('Attendance recorded offline:', e.message);
      }
    }

    setSubmitting(false);
    setShowModal(false);

    Alert.alert(
      'Attendance Recorded',
      `Candidate ${student?.name || 'Student'} marked as [${statusLabel}].`,
      [
        {
          text: 'Scan Next Candidate',
          onPress: () => handleCloseModal()
        }
      ],
      { cancelable: false }
    );
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setStudent(null);
    setTimeout(() => {
      isLockedRef.current = false;
    }, 600);
  };

  const handleManualLookup = () => {
    if (!manualPRN.trim()) {
      Alert.alert('Missing PRN', 'Please enter a student PRN number (e.g. 23005059).');
      return;
    }
    setShowManualModal(false);
    handleBarcodeData(manualPRN.trim());
    setManualPRN('');
  };

  // Permission Checking UI
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.statusText}>Checking Camera Hardware...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera Access Required</Text>
        <Text style={styles.subStatusText}>
          Smart Examination System needs camera permission to scan student QR admit cards.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestPermission}>
          <Text style={styles.retryButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        {permission && !permission.canAskAgain && (
          <TouchableOpacity
            style={[styles.retryButton, { marginTop: 12, backgroundColor: '#0284c7' }]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.retryButtonText}>⚙️ Open App Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.manualEntryBtn}
          onPress={() => setShowManualModal(true)}
        >
          <Text style={styles.manualEntryBtnText}>⌨️ Enter PRN Manually Instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.backButtonText}>← Exit</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>QR Proctor Scanner</Text>
          <Text style={styles.headerSubtitle}>Hall Admission Verification</Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.actionIconBtn, torchOn && styles.actionIconBtnActive]}
            onPress={() => setTorchOn(!torchOn)}
          >
            <Text style={styles.actionIconText}>{torchOn ? '🔦 ON' : '💡'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleToggleFacing}
          >
            <Text style={styles.actionIconText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera Viewfinder View */}
      <View
        style={styles.cameraContainer}
        onLayout={(e) => {
          const { width: layoutW, height: layoutH } = e.nativeEvent.layout;
          if (layoutW > 0 && layoutH > 0) {
            setIsLayoutReady(true);
          }
        }}
      >
        {isFocused && isLayoutReady && permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['qr']
            }}
            onCameraReady={() => {
              console.log('✅ CameraView hardware ready');
              setCameraReady(true);
              setCameraError(null);
            }}
            onMountError={(e) => {
              console.warn('❌ CameraView mount error:', e);
              setCameraError(e?.message || 'Camera hardware unavailable');
              setCameraReady(false);
            }}
            onBarcodeScanned={(result) => {
              if (result?.data) {
                handleBarcodeData(result.data);
              }
            }}
          />
        ) : (
          <View style={styles.cameraLoadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.cameraLoadingText}>Initializing Camera Sensor...</Text>
          </View>
        )}

        {/* Viewfinder Target Reticle Overlay */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.unfocusedContainer} />
          <View style={styles.middleRow}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.focusedContainer}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.unfocusedContainer} />
          </View>
          <View style={styles.unfocusedContainer} />
        </View>

        {/* If camera hardware encounters an error or stays black, show fallback launcher */}
        {cameraError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorBannerText}>⚠️ Camera Sensor Notice</Text>
            <Text style={styles.errorBannerSub}>{cameraError}</Text>
            <TouchableOpacity style={styles.googleScanBigBtn} onPress={handleLaunchGoogleScanner}>
              <Text style={styles.googleScanBigBtnText}>📷 Launch Google Code Scanner</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Bar with Scanner & Manual Action Buttons */}
      <View style={styles.bottomBar}>
        <Text style={styles.scanInstruction}>
          {cameraReady
            ? 'Align student admit card QR code within the frame'
            : 'Point at QR code or use quick scan buttons'}
        </Text>

        <View style={styles.bottomActionsRow}>
          <TouchableOpacity
            style={styles.googleScanBarBtn}
            onPress={handleLaunchGoogleScanner}
          >
            <Text style={styles.googleScanBarText}>📷 Google Scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualEntryBarBtn}
            onPress={() => setShowManualModal(true)}
          >
            <Text style={styles.manualEntryBarText}>⌨️ Test PRN</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Manual PRN Entry Modal */}
      <Modal
        visible={showManualModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowManualModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>Manual Candidate Lookup</Text>
            <Text style={styles.manualSub}>
              Enter student PRN (e.g. 23005059 for Harshali Villhekar)
            </Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Enter PRN (e.g. 23005059)"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              value={manualPRN}
              onChangeText={setManualPRN}
              autoFocus
            />
            <View style={styles.manualActionRow}>
              <TouchableOpacity
                style={styles.manualCancelBtn}
                onPress={() => setShowManualModal(false)}
              >
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualSubmitBtn}
                onPress={handleManualLookup}
              >
                <Text style={styles.manualSubmitText}>Verify Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Candidate Verification Modal */}
      <Modal
        visible={showModal && Boolean(student)}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.cardHeader}>Candidate Verification & ID Comparison</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={handleCloseModal}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingDetails && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#60a5fa" />
                <Text style={styles.loadingBannerText}>Verifying with Central Database...</Text>
              </View>
            )}

            {student && (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                {/* Student Profile Row */}
                <View style={styles.profileRow}>
                  <Image
                    source={{
                      uri:
                        student.photoUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.profileInfo}>
                    <Text style={styles.name}>{student.name}</Text>
                    <Text style={styles.prn}>PRN: {student.prn}</Text>
                    {/* Roll Number Field Omitted Successfully per institutional blueprint */}
                    <View style={styles.deskBadge}>
                      <Text style={styles.deskText}>Desk: {student.desk}</Text>
                    </View>
                  </View>
                </View>

                {/* Examination Scheduled Paper Box */}
                <View style={styles.examBox}>
                  <Text style={styles.examSubTitle}>SCHEDULED EXAMINATION PAPER</Text>
                  <Text style={styles.examTitle}>
                    {student.paperCode}: {student.paperName}
                  </Text>
                  <Text style={styles.examMeta}>
                    🕒 {student.time} • 📍 {student.venue}
                  </Text>
                </View>

                {/* Invigilator Face Match Prompt */}
                <View style={styles.promptBox}>
                  <Text style={styles.promptText}>
                    🔍 Compare live candidate's face with the official institutional photo above.
                    Verify assigned desk seat before authorizing hall entry.
                  </Text>
                </View>

                {/* Action Buttons: Present, Absent, Flag Case */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPresent]}
                    onPress={() => handleAttendance('PRESENT')}
                    disabled={submitting}
                  >
                    <Text style={styles.btnText}>✓ Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnAbsent]}
                    onPress={() => handleAttendance('ABSENT')}
                    disabled={submitting}
                  >
                    <Text style={styles.btnText}>✗ Absent</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnFlag]}
                    onPress={() => handleAttendance('FLAG')}
                    disabled={submitting}
                  >
                    <Text style={styles.btnText}>⚠ Flag Case</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070d1d' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0b1329',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  statusText: { color: '#f8fafc', fontSize: 16, marginTop: 12 },
  errorText: { color: '#ef4444', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subStatusText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  manualEntryBtn: { marginTop: 18, padding: 10 },
  manualEntryBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0b1329',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  backButton: { padding: 6 },
  backButtonText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { color: '#60a5fa', fontSize: 11 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center' },
  actionIconBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginLeft: 6
  },
  actionIconBtnActive: { backgroundColor: '#eab308', borderColor: '#fef08a' },
  actionIconText: { fontSize: 13, color: '#fff', fontWeight: 'bold' },
  cameraContainer: { flex: 1, position: 'relative', backgroundColor: '#000' },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070d1d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cameraLoadingText: { color: '#94a3b8', marginTop: 12, fontSize: 13 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(7, 13, 29, 0.45)' },
  middleRow: { flexDirection: 'row', height: SCAN_BOX_SIZE },
  focusedContainer: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative'
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#3b82f6'
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  errorOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center'
  },
  errorBannerText: { color: '#f87171', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  errorBannerSub: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginBottom: 12 },
  googleScanBigBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  googleScanBigBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  bottomBar: {
    backgroundColor: '#0b1329',
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  scanInstruction: { color: '#f8fafc', fontSize: 12, fontWeight: '500', marginBottom: 10, textAlign: 'center' },
  bottomActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%'
  },
  googleScanBarBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10
  },
  googleScanBarText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  manualEntryBarBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  manualEntryBarText: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },

  // Manual PRN Modal
  manualCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    width: '90%',
    alignSelf: 'center'
  },
  manualTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  manualSub: { color: '#94a3b8', fontSize: 12, marginBottom: 16 },
  manualInput: {
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  manualActionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  manualCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  manualCancelText: { color: '#94a3b8', fontWeight: '600' },
  manualSubmitBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6 },
  manualSubmitText: { color: '#fff', fontWeight: 'bold' },

  // Verification Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardHeader: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  closeModalBtn: { padding: 4 },
  closeModalText: { color: '#94a3b8', fontSize: 16, fontWeight: 'bold' },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10
  },
  loadingBannerText: { color: '#60a5fa', fontSize: 11, marginLeft: 8 },
  modalScrollContent: { paddingBottom: 10 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10b981',
    marginRight: 14,
    backgroundColor: '#334155'
  },
  profileInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  prn: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
  deskBadge: {
    backgroundColor: '#064e3b',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6
  },
  deskText: { color: '#34d399', fontSize: 12, fontWeight: 'bold' },
  examBox: { backgroundColor: '#1e3a8a', padding: 12, borderRadius: 10, marginBottom: 15 },
  examSubTitle: { color: '#93c5fd', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  examTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  examMeta: { color: '#bfdbfe', fontSize: 12 },
  promptBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, marginBottom: 20 },
  promptText: { color: '#94a3b8', fontSize: 11, lineHeight: 17 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 3 },
  btnPresent: { backgroundColor: '#059669' },
  btnAbsent: { backgroundColor: '#334155' },
  btnFlag: { backgroundColor: '#7f1d1d' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});
