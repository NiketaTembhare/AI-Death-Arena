import { supabase } from './supabase';

let globalClockOffsetMs = 0;
let isSynced = false;

const defaultUrl = 'https://utzpigjeqswrnelyuzgs.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0enBpZ2plcXN3cm5lbHl1emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxOTI3OTgsImV4cCI6MjEwNDc2ODc5OH0.82-D5WZG9QxOFiI2UDR1ccdb0rEGD_-T3_y5e2noeIg';

const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.startsWith('https://') && !lower.includes('placeholder') && !lower.includes('your-project') && !lower.includes('example');
};

const isValidKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const lower = key.toLowerCase();
  return !lower.includes('placeholder') && !lower.includes('your-key') && key.length > 20;
};

/**
 * Synchronize local device time with Supabase server time using HTTP Date header.
 * Calculates latency-adjusted offset: clockOffsetMs = serverTimeMs - Date.now()
 */
export const syncServerClock = async () => {
  try {
    const envUrl = import.meta.env.VITE_SUPABASE_URL;
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const supabaseUrl = isValidUrl(envUrl) ? envUrl : defaultUrl;
    const supabaseKey = isValidKey(envKey) ? envKey : defaultKey;

    const start = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    const dateHeader = response.headers.get('date');
    if (dateHeader) {
      const end = Date.now();
      const roundTripMs = (end - start) / 2;
      const serverTimeMs = new Date(dateHeader).getTime() + roundTripMs;
      globalClockOffsetMs = Math.round(serverTimeMs - end);
      isSynced = true;
      console.log('⚡ Device clock vs server clock offset (ms):', globalClockOffsetMs);
    }
  } catch (err) {
    console.warn('⚠️ Server clock sync error:', err);
  }
  return globalClockOffsetMs;
};

/**
 * Get current timestamp corrected for device clock skew against Supabase server.
 */
export const getServerTimeMs = () => {
  return Date.now() + globalClockOffsetMs;
};

/**
 * Get current measured clock offset in milliseconds.
 */
export const getClockOffsetMs = () => {
  return globalClockOffsetMs;
};
