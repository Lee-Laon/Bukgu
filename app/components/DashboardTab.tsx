'use client';

import { SlotStatusResult } from '@/app/page';

interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  allowedSports?: string[];
}

interface DashboardTabProps {
  selectedDate: string;
  dayOfWeek: string;
  timeSlots: TimeSlot[];
  weekdayRules: any;
  dbReservations: any[];
  getTimeLockStatus: (startTime: string) => 'past' | 'imminent' | 'none';
  getSlotStatusInfo: (slotId: string, startTime: string) => SlotStatusResult;
  onSlotClick: (slot: TimeSlot) => void;
  sports: string[];
}

export default function DashboardTab({
  selectedDate,
  dayOfWeek,
  timeSlots,
  dbReservations,
  getTimeLockStatus,
  getSlotStatusInfo,
  onSlotClick,
  sports,
}: DashboardTabProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 text-black animate-fadeIn">
      <div className="border-b border-gray-100 pb-2">
        <h2 className="text-md font-bold text-gray-800 flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          체육관 예약 현황판
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">기준일자: {selectedDate} ({dayOfWeek}요일)</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {timeSlots.map((slot) => {
          const lockStatus = getTimeLockStatus(slot.startTime);
          const status = getSlotStatusInfo(String(slot.id), slot.startTime);
          
          // 등록된 제한 종목 개수가 전역 마스터 종목 개수보다 적을 때 실질적인 강좌 제한으로 판별
          const hasSportRestriction = 
            slot.allowedSports && 
            slot.allowedSports.length > 0 && 
            slot.allowedSports.length < (sports?.length || 3);
          
          const hasExistingReservations = status.allocatedCourts > 0;

          let cardBg = "bg-gray-50 border-gray-200";
          let statusBadge = (
            <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[11px] px-2 py-0.5 rounded-md font-bold">
              🟢 {status.remainingCourts}코트 이용 가능
            </span>
          );
          let subGuideText = "";

          // 🚫 1. 운영 종료 및 마감 임박 예외 처리
          if (lockStatus === 'past') {
            cardBg = "bg-gray-100/70 border-gray-200 opacity-60";
            statusBadge = <span className="bg-gray-200 text-gray-500 text-[11px] px-2 py-0.5 rounded-md font-medium">⏳ 예약 마감</span>;
            subGuideText = "접수가 마감된 시간대입니다.";
          } else if (lockStatus === 'imminent') {
            cardBg = "bg-amber-50/40 border-amber-200";
            statusBadge = <span className="bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 rounded-md font-bold animate-pulse">⚠️ 마감 임박</span>;
            subGuideText = "현장 마감 직전 상태입니다. 안내 데스크에 문의하세요.";
          } 
          
          // 🚫 2. [4번 분기] 전체 매진 상태 ➔ 행정 문구 교체
          else if (status.isFull) {
            cardBg = "bg-red-50/30 border-red-200";
            statusBadge = <span className="bg-red-50 text-red-600 border border-red-200 text-[11px] px-2 py-0.5 rounded-md font-bold">🔴 예약 마감 (잔여 코트 없음)</span>;
            subGuideText = "예약 가능한 잔여 코트가 없습니다.";
          } 
          
          // 🚫 3. [2번 분기] 강좌 운영 제한 상태 ➔ 행정 문구 교체
          else if (hasSportRestriction) {
            cardBg = "bg-orange-50/40 border-orange-200";
            statusBadge = (
              <span className="bg-orange-100 text-orange-700 border border-orange-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟠 {status.remainingCourts}코트 한정 이용 가능
              </span>
            );
            subGuideText = `📢 [관내 강좌] 해당 시간대 [${slot.allowedSports?.join(', ')}] 강좌 운영으로 일반 대관 제한`;
          } 
          
          // 🚫 4. [3번 분기] 선행 예약 존재 상태 ➔ 행정 문구 교체
          else if (hasExistingReservations) {
            cardBg = "bg-amber-50/30 border-amber-200";
            statusBadge = (
              <span className="bg-amber-100 text-amber-700 border border-amber-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟡 {status.remainingCourts}코트 이용 가능
              </span>
            );
            subGuideText = `🟡 타 종목 예약 중 [현재 개설: ${status.activeSports.join(', ')}] (잔여 코트 범위 내 예약 가능)`;
          } 
          
          // 🚫 5. [1번 분기] 완전 청정 상태 ➔ 행정 문구 교체
          else {
            cardBg = "bg-emerald-50/20 border-emerald-200 hover:border-blue-300";
            statusBadge = (
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟢 전 코트 일반 대관 가능
              </span>
            );
            subGuideText = "제한 없는 시간대입니다. 자유롭게 종목을 선택하여 예약을 진행하세요.";
          }

          return (
            <div
              key={slot.id}
              onClick={() => lockStatus === 'none' && !status.isFull && onSlotClick(slot)}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg} ${
                lockStatus === 'none' && !status.isFull ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-gray-700 text-sm">{slot.startTime}</span>
                  <span className="text-xs font-bold text-gray-800">{slot.name}</span>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">{subGuideText}</p>
              </div>
              <div className="flex items-center justify-end">{statusBadge}</div>
            </div>
          );
        })}

        {timeSlots.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-400 font-medium">선택하신 요일에는 등록된 운영 시간대 정보가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}