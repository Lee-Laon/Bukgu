// 데이터 가공용 유저 정보 파서
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

// 기본 마스킹 처리 가공기
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