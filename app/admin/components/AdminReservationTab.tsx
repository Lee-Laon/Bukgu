'use client';

import { useState } from 'react';
import AdminTeleDesk from '@/app/components/AdminTeleDesk';
import MasterPanel from '@/app/components/MasterPanel';

// 🎯 [오류 해결] 인터페이스 규격에 setSelectedDate 속성을 정확하게 추가했습니다!
interface AdminReservationTabProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void; // 👈 부모가 밀어주는 날짜 변경 함수 수용 명시
  handleNavigateDate: (daysToMove: number) => void;
  activeBlockingRule: any;
  adaptedTimeSlots: any[];
  getSlotStatusInfo: (startTime: string) => {
    allocatedCourts: number;
    remainingCourts: number;
    isFull: boolean;
    activeSports: string[];
    isSportLimitReached: boolean;
    allowedSports?: string[];
  };
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
}

export default function AdminReservationTab({
  selectedDate,
  setSelectedDate, // 👈 구조 분해 인자 파라미터로 명확히 주입받아 매칭 완료
  handleNavigateDate,
  activeBlockingRule,
  adaptedTimeSlots,
  getSlotStatusInfo,
  handleAdminReservationSubmit,
  dbReservations,
  handleMasterCancel,
}: AdminReservationTabProps) {
  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* 📅 날짜 제어 바 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shadow-xl">
        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">📅 실시간 접수 관측일 제어:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleNavigateDate(-1)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 font-bold text-xs py-1.5 px-2.5 rounded-lg transition-all"
          >
            ◀ 이전날
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-700 rounded-lg p-1.5 font-bold bg-slate-800 text-xs text-center text-white focus:outline-none w-36"
          />
          <button
            type="button"
            onClick={() => handleNavigateDate(1)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 font-bold text-xs py-1.5 px-2.5 rounded-lg transition-all"
          >
            다음날 ▶
          </button>
        </div>
      </div>

      {/* 공사 통제 시 경고 알림 바 */}
      {activeBlockingRule && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-center text-xs text-red-400 font-bold animate-pulse">
          ⚠️ [안내] 해당 일자는 공단 장기 행정 통제 기간에 포함되어 있습니다.<br />
          사유: {activeBlockingRule.reason} (예약 접수창이 잠금 처리됩니다.)
        </div>
      )}

      {/* 📞 현장 및 전화 우회 대관 콤포저 데스크 */}
      <AdminTeleDesk
        timeSlots={adaptedTimeSlots}
        selectedDate={selectedDate}
        getSlotStatusInfo={getSlotStatusInfo}
        onAdminSubmit={handleAdminReservationSubmit}
      />

      {/* 👥 당일 대관 내역 모니터링 및 취소 처리 마스터 패널 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">
        <p className="text-xs font-bold text-slate-400 mb-2.5">👥 예약자 관리 마스터 패널</p>
        <MasterPanel
          selectedDate={selectedDate}
          dbReservations={dbReservations}
          onMasterCancel={handleMasterCancel}
        />
      </div>

    </div>
  );
}