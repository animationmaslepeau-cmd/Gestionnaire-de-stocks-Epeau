
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmnwninfuyxmtdczopmq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptbnduaW5mdXl4bXRkY3pvcG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MzMzNDQsImV4cCI6MjA3NTQwOTM0NH0.cuhfVSo1pbQPUeCdsAhoc5G9nVoXbAHtKKt749q2q28';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
