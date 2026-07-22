'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AdminReservationTabProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  handleNavigateDate: (daysToMove: number) => void;
  activeBlockingRule: any;
  adaptedTimeSlots: any[];
  getSlotStatusInfo: (startTime: string) => any;
  handleAdminReservationSubmit: (
    slot: any,
    sport: string,
    name: string,
    phone: string,
    pass: string,
    headCount: number,
    courtCount: number
  ) => Promise<void>;
  dbReservations: any[];
  handleMasterCancel: (id: number) => Promise<void>;
  sports?: string[];
}

export default function AdminReservationTab({
  selectedDate,
  setSelectedDate,
  handleNavigateDate,
  activeBlockingRule,
  adaptedTimeSlots,
  getSlotStatusInfo,
  handleAdminReservationSubmit,
  dbReservations,
  handleMasterCancel,
  sports = ['배드민턴', '피클볼', '농구'],
}: AdminReservationTabProps) {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalSlot, setModalSlot] = useState<any | null>(null);
  const [modalSport, setModalSport] = useState<string>(sports[0] || '배드민턴');
  const [modalName, setModalName] = useState<string>('');
  const [modalPhone, setModalPhone] = useState<string>('');
  const [modalHeadCount, setModalHeadCount] = useState<number>(4);
  const [modalCourtCount, setModalCourtCount] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getSlotTimeState = (startTime: string): 'PAST' | 'IN_PROGRESS' | 'FUTURE' => {
    if (selectedDate !== getTodayString()) {
      const selected = new Date(selectedDate);
      const today = new Date(getTodayString());
      return selected < today ? 'PAST' : 'FUTURE';
    }

    const currentTotal = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [sH, sM] = startTime.split(':').map(Number);
    const startTotal = sH * 60 + sM;
    const endTotal = startTotal + 120; // 2시간 슬롯 기준

    if (currentTotal >= endTotal) {
      return 'PAST'; 
    } else if (currentTotal >= startTotal && currentTotal < endTotal) {
      return 'IN_PROGRESS'; 
    }
    return 'FUTURE'; 
  };

  const handleOpenModal = (slot?: any) => {
    const targetSlot = slot || adaptedTimeSlots.find((s) => getSlotTimeState(s.startTime) !== 'PAST');
    if (!targetSlot) {
      alert('대리 등록 가능한 시간대가 없습니다.');
      return;
    }
    setModalSlot(targetSlot);
    
    const allowed = targetSlot.allowedSports && targetSlot.allowedSports.length > 0 
      ? targetSlot.allowedSports 
      : sports;
      
    setModalSport(allowed[0] || sports[0] || '배드민턴');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalName('');
    setModalPhone('');
    setModalHeadCount(4);
    setModalCourtCount(1);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSlot) return;
    if (!modalName.trim() || !modalPhone.trim()) {
      alert('예약자 성함과 연락처를 입력해 주세요.');
      return;
    }

    const slotState = getSlotTimeState(modalSlot.startTime);
    if (slotState === 'PAST') {
      alert('이미 운영이 종료된 시간대에는 대리 예약할 수 없습니다.');
      return;
    }

    if (slotState === 'IN_PROGRESS') {
      if (!confirm('⚠️ 현재 이미 진행 중인 시간대입니다. 정말 대리 예약을 진행하시겠습니까?')) {
        return;
      }
    }

    await handleAdminReservationSubmit(
      modalSlot,
      modalSport,
      modalName,
      modalPhone,
      '', 
      modalHeadCount,
      modalCourtCount
    );

    handleCloseModal();
  };

  const availableSportOptions = modalSlot?.allowedSports && modalSlot.allowedSports.length > 0
    ? modalSlot.allowedSports
    : sports;

  return (
    <div className="space-y-5">
      {/* 📅 상단 헤더 컨트롤 바 */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-2xl gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigateDate(-1)}
            className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700/50"
          >
            ◀
          </button>
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-blue-400 font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <button
            type="button"
            onClick={() => handleNavigateDate(1)}
            className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700/50"
          >
            ▶
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 border border-blue-400/20"
        >
          <span className="text-sm">📝</span>
          <span>현장/전화 등록</span>
        </button>
      </div>

      {/* 🛑 차단 안내 알림 */}
      {activeBlockingRule && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 text-center shadow-lg animate-fade-in">
          <p className="text-xs font-black text-rose-400 flex items-center justify-center gap-1.5">
            <span>🚨</span>
            <span>행정 통제 기간 적용 중: {activeBlockingRule.reason}</span>
          </p>
          <p className="text-[10px] text-rose-300/60 mt-1 font-mono">
            통제 범위: {activeBlockingRule.start_date} ~ {activeBlockingRule.end_date}
          </p>
        </div>
      )}

      {/* 🏟️ 타임슬롯 그리드 카고 보드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {adaptedTimeSlots.map((slot) => {
          const status = getSlotStatusInfo(slot.startTime);
          const timeState = getSlotTimeState(slot.startTime);
          const isFull = status.isFull || status.remainingCourts <= 0;
          
          const isPast = timeState === 'PAST';
          const isInProgress = timeState === 'IN_PROGRESS';
          const isDisabled = isPast || (isFull && !isInProgress) || activeBlockingRule;

          return (
            <div
              key={slot.id}
              className={`relative p-4 rounded-2xl border transition-all duration-200 text-left flex flex-col justify-between space-y-3 ${
                isPast
                  ? 'bg-slate-950/40 border-slate-900/80 text-slate-600 opacity-50'
                  : isInProgress
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-950/20'
                  : isFull
                  ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                  : 'bg-slate-900 border-slate-800/80 text-slate-100 hover:border-slate-700 shadow-xl'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-black text-sm ${isInProgress ? 'text-amber-400' : 'text-blue-400'}`}>
                      {slot.startTime}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50">
                      {slot.name}
                    </span>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    {isPast ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-500 border border-slate-700/30">
                        ⌛ 운영 종료
                      </span>
                    ) : isInProgress ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                        ⚠️ 이용 중 (비권장)
                      </span>
                    ) : isFull ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-900/40">
                        🛑 예약 마감
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-900/40">
                        🟢 잔여 {status.remainingCourts}코트
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleOpenModal(slot)}
                  className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all shadow-sm ${
                    isPast
                      ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                      : isInProgress
                      ? 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 active:scale-95'
                      : isDisabled
                      ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/20 active:scale-95'
                  }`}
                >
                  {isPast ? '종료' : '등록'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-[10px]">
                <span className="text-slate-500 font-bold">예약된 종목</span>
                <span className="font-semibold text-slate-300">
                  {status.activeSports && status.activeSports.length > 0
                    ? status.activeSports.join(', ')
                    : '자유 이용 가능'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📋 실시간 대장 */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-2xl space-y-4 text-left">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>📋</span>
            <span>[{selectedDate}] 대관 실시간 대장</span>
          </h3>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-950 text-blue-400 border border-blue-900/50">
            총 {dbReservations.length}건
          </span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
          {dbReservations.length === 0 ? (
            <div className="py-10 text-center space-y-1">
              <p className="text-xs font-bold text-slate-500">신청된 대관 내역이 없습니다.</p>
            </div>
          ) : (
            dbReservations.map((res) => {
              const cleanDisplayName = res.user_name.replace(/\[.*?\]\s*/g, '');
              return (
                <div
                  key={res.id}
                  className="flex justify-between items-center bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/40">
                        {res.slot_time}
                      </span>
                      <span className="font-bold text-slate-200 text-sm">{cleanDisplayName}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      종목: <span className="text-slate-300 font-bold">{res.sport_name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMasterCancel(res.id)}
                    className="bg-rose-950/40 hover:bg-rose-600 text-rose-400 hover:text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl border border-rose-900/40 active:scale-95 transition-all"
                  >
                    강제 취소
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🎯 [버튼형 선택 방식으로 전면 개편된 대리 예약 모달] */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center p-4 md:p-6 z-[9999]">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={handleCloseModal} />
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl space-y-6 z-10 text-left animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest font-mono">ADMIN TICKET</span>
                  <h3 className="text-lg font-black text-slate-100 mt-1">현장 / 전화 대리 예약</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-500 hover:text-slate-300 font-bold text-base px-2 py-1 transition-colors"
                >
                  ✕
                </button>
              </div>

              {modalSlot && getSlotTimeState(modalSlot.startTime) === 'IN_PROGRESS' && (
                <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 text-xs text-amber-300 font-bold">
                  ⚠️ 선택하신 [{modalSlot.startTime}] 슬롯은 현재 이미 진행 중인 시간대입니다.
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* 1. 희망 시간대 (버튼 선택형) */}
                <div className="space-y-2">
                  <label className="block text-xs text-slate-400 font-bold uppercase">희망 시간대 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {adaptedTimeSlots.map((s) => {
                      const state = getSlotTimeState(s.startTime);
                      const isPast = state === 'PAST';
                      const isInProgress = state === 'IN_PROGRESS';
                      const isSelected = modalSlot?.startTime === s.startTime;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isPast}
                          onClick={() => {
                            setModalSlot(s);
                            const allowed = s.allowedSports && s.allowedSports.length > 0 ? s.allowedSports : sports;
                            setModalSport(allowed[0] || sports[0] || '배드민턴');
                          }}
                          className={`p-3 rounded-xl border text-left transition-all font-mono font-bold text-xs flex flex-col justify-between gap-1 ${
                            isPast
                              ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                              : isSelected
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                              : isInProgress
                              ? 'bg-amber-950/20 border-amber-500/40 text-amber-300 hover:bg-amber-950/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-black">{s.startTime}</span>
                            {isPast && <span className="text-[9px] text-slate-500">종료</span>}
                            {isInProgress && <span className="text-[9px] text-amber-400 font-extrabold">이용중</span>}
                          </div>
                          <span className={`text-[10px] font-sans ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            {s.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 이용 종목 (버튼 선택형) */}
                <div className="space-y-2">
                  <label className="block text-xs text-slate-400 font-bold uppercase">이용 종목 선택</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSportOptions.map((sp: string) => {
                      const isSelected = modalSport === sp;
                      return (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => setModalSport(sp)}
                          className={`py-3 px-2 rounded-xl border text-center text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          {sp}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 신청자 성함 */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400 font-bold uppercase">신청자 성함</label>
                  <input
                    type="text"
                    placeholder="성함을 입력하세요 (예: 이강민)"
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-slate-100 font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 4. 연락처 */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400 font-bold uppercase">연락처</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-slate-100 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 5. 인원수 및 코트수 수량 제어 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold uppercase">이용 인원수</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden h-[48px]">
                      <button
                        type="button"
                        onClick={() => setModalHeadCount((prev) => Math.max(1, prev - 1))}
                        className="w-12 h-full text-slate-400 font-bold hover:bg-slate-800 text-lg"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center text-sm font-mono font-bold text-slate-100">
                        {modalHeadCount}명
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalHeadCount((prev) => Math.min(30, prev + 1))}
                        className="w-12 h-full text-slate-400 font-bold hover:bg-slate-800 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold uppercase">필요 코트수</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden h-[48px]">
                      <button
                        type="button"
                        onClick={() => setModalCourtCount((prev) => Math.max(1, prev - 1))}
                        className="w-12 h-full text-slate-400 font-bold hover:bg-slate-800 text-lg"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center text-sm font-mono font-bold text-blue-400">
                        {modalCourtCount}코트
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalCourtCount((prev) => Math.min(3, prev + 1))}
                        className="w-12 h-full text-slate-400 font-bold hover:bg-slate-800 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 하단 액션 버튼 */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-900/30 active:scale-98 transition-all"
                  >
                    대리 예약 등록 완료
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}