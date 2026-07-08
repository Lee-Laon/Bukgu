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
  // 폼 입력 상태
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [sport, setSport] = useState('배드민턴');
  const [headCount, setHeadCount] = useState<number>(1);
  const [courtCount, setCourtCount] = useState<number>(1);

  const isPhoneValid = phone.length === 13;

  // 연락처 자동 하이픈 삽입 헬퍼
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    let formatted = val;
    if (val.length <= 3) formatted = val;
    else if (val.length <= 7) formatted = `${val.slice(0, 3)}-${val.slice(3)}`;
    else formatted = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7, 11)}`;
    setPhone(formatted);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      alert('📱 연락처 번호 11자리를 온전히 채워주세요.');
      return;
    }
    await onReservationSubmit(selectedSlot, sport, name, phone, pass, headCount, courtCount);
    
    // 폼 초기화
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

            let availableSportsArray: string[] = [];
            if (slot.allowedSports && slot.allowedSports.length > 0) {
              availableSportsArray = slot.allowedSports;
            } else if (status.isSportLimitReached) {
              availableSportsArray = status.activeSports;
            } else {
              availableSportsArray = sports;
            }
            const sportsLabel = availableSportsArray.map(sp => `[${sp}]`).join(', ');

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
                <div className="font-bold">⏱️ {slot.name}</div>
                {!isDisabled && (
                  <div className={`text-[10px] mt-1.5 font-medium leading-relaxed ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                    <div>• 잔여 코트 : <span className="font-bold text-red-500 bg-red-50 px-1 py-0.2 rounded mx-0.5">{status.remainingCourts}개</span></div>
                    <div className="mt-0.5">• 신청 가능 종목 : <span className={isSelected ? 'text-white font-bold' : 'text-blue-600 font-bold'}>{sportsLabel}</span></div>
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

          {/* 인적 사항 기입 인풋 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">👤 예약자 성함</label>
              <input type="text" required placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg p-2 text-sm text-black bg-white focus:border-blue-500 focus:outline-none" />
            </div>
            
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
                  phone.length > 0 && !isPhoneValid ? 'border-red-500 bg-red-50/20 text-red-600' : 'border-gray-200 focus:border-blue-500'
                }`} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">🔒 예약 비밀번호 (4자리)</label>
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
                        isOverCourt ? 'bg-gray-100 text-gray-300 opacity-40 line-through' : isChecked ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {num}개
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md">
            🚀 체육관 예약 대관 신청하기
          </button>
        </form>
      )}

      {/* 결과 메시지 (예약 신청 후 상단 성공/실패 가이드라인) */}
      {resultMessage && (
        <div className={`p-4 rounded-xl border font-semibold text-center text-sm ${resultMessage.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div>{resultMessage.message}</div>
          {resultMessage.success && (
            <p className="text-xs mt-1 text-gray-600 font-normal">상단의 <span className="font-bold text-blue-600">[확인]</span> 탭으로 이동하시면 예약 내역 조회 및 공유/취소가 가능합니다.</p>
          )}
        </div>
      )}
    </div>
  );
}