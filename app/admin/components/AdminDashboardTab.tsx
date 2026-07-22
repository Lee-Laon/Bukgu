'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminDashboardTabProps {
  selectedDate: string; // 부모로부터 전달받은 기준 설정일 (YYYY-MM-DD)
}

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface StatsResult {
  totalReservations: number;
  totalHeadCount: number;
  courtUtilization: number;
  sportDistribution: { [key: string]: number };
  peakTimeSlots: { slot: string; count: number }[];
}

export default function AdminDashboardTab({ selectedDate }: AdminDashboardTabProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [period, setPeriod] = useState<PeriodType>('DAILY');
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 1. 기준일을 파싱하여 주간/월간 날짜 경계 범위를 계산하는 유틸리티
  const getDateRange = (dateStr: string, mode: PeriodType) => {
    const targetDate = new Date(dateStr);
    
    if (mode === 'DAILY') {
      return { start: dateStr, end: dateStr };
    }
    
    if (mode === 'WEEKLY') {
      // 일요일 기준 주의 시작일 계산
      const day = targetDate.getDay();
      const diffToSun = targetDate.getDate() - day;
      const sunDate = new Date(targetDate.setDate(diffToSun));
      
      const monDate = new Date(sunDate);
      monDate.setDate(sunDate.getDate() + 6); // 토요일까지
      
      const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { start: format(sunDate), end: format(monDate) };
    }
    
    if (mode === 'MONTHLY') {
      const yyyy = targetDate.getFullYear();
      const mm = targetDate.getMonth() + 1;
      const lastDay = new Date(yyyy, mm, 0).getDate();
      
      const padMM = String(mm).padStart(2, '0');
      return { 
        start: `${yyyy}-${padMM}-01`, 
        end: `${yyyy}-${padMM}-${String(lastDay).padStart(2, '0')}` 
      };
    }
    
    return { start: dateStr, end: dateStr };
  };

  // 2. 🎯 [연동 메커니즘 인프라 수리] 설정일과 탭 상태가 바뀔 때 연쇄 호출 처리
  const fetchDashboardStatsData = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    
    const { start, end } = getDateRange(selectedDate, period);

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('reservation_date', start)
      .lte('reservation_date', end)
      .order('reservation_date', { ascending: true });

    if (!error && data) {
      setAllReservations(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchDashboardStatsData();
  }, [selectedDate, period]);

  // 3. 수집된 로우 데이터 기반 가공 가전 엔진
  const calculateMetrics = (): StatsResult => {
    // 행정 통제 내역은 순수 주민 이용자 통계 지표 산출에서 제외
    const userRes = allReservations.filter(r => r.sport_name !== '행정 통제');
    
    let totalHeadCount = 0;
    const sportDistribution: { [key: string]: number } = {};
    const timeSlotCounter: { [key: string]: number } = {};

    userRes.forEach(r => {
      // 성명 분리 파싱 가드 구문
      const match = r.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      if (match) {
        totalHeadCount += parseInt(match[1], 10);
      } else {
        totalHeadCount += 1;
      }

      // 종목 매핑 분포 트래킹
      if (r.sport_name) {
        sportDistribution[r.sport_name] = (sportDistribution[r.sport_name] || 0) + 1;
      }

      // 피크 타임 슬롯 카운팅
      if (r.slot_time) {
        timeSlotCounter[r.slot_time] = (timeSlotCounter[r.slot_time] || 0) + 1;
      }
    });

    // 피크타임 정렬 매핑 변환
    const peakTimeSlots = Object.entries(timeSlotCounter)
      .map(([slot, count]) => ({ slot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 총 가동 코트 점유율 계산 (전역 모수 임시 상설 15코트 기준)
    const totalSlotsFetchedCount = userRes.length;
    const courtUtilization = totalSlotsFetchedCount > 0 ? Math.min(100, Math.round((totalSlotsFetchedCount / 45) * 100)) : 0;

    return {
      totalReservations: userRes.length,
      totalHeadCount,
      courtUtilization,
      sportDistribution,
      peakTimeSlots
    };
  };

  const metrics = calculateMetrics();
  const currentRange = getDateRange(selectedDate, period);

  if (!mounted) return null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 상단 탭 제어 스위치 인터페이스 */}
      <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="text-left">
          <p className="text-xs font-bold text-slate-400">이용자 대관 통계 모니터</p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            관측 범위: {currentRange.start} ~ {currentRange.end}
          </p>
        </div>
        <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as PeriodType[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPeriod(mode)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                period === mode 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'DAILY' ? '일간' : mode === 'WEEKLY' ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-slate-900/40 rounded-xl p-12 text-center text-xs text-slate-500 border border-dashed border-slate-800">
          통계 지표 연산 데이터 분석 중...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 지표 카드 1 */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl text-left">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">총 대관 건수</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-mono font-black text-blue-400">{metrics.totalReservations}</span>
              <span className="text-xs text-slate-400 font-bold">건</span>
            </div>
          </div>

          {/* 지표 카드 2 */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl text-left">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">총 이용 인원</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-mono font-black text-emerald-400">{metrics.totalHeadCount}</span>
              <span className="text-xs text-slate-400 font-bold">명</span>
            </div>
          </div>

          {/* 지표 카드 3 */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl text-left">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">시설 전체 사용률</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-mono font-black text-purple-400">{metrics.courtUtilization}</span>
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
          </div>
        </div>
      )}

      {/* 세부 분포 명세 보드 */}
      {!isLoading && metrics.totalReservations > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 종목별 대관 비율 */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-2 text-left">
            <p className="text-[11px] font-bold text-slate-400">인기 종목 대관 빈도 현황</p>
            <div className="space-y-1.5 pt-1">
              {Object.entries(metrics.sportDistribution).map(([sport, count]) => (
                <div key={sport} className="flex justify-between items-center text-xs bg-slate-950 px-2.5 py-2 rounded-lg border border-slate-800/40">
                  <span className="font-bold text-slate-300">{sport}</span>
                  <span className="font-mono font-extrabold text-blue-400">{count}건 등록</span>
                </div>
              ))}
            </div>
          </div>

          {/* 피크타임 슬롯 통계 */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-2 text-left">
            <p className="text-[11px] font-bold text-slate-400">대관 집중 피크 타임 Top 3</p>
            <div className="space-y-1.5 pt-1">
              {metrics.peakTimeSlots.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">집계된 데이터가 없습니다.</p>
              ) : (
                metrics.peakTimeSlots.map((item, idx) => (
                  <div key={item.slot} className="flex justify-between items-center text-xs bg-slate-950 px-2.5 py-2 rounded-lg border border-slate-800/40">
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-black text-purple-400 font-mono">0{idx + 1}</span>
                      <span className="font-mono font-bold text-slate-300">{item.slot}시 슬롯</span>
                    </div>
                    <span className="font-mono font-extrabold text-amber-500">{item.count}개 팀 매칭</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}