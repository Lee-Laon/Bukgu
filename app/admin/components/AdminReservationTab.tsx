'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminReservationTabProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  handleNavigateDate: (daysToMove: number) => void;
  activeBlockingRule: any;
  adaptedTimeSlots: any[];
  getSlotStatusInfo: (startTime: string) => any;
  handleAdminReservationSubmit: (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number, courtCount: number) => void;
  dbReservations: any[];
  handleMasterCancel: (id: number) => void;
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
}: AdminReservationTabProps) {

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 🎯 YYYY-MM-DD -> MM.DD(요일) 엑셀 내부 데이터용 포맷터
  const formatExcelDate = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr);
      const mm = dateObj.getMonth() + 1;
      const dd = dateObj.getDate();
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = days[dateObj.getDay()];
      return `${mm}.${dd}(${dayOfWeek})`;
    } catch (e) {
      return dateStr;
    }
  };

  // 🎯 [신규 행정 연산] 기준 날짜가 해당 월의 '몇 주차'인지 계산하는 함수 (월요일 기준 주차 연산)
  const getWeekOfMonthLabel = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    
    // 해당 월의 1일 날짜 객체 생성
    const firstDayOfMonth = new Date(year, dateObj.getMonth(), 1);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 1일의 요일 (0: 일, 1: 월, ...)
    
    // 1일이 속한 주의 월요일과 기준일 사이의 일수 계산
    const offset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const firstMonday = new Date(firstDayOfMonth);
    firstMonday.setDate(firstDayOfMonth.getDate() + offset);
    
    // 기준일과 첫 주 월요일 간의 시간 차이 연산
    const diffTime = dateObj.getTime() - firstMonday.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 주차 계산 (0부터 시작하므로 +1)
    const weekNum = Math.floor(diffDays / 7) + 1;
    
    return `${year}년 ${String(month).padStart(2, '0')}월 ${weekNum}주 (주간)`;
  };

  // 🎯 [신규 행정 연산] 일간 및 월간 가독성 파일명 라벨 생성기
  const getFileNameLabel = (dateStr: string, rangeType: 'day' | 'month') => {
    const dateObj = new Date(dateStr);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    if (rangeType === 'day') {
      return `${year}년 ${month}월 ${day}일 (일간)`;
    }
    return `${year}년 ${month}월 (월간)`;
  };

  // 📊 Core 엑셀 파일 조립 및 다운로드 공통 실행부
  const executeDownload = (targetData: any[], completeFileName: string) => {
    const headers = ['순번', '날짜', '시간대', '성명', '연락처', '종목', '인원', '코트'];
    
    const rows = targetData.map((res, index) => {
      const rawUser = res.user_name || '';
      const name = rawUser.split(' (')[0] || '';
      
      const phoneMatch = rawUser.match(/\((.*?)\)/);
      const phone = phoneMatch ? phoneMatch[1] : '';
      
      const courtMatch = rawUser.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      const headCount = courtMatch ? courtMatch[1] : '1';
      const court = courtMatch ? courtMatch[2] : '1';

      const rawStartTime = res.slot_time || '';
      const startTime = rawStartTime.split(':').slice(0, 2).join(':'); 
      
      let endTime = '';
      if (startTime) {
        const [h, m] = startTime.split(':').map(Number);
        endTime = `${String(h + 2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const timeRange = startTime && endTime ? `${startTime} ~ ${endTime}` : startTime;

      return [
        index + 1,
        formatExcelDate(res.reservation_date),
        timeRange,
        name,
        phone,
        res.sport_name,
        headCount,
        court
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    // 🎯 요청하신 표준 명명 규칙을 파일명 속성에 최종 할당
    link.setAttribute('download', `${completeFileName}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 일간/주간/월간 범위 선택 및 다운로드 프로세서
  const handleRangeDownload = async (rangeType: 'day' | 'week' | 'month') => {
    setIsDropdownOpen(false);

    // 1. 일간 명단 출력 프로세스
    if (rangeType === 'day') {
      if (!dbReservations || dbReservations.length === 0) {
        alert('📊 현재 날짜에 예약 내역이 존재하지 않습니다.');
        return;
      }
      const fileName = getFileNameLabel(selectedDate, 'day'); // XXXX년 XX월 XX일 (일간)
      executeDownload(dbReservations, fileName);
      return;
    }

    // 주간/월간 실시간 범위 쿼리 구동
    setIsDownloading(true);
    try {
      const baseDate = new Date(selectedDate);
      let startDateStr = selectedDate;
      let endDateStr = selectedDate;
      let calculatedFileName = '';

      // 2. 주간 명단 출력 프로세스 (주차 계산 포함)
      if (rangeType === 'week') {
        const currentDay = baseDate.getDay(); 
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() + distanceToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        startDateStr = monday.toISOString().split('T')[0];
        endDateStr = sunday.toISOString().split('T')[0];
        
        calculatedFileName = getWeekOfMonthLabel(selectedDate); // XXXX년 XX월 X주 (주간)
      } 
      
      // 3. 월간 명단 출력 프로세스
      else if (rangeType === 'month') {
        const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

        startDateStr = firstDay.toISOString().split('T')[0];
        endDateStr = lastDay.toISOString().split('T')[0];
        
        calculatedFileName = getFileNameLabel(selectedDate, 'month'); // XXXX년 XX월 (월간)
      }

      // Supabase 레인지 가드 조회 실행
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .gte('reservation_date', startDateStr)
        .lte('reservation_date', endDateStr)
        .order('reservation_date', { ascending: true })
        .order('slot_time', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`📊 지정된 범위 [${startDateStr} ~ ${endDateStr}]에 예약 내역이 존재하지 않습니다.`);
        return;
      }

      executeDownload(data, calculatedFileName);

    } catch (err: any) {
      console.error(err);
      alert('데이터 원장을 조회하는 과정에서 예외 에러가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn text-slate-200">
      
      {/* 날짜 제어 및 드롭다운 엑셀 통합 제어 센터 */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <button onClick={() => handleNavigateDate(-1)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 transition-all">◀ 이전일</button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono text-center text-blue-400 focus:outline-none focus:border-blue-500 font-bold"
          />
          <button onClick={() => handleNavigateDate(1)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 transition-all">다음일 ▶</button>
        </div>

        {/* 📥 드롭다운 연동형 엑셀 내보내기 버튼 */}
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isDownloading}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md border border-emerald-500/20"
          >
            <span>{isDownloading ? '⏳' : '📊'}</span> 
            {isDownloading ? '데이터 조회 중...' : '맞춤 서식 엑셀 다운로드 ▾'}
          </button>

          {/* ▾ 드롭다운 메뉴 팝업 */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-full sm:w-40 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-slate-900">
              <button
                onClick={() => handleRangeDownload('day')}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2"
              >
                <span>📅</span> 일간 명단 출력
              </button>
              <button
                onClick={() => handleRangeDownload('week')}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2"
              >
                <span>📆</span> 주간 명단 출력
              </button>
              <button
                onClick={() => handleRangeDownload('month')}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2"
              >
                <span>🗓️</span> 월간 명단 출력
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 공사 기간 Guard 배너 */}
      {activeBlockingRule && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-center">
          <p className="text-xs font-bold text-red-400">🛑 통제 기간: [{activeBlockingRule.reason}]로 인해 대관이 전면 차단되었습니다.</p>
        </div>
      )}

      {/* 타임슬롯별 접수 관리 리스트 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-xs font-bold text-slate-400">📅 타임슬롯별 예약 배정 및 현장 마스터 통제</h3>
        
        <div className="space-y-3">
          {adaptedTimeSlots.map((slot) => {
            const status = getSlotStatusInfo(slot.startTime);
            const slotRes = dbReservations.filter(r => r.slot_time.startsWith(slot.startTime));

            return (
              <div key={slot.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-black text-blue-400">[{slot.startTime}]</span>
                    <span className="text-xs font-bold text-slate-300 ml-1.5">{slot.name}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${status.isFull ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {status.isFull ? '매진' : `잔여: ${status.remainingCourts}코트`}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {slotRes.map((res) => (
                    <div key={res.id} className="flex justify-between items-center bg-slate-900/60 px-2.5 py-2 rounded border border-slate-800/40 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-800 text-[10px] px-1.5 py-0.2 rounded text-slate-400 font-bold">{res.sport_name}</span>
                          <span className="font-medium text-slate-200">{res.user_name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMasterCancel(res.id)}
                        className="text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-0.5 rounded font-bold transition-all"
                      >
                        강제 취소
                      </button>
                    </div>
                  ))}
                  {slotRes.length === 0 && (
                    <p className="text-[10px] text-slate-600 text-center py-2">배정된 예약 원장이 없습니다.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}