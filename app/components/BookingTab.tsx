'use client';

import React, { useState, useEffect } from 'react';

interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  allowedSports?: string[];
}

interface BookingTabProps {
  timeSlots: TimeSlot[];
  sports: string[];
  getTimeLockStatus: (startTime: string) => 'past' | 'imminent' | 'none';
  getSlotStatusInfo: (slotId: string, startTime: string) => {
    allocatedCourts: number;
    remainingCourts: number;
    isFull: boolean;
    sportCount: number;
    activeSports: string[];
    isSportLimitReached: boolean;
    allowedSports?: string[];
  };
  onReservationSubmit: (
    slot: any,
    sport: string,
    name: string,
    phone: string,
    pass: string,
    headCount: number,
    courtCount: number
  ) => Promise<boolean>;
  selectedSlot: any | null;
  setSelectedSlot: (slot: any | null) => void;
  isDarkMode?: boolean;
}

type Step = 'SLOT' | 'SPORT' | 'NAME' | 'PASS' | 'PHONE' | 'FINAL';

export default function BookingTab({
  timeSlots,
  sports,
  getTimeLockStatus,
  getSlotStatusInfo,
  onReservationSubmit,
  selectedSlot,
  setSelectedSlot,
  isDarkMode = false,
}: BookingTabProps) {
  const [step, setStep] = useState<Step>('SLOT');
  const [selectedSport, setSelectedSport] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPass, setUserPass] = useState('');
  const [headCount, setHeadCount] = useState(1);
  const [courtCount, setCourtCount] = useState<number>(1);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  // 🎯 부모에 의해 selectedSlot이 비워지는 시점 폼 상태 리셋
  useEffect(() => {
    if (selectedSlot) {
      if (step === 'SLOT') {
        setSelectedSport('');
        setStep('SPORT');
      }
    } else {
      setUserName('');
      setUserPhone('');
      setUserPass('');
      setHeadCount(1);
      setCourtCount(1);
      setStep('SLOT');
    }
  }, [selectedSlot]);

  // 🎯 초기 진입 시 기본 코트 수 세팅 분기
  useEffect(() => {
    if (step === 'FINAL') {
      if (selectedSport === '농구') {
        setCourtCount(0.5);
      } else {
        setCourtCount(1);
      }
    }
  }, [step, selectedSport]);

  // 🎯 [신규] 인원수 변동에 따른 코트 수 초과 방지용 실시간 롤백 자동 가드
  useEffect(() => {
    if (selectedSport === '배드민턴' || selectedSport === '피클볼') {
      if (headCount >= 1 && headCount <= 4 && courtCount > 1) {
        setCourtCount(1); // 4명 이하인데 2코트 이상 들고 있으면 1코트로 강등
      } else if (headCount >= 5 && headCount <= 8 && courtCount > 2) {
        setCourtCount(2); // 8명 이하인데 3코트 들고 있으면 2코트로 강등
      }
    }
  }, [headCount, selectedSport, courtCount]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    let formatted = rawValue;
    if (rawValue.length > 3 && rawValue.length <= 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 7) {
      formatted = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}-${rawValue.slice(7, 11)}`;
    }
    setUserPhone(formatted);
  };

  const adjustHeadCount = (amount: number) => {
    triggerHaptic();
    setHeadCount(prev => Math.max(1, Math.min(30, prev + amount)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    triggerHaptic();
    await onReservationSubmit(
      selectedSlot,
      selectedSport,
      userName,
      userPhone,
      userPass,
      headCount,
      courtCount
    );
  };

  const getProgressWidth = () => {
    const steps: Step[] = ['SLOT', 'SPORT', 'NAME', 'PASS', 'PHONE', 'FINAL'];
    const idx = steps.indexOf(step);
    return `${((idx + 1) / steps.length) * 100}%`;
  };

  // 🎯 [핵심] 코트 버튼 활성화 상태 및 인원수/잔여량 다중 조건 교차 판별 검증 함수
  const isCourtButtonAvailable = (buttonCourt: number, currentHead: number, remaining: number): boolean => {
    // 원칙 1: 현재 시간대 슬롯의 대관 가능 잔여량보다 큰 코트 버튼은 무조건 비활성화
    if (buttonCourt > remaining) return false;

    // 원칙 2: 배드민턴 및 피클볼 전 전용 한계선 마운트
    if (selectedSport === '배드민턴' || selectedSport === '피클볼') {
      if (currentHead >= 1 && currentHead <= 4) {
        return buttonCourt === 1; // 1~4명은 1코트만 활성화
      }
      if (currentHead >= 5 && currentHead <= 8) {
        return buttonCourt === 1 || buttonCourt === 2; // 5~8명은 1, 2코트 활성화
      }
      if (currentHead >= 9) {
        return buttonCourt === 1 || buttonCourt === 2 || buttonCourt === 3; // 9명 이상은 최대 3코트까지 활성화
      }
    }
    return true;
  };

  const renderCourtButtons = (remaining: number) => {
    if (selectedSport === '농구') {
      return (
        <div className="flex justify-center w-full">
          <button
            type="button"
            onClick={() => { triggerHaptic(); setCourtCount(0.5); }}
            className={`w-full max-w-[120px] py-3.5 rounded-2xl border text-xs font-mono font-extrabold transition-all shadow-sm active:scale-[0.95] ${
              isDarkMode ? 'border-blue-500 bg-blue-950/40 text-blue-400 ring-2 ring-blue-500/20' : 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/10'
            }`}
          >
            0.5코트
          </button>
        </div>
      );
    }

    // 1코트, 2코트, 3코트 버튼 루프 처리
    const allButtons = [1, 2, 3];

    return (
      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
        {allButtons.map((val) => {
          // 실시간 활성화 조건 충족 여부 체크
          const isAvailable = isCourtButtonAvailable(val, headCount, remaining);
          const isSelected = courtCount === val;

          return (
            <button
              key={val}
              type="button"
              disabled={!isAvailable}
              onClick={() => { triggerHaptic(); setCourtCount(val); }}
              className={`py-3.5 rounded-2xl border text-xs font-mono font-extrabold transition-all duration-150 shadow-sm ${
                isSelected
                  ? isDarkMode
                    ? 'border-blue-500 bg-blue-950/40 text-blue-400 ring-2 ring-blue-500/20 scale-[0.98]'
                    : 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/10 scale-[0.98]'
                  : isAvailable
                  ? isDarkMode
                    ? 'bg-[#22222a] border-slate-800 text-slate-300 hover:bg-slate-800/50 active:scale-[0.94]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.94]'
                  : isDarkMode
                  ? 'bg-[#1a1a22] border-slate-900/60 text-slate-700 cursor-not-allowed opacity-30' // 조건 미달 비활성화 (다크)
                  : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'    // 조건 미달 비활성화 (라이트)
              }`}
            >
              {val}코트
            </button>
          );
        })}
      </div>
    );
  };

  const currentSlotStatus = selectedSlot ? getSlotStatusInfo(String(selectedSlot.id), selectedSlot.startTime) : null;
  const currentRemainingCourts = currentSlotStatus ? currentSlotStatus.remainingCourts : 3;

  return (
    <div className="w-full max-w-md mx-auto py-12 md:py-16 space-y-8 transition-all duration-300 ease-in-out">
      {/* 상단 네비게이션 칩 */}
      {step !== 'SLOT' && (
        <div className={`rounded-2xl p-3 flex items-center justify-between text-xs font-semibold animate-fade-in shadow-sm transition-colors ${
          isDarkMode ? 'bg-[#22222a]' : 'bg-slate-100/60'
        }`}>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              if (step === 'SPORT') { setSelectedSlot(null); setStep('SLOT'); }
              else if (step === 'NAME') setStep('SPORT');
              else if (step === 'PASS') setStep('NAME');
              else if (step === 'PHONE') setStep('PASS');
              else if (step === 'FINAL') setStep('PHONE');
            }}
            className={`transition-colors font-bold px-2 active:scale-95 ${
              isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ← 이전 단계로
          </button>
          <div className="flex items-center gap-2 pr-2">
            <span className={`text-[10px] border px-2 py-0.5 rounded-full font-mono font-bold ${
              isDarkMode ? 'bg-blue-950/40 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}>
              {selectedSlot?.startTime}
            </span>
          </div>
        </div>
      )}

      {/* 프로세스 게이지 */}
      <div className={`w-full h-1 rounded-full overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div className="bg-blue-600 h-full transition-all duration-500 ease-out rounded-full" style={{ width: getProgressWidth() }}></div>
      </div>

      {/* STEP 1: 시간 선택 */}
      {step === 'SLOT' && (
        <div className="space-y-6 animate-fade-in">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight leading-snug transition-colors ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              언제 시간대로 예약할까요?
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">대관을 원하시는 희망 시간대를 터치해 주세요.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 pt-2">
            {timeSlots.map((slot) => {
              const lockStatus = getTimeLockStatus(slot.startTime);
              const status = getSlotStatusInfo(String(slot.id), slot.startTime);
              const availableCourts = status.remainingCourts;
              const isFullOrEmpty = status.isFull || availableCourts === 0;
              const isAvailable = !isFullOrEmpty && lockStatus === 'none';

              let btnStyle = isDarkMode ? "bg-[#22222a] border-slate-800/80 text-slate-200 hover:border-blue-500 active:scale-[0.99]" : "bg-white border-slate-200/80 text-slate-800 hover:border-blue-600 hover:shadow-md hover:shadow-blue-600/5 active:scale-[0.99]";
              let badge = (
                <div className="text-right space-y-0.5">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {availableCourts}코트 가능
                  </span>
                  {status.activeSports && status.activeSports.length > 0 && (
                    <p className="text-[9px] text-slate-400 font-medium tracking-tight">{status.activeSports.join(', ')}</p>
                  )}
                </div>
              );

              if (isFullOrEmpty) {
                btnStyle = isDarkMode ? "bg-[#1d1d24] border-slate-900 text-slate-600 cursor-not-allowed" : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed";
                badge = <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md font-bold">마감</span>;
              } else if (lockStatus === 'past') {
                btnStyle = isDarkMode ? "bg-[#1d1d24] opacity-30 cursor-not-allowed text-slate-600 border-slate-900" : "bg-slate-50 opacity-40 cursor-not-allowed text-slate-400 border-slate-100";
                badge = <span className={`text-[10px] px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>운영 종료</span>;
              } else if (lockStatus === 'imminent') {
                btnStyle = isDarkMode ? "bg-amber-950/10 border-amber-900/60 text-slate-400 cursor-not-allowed" : "bg-amber-50/10 border-amber-200 text-slate-700 cursor-not-allowed";
                badge = <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isDarkMode ? 'bg-amber-950 text-amber-500' : 'bg-amber-100 text-amber-700'}`}>마감 임박</span>;
              }

              return (
                <button key={slot.id} disabled={!isAvailable} onClick={() => { triggerHaptic(); setSelectedSlot(slot); }} className={`w-full px-5 py-4 rounded-2xl border text-left transition-all flex items-center justify-between group duration-200 shadow-sm ${btnStyle}`}>
                  <div>
                    <span className={`font-mono font-extrabold text-xs transition-colors ${isDarkMode ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-600'}`}>{slot.startTime}</span>
                    <p className={`text-xs font-bold mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{slot.name}</p>
                  </div>
                  {badge}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: 종목 선택 */}
      {step === 'SPORT' && selectedSlot && (
        <div className="space-y-6 animate-slide-up py-4">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight transition-colors ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>어느 종목을 예약할까요?</h2>
          </div>
          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {(selectedSlot.allowedSports && selectedSlot.allowedSports.length > 0 ? selectedSlot.allowedSports : sports)
              .filter((sp: string) => {
                const currentStatus = getSlotStatusInfo(String(selectedSlot.id), selectedSlot.startTime);
                if (currentStatus.remainingCourts === 0.5 && (sp === '배드민턴' || sp === '피클볼')) return false;
                return true;
              })
              .map((sp: string) => (
                <button key={sp} type="button" onClick={() => { triggerHaptic(); setSelectedSport(sp); setStep('NAME'); }} className={`w-full py-4 rounded-2xl border text-center text-xs font-bold tracking-tight transition-all active:scale-[0.99] duration-150 shadow-sm ${selectedSport === sp ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/10' : isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {sp}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* STEP 3: 성명 입력 */}
      {step === 'NAME' && (
        <div className="space-y-6 animate-slide-up py-4">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>예약하시는 분의 성명이 어떻게 되시나요?</h2>
          </div>
          <div className="space-y-4 pt-2">
            <input type="text" autoFocus placeholder="예약자 성함을 알려주세요" value={userName} onChange={(e) => setUserName(e.target.value)} className={`w-full border-b-2 px-1 py-3 text-sm font-semibold focus:outline-none bg-transparent transition-colors ${isDarkMode ? 'border-slate-800 focus:border-blue-500 text-slate-100 placeholder-slate-600' : 'border-slate-200 focus:border-blue-600 text-slate-800 placeholder-slate-400'}`} />
            <button type="button" disabled={!userName.trim()} onClick={() => { triggerHaptic(); setStep('PASS'); }} className={`w-full text-xs font-extrabold py-4 rounded-2xl transition-all shadow-sm duration-150 ${userName.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]' : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>입력 완료</button>
          </div>
        </div>
      )}

      {/* STEP 4: 비밀번호 설정 */}
      {step === 'PASS' && (
        <div className="space-y-6 animate-slide-up py-4">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>예약 확인과 취소에 쓰일 비밀번호 4자리를 정해 주세요.</h2>
          </div>
          <div className="space-y-4 pt-2">
            <input type="password" maxLength={4} autoFocus placeholder="숫자 4자리" value={userPass} onChange={(e) => setUserPass(e.target.value.replace(/[^0-9]/g, ''))} className={`w-full border-b-2 px-1 py-3 text-lg text-center font-mono font-bold focus:outline-none bg-transparent transition-colors tracking-widest ${isDarkMode ? 'border-slate-800 focus:border-blue-500 text-slate-100 placeholder-slate-600' : 'border-slate-200 focus:border-blue-600 text-slate-800 placeholder-slate-400'}`} />
            <button type="button" disabled={userPass.length !== 4} onClick={() => { triggerHaptic(); setStep('PHONE'); }} className={`w-full text-xs font-extrabold py-4 rounded-2xl transition-all shadow-sm duration-150 ${userPass.length === 4 ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]' : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>비밀번호 설정 완료</button>
          </div>
        </div>
      )}

      {/* STEP 5: 연락처 입력 */}
      {step === 'PHONE' && (
        <div className="space-y-6 animate-slide-up py-4">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>예약하신 분의 연락처를 남겨주세요.</h2>
          </div>
          <div className="space-y-4 pt-2">
            <input type="tel" maxLength={13} autoFocus placeholder="휴대폰 번호를 입력해 주세요" value={userPhone} onChange={handlePhoneChange} className={`w-full border-b-2 px-1 py-3 text-sm font-mono font-semibold focus:outline-none bg-transparent transition-colors ${isDarkMode ? 'border-slate-800 focus:border-blue-500 text-slate-100 placeholder-slate-600' : 'border-slate-200 focus:border-blue-600 text-slate-800 placeholder-slate-400'}`} />
            <button type="button" disabled={userPhone.length < 12} onClick={() => { triggerHaptic(); setStep('FINAL'); }} className={`w-full text-xs font-extrabold py-4 rounded-2xl transition-all shadow-sm duration-150 ${userPhone.length >= 12 ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]' : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>번호 등록 완료</button>
          </div>
        </div>
      )}

      {/* STEP 6: 최종 명세 결산 */}
      {step === 'FINAL' && selectedSlot && (
        <form onSubmit={handleSubmit} className="space-y-8 animate-slide-up py-2">
          <div className="space-y-2 px-1">
            <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">BOOKING TICKET</span>
            <h2 className={`text-xl font-black tracking-tight leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              마지막으로, 몇 분이서 몇 코트를 쓰시나요?
            </h2>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 block px-0.5 uppercase tracking-wider">총 이용 인원</label>
              <div className={`flex items-center border rounded-2xl overflow-hidden h-[46px] max-w-[160px] shadow-sm transition-colors ${
                isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <button type="button" onClick={() => adjustHeadCount(-1)} className={`w-12 h-full font-bold transition-colors text-base active:scale-95 ${
                  isDarkMode ? 'text-slate-400 hover:bg-slate-800 active:bg-slate-700' : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
                }`}>－</button>
                <span className={`flex-1 text-center text-xs font-mono font-extrabold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{headCount} 명</span>
                <button type="button" onClick={() => adjustHeadCount(1)} className={`w-12 h-full font-bold transition-colors text-base active:scale-95 ${
                  isDarkMode ? 'text-slate-400 hover:bg-slate-800 active:bg-slate-700' : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
                }`}>＋</button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <label className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">필요한 코트 수 선택</label>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  대관 가능 잔여량: {currentRemainingCourts}코트
                </span>
              </div>
              <div className="pt-1">
                {renderCourtButtons(currentRemainingCourts)}
              </div>
            </div>
          </div>
          <div className={`rounded-2xl p-4 space-y-2 text-[11px] border shadow-inner transition-colors ${
            isDarkMode ? 'bg-[#1d1d24] border-slate-800/60 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
          }`}>
            <div className="flex justify-between"><span>선택된 일정 / 종목</span><span className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{selectedSlot.startTime} / {selectedSport}</span></div>
            <div className="flex justify-between"><span>대표 예약자</span><span className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{userName} 님</span></div>
            <div className={`flex justify-between border-t pt-2.5 mt-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200/60'}`}>
              <span className="font-semibold text-blue-500">신청 명세 내역</span>
              <span className={`font-extrabold text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{headCount}명 / {courtCount}코트</span>
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-4 rounded-2xl transition-all shadow-md shadow-blue-600/10 active:scale-[0.985] text-center">이대로 대관 예약 완료하기</button>
        </form>
      )}
    </div>
  );
}