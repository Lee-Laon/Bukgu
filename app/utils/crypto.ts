/**
 * 운암복합문화체육센터 보안 인프라 파이프라인
 * 클라이언트 단방향 해시 암호화 및 가공 유틸리티
 */

// 1. 데이터 가공용 유저 정보 파서
export const parseRawUserInfo = (rawString: string) => {
  if (!rawString) return { name: '', phone: '', password: '' };
  const match = rawString.match(/^(.*?)\s*\((.*?)\)/);
  const passMatch = rawString.match(/\[(.*?)\]/);
  return {
    name: match ? match[1].trim() : rawString.split(' [')[0],
    phone: match ? match[2].trim() : '',
    password: passMatch ? passMatch[1] : ''
  };
};

// 2. 기본 마스킹 처리 가공기 (화면 노출용)
export const getMaskedUserInfo = (rawString: string) => {
  const { name, phone } = parseRawUserInfo(rawString);
  if (!name) return '';

  let maskedName = name;
  if (name.length === 2) {
    maskedName = name[0] + '*';
  } else if (name.length > 2) {
    maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  }

  let maskedPhone = phone;
  const phoneParts = phone.split('-');
  if (phoneParts.length === 3) {
    maskedPhone = `${phoneParts[0]}-****-${phoneParts[2]}`;
  }

  return `${maskedName} (${maskedPhone})`;
};

// 3. 🎯 복호화가 불가능한 글로벌 표준 SHA-256 해시 함수 (단방향 암호화)
// Next.js 웹 표준 Web Crypto API를 활용하여 별도의 패키지 없이 안전하게 구동됩니다.
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}