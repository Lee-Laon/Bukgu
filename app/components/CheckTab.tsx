'use client';

import { useState } from 'react';

interface CheckTabProps {
  myReservations: any[];
  hasSearched: boolean;
  onSearch: (type: 'name' | 'phone', value: string) => Promise<void>;
  onCancel: (id: number, inputPass: string) => Promise<boolean>;
}

export default function CheckTab({ 
  myReservations = [], 
  hasSearched, 
  onSearch, 
  onCancel 
}: CheckTabProps) {
  const [lookupName, setLookupName] = useState('');
  const [lookupPass, setLookupPass] = useState('');
  const [lookupPhoneMid, setLookupPhoneMid] = useState('');
  const [matchedReservation, setMatchedReservation] = useState<any | null>(null);

  // 성명 마스킹 (외자/일반 완벽 대응)
  const getMaskedName = (rawName: string) => {
    if (!rawName) return '';
    const trimmed = rawName.trim();
    if (trimmed.length <= 1) return trimmed;
    if (trimmed.length === 2) return trimmed[0] + '*';
    if (trimmed.length === 3) return trimmed[0] + '*' + trimmed[2];
    return trimmed[0] + '*'.repeat(trimmed.length - 2) + trimmed[trimmed.length - 1];
  };

  // 연락처 추출 및 마스킹 헬퍼
  const getMaskedPhone = (userString: string) => {
    const match = userString.match(/\((.*?)\)/);
    if (!match) return '010-****-****';
    const phone = match[1];
    const parts = phone.split('-');
    if (parts.length === 3) return `${parts[0]}-****-${parts[2]}`;
    return phone;
  };

  // 🔒 비밀번호 입력 후 Supabase 데이터 기반 실제 내역 조회 검증
  const handleLookupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupName.trim() || lookupPass.length !== 4) {
      alert('👤 성함과 🔒 4자리 비밀번호를 정확히 입력해 주세요.');
      return;
    }

    // 1단계: Supabase에 등록된 성함 기반 조회 요청 트리거
    await onSearch('name', lookupName);

    // 2단계: 가져온 대관 리스트 중 유저 포맷 내 문자열 파싱 검증
    // combined 포맷 구조: 홍길동 (010-1234-5678) [1234] {2명/1코트}
    const found = myReservations.find(res => {
      const isNameMatch = res.user_name.split(' (')[0] === lookupName.trim();
      const isPassMatch = res.user_name.includes(`[${lookupPass}]`);
      return isNameMatch && isPassMatch;
    });

    if (found) {
      setMatchedReservation(found);
    } else {
      alert('❌ 일치하는 대관 내역이 없거나 비밀번호가 틀렸습니다.');
    }
  };

  // 💬 카카오톡 / 문자 메시지 알림 서식 공유 엔진
  const handleShareReservation = async () => {
    if (!matchedReservation) return;

    // 대관 문자 서식 데이터 파싱
    const rawName = matchedReservation.user_name.split(' (')[0];
    const matchHeadCourt = matchedReservation.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
    const detailInfo = matchHeadCourt ? ` (${matchHeadCourt[1]}명/${matchHeadCourt[2]}코트)` : '';

    const shareText = `[운암복합문화체육센터 예약 안내]
- 예약일시 : ${matchedReservation.reservation_date} / ${matchedReservation.slot_time}
- 성명 : ${getMaskedName(rawName)}
- 종목 : ${matchedReservation.sport_name}${detailInfo}
- 비밀번호 : ****
- 위치 : https://unam-sports.center/map

* 안내 사항
- 반드시 현장에서 결제 후 입장해주시길 바랍니다.
- 시설 이용 시 실내화를 착용하시길 바랍니다.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '🏛️ 운암복합문화체육센터 대관 안내',
          text: shareText,
        });
      } catch (err) {
        console.log('공유 취소:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert('📋 공유 서식이 클립보드에 복사되었습니다. 카카오톡 창에 붙여넣기(Command+V) 해주세요!');
    }
  };

  // 🛑 가운데 4자리 검증 후 최종 대관 즉시 취소 실행
  const handleCancelExecute = async () => {
    if (!matchedReservation) return;
    
    const phoneMatch = matchedReservation.user_name.match(/\((.*?)\)/);
    if (!phoneMatch) return;
    
    const realPhone = phoneMatch[1]; // 010-6253-7699 형태 추출
    const realMidNum = realPhone.split('-')[1]; // 가운데 4자리 추출
    
    if (lookupPhoneMid !== realMidNum) {
      alert('❌ 입력하신 연락처 가운데 4자리 번호가 일치하지 않습니다.');
      return;
    }

    if (confirm('🛑 정말로 해당 예약을 취소하고 코트를 반환하시겠습니까?')) {
      // 🎯 여기서 page.tsx의 handleUserCancel 함수를 호출합니다!
      const success = await onCancel(matchedReservation.id, lookupPass);
      if (success) {
        setMatchedReservation(null);
        setLookupName('');
        setLookupPass('');
        setLookupPhoneMid('');
      }
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn text-black max-w-md mx-auto w-full">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <p className="text-sm font-bold text-gray-700 border-b pb-2">🔍 예약 정보 조회 및 확인</p>

        {/* 1단계: 이름 및 비밀번호 조회 입력 폼 */}
        {!matchedReservation ? (
          <form onSubmit={handleLookupVerify} className="space-y-3">
            <p className="text-xs font-medium text-gray-500 leading-relaxed">
              대관 신청 시 등록했던 <span className="font-bold text-blue-600">예약자 성함</span>과 <span className="font-bold text-blue-600">[4자리 비밀번호]</span>를 입력하시면 확인 및 취소가 가능합니다.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                required
                placeholder="예약자 성함 (예: 홍길동)"
                value={lookupName}
                onChange={(e) => setLookupName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="비밀번호 4자리"
                  value={lookupPass}
                  onChange={(e) => setLookupPass(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 border rounded-xl px-3 py-2 text-sm text-center font-mono bg-white focus:border-blue-500 focus:outline-none"
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 rounded-xl transition-all">
                  조회하기
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* 2단계: 인증 성공 시 나타나는 정보 확인 및 취소 패널 */
          <div className="space-y-4">
            
            {/* 📝 깔끔하게 정돈된 오피셜 예약 안내 서식 명세서 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs font-mono text-gray-800 space-y-2 leading-relaxed">
              <p className="font-bold text-gray-800 text-sm mb-1">[운암복합문화체육센터 예약 안내]</p>
              <div>- 예약일시 : {matchedReservation.reservation_date} ({matchedReservation.slot_time})</div>
              <div>- 성명 : {getMaskedName(matchedReservation.user_name.split(' (')[0])}</div>
              <div>- 종목 : {matchedReservation.sport_name}</div>
              <div>- 위치 : <span className="text-blue-500 underline">https://gbfmc.or.kr/menu.es?mid=a10401080000</span></div>
              
              <div className="border-t border-dashed my-2 pt-2 text-gray-500 space-y-0.5">
                <p className="font-bold text-gray-700">* 안내 사항</p>
                <p>- 반드시 현장에서 결제하고 입장</p>
                <p>- 실내화 필수</p>
              </div>
            </div>

            {/* 💬 내이티브 카톡 / 문자 정보 공유 기능 */}
            <button
              type="button"
              onClick={handleShareReservation}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
            >
              💬 예약 정보 공유하기
            </button>

            {/* 🛑 가운데 4자리 입력 방식 취소 엔진 */}
            <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-200 space-y-2">
              <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                <span>🛑</span> 대관 비대면 취소 검증선
              </div>
              <p className="text-[10px] text-gray-500 leading-normal">
                예약 취소를 위해 본인 연락처의 <span className="font-bold text-red-600">[중간 번호 4자리]</span>를 입력해 주세요.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="4자리"
                  value={lookupPhoneMid}
                  onChange={(e) => setLookupPhoneMid(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-28 border border-red-200 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-red-600 bg-white focus:border-red-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCancelExecute}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all"
                >
                  취소
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMatchedReservation(null);
                setLookupName('');
                setLookupPass('');
                setLookupPhoneMid('');
              }}
              className="w-full text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 py-2 rounded-xl text-center font-bold"
            >
              뒤로가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}