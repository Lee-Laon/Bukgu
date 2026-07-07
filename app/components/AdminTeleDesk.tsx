'use client';

import { useState, useEffect } from 'react';

interface AdminTeleDeskProps {
  timeSlots: any[];
  selectedDate: string;
  getSlotStatusInfo: (startTime: string) => { 
    allocatedCourts: number;
    remainingCourts: number;
    isFull: boolean; 
    activeSports: string[]; 
    isSportLimitReached: boolean;
  };
  onAdminSubmit: (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number, courtCount: number) => Promise<void>;
}

export default function AdminTeleDesk({ timeSlots = [], selectedDate, getSlotStatusInfo, onAdminSubmit }: AdminTeleDeskProps) {
  const [targetName, setTargetName] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [selectedSport, setSelectedSport] = useState('배드민턴');
  const [chosenSlot, setChosenSlot] = useState<any | null>(null);
  
  const [headCount, setHeadCount] = useState<number>(1);
  const [courtCount, setCourtCount] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // 시간대 선택 시 종목 자동 포커싱 규칙
  useEffect(() => {
    if (chosenSlot) {
      const { activeSports } = getSlotStatusInfo(chosenSlot.startTime);
      if (chosenSlot.allowedSports && chosenSlot.allowedSports.length > 0) {
        setSelectedSport(chosenSlot.allowedSports[0]);
      } else if (activeSports.length > 0) {
        setSelectedSport(activeSports[0]);
      } else {
        setSelectedSport('배드민턴');
      }
      setCourtCount(1);
    }
  }, [chosenSlot]);

  // 실시간 선택된 시간대의 대관 상태 정보 기칭
  const currentStatus = chosenSlot 
    ? getSlotStatusInfo(chosenSlot.startTime)
    : { isFull: false, remainingCourts: 3, activeSports: [], isSportLimitReached: false };

  const isPastSlot = (slotStartTime: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (selectedDate !== todayStr) return false;

    const currentTotal = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [sH, sM] = slotStartTime.split(':').map(Number);
    return currentTotal > (sH * 60 + sM); 
  };

  const formatPhone = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  };

  const handleRegister = async () => {
    if (!chosenSlot) { alert('📢 접수 희망 시간대를 먼저 선택해 주세요!'); return; }
    if (!targetName.trim()) { alert('👤 예약자 이름을 입력해 주세요.'); return; }
    if (targetPhone.length < 12) { alert('📱 연락처 번호를 온전히 채워주세요.'); return; }

    await onAdminSubmit(chosenSlot, selectedSport, targetName.trim(), targetPhone, '0000', headCount, courtCount);
    
    setTargetName('');
    setTargetPhone('');
    setChosenSlot(null);
    setHeadCount(1);
    setCourtCount(1);
    setSelectedSport('배드민턴');
    alert('🎯 제한 규칙이 완벽 검증된 전화 예약 등록이 완료되었습니다!');
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 animate-fadeIn text-white shadow-xl">
      <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          📞 안내데스크 전화 예약 접수
        </h2>
        <span className="bg-slate-800 text-slate-300 font-semibold px-3 py-1 rounded-full text-xs border border-slate-700">
          📅 접수 기준일: {selectedDate}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1단계: 시간대 선택 */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <p className="text-xs font-bold text-slate-400 mb-2.5">1단계: 접수 희망 시간대 누르기</p>
          <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {/* 🎯 [수리] 혹시나 데이터가 빈 채로 들어와도 안전하게 map이 구동되도록 (timeSlots || []) 가드 가동 */}
            {(timeSlots || []).map((slot) => {
              const isSelected = chosenSlot?.id === slot.id;
              const isPast = isPastSlot(slot.startTime);
              
              const { isFull, remainingCourts, activeSports } = getSlotStatusInfo(slot.startTime);
              const isDisabled = isPast || isFull;

              return (
                <button
                  key={slot.id}
                  disabled={isDisabled}
                  type="button"
                  onClick={() => setChosenSlot(slot)}
                  className={`w-full text-left p-2.5 rounded-lg font-medium text-xs transition-all ${
                    isDisabled 
                      ? 'bg-slate-950 text-slate-700 border-slate-950/40 cursor-not-allowed opacity-25 line-through' 
                      : isSelected 
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {isPast ? `🔒 [시간지남] ${slot.name}` : isFull ? `🔒 [대관매진] ${slot.name}` : `⏱️ ${slot.name}`} 
                  {!isDisabled && ` (잔여: ${remainingCourts}코트 / 개설: ${activeSports.length}종목)`}
                </button>
              );
            })}
          </div>
          {chosenSlot && (
            <p className="mt-3 text-xs text-center font-bold text-blue-400 bg-blue-500/10 py-1.5 rounded border border-blue-500/20">
              선택됨: {chosenSlot.name}
            </p>
          )}
        </div>

        {/* 2단계: 정보 입력칸 */}
        <div className="flex flex-col justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2.5">2단계: 상세 정보 입력</p>
            
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {['배드민턴', '피클볼', '농구'].map((sp) => {
                const noSlotSelected = !chosenSlot;
                const { activeSports, isSportLimitReached } = getSlotStatusInfo(chosenSlot?.startTime || '');
                const isNotAllowedByRule = chosenSlot?.allowedSports && !chosenSlot.allowedSports.includes(sp);
                const isLockedBySportLimit = isSportLimitReached && !activeSports.includes(sp);

                const isLocked = noSlotSelected || isNotAllowedByRule || isLockedBySportLimit;
                
                return (
                  <button
                    key={sp}
                    type="button"
                    disabled={!!isLocked}
                    onClick={() => setSelectedSport(sp)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      isLocked
                        ? 'bg-slate-950 text-slate-800 border-slate-950 cursor-not-allowed opacity-10 line-through' 
                        : selectedSport === sp 
                          ? 'bg-blue-600 text-white border-blue-500' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {sp}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">👤 이용자 성함</label>
                  <input type="text" placeholder="예: 홍길동" value={targetName} onChange={(e) => setTargetName(e.target.value)} className="w-full border border-slate-800 rounded-lg p-2 bg-slate-900 text-white text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">📱 전화번호</label>
                  <input type="text" maxLength={13} placeholder="010-1234-5678" value={targetPhone} onChange={(e) => setTargetPhone(formatPhone(e.target.value))} className="w-full border border-slate-800 rounded-lg p-2 bg-slate-900 text-white text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              {/* 인원 카운터 */}
              <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400">👥 입장 인원수</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setHeadCount(Math.max(1, headCount - 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded font-bold text-xs">-</button>
                  <span className="text-xs font-bold w-7 text-center text-blue-400">{headCount}명</span>
                  <button type="button" onClick={() => setHeadCount(Math.min(15, headCount + 1))} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded font-bold text-xs">+</button>
                </div>
              </div>

              {/* 코트 수 선택 */}
              <div className="flex flex-col bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 mb-1.5 text-center md:text-left">
                  🏸 필요 코트수 지정 (남은 코트: {currentStatus.remainingCourts}개)
                </span>
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
                            ? 'bg-slate-950 text-slate-800 border-slate-950 cursor-not-allowed opacity-20 line-through'
                            : isChecked
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {num}개
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          <button type="button" onClick={handleRegister} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs shadow-md">
            ✅ 이 정보로 예약 즉시 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}