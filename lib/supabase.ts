import { createClient } from '@supabase/supabase-js';

// ⭕ 배포 서버에서 환경 변수 파일(.env)에 오염되지 않도록 진짜 정보를 완전히 직격으로 박아버립니다.
const supabaseUrl = 'https://ayvoqqvzmhlncuksxjcw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5dm9xcXZ6bWhsbmN1a3N4amN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTU2MjYsImV4cCI6MjA5ODYzMTYyNn0.ao1DJ_b8sP1XrUEMC4NdqyRDQmuLa03iLhe-HmdvMGE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);