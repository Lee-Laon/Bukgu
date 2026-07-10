'use client';

// 🎯 [오류 해결] 부모(page.tsx)가 내려주는 sports 속성을 수용하도록 인터페이스 규격을 완벽히 정돈했습니다.
interface AdminDashboardTabProps {
  dbReservations: any[];
  analysisPeriod: 'day' | 'week' | 'month';
  setAnalysisPeriod: (period: 'day' | 'week' | 'month') => void;
  sports: string[]; // 👈 부모가 전달하는 최신 마스터 종목 명단 배열 수용
}

export default function AdminDashboardTab({
  dbReservations,
  analysisPeriod,
  setAnalysisPeriod,
  sports, // 👈 구조분해 할당 파라미터로 명확히 주입 완료
}: AdminDashboardTabProps) {
  
  // 📈 1. 실시간 총 예약 건수 및 코트 점유 총량 산출 로직
  const totalReservations = dbReservations.length;
  
  const totalCourtsAllocated = dbReservations.reduce((sum, res) => {
    const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
    return sum + (match ? parseFloat(match[2]) : 1);
  }, 0);

  // 🎯 [동적 리팩토링 핵심] 하드코딩 종목 대신, 마스터 보드에서 주입된 sports 배열을 기반으로 실시간 분포도 연산
  const sportsDistribution = sports.map((sportName) => {
    // 해당 종목의 예약 건수 필터링
    const targetReservations = dbReservations.filter((res) => res.sport_name === sportName);
    const count = targetReservations.length;

    // 해당 종목이 점유한 총 코트 수 합산
    const courts = targetReservations.reduce((sum, res) => {
      const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      return sum + (match ? parseFloat(match[2]) : 1);
    }, 0);

    // 백분율 비율 계산 (분모 가드 적용)
    const percentage = totalReservations > 0 ? Math.round((count / totalReservations) * 100) : 0;

    return {
      name: sportName,
      count,
      courts,
      percentage,
    };
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* ⏱️ 상단 분석 주기 제어 패널 */}
      <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-md">
        <span className="text-xs font-bold text-slate-400">이용 현황 분석 주기:</span>
        <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['day', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setAnalysisPeriod(period)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                analysisPeriod === period ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {period === 'day' ? '일간' : period === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </div>

      {/* 💳 총량 지표 요약 카드 섹션 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Booking</p>
          <p className="text-2xl font-black text-white font-mono">{totalReservations}<span className="text-xs font-bold text-slate-500 ml-1">건</span></p>
          <p className="text-[10px] text-slate-500">총 접수된 예약 개수</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Court Utilization</p>
          <p className="text-2xl font-black text-emerald-400 font-mono">{totalCourtsAllocated}<span className="text-xs font-bold text-slate-500 ml-1">코트</span></p>
          <p className="text-[10px] text-slate-500">총 대관 코트</p>
        </div>
      </div>

      {/* 📊 종목별 점유 분포 현황 분석 판넬 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-3">
        <p className="text-xs font-bold text-slate-400">실시간 종목별 점유 분포 및 이용 현황</p>
        
        <div className="space-y-3">
          {sportsDistribution.map((item) => (
            <div key={item.name} className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span className="font-extrabold text-slate-200">{item.name}</span>
                </div>
                <div className="font-mono text-slate-400">
                  <span className="text-blue-400 font-bold">{item.count}건</span> / {item.courts}코트 점유 ({item.percentage}%)
                </div>
              </div>
              
              {/* 시각화 프로그레스 바 차트 레이어 */}
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}

          {sportsDistribution.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">마스터 보드에 등록된 운동 종목이 없습니다.</p>
          )}
        </div>
      </div>

    </div>
  );
}