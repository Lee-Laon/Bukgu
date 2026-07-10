'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRawUserInfo, hashPassword } from './utils/crypto'; // 🎯 hashPassword 유틸 추가

import BookingTab from '@/app/components/BookingTab';
import DashboardTab from '@/app/components/DashboardTab';
import CheckTab from '@/app/components/CheckTab';
import MapSection from '@/app/components/MapSection';

export interface SlotStatusResult {
  allocatedCourts: number;
  remainingCourts: number;
  isFull: boolean;
  sportCount: number;
  activeSports: string[];
  isSportLimitReached: boolean;
  allowedSports?: string[];
}

export default function Home() {
  // 🎯 스플래시 인트로 화면 제어 상태
  const [isSplashing, setIsSplashing] = useState<boolean>(true);
  
  const [activeTab, setActiveTab] = useState<'booking' | 'check' | 'dashboard' | 'map'>('booking');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [maxDateStr, setMaxDateStr] = useState<string>(todayStr);
  const [dynamicTimeConfigs, setDynamicTimeConfigs] = useState<any[]>([]);
  const [globalSports, setGlobalSports] = useState<string[]>(['배드민턴', '피클볼', '농구']);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [dbReservations, setDbReservations] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // 예약 완료 모달 상태
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successDetails, setSuccessDetails] = useState<{
    name: string;
    sport: string;
    date: string;
    time: string;
    courtCount: number;
  } | null>(null);

  // 예약 취소 완료 모달 상태
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelDetails, setCancelDetails] = useState<{
    name: string;
    sport: string;
    date: string;
    time: string;
  } | null>(null);

  const [dateRange, setDateRange] = useState<Array<{ dateStr: string; dayNum: string; dayName: string }>>([]);

  // 앱 구동 시 1.8초 동안 스플래시 화면 노출 후 진입
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashing(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      arr.push({
        dateStr: `${yyyy}-${mm}-${dd}`,
        dayNum: String(d.getDate()),
        dayName: days[d.getDay()]
      });
    }
    setDateRange(arr);
  }, []);

  useEffect(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateObj = new Date(selectedDate);
    const calculatedDay = days[dateObj.getDay()];
    setDayOfWeek(calculatedDay);
    setSelectedSlot(null);
    fetchReservations(selectedDate);
    fetchTimeConfigs(calculatedDay); 
  }, [selectedDate]);

  const fetchTimeConfigs = async (day: string) => {
    const { data } = await supabase
      .from('time_configs')
      .select('*')
      .eq('day_of_week', day) 
      .order('start_time', { ascending: true });
    if (data) setDynamicTimeConfigs(data);
  };

  const fetchMasterSports = async () => {
    const { data } = await supabase
      .from('sports_master')
      .select('sport_name')
      .order('id', { ascending: true });
    if (data) setGlobalSports(data.map(d => d.sport_name));
  };

  useEffect(() => {
    fetchMasterSports(); 
    const loadBookingLimit = async () => {
      const { data, error } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'max_booking_days')
        .single();

      if (data && !error) {
        const limitDays = parseInt(data.value, 10);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + limitDays);
        const yyyy = maxDate.getFullYear();
        const mm = String(maxDate.getMonth() + 1).padStart(2, '0');
        const dd = String(maxDate.getDate()).padStart(2, '0');
        setMaxDateStr(`${yyyy}-${mm}-${dd}`);
      }
    };
    loadBookingLimit();
  }, []);

  const fetchReservations = async (date: string) => {
    const { data } = await supabase.from('reservations').select('*').eq('reservation_date', date).order('slot_time', { ascending: true });
    if (data) setDbReservations(data);
  };

  const getTimeLockStatus = (slotStartTime: string) => {
    if (selectedDate !== todayStr) return 'none' as const;
    const currentTotal = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [sH, sM] = slotStartTime.split(':').map(Number);
    const slotTotal = sH * 60 + sM;
    if (currentTotal > slotTotal) return 'past' as const;
    if (slotTotal - currentTotal <= 5) return 'imminent' as const;
    return 'none' as const;
  };

  const getSlotStatusInfo = (slotId: string, startTime: string): SlotStatusResult => {
    const slotReservations = dbReservations.filter((res) => res.slot_time.startsWith(startTime));
    const allocatedCourts = slotReservations.reduce((sum, res) => {
      const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      const val = match ? parseFloat(match[2]) : 1;
      return sum + val;
    }, 0);
    const activeSports = Array.from(new Set(slotReservations.map((res) => res.sport_name as string)));
    const currentSlotConfig = dynamicTimeConfigs.find(s => s.start_time === startTime);
    const maxCourts = currentSlotConfig ? parseFloat(currentSlotConfig.max_courts) : 3; 

    return {
      allocatedCourts,
      remainingCourts: maxCourts - allocatedCourts,
      isFull: allocatedCourts >= maxCourts,
      sportCount: activeSports.length,
      activeSports,
      isSportLimitReached: activeSports.length >= 2,
      allowedSports: currentSlotConfig ? currentSlotConfig.allowed_sports : undefined
    };
  };

  const handleStrictSearch = async (type: 'name' | 'phone', value: string) => {
    try {
      const cleanValue = value.trim();
      if (!cleanValue) { alert('검색어를 입력해 주세요.'); return; }
      let query = supabase.from('reservations').select('*').like('user_name', `%${cleanValue}%`);
      const { data, error } = await query;
      if (error) throw error;
      setMyReservations(data || []);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
    }
  };

  // 🎯 [보안 고도화] 예약 취소 시 단방향 해시 암호 검증 연동
  const handleUserCancel = async (id: number, inputPass: string): Promise<boolean> => {
    const target = myReservations.find(res => res.id === id);
    if (!target) return false;
    
    const { password } = parseRawUserInfo(target.user_name);
    const name = target.user_name.split(' (')[0];
    
    // 사용자가 취소 창에 입력한 비밀번호 4자리를 똑같이 SHA-256 해시로 변환
    const hashedInput = await hashPassword(inputPass);
    
    // DB의 해시 코드와 입력 값의 해시 코드를 대조 검증
    if (hashedInput !== password) { 
      alert('비밀번호가 일치하지 않습니다.'); 
      return false; 
    }
    
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    
    if (!error) {
      setCancelDetails({
        name: name,
        sport: target.sport_name,
        date: target.reservation_date,
        time: target.slot_time
      });
      setShowCancelModal(true);
      
      fetchReservations(selectedDate);
      handleStrictSearch('name', name);
      return true;
    } else {
      alert(`취소 실패: ${error.message}`);
      return false;
    }
  };

  // 🎯 [보안 고도화] 예약 신청 시 비밀번호 단방향 암호화 처리 후 DB 인서트
  const handleReservationSubmit = async (
    slot: any, 
    sport: string, 
    name: string, 
    phone: string, 
    pass: string, 
    headCount: number = 1, 
    courtCount: number = 1
  ): Promise<boolean> => {
    // 비밀번호 4자리를 DB에 넣기 직전에 SHA-256 비동기 암호화 수행
    const hashedPassword = await hashPassword(pass.trim());
    
    const combined = `${name.trim()} (${phone.trim()}) [${hashedPassword}] {${headCount}명/${courtCount}코트}`;
    const { error } = await supabase.from('reservations').insert([{ 
      user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slot.startTime 
    }]);
    
    if (!error) {
      setSuccessDetails({
        name: name.trim(),
        sport,
        date: selectedDate,
        time: slot.startTime,
        courtCount
      });
      setShowSuccessModal(true);
      return true;
    } else {
      alert(`예약 실패 사유: ${error.message}`);
      return false;
    }
  };

  const handleCloseSuccessModal = () => {
    triggerHaptic();
    setShowSuccessModal(false);
    setSuccessDetails(null);
    setSelectedSlot(null); 
    fetchReservations(selectedDate); 
  };

  const handleTabChange = (tab: 'booking' | 'check' | 'dashboard' | 'map') => {
    triggerHaptic();
    setActiveTab(tab);
  };

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => ({ id: c.id, name: c.slot_name, startTime: c.start_time, allowedSports: c.allowed_sports }));

  if (isSplashing) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-50 via-white to-blue-50 flex flex-col items-center justify-between py-24 px-6 select-none animate-fade-in">
        
        <div className="pt-4 opacity-0 animate-fade-in [animation-delay:200ms]">
          <span className="text-[9px] font-black tracking-widest text-blue-600/60 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full font-mono">
            WELCOMING YOU
          </span>
        </div>

        <div className="flex flex-col items-center justify-center space-y-6 transform scale-95 animate-fade-in [animation-delay:100ms] w-full max-w-[280px]">
          <div className="w-full px-4">
            <img 
              src="/logo.png" 
              alt="운암복합문화체육센터 로고" 
              className="w-full h-auto object-contain mx-auto"
            />
          </div>

          <div className="space-y-1 text-center">
            <p className="text-[10px] font-extrabold text-blue-600/80 tracking-widest font-mono uppercase">
              Sports Reservation System
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-center space-y-4 w-full max-w-[200px]">
          <div className="h-[2px] w-[120px] bg-slate-200/80 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full w-0 animate-[loading_1.5s_ease-in-out_infinite]"></div>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-[10px] font-bold text-slate-500 tracking-normal">
              주민의 건강한 일상과 함께합니다
            </p>
            <p className="text-[8px] font-extrabold text-slate-400/80 tracking-wider font-mono uppercase">
              Unam Sports Center Infrastructure
            </p>
          </div>
        </div>

        <style jsx global>{`
          @keyframes loading {
            0% { width: 0%; min-width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full font-sans antialiased flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-[#17171c]' : 'bg-slate-100'}`}>
      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-32 flex flex-col">
        
        {activeTab !== 'map' && (
          <div className="w-full mt-4 space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">조회 일정 선택</label>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${isDarkMode ? 'bg-[#22222a] text-blue-400 border-slate-800' : 'bg-white text-blue-600 border-slate-200/40'}`}>
                {selectedDate.split('-')[1]}월 {selectedDate.split('-')[2]}일 ({dayOfWeek})
              </span>
            </div>
            
            <div className="w-full overflow-x-auto flex gap-2 pb-1 no-scrollbar scroll-smooth">
              {dateRange.map((item) => {
                const isSelected = selectedDate === item.dateStr;
                const isSunday = item.dayName === '일';
                const isSaturday = item.dayName === '토';
                
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => { triggerHaptic(); setSelectedDate(item.dateStr); }}
                    className={`flex-shrink-0 w-[52px] py-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-95 shadow-sm ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white font-black scale-[1.02] ring-4 ring-blue-600/10'
                        : isDarkMode
                          ? 'bg-[#22222a] border-slate-800/80 text-slate-300 hover:bg-slate-800/40'
                          : 'bg-white border-slate-200/60 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-[10px] font-extrabold ${
                      isSelected 
                        ? 'text-blue-100' 
                        : isSunday ? 'text-rose-500' : isSaturday ? 'text-blue-500' : 'text-slate-400'
                    }`}>
                      {item.dayName}
                    </span>
                    <span className="text-xs font-mono font-black tracking-tight">
                      {item.dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full flex-1 transition-all duration-300 ease-out transform animate-fade-in mt-2">
          {activeTab === 'booking' && (
            <div className="transition-opacity duration-300 opacity-100">
              <BookingTab 
                timeSlots={adaptedTimeSlots} 
                sports={globalSports} 
                getTimeLockStatus={getTimeLockStatus} 
                getSlotStatusInfo={getSlotStatusInfo} 
                onReservationSubmit={handleReservationSubmit} 
                selectedSlot={selectedSlot} 
                setSelectedSlot={setSelectedSlot} 
                isDarkMode={isDarkMode} 
              />
            </div>
          )}
          {activeTab === 'dashboard' && (
            <div className="transition-opacity duration-300 opacity-100">
              <DashboardTab selectedDate={selectedDate} dayOfWeek={dayOfWeek} timeSlots={adaptedTimeSlots} weekdayRules={{}} dbReservations={dbReservations} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onSlotClick={(slot) => { triggerHaptic(); setSelectedSlot(slot); setActiveTab('booking'); }} sports={globalSports} isDarkMode={isDarkMode} />
            </div>
          )}
          {activeTab === 'check' && (
            <div className="transition-opacity duration-300 opacity-100">
              <CheckTab 
                myReservations={myReservations} 
                hasSearched={hasSearched} 
                onSearch={async (t, v) => { triggerHaptic(); await handleStrictSearch(t, v); }} 
                onCancel={async (id, pass) => { triggerHaptic(); return await handleUserCancel(id, pass); }} 
                isDarkMode={isDarkMode} 
              />
            </div>
          )}
          {activeTab === 'map' && (
            <div className="transition-opacity duration-300 opacity-100">
              <MapSection isDarkMode={isDarkMode} />
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-20 right-4 z-40 max-w-md w-full flex flex-col items-end gap-2.5 px-4 pointer-events-none">
        <button type="button" onClick={() => { triggerHaptic(); setIsDarkMode(!isDarkMode); }} className="pointer-events-auto w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-lg bg-blue-600 text-white hover:scale-105 active:scale-95 transition-all">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t pb-safe shadow-lg backdrop-blur-lg ${isDarkMode ? 'bg-[#17171c]/95 border-slate-800' : 'bg-white/95 border-slate-200/50'}`}>
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <button onClick={() => handleTabChange('dashboard')} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all duration-100">
            <span className={`text-[17px] ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📋</span>
            <span className={`text-[10px] font-bold ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-slate-400'}`}>지금 현황</span>
          </button>
          <button onClick={() => handleTabChange('booking')} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all duration-100">
            <span className={`text-[17px] ${activeTab === 'booking' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📅</span>
            <span className={`text-[10px] font-bold ${activeTab === 'booking' ? 'text-blue-500' : 'text-slate-400'}`}>예약하기</span>
          </button>
          <button onClick={() => handleTabChange('check')} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all duration-100">
            <span className={`text-[17px] ${activeTab === 'check' ? 'opacity-100' : 'opacity-40 grayscale'}`}>🔍</span>
            <span className={`text-[10px] font-bold ${activeTab === 'check' ? 'text-blue-500' : 'text-slate-400'}`}>내 예약</span>
          </button>
          <button onClick={() => handleTabChange('map')} className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all duration-100">
            <span className={`text-[17px] ${activeTab === 'map' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📍</span>
            <span className={`text-[10px] font-bold ${activeTab === 'map' ? 'text-blue-500' : 'text-slate-400'}`}>오시는 길</span>
          </button>
        </div>
      </nav>

      {/* [예약 완료 카드 모달창] */}
      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center transform scale-100 border transition-colors ${
            isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <h3 className="text-base font-black tracking-tight mb-1">대관 예약 신청 완료</h3>
            <p className="text-xs text-slate-400 font-semibold mb-4">예약이 정상적으로 데이터베이스에 등록되었습니다.</p>
            <div className={`rounded-2xl p-4 text-left text-xs font-bold space-y-2 mb-5 ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
              <div className="flex justify-between"><span className="text-slate-400">대표 신청자</span><span>{successDetails.name} 님</span></div>
              <div className="flex justify-between"><span className="text-slate-400">선택 종목</span><span className="text-blue-500 font-black">{successDetails.sport}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">이용 일정</span><span>{successDetails.date} ({successDetails.time})</span></div>
              <div className="flex justify-between"><span className="text-slate-400">배정 코트수</span><span>{successDetails.courtCount}코트</span></div>
            </div>
            <button type="button" onClick={handleCloseSuccessModal} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md active:scale-98 transition-all">
              확인 및 메인으로 이동
            </button>
          </div>
        </div>
      )}

      {/* [예약 취소 완료 전용 카드 모달창 UI] */}
      {showCancelModal && cancelDetails && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center transform scale-100 border transition-colors ${
            isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-rose-600 dark:text-rose-400">✕</span>
            </div>
            <h3 className="text-base font-black tracking-tight mb-1">예약 취소 완료</h3>
            <p className="text-xs text-slate-400 font-semibold mb-4">신청하신 대관 예약이 정상적으로 삭제되었습니다.</p>
            <div className={`rounded-2xl p-4 text-left text-xs font-bold space-y-2 mb-5 ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
              <div className="flex justify-between"><span className="text-slate-400">기존 예약자</span><span>{cancelDetails.name} 님</span></div>
              <div className="flex justify-between"><span className="text-slate-400">취소 종목</span><span className="text-rose-500 font-black">{cancelDetails.sport}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">대관 일자</span><span>{cancelDetails.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">대관 시간</span><span>{cancelDetails.time}</span></div>
            </div>
            <button
              type="button"
              onClick={() => { triggerHaptic(); setShowCancelModal(false); setCancelDetails(null); }}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md active:scale-98 transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}