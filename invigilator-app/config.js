/**
 * Smart Examination System — Invigilator App Configuration
 * 
 * Active Wi-Fi IPv4: 10.141.24.238
 * Mobile Hotspot IPv4: 192.168.137.1
 */

const resolvedDefaultUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  '192.168.137.1';

export const CONFIG = {
  // Primary server URL (Wi-Fi LAN by default)
  DEFAULT_SERVER_URL: resolvedDefaultUrl,
  CLOUDFLARE_TUNNEL_URL: 'https://relaxation-posters-freight-oct.trycloudflare.com',
  WIFI_SERVER_URL: 'http://10.141.24.238:5000',
  HOTSPOT_SERVER_URL: 'http://192.168.137.1:5000',
  FALLBACK_SERVER_URL: 'http://192.168.137.1:5000',
  API_TIMEOUT: 8000,
  APP_NAME: 'Smart Exam Invigilator',
  INSTITUTE: 'Government College of Engineering, Amravati'
};
