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

  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async (targetUrl = serverUrl) => {
    setTestingConnection(true);
    try {
      const cleanUrl = (targetUrl || '').trim();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ping_test', password: 'test' }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      Alert.alert(
        'Server Reachable! ✅',
        `Successfully connected to examination server at:\n${cleanUrl}\n\n(Server responded with HTTP ${res.status})`
      );
    } catch (e) {
      Alert.alert(
        'Server Unreachable ❌',
        `Could not reach server at:\n${targetUrl}\n\nReason: ${e.message}\n\nEnsure laptop and phone are on the same Wi-Fi or Mobile Hotspot, and port 5000 is open.`
      );
    } finally {
      setTestingConnection(false);
    }
  };

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

      console.log(`[LoginScreen] Attempting login to: ${serverUrl}/api/auth/login`);
      const response = await fetch(`${serverUrl.trim()}/api/auth/login`, {
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
      console.log(`[LoginScreen] Login HTTP status: ${response.status}`);
      const data = await response.json();

      if (response.ok && data.token) {
        navigation.replace('Scanner', {
          token: data.token,
          user: data.user,
          serverUrl: serverUrl.trim()
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
                  serverUrl: serverUrl.trim()
                })
            }
          ]
        );
      }
    } catch (error) {
      console.error('[LoginScreen] Connection failed:', error);
      const isTimeout = error.name === 'AbortError';
      const detailMsg = isTimeout
        ? `Request timed out after ${CONFIG.API_TIMEOUT / 1000}s.`
        : (error.message || 'Network request failed');

      // Distinguish server unreachable from false jammer claims
      Alert.alert(
        'Server Connection Failed',
        `Cannot reach the central exam server at:\n${serverUrl}\n\nCause: ${detailMsg}\n\nEnsure your phone and laptop are on the same Wi-Fi/Hotspot network and the backend server is active.`,
        [
          {
            text: 'Configure Server IP',
            onPress: () => setShowServerConfig(true)
          },
          {
            text: 'Enter Offline Mode',
            onPress: () =>
              navigation.replace('Scanner', {
                token: 'offline-token',
                user: { name: 'Hall Proctor (Offline)', email: invigilatorId || 'proctor@offline' },
                serverUrl: serverUrl.trim()
              })
          },
          { text: 'Cancel', style: 'cancel' }
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

        {/* Current Target Server Indicator */}
        <View style={styles.activeServerBar}>
          <Text style={styles.activeServerLabel}>Connected Server Target:</Text>
          <Text style={styles.activeServerUrl} numberOfLines={1}>{serverUrl}</Text>
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
              placeholder="https://relaxation-posters-freight-oct.trycloudflare.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              value={serverUrl}
              onChangeText={setServerUrl}
            />

            {/* Quick Network Preset Buttons */}
            <Text style={styles.presetHeading}>QUICK NETWORK PRESETS:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  serverUrl === CONFIG.CLOUDFLARE_TUNNEL_URL && styles.presetBtnActive
                ]}
                onPress={() => setServerUrl(CONFIG.CLOUDFLARE_TUNNEL_URL)}
              >
                <Text style={styles.presetBtnText}>🌐 Cloudflare Tunnel (4G)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  serverUrl === CONFIG.WIFI_SERVER_URL && styles.presetBtnActive
                ]}
                onPress={() => setServerUrl(CONFIG.WIFI_SERVER_URL)}
              >
                <Text style={styles.presetBtnText}>🏢 Wi-Fi LAN (10.141.24.238)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  serverUrl === CONFIG.HOTSPOT_SERVER_URL && styles.presetBtnActive
                ]}
                onPress={() => setServerUrl(CONFIG.HOTSPOT_SERVER_URL)}
              >
                <Text style={styles.presetBtnText}>📱 Hotspot (192.168.137.1)</Text>
              </TouchableOpacity>
            </View>

            {/* Test Connection Button */}
            <TouchableOpacity
              style={styles.testBtn}
              onPress={() => handleTestConnection(serverUrl)}
              disabled={testingConnection}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <Text style={styles.testBtnText}>📡 Test Server Connection</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.serverHint}>
              Ensure your phone and laptop are on the same Wi-Fi or Mobile Hotspot network.
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
  serverHint: { color: '#64748b', fontSize: 10, marginTop: 6 },
  activeServerBar: {
    marginTop: 14,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center'
  },
  activeServerLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  activeServerUrl: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  presetHeading: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  presetBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  presetBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e'
  },
  presetBtnText: { color: '#e2e8f0', fontSize: 11, fontWeight: '600' },
  testBtn: {
    backgroundColor: '#0369a1',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8
  },
  testBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' }
});
