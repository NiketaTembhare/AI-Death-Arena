import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://utzpigjeqswrnelyuzgs.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0enBpZ2plcXN3cm5lbHl1emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxOTI3OTgsImV4cCI6MjEwNDc2ODc5OH0.82-D5WZG9QxOFiI2UDR1ccdb0rEGD_-T3_y5e2noeIg';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

const supabaseUrl = isValidUrl(envUrl) ? envUrl : defaultUrl;
const supabaseAnonKey = isValidKey(envKey) ? envKey : defaultKey;

console.log('⚡ Supabase Connected:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

