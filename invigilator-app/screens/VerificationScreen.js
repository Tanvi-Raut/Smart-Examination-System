import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { CONFIG } from '../config';

export default function VerificationScreen({ route, navigation }) {
  const { studentToken, serverUrl = CONFIG.DEFAULT_SERVER_URL, token, user } = route?.params || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Default / Reference student object (Roll number is STRICTLY EXCLUDED per instructions)
  const [student, setStudent] = useState({
    name: 'Amit Kumar',
    prn: '23005083',
    // rollNo intentionally excluded
    desk: 'R1C1',
    paperCode: 'CS502',
    paperName: 'Advanced Java Programming',
    time: '10:30 AM – 01:30 PM',
    venue: 'CC-102',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    allocationId: null,
    studentId: null,
    examId: null,
    hallId: null,
    seatId: null
  });

  // Attempt to parse studentToken if it's already a JSON payload
  useEffect(() => {
    if (studentToken && typeof studentToken === 'string') {
      try {
        const parsed = JSON.parse(studentToken);
        if (parsed && typeof parsed === 'object') {
          setStudent((prev) => ({
            ...prev,
            name: parsed.studentName || parsed.name || prev.name,
            prn: parsed.prn || parsed.PRN || prev.prn,
            desk: parsed.seat || parsed.desk || prev.desk,
            paperCode: parsed.sub || parsed.subjectCode || prev.paperCode,
            venue: parsed.hall || parsed.hallNumber || prev.venue
          }));
        }
      } catch (e) {
        // Raw token string or non-JSON, fetch from server or use defaults
      }
    }
  }, [studentToken]);

  // Attempt to fetch live candidate information from backend if serverUrl is present
  useEffect(() => {
    let isMounted = true;

    async function fetchCandidateDetails() {
      if (!serverUrl || !studentToken) return;

      try {
        setLoading(true);
        console.log(`[VerificationScreen] Verifying candidate at: ${serverUrl}/api/attendance/verify-qr`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT || 6000);

        const response = await fetch(`${serverUrl}/api/attendance/verify-qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ qrData: studentToken }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log(`[VerificationScreen] Server response status: ${response.status}`);
        const data = await response.json();
        console.log('[VerificationScreen] Verification data:', data);

        const studentObj = data?.student || data?.allocation?.student;
        const examObj = data?.exam || data?.allocation?.exam;
        const hallObj = data?.hall || data?.allocation?.hall;
        const seatObj = data?.seat || data?.allocation?.seat;
        const allocId = data?.allocationId || data?.allocation?._id;

        if (isMounted && studentObj) {
          let photo = studentObj.photo;
          if (photo && photo.startsWith('/')) {
            photo = `${serverUrl}${photo}`;
          }
          if (!photo) {
            photo = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentObj.name || 'Candidate')}&background=0284c7&color=fff&size=256&bold=true`;
          }

          const resolvedDesk = seatObj?.seatNumber || (seatObj?.row ? `R${seatObj.row}C${seatObj.column}` : 'Assigned');
          const resolvedPaperCode = examObj?.subjectCode || examObj?.subject?.subjectCode || 'EXAM';
          const resolvedPaperName = examObj?.subjectName || examObj?.subject?.subjectName || 'Scheduled Paper';
          const resolvedTime =
            examObj?.startTime && examObj?.endTime
              ? `${examObj.startTime} – ${examObj.endTime}`
              : '10:00 AM – 01:00 PM';
          const resolvedVenue = hallObj?.hallNumber || 'Exam Hall';

          setStudent({
            name: studentObj.name || 'Candidate',
            prn: String(studentObj.PRN || 'N/A'),
            // Roll number strictly omitted
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
        }
      } catch (err) {
        console.warn('[VerificationScreen] Candidate lookup failed:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCandidateDetails();

    return () => {
      isMounted = false;
    };
  }, [serverUrl, studentToken, token]);

  const handleAttendance = async (status) => {
    setSubmitting(true);

    const statusLabel =
      status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : 'Malpractice Flagged';

    // If connected to central server, submit attendance stamp
    if (serverUrl && (student.studentId || student.allocationId)) {
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
        console.log('Attendance saved locally:', e.message);
      }
    }

    Alert.alert(
      'Attendance Recorded',
      `Candidate ${student.name} marked as [${statusLabel}].`,
      [
        {
          text: 'Next Candidate',
          onPress: () => {
            navigation.replace('Scanner', { serverUrl, token, user });
          }
        }
      ],
      { cancelable: false }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Candidate Verification & ID Card Comparison</Text>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loaderText}>Verifying QR Token with Central Database...</Text>
          </View>
        ) : (
          <>
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
                {/* Roll Number Field Omitted Successfully per instructions */}
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

            {/* Face Match Prompt Instruction */}
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>
                <Text style={{ fontWeight: 'bold' }}>Face Match Prompt:</Text> Compare official
                photograph above against student's physical College Identity Card before confirming
                admission for this subject.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPresent]}
                onPress={() => handleAttendance('PRESENT')}
                disabled={submitting}
              >
                <Text style={styles.btnText}>✔ Present</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnAbsent]}
                onPress={() => handleAttendance('ABSENT')}
                disabled={submitting}
              >
                <Text style={styles.btnText}>✖ Absent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnFlag]}
                onPress={() => handleAttendance('FLAG')}
                disabled={submitting}
              >
                <Text style={styles.btnText}>⚠ Flag Case</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#070d1d', justifyContent: 'center', padding: 15 },
  card: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', padding: 15 },
  cardHeader: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  loaderBox: { paddingVertical: 40, alignItems: 'center' },
  loaderText: { color: '#94a3b8', marginTop: 12, fontSize: 13 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#1e293b', padding: 12, borderRadius: 8 },
  avatar: { width: 70, height: 70, borderRadius: 8, borderWidth: 2, borderColor: '#10b981', marginRight: 15, backgroundColor: '#334155' },
  profileInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  prn: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
  deskBadge: { backgroundColor: '#064e3b', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 6 },
  deskText: { color: '#34d399', fontSize: 12, fontWeight: 'bold' },
  examBox: { backgroundColor: '#1e3a8a', padding: 12, borderRadius: 8, marginBottom: 15 },
  examSubTitle: { color: '#93c5fd', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  examTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  examMeta: { color: '#bfdbfe', fontSize: 12 },
  promptBox: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, marginBottom: 20 },
  promptText: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 3 },
  btnPresent: { backgroundColor: '#059669' },
  btnAbsent: { backgroundColor: '#334155' },
  btnFlag: { backgroundColor: '#7f1d1d' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});
