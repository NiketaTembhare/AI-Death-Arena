import { supabase } from './supabase';

let globalClockOffsetMs = 0;
let isSynced = false;

/**
 * Synchronize local device time with Supabase server time using HTTP Date header.
 * Calculates latency-adjusted offset: clockOffsetMs = serverTimeMs - Date.now()
 */
export const syncServerClock = async () => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) return 0;

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
