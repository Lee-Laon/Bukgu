'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 🎯 분할된 3대 핵심 탭 컴포넌트 임포트
import AdminReservationTab from './components/AdminReservationTab';
import AdminDashboardTab from './components/AdminDashboardTab';
import AdminSettingTab from './components/AdminSettingTab';

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<'reservation' | 'dashboard' | 'setting'>('reservation');
  const [analysisPeriod, setAnalysisPeriod] = useState<'day' | 'week' | 'month'>('day');

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [dayOfWeek, setDayOfWeek] = useState<string>('화');
  const [dbReservations, setDbReservations] = useState<any[]>([]);
  const [dynamicTimeConfigs, setDynamicTimeConfigs] = useState<any[]>([]);
  const [blockingRules, setBlockingRules] = useState<any[]>([]);

  // 🎯 [신규] 관리자 백오피스 전체에서 공유할 운동 종목 마스터 상태
  const [globalSports, setGlobalSports] = useState<string[]>(['배드민턴', '피클볼', '농구']);

  // 헬퍼: 날짜 좌우 이동 버튼용
  const handleNavigateDate = (daysToMove: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + daysToMove);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const fetchReservations = async (date: string) => {
    const { data } = await supabase.from('reservations').select('*').eq('reservation_date', date).order('slot_time', { ascending: true });
    if (data) setDbReservations(data);
  };

  const fetchTimeConfigs = async (day: string) => {
    const { data } = await supabase.from('time_configs').select('*').eq('day_of_week', day).order('start_time', { ascending: true });
    if (data) setDynamicTimeConfigs(data);
  };

  const fetchBlockingRules = async () => {
    const { data } = await supabase.from('blocking_rules').select('*').order('start_date', { ascending: true });
    if (data) setBlockingRules(data);
  };

  // 🎯 [신규 함수] DB에서 실시간 전역 운영 종목 명단 패치
  const fetchMasterSports = async () => {
    const { data } = await supabase.from('sports_master').select('sport_name').order('id', { ascending: true });
    if (data) {
      setGlobalSports(data.map(d => d.sport_name));
    }
  };

  // 🎯 Supabase 양방향 실시간 웹소켓 통합 관제 파이프라인
  useEffect(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateObj = new Date(selectedDate);
    const calculatedDay = days[dateObj.getDay()];
    setDayOfWeek(calculatedDay);

    fetchReservations(selectedDate);
    fetchTimeConfigs(calculatedDay);
    fetchBlockingRules();
    fetchMasterSports(); // 🎯 규칙 최초 로드 시 마스터 종목 동시 패치

    const channelRes = supabase.channel('admin-res-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `reservation_date=eq.${selectedDate}` }, () => { fetchReservations(selectedDate); })
      .subscribe();

    const channelConfig = supabase.channel('admin-config-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_configs' }, () => { fetchTimeConfigs(dayOfWeek); })
      .subscribe();

    const channelBlocking = supabase.channel('admin-blocking-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocking_rules' }, () => { fetchBlockingRules(); })
      .subscribe();

    // 🔄 [신규] 종목 마스터 보드 변동 건에 대한 실시간 웹소켓 구독 감지 추가
    const channelSports = supabase.channel('admin-sports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_master' }, () => { fetchMasterSports(); })
      .subscribe();

    const backupTimer = setInterval(() => { 
      fetchReservations(selectedDate); 
      fetchBlockingRules();
    }, 5000);

    return () => {
      supabase.removeChannel(channelRes);
      supabase.removeChannel(channelConfig);
      supabase.removeChannel(channelBlocking);
      supabase.removeChannel(channelSports); // 🔄 채널 해제 규칙 추가
      clearInterval(backupTimer);
    };
  }, [selectedDate, dayOfWeek]);

  // 공사 기간 차단 규칙 판별 가드
  const activeBlockingRule = blockingRules.find(rule => {
    return selectedDate >= rule.start_date && selectedDate <= rule.end_date;
  });

  const getSlotStatusInfo = (startTime: string) => {
    if (activeBlockingRule) {
      return { allocatedCourts: 0, remainingCourts: 0, isFull: true, activeSports: [], isSportLimitReached: true, allowedSports: [] };
    }
    const slotReservations = dbReservations.filter((res) => res.slot_time.startsWith(startTime));
    const allocatedCourts = slotReservations.reduce((sum, res) => {
      const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      return sum + (match ? parseFloat(match[2]) : 1);
    }, 0);

    const activeSports = Array.from(new Set(slotReservations.map((res) => res.sport_name)));
    const currentSlotConfig = dynamicTimeConfigs.find(s => s.start_time === startTime);
    const maxCourts = currentSlotConfig ? parseFloat(currentSlotConfig.max_courts) : 3; 

    return {
      allocatedCourts, remainingCourts: maxCourts - allocatedCourts, isFull: allocatedCourts >= maxCourts, activeSports, isSportLimitReached: activeSports.length >= 2, allowedSports: currentSlotConfig ? currentSlotConfig.allowed_sports : undefined
    };
  };

  const handleAdminReservationSubmit = async (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number, courtCount: number) => {
    if (activeBlockingRule) { alert(`🛑 [${activeBlockingRule.reason}]로 차단된 통제 기간입니다.`); return; }
    const slotKey = slot.start_time || slot.startTime;
    const { isFull, remainingCourts } = getSlotStatusInfo(slotKey);
    if (isFull || courtCount > remainingCourts) { alert(`❌ 코트 부족`); return; }
    
    const combined = `${name.trim()} (${phone.trim()}) [${pass.trim()}] {${headCount}명/${courtCount}코트}`;
    await supabase.from('reservations').insert([{ user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slotKey }]);
    fetchReservations(selectedDate);
  };

  const handleMasterCancel = async (id: number) => {
    if (!confirm('강제 취소하시겠습니까?')) return;
    await supabase.from('reservations').delete().eq('id', id);
    fetchReservations(selectedDate);
  };

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => ({
    id: c.id, name: c.slot_name, startTime: c.start_time, allowedSports: c.allowed_sports
  }));

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-2xl w-full space-y-5">
        
        {/* 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-200">🏛️ 운암복합문화체육센터 백오피스</h1>
            <p className="text-[11px] text-slate-500 font-medium">실시간 현황 관측일: {selectedDate} ({dayOfWeek})</p>
          </div>
          <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full font-bold border border-red-500/30">데스크 마스터</span>
        </div>

        {/* 🛠️ 메인 탭 전환 메뉴 바 */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button onClick={() => setAdminTab('reservation')} className={`py-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${adminTab === 'reservation' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
            <span>📅 예약 관련 탭</span><span className="text-[9px] opacity-60 font-medium">(접수 / 예약자 관리)</span>
          </button>
          <button onClick={() => setAdminTab('dashboard')} className={`py-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${adminTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
            <span>📊 대시보드 탭</span><span className="text-[9px] opacity-60 font-medium">(이용건수 / 종목별 분석)</span>
          </button>
          <button onClick={() => setAdminTab('setting')} className={`py-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${adminTab === 'setting' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
            <span>⚙️ 시설 설정 탭</span><span className="text-[9px] opacity-60 font-medium">(시간대 변동 / 공사 설정)</span>
          </button>
        </div>

        {/* 🔀 선택된 탭에 따라 하위 컴포넌트로 데이터 위임 배포 */}
        {adminTab === 'reservation' && (
          <AdminReservationTab
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            handleNavigateDate={handleNavigateDate}
            activeBlockingRule={activeBlockingRule}
            adaptedTimeSlots={adaptedTimeSlots}
            getSlotStatusInfo={getSlotStatusInfo}
            handleAdminReservationSubmit={handleAdminReservationSubmit}
            dbReservations={dbReservations}
            handleMasterCancel={handleMasterCancel}
          />
        )}

        {adminTab === 'dashboard' && (
          <AdminDashboardTab
            dbReservations={dbReservations}
            analysisPeriod={analysisPeriod}
            setAnalysisPeriod={setAnalysisPeriod}
            sports={globalSports} // 🎯 [연동 조준 완동] 하드코딩 배열을 대체하여 실시간 동적 종목을 배포합니다!
          />
        )}

        {adminTab === 'setting' && (
          <AdminSettingTab
            dayOfWeek={dayOfWeek}
            dynamicTimeConfigs={dynamicTimeConfigs}
            blockingRules={blockingRules}
            fetchTimeConfigs={fetchTimeConfigs}
            fetchBlockingRules={fetchBlockingRules}
            selectedDate={selectedDate}
            fetchReservations={fetchReservations}
            setSelectedDate={setSelectedDate}
          />
        )}

      </div>
    </main>
  );
}