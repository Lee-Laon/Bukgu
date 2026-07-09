'use client';

import React from 'react';

interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
}

interface DashboardTabProps {
  selectedDate: string;
  dayOfWeek: string;
  timeSlots: TimeSlot[];
  weekdayRules: any;
  dbReservations: any[];
  getTimeLockStatus: (startTime: string) => 'past' | 'imminent' | 'none';
  getSlotStatusInfo: (slotId: string, startTime: string) => {
    allocatedCourts: number;
    remainingCourts: number;
    isFull: boolean;
    sportCount: number;
    activeSports: string[];
    isSportLimitReached: boolean;
  };
  onSlotClick: (slot: TimeSlot) => void;
  sports: string[];
  // 🎯 메인 page.tsx의 다크모드 무선 신호를 받기 위한 레일 추가!
  isDarkMode?: boolean;
}

export default function DashboardTab({
  selectedDate,
  dayOfWeek,
  timeSlots,
  dbReservations,
  getTimeLockStatus,
  getSlotStatusInfo,
  onSlotClick,
  isDarkMode = false, // 기본 라이트 가드
}: DashboardTabProps) {
  
  // 날짜 포맷 변환 (2026-07-09 -> 7월 9일)
  const formatMD = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`;
  };

  return (
    <div className="w-full max-w-md mx-auto py-12 md:py-16 space-y-8 transition-all duration-300 ease-in-out">
      
      {/* 📊 토스 스타일 문장형 볼드 헤더 */}
      <div className="space-y-2 px-1">
        <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">LIVE STATUS</span>
        {/* 🎯 버그 수정: 다크모드일 때 흰색(text-slate-100)으로 화사하게 켜지도록 조건부 클래스 배치! */}
        <h2 className={`text-xl font-black tracking-tight leading-snug transition-colors whitespace-pre-line ${
          isDarkMode ? 'text-slate-100' : 'text-slate-900'
        }`}>
          {formatMD(selectedDate)} ({dayOfWeek}){"\n"}대관 현황입니다
        </h2>
      </div>

      {/* ⚡ 시간별 현황 리스트 대시보드 카드 섹션 */}
      <div className="grid grid-cols-1 gap-3 pt-2">
        {timeSlots.map((slot) => {
          const lockStatus = getTimeLockStatus(slot.startTime);
          const status = getSlotStatusInfo(String(slot.id), slot.startTime);
          const availableCourts = status.remainingCourts;
          const isFullOrEmpty = status.isFull || availableCourts === 0;

          // 시간 및 슬롯 마감 여부 통합 가드
          const isPastOrFull = lockStatus === 'past' || isFullOrEmpty;

          let cardStyle = isDarkMode
            ? "bg-[#22222a] border-slate-800/80 text-slate-200 hover:border-blue-500"
            : "bg-white border-slate-200/60 text-slate-800 hover:border-blue-600 hover:shadow-md hover:shadow-blue-600/5";

          let badge = (
            <div className="text-right space-y-0.5">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                isDarkMode ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                {availableCourts}코트 가능
              </span>
              {status.activeSports && status.activeSports.length > 0 && (
                <p className="text-[9px] text-slate-400 font-medium tracking-tight">
                  {status.activeSports.join(', ')}
                </p>
              )}
            </div>
          );

          if (lockStatus === 'past') {
            cardStyle = isDarkMode
              ? "bg-[#1d1d24] opacity-30 cursor-not-allowed text-slate-600 border-slate-900"
              : "bg-slate-50 opacity-40 cursor-not-allowed text-slate-400 border-slate-100";
            badge = <span className={`text-[10px] px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>운영 종료</span>;
          } else if (isFullOrEmpty) {
            cardStyle = isDarkMode
              ? "bg-[#1d1d24] border-slate-900 text-slate-600 cursor-not-allowed"
              : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed";
            badge = <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md font-bold">마감</span>;
          } else if (lockStatus === 'imminent') {
            cardStyle = isDarkMode
              ? "bg-amber-950/10 border-amber-900/60 text-slate-400 cursor-not-allowed"
              : "bg-amber-50/10 border-amber-200 text-slate-700 cursor-not-allowed";
            badge = <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isDarkMode ? 'bg-amber-950 text-amber-500' : 'bg-amber-100 text-amber-700'}`}>마감 임박</span>;
          }

          return (
            <button
              key={slot.id}
              disabled={isPastOrFull || lockStatus === 'imminent'}
              onClick={() => onSlotClick(slot)}
              className={`w-full px-5 py-4 rounded-2xl border text-left transition-all flex items-center justify-between group active:scale-[0.995] duration-200 shadow-sm ${cardStyle}`}
            >
              <div>
                <span className={`font-mono font-extrabold text-xs transition-colors ${
                  isDarkMode ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-600'
                }`}>{slot.startTime}</span>
                <p className={`text-xs font-bold mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{slot.name}</p>
              </div>
              {badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}