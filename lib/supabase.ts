import { createClient } from '@supabase/supabase-js';

// .env.local에 저장해둔 주소와 키를 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 혹시라도 설정 값이 없을 때를 대비한 안전장치
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 또는 Anon Key가 .env.local 파일에 설정되지 않았습니다.');
}

// Next.js 프로젝트 어디서든 불러와 쓸 수 있는 진짜 DB 연결 객체(client)를 생성합니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);