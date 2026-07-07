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
  sports: string[]; // 🎯 [신규] 전역 종목 리스트 타입을 추가합니다.
}

export default function DashboardTab({
  selectedDate,
  dayOfWeek,
  timeSlots,
  dbReservations,
  getTimeLockStatus,
  getSlotStatusInfo,
  onSlotClick,
  sports, // 🎯 구조분해 파라미터 주입
}: DashboardTabProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 text-black animate-fadeIn">
      <div className="border-b border-gray-100 pb-2">
        <h2 className="text-md font-bold text-gray-800 flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          실시간 코트 대관 및 강좌 이용 현황판
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">기준일자: {selectedDate} ({dayOfWeek}요일)</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {timeSlots.map((slot) => {
          const lockStatus = getTimeLockStatus(slot.startTime);
          const status = getSlotStatusInfo(String(slot.id), slot.startTime);
          
          // 🎯 [핵심 알고리즘 고도화] 
          // 등록된 제한 종목 개수가 전역 마스터 종목 개수보다 적을 때에만 '실질적인 종목 제한(강좌)'이 있다고 판별합니다.
          const hasSportRestriction = 
            slot.allowedSports && 
            slot.allowedSports.length > 0 && 
            slot.allowedSports.length < (sports?.length || 3);
          
          // 현재 한 면이라도 예약(선점)된 코트가 존재하는가?
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
            statusBadge = <span className="bg-gray-200 text-gray-500 text-[11px] px-2 py-0.5 rounded-md font-medium">⏳ 운영 종료</span>;
            subGuideText = "오늘의 운영 및 접수가 마감된 시간대입니다.";
          } else if (lockStatus === 'imminent') {
            cardBg = "bg-amber-50/40 border-amber-200";
            statusBadge = <span className="bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 rounded-md font-bold animate-pulse">⚠️ 마감 임박</span>;
            subGuideText = "현장 마감 직전 상태입니다. 데스크에 문의하세요.";
          } 
          
          // 🚫 2. 전체 매진 상태
          else if (status.isFull) {
            cardBg = "bg-red-50/30 border-red-200";
            statusBadge = <span className="bg-red-50 text-red-600 border border-red-200 text-[11px] px-2 py-0.5 rounded-md font-bold">🔴 전체 매진</span>;
            subGuideText = "예약 가능한 잔여 코트가 없습니다 (대기 불가).";
          } 
          
          // 🚫 3. 실질적인 강좌 운영 제한 상태 (허용 종목이 마스터 종목보다 적을 때만 주황불)
          else if (hasSportRestriction) {
            cardBg = "bg-orange-50/40 border-orange-200";
            statusBadge = (
              <span className="bg-orange-100 text-orange-700 border border-orange-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟠 {status.remainingCourts}코트 한정 이용 가능
              </span>
            );
            subGuideText = `📢 [강좌운영] ${slot.allowedSports?.join(', ')} 종목 강좌로 인해 제한적으로 이용 가능함`;
          } 
          
          // 🚫 4. 강좌 제한은 없으나 선행 일반 예약이 존재하여 일부 코트가 차 있는 상태
          else if (hasExistingReservations) {
            cardBg = "bg-amber-50/30 border-amber-200";
            statusBadge = (
              <span className="bg-amber-100 text-amber-700 border border-amber-300 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟡 {status.remainingCourts}코트 선점 이용 가능
              </span>
            );
            subGuideText = `현재 대관 종목: [${status.activeSports.join(', ')}] (종목 제한 규칙이 적용될 수 있음)`;
          } 
          
          // 🚫 5. 코트가 전부 비어 있고 모든 종목 진입이 가능한 청정 상태
          else {
            cardBg = "bg-emerald-50/20 border-emerald-200 hover:border-blue-300";
            statusBadge = (
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px] px-2 py-0.5 rounded-md font-bold">
                🟢 {status.remainingCourts}코트 전부 비어있음
              </span>
            );
            subGuideText = "제한 없는 시간대입니다. 자유롭게 종목을 선택하여 예약하세요.";
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