'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 🎯 분할된 3대 핵심 탭 컴포넌트 임포트
import AdminReservationTab from './components/AdminReservationTab';
import AdminDashboardTab from './components/AdminDashboardTab';
import AdminSettingTab from './components/AdminSettingTab';

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<'reservation' | 'dashboard' | 'setting'>('reservation');

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

  // 🎯 관리자 백오피스 전체에서 공유할 운동 종목 마스터 상태
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

  // 🎯 DB에서 실시간 전역 운영 종목 명단 패치
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
    fetchMasterSports(); 

    const channelRes = supabase.channel('admin-res-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `reservation_date=eq.${selectedDate}` }, () => { fetchReservations(selectedDate); })
      .subscribe();

    const channelConfig = supabase.channel('admin-config-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_configs' }, () => { fetchTimeConfigs(dayOfWeek); })
      .subscribe();

    const channelBlocking = supabase.channel('admin-blocking-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocking_rules' }, () => { fetchBlockingRules(); })
      .subscribe();

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
      supabase.removeChannel(channelSports); 
      clearInterval(backupTimer);
    };
  }, [selectedDate, dayOfWeek]);

  // 공사 기간 차단 규칙 판별 가드
  const activeBlockingRule = blockingRules.find(rule => {
    return selectedDate >= rule.start_date && selectedDate <= rule.end_date;
  });

  /**
   * 🎯 [운영 로직 엔진 통합] 이용자 페이지와 100% 싱크로율을 이루는 상호 배제 필터링 시스템
   */
  const getSlotStatusInfo = (startTime: string) => {
    if (activeBlockingRule) {
      return { allocatedCourts: 0, remainingCourts: 0, isFull: true, activeSports: [], isSportLimitReached: true, allowedSports: [] };
    }
    const slotReservations = dbReservations.filter((res) => res.slot_time.startsWith(startTime));
    const allocatedCourts = slotReservations.reduce((sum, res) => {
      const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      return sum + (match ? parseFloat(match[2]) : 1);
    }, 0);

    // 현재 타임슬롯에 이미 차 있는 고유 종목 배열 스캔
    const activeSports = Array.from(new Set(slotReservations.map((res) => res.sport_name as string)));
    const currentSlotConfig = dynamicTimeConfigs.find(s => s.start_time === startTime);
    const maxCourts = currentSlotConfig ? parseFloat(currentSlotConfig.max_courts) : 3; 

    // 기본 가용 종목 리스트 셋업
    let allowedSports = currentSlotConfig?.allowed_sports 
      ? currentSlotConfig.allowed_sports 
      : ['배드민턴', '피클볼', '농구'];

    // 🔥 [CASE 1 공식 연동] 이미 2가지 이상의 종목이 코트를 차지하고 있다면 제3의 종목 전면 거부
    if (activeSports.length >= 2) {
      allowedSports = allowedSports.filter((sport: string) => activeSports.includes(sport));
    }

    return {
      allocatedCourts, 
      remainingCourts: maxCourts - allocatedCourts, 
      isFull: allocatedCourts >= maxCourts, 
      activeSports, 
      isSportLimitReached: activeSports.length >= 2, 
      allowedSports
    };
  };

  const handleAdminReservationSubmit = async (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number, courtCount: number) => {
    if (activeBlockingRule) { alert(`🛑 [${activeBlockingRule.reason}]로 차단된 통제 기간입니다.`); return; }
    const slotKey = slot.start_time || slot.startTime;
    const { isFull, remainingCourts } = getSlotStatusInfo(slotKey);
    if (isFull || courtCount > remainingCourts) { alert(`❌ 코트 부족`); return; }
    
    // 🎯 비밀번호 항목이 비어있으면 불필요한 해시 괄호 없이 깔끔한 유저 이름 생성
    const combined = pass && pass.trim() 
      ? `${name.trim()} (${phone.trim()}) [${pass.trim()}] {${headCount}명/${courtCount}코트}`
      : `${name.trim()} (${phone.trim()}) {${headCount}명/${courtCount}코트}`;

    await supabase.from('reservations').insert([{ user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slotKey }]);
    fetchReservations(selectedDate);
  };

  const handleMasterCancel = async (id: number) => {
    if (!confirm('강제 취소하시겠습니까?')) return;
    await supabase.from('reservations').delete().eq('id', id);
    fetchReservations(selectedDate);
  };

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => {
    const statusInfo = getSlotStatusInfo(c.start_time);
    return {
      id: c.id, 
      name: c.slot_name, 
      startTime: c.start_time, 
      allowedSports: statusInfo.allowedSports // 필터링 공식이 주입된 정제 배열 위임
    };
  });

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-white transition-colors duration-500">
      <div className="max-w-2xl w-full space-y-5">
        
        {/* 헤더 */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-200 tracking-tight">운암복합문화체육센터 관리자 페이지</h1>
            <p className="text-[11px] text-slate-500 font-semibold font-mono">현재 통제 가동일: {selectedDate} ({dayOfWeek}요일)</p>
          </div>
          <span className="bg-red-500/10 text-red-400 text-xs px-3 py-1 rounded-full font-black border border-red-500/20 shadow-sm">ADMIN SYSTEM</span>
        </div>

        {/* 🛠️ 메인 탭 전환 메뉴 바 */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button onClick={() => setAdminTab('reservation')} className={`py-2.5 rounded-lg text-xs font-black transition-all duration-300 transform active:scale-98 flex flex-col items-center gap-1 ${adminTab === 'reservation' ? 'bg-blue-600 text-white shadow-lg scale-[1.01]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
            <span>📅 예약 정보</span><span className="text-[9px] opacity-60 font-medium">(예약자 관리)</span>
          </button>
          <button onClick={() => setAdminTab('dashboard')} className={`py-2.5 rounded-lg text-xs font-black transition-all duration-300 transform active:scale-98 flex flex-col items-center gap-1 ${adminTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg scale-[1.01]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
            <span>📊 이용자 통계</span><span className="text-[9px] opacity-60 font-medium">(이용자수 / 종목별 분석)</span>
          </button>
          <button onClick={() => setAdminTab('setting')} className={`py-2.5 rounded-lg text-xs font-black transition-all duration-300 transform active:scale-98 flex flex-col items-center gap-1 ${adminTab === 'setting' ? 'bg-blue-600 text-white shadow-lg scale-[1.01]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
            <span>⚙️ 시설 관리</span><span className="text-[9px] opacity-60 font-medium">(운영시간 / 기간차단 설정)</span>
          </button>
        </div>

        {/* 🔀 탭 전환 서브 바인딩 매핑 플레이스 */}
        <div className="relative overflow-hidden w-full transition-all duration-300 ease-out">
          
          {/* 🎯 [바인딩 수리 완료] 시설 관리 탭의 전역 종목 명단(sports={globalSports}) 전달 */}
          {adminTab === 'reservation' && (
            <div className="animate-fade-in-up">
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
                sports={globalSports}
              />
            </div>
          )}

          {adminTab === 'dashboard' && (
            <div className="animate-fade-in-up">
              <AdminDashboardTab selectedDate={selectedDate} />
            </div>
          )}

          {adminTab === 'setting' && (
            <div className="animate-fade-in-up">
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
            </div>
          )}

        </div>

      </div>

      {/* 🎨 부드러운 애니메이션 효과용 CSS 주입 */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </main>
  );
}