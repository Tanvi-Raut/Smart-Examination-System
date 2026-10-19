import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { CONFIG } from '../config';

export default function LoginScreen({ navigation }) {
  const [invigilatorId, setInvigilatorId] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(CONFIG.DEFAULT_SERVER_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFillDemo = () => {
    setInvigilatorId('invigilator@gcoea.ac.in');
    setPassword('invigilator123');
  };

  const handleLogin = async () => {
    if (!invigilatorId || !password) {
      Alert.alert('Missing Details', 'Please enter both Invigilator ID/Email and Password.');
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invigilatorId.trim(),
          password: password,
          role: 'invigilator'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.token) {
        navigation.replace('Scanner', {
          token: data.token,
          user: data.user,
          serverUrl: serverUrl
        });
      } else {
        // If server returns error, prompt user or allow offline demo session
        Alert.alert(
          'Login Notice',
          data.message || 'Invalid credentials. Proceed in offline demo mode?',
          [
            { text: 'Try Again', style: 'cancel' },
            {
              text: 'Enter Offline Demo',
              onPress: () =>
                navigation.replace('Scanner', {
                  token: 'demo-token',
                  user: { name: 'Demo Invigilator', email: invigilatorId },
                  serverUrl: serverUrl
                })
            }
          ]
        );
      }
    } catch (error) {
      // Server unreachable (e.g., active signal jammers or offline testing)
      Alert.alert(
        'Offline / Jammer Mode Active',
        'Cannot reach central exam server. Would you like to enter offline proctoring mode?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue Offline',
            onPress: () =>
              navigation.replace('Scanner', {
                token: 'offline-token',
                user: { name: 'Hall Proctor', email: invigilatorId },
                serverUrl: serverUrl
              })
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>GCOEA EXAM CELL</Text>
        </View>

        <Text style={styles.title}>Invigilator Portal</Text>
        <Text style={styles.subtitle}>Smart Examination Management System</Text>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.label}>INVIGILATOR ID / EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. invigilator@gcoea.ac.in"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
            value={invigilatorId}
            onChangeText={setInvigilatorId}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter session password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Quick Demo Fill Button */}
          <TouchableOpacity style={styles.demoButton} onPress={handleFillDemo}>
            <Text style={styles.demoButtonText}>⚡ Quick Demo Fill (LH-101 Proctor)</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login to Session</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Server IP Settings Toggle */}
        <TouchableOpacity
          style={styles.configToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.configToggleText}>
            ⚙️ {showServerConfig ? 'Hide Server Configuration' : 'Server LAN Connection Settings'}
          </Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.serverConfigLabel}>CENTRAL SERVER API URL:</Text>
            <TextInput
              style={styles.serverInput}
              placeholder="http://192.168.1.105:5000"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              value={serverUrl}
              onChangeText={setServerUrl}
            />
            <Text style={styles.serverHint}>
              Point to your laptop's Wi-Fi IP address on the campus network.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1, backgroundColor: '#0b1329' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  badgeContainer: {
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 12
  },
  badgeText: { color: '#60a5fa', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f8fafc', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 28 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6
  },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 15
  },
  demoButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  demoButtonText: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  configToggle: { alignSelf: 'center', marginTop: 24 },
  configToggleText: { color: '#64748b', fontSize: 12 },
  serverConfigCard: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  serverConfigLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold', marginBottom: 6 },
  serverInput: {
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    padding: 10,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    borderWidth: 1,
    borderColor: '#334155'
  },
  serverHint: { color: '#64748b', fontSize: 10, marginTop: 6 }
});
