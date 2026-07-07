'use client';

import { useState, useEffect } from 'react';

interface BookingTabProps {
  timeSlots: any[];
  sports: string[];
  getTimeLockStatus: (startTime: string) => 'none' | 'past' | 'imminent';
  getSlotStatusInfo: (slotId: string, startTime: string) => { 
    allocatedCourts: number; 
    remainingCourts: number; 
    isFull: boolean; 
    activeSports: string[]; 
    isSportLimitReached: boolean;
    allowedSports?: string[];
  };
  onReservationSubmit: (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number, courtCount: number) => Promise<void>;
  resultMessage: { success: boolean; message: string } | null;
  setResultMessage: (msg: { success: boolean; message: string } | null) => void;
  selectedSlot: any | null;
  setSelectedSlot: (slot: any | null) => void;
}

export default function BookingTab({
  timeSlots = [],
  sports,
  getTimeLockStatus,
  getSlotStatusInfo,
  onReservationSubmit,
  resultMessage,
  setResultMessage,
  selectedSlot,
  setSelectedSlot,
}: BookingTabProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [sport, setSport] = useState('배드민턴');
  
  const [headCount, setHeadCount] = useState<number>(1);
  const [courtCount, setCourtCount] = useState<number>(1);

  // 🚨 연락처 11자리 정밀 검증용 가드 (010-xxxx-xxxx 총 13자)
  const isPhoneValid = phone.length === 13;

  // ⏱️ [UX] 연락처 입력 시 실시간으로 하이픈(-)을 자동으로 삽입해주는 헬퍼 함수
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 남기기
    let formatted = val;
    
    if (val.length <= 3) {
      formatted = val;
    } else if (val.length <= 7) {
      formatted = `${val.slice(0, 3)}-${val.slice(3)}`;
    } else {
      formatted = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7, 11)}`;
    }
    
    setPhone(formatted);
  };

  // 🎯 시간대를 이동할 때마다 종목을 안전하게 동기화 리셋
  useEffect(() => {
    if (selectedSlot) {
      const status = getSlotStatusInfo(selectedSlot.id, selectedSlot.startTime);
      if (selectedSlot.allowedSports && selectedSlot.allowedSports.length > 0) {
        setSport(selectedSlot.allowedSports[0]);
      } else if ((status.activeSports as string[]).includes(sport)) {
        setSport(sport);
      } else if (status.activeSports.length > 0 && status.isSportLimitReached) {
        setSport(status.activeSports[0]);
      } else {
        setSport('배드민턴');
      }
    }
  }, [selectedSlot]);

  const currentStatus = selectedSlot 
    ? getSlotStatusInfo(selectedSlot.id, selectedSlot.startTime)
    : { isFull: false, remainingCourts: 3, activeSports: [], isSportLimitReached: false, allowedSports: undefined };

  // 💬 [신규] 카카오톡 / 문자 메시지 네이티브 공유 엔진 가동
  const handleShare = async () => {
    if (!selectedSlot) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '🏛️ 운암복합문화체육센터 대관 완료',
          text: `📢 [체육관 예약 완료 안내]\n\n• 이용 목적: ${sport}\n• 필요 코트: ${courtCount}코트\n• 입장 인원: ${headCount}명\n\n※ 비대면 예약 취소 시 본인이 설정한 [4자리 비밀번호]가 반드시 필요합니다.`,
        });
      } catch (err) {
        console.log('공유 취소 또는 에러:', err);
      }
    } else {
      // Web Share API 미지원 환경용 클립보드 백업 폴백
      navigator.clipboard.writeText(`[운암체육센터] 예약 성공!\n종목: ${sport}\n코트: ${courtCount}코트\n인원: ${headCount}명`);
      alert('📋 공유 기능이 제한된 브라우저 환경이므로 예약 내용이 클립보드에 복사되었습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      alert('📱 연락처 번호 11자리를 온전히 채워주세요.');
      return;
    }
    await onReservationSubmit(selectedSlot, sport, name, phone, pass, headCount, courtCount);
    
    setName(''); 
    setPhone(''); 
    setPass(''); 
    setHeadCount(1);
    setCourtCount(1);
  };

  return (
    <div className="space-y-4 animate-fadeIn text-black">
      {/* 1단계: 시간대 선택 */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-sm font-bold text-gray-700 mb-3">1단계: 접수 희망 시간대 선택</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(timeSlots || []).map((slot) => {
            const timeLock = getTimeLockStatus(slot.startTime);
            const status = getSlotStatusInfo(slot.id, slot.startTime);
            
            const isPast = timeLock === 'past';
            const isFull = status.isFull;
            const isDisabled = isPast || isFull;
            const isSelected = selectedSlot?.id === slot.id;

            return (
              <button
                key={slot.id}
                type="button"
                disabled={isDisabled}
                onClick={() => { 
                  setSelectedSlot(slot); 
                  setResultMessage(null); 
                  setCourtCount(1);
                  setHeadCount(1);
                }}
                className={`p-3 rounded-lg text-left font-semibold text-xs border transition-all ${
                  isDisabled
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through opacity-60'
                    : isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.01]'
                      : 'bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                <div>⏱️ {slot.name}</div>
                {!isDisabled && (
                  <div className={`text-[10px] mt-1 font-medium ${isSelected ? 'text-blue-200' : 'text-blue-500'}`}>
                    (잔여: {status.remainingCourts}코트 / 개설: {status.activeSports.length}종목)
                  </div>
                )}
                {isFull && <div className="text-[10px] mt-1 text-red-500 font-bold">🔒 [대관매진]</div>}
                {isPast && <div className="text-[10px] mt-1 text-gray-400 font-bold">🔒 [시간지남]</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2단계: 예약 상세 정보 입력 */}
      {selectedSlot && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <p className="text-sm font-bold text-gray-700 border-b pb-2">2단계: 예약 상세 정보 입력</p>

          {/* 종목 선택 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">🏸 운동 종목 선택</label>
            <div className="grid grid-cols-3 gap-2">
              {sports.map((sp) => {
                const isNotAllowedByRule = selectedSlot.allowedSports && !selectedSlot.allowedSports.includes(sp);
                const isLockedBySportLimit = currentStatus.isSportLimitReached && !(currentStatus.activeSports as string[]).includes(sp);
                const isLocked = isNotAllowedByRule || isLockedBySportLimit;

                return (
                  <button
                    key={sp}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setSport(sp)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      isLocked
                        ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through opacity-40'
                        : sport === sp
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {sp}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 인적 사항 기입 인풋 (UX 고도화 포함) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">👤 예약자 성함</label>
              <input type="text" required placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-black bg-white focus:border-blue-500 focus:outline-none" />
            </div>
            
            {/* 📱 동적 하이픈 및 자릿수 미달 경고 테두리 인풋 */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">📱 연락처 번호</label>
              <input 
                type="text" 
                required 
                placeholder="010-0000-0000" 
                maxLength={13}
                value={phone} 
                onChange={handlePhoneChange} 
                className={`w-full border rounded-lg p-2 text-sm text-black bg-white focus:outline-none transition-all ${
                  phone.length > 0 && !isPhoneValid
                    ? 'border-red-500 bg-red-50/20 focus:border-red-600 text-red-600' // 🚨 미달 시 레드 스킨 경고
                    : 'border-gray-200 focus:border-blue-500'
                }`} 
              />
              {phone.length > 0 && !isPhoneValid && (
                <p className="text-[10px] text-red-500 mt-1 font-semibold animate-pulse">⚠️ 11자리 번호를 가득 채워주세요.</p>
              )}
            </div>

            {/* 🔒 비밀번호 안내 툴팁 조합 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-gray-600">🔒 예약 비밀번호</label>
                <span className="text-[9px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">※ 취소시 검증용</span>
              </div>
              <input type="password" required placeholder="4자리 숫자" maxLength={4} value={pass} onChange={(e) => setPass(e.target.value.replace(/[^0-9]/g, ''))} className="w-full border rounded-lg p-2 text-sm text-black bg-white focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* 인원 및 코트수 제어판 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border">
            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border">
              <span className="text-xs font-bold text-gray-600">👥 입장 인원수</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setHeadCount(Math.max(1, headCount - 1))} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-black rounded font-bold text-xs">-</button>
                <span className="text-xs font-bold w-7 text-center text-blue-600">{headCount}명</span>
                <button type="button" onClick={() => setHeadCount(Math.min(15, headCount + 1))} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-black rounded font-bold text-xs">+</button>
              </div>
            </div>

            <div className="flex flex-col bg-white p-2.5 rounded-lg border justify-center">
              <span className="text-[11px] font-bold text-gray-500 mb-1.5 text-center sm:text-left">🏸 필요 코트수 선택 (남은 코트: {currentStatus.remainingCourts}개)</span>
              <div className="grid grid-cols-4 gap-1">
                {[0.5, 1, 2, 3].map((num) => {
                  const isOverCourt = num > currentStatus.remainingCourts;
                  const isChecked = courtCount === num;
                  
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={isOverCourt}
                      onClick={() => setCourtCount(num)}
                      className={`py-1 rounded text-xs font-bold transition-all ${
                        isOverCourt
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-40 line-through'
                          : isChecked
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {num}개
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md active:scale-[0.99]">
            🚀 체육관 예약 대관 신청하기
          </button>
        </form>
      )}

      {/* 결과 및 공유 패널 */}
      {resultMessage && (
        <div className={`p-4 rounded-xl border font-semibold text-center text-sm space-y-2.5 ${resultMessage.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div>{resultMessage.message}</div>
          {resultMessage.success && (
            <button
              type="button"
              onClick={handleShare}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-5 rounded-lg text-xs transition-all shadow active:scale-95 inline-flex items-center justify-center gap-1.5"
            >
              💬 카카오톡 / 문자 예약 정보 전달 및 공유하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}