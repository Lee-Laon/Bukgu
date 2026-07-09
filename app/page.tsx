'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRawUserInfo } from './utils/crypto';

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
  const [activeTab, setActiveTab] = useState<'booking' | 'check' | 'dashboard' | 'map'>('booking');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  const getTodayDayOfWeek = () => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date().getDay()];
  };
  const [dayOfWeek, setDayOfWeek] = useState<string>(getTodayDayOfWeek());
  
  const [maxDateStr, setMaxDateStr] = useState<string>(todayStr);
  const [dynamicTimeConfigs, setDynamicTimeConfigs] = useState<any[]>([]);
  const [globalSports, setGlobalSports] = useState<string[]>(['배드민턴', '피클볼', '농구']);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [dbReservations, setDbReservations] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [resultMessage, setResultMessage] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateObj = new Date(selectedDate);
    const calculatedDay = days[dateObj.getDay()];
    setDayOfWeek(calculatedDay);
    setSelectedSlot(null);
    setResultMessage(null);
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
    return () => {};
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

  const handleUserCancel = async (id: number, inputPass: string) => {
    const target = myReservations.find(res => res.id === id);
    if (!target) return false;
    const { password } = parseRawUserInfo(target.user_name);
    const name = target.user_name.split(' (')[0];
    if (inputPass !== password) { alert('비밀번호가 일치하지 않습니다.'); return false; }
    await supabase.from('reservations').delete().eq('id', id);
    alert('예약이 정상 취소되었습니다.');
    fetchReservations(selectedDate);
    handleStrictSearch('name', name);
    return true;
  };

  const handleReservationSubmit = async (slot: any, sport: string, name: string, phone: string, pass: string, headCount: number = 1, courtCount: number = 1) => {
    const combined = `${name.trim()} (${phone.trim()}) [${pass.trim()}] {${headCount}명/${courtCount}코트}`;
    const { error } = await supabase.from('reservations').insert([{ 
      user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slot.startTime 
    }]);
    if (!error) {
      setResultMessage({ success: true, message: '🎉 예약이 성공적으로 등록되었습니다!' });
      setTimeout(() => { fetchReservations(selectedDate); }, 200);
    }
  };

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => ({ id: c.id, name: c.slot_name, startTime: c.start_time, allowedSports: c.allowed_sports }));
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSelectedDate(e.target.value); };

  return (
    <div className={`min-h-screen w-full font-sans antialiased flex flex-col ${isDarkMode ? 'bg-[#17171c]' : 'bg-slate-100'}`}>
      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-32 flex flex-col">
        {activeTab !== 'map' && (
          <div className="w-full mt-3">
            <div className={`flex flex-col gap-1.5 p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200/60'}`}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">조회 기준일 선택</label>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${isDarkMode ? 'bg-blue-950/40 text-blue-400 border-blue-900' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{dayOfWeek}요일</span>
              </div>
              <input type="date" value={selectedDate} min={todayStr} max={maxDateStr} onChange={handleDateChange} className={`w-full text-xs font-bold focus:outline-none bg-transparent ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`} />
            </div>
          </div>
        )}

        <div className="w-full flex-1">
          {activeTab === 'booking' && <BookingTab timeSlots={adaptedTimeSlots} sports={globalSports} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onReservationSubmit={handleReservationSubmit} resultMessage={resultMessage} setResultMessage={setResultMessage} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} isDarkMode={isDarkMode} />}
          {activeTab === 'dashboard' && <DashboardTab selectedDate={selectedDate} dayOfWeek={dayOfWeek} timeSlots={adaptedTimeSlots} weekdayRules={{}} dbReservations={dbReservations} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onSlotClick={(slot) => { setSelectedSlot(slot); setActiveTab('booking'); }} sports={globalSports} isDarkMode={isDarkMode} />}
          {activeTab === 'check' && <CheckTab myReservations={myReservations} hasSearched={hasSearched} onSearch={handleStrictSearch} onCancel={handleUserCancel} isDarkMode={isDarkMode} />}
          {activeTab === 'map' && <MapSection isDarkMode={isDarkMode} />}
        </div>
      </main>

      {/* 📱 플로팅 테마 전환 버튼만 유지 (말썽 부리던 챗봇 말풍선/버튼 완전 영구 제거) */}
      <div className="fixed bottom-20 right-4 z-40 max-w-md w-full flex flex-col items-end gap-2.5 px-4 pointer-events-none">
        <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="pointer-events-auto w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-lg bg-blue-600 text-white hover:scale-105 active:scale-[0.95] transition-all">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* 하단 네비게이션 바 */}
      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t pb-safe shadow-lg backdrop-blur-lg ${isDarkMode ? 'bg-[#17171c]/95 border-slate-800' : 'bg-white/95 border-slate-200/50'}`}>
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <button onClick={() => setActiveTab('dashboard')} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className={`text-[17px] ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📋</span>
            <span className={`text-[10px] font-bold ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-slate-400'}`}>지금 현황</span>
          </button>
          <button onClick={() => setActiveTab('booking')} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className={`text-[17px] ${activeTab === 'booking' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📅</span>
            <span className={`text-[10px] font-bold ${activeTab === 'booking' ? 'text-blue-500' : 'text-slate-400'}`}>예약하기</span>
          </button>
          <button onClick={() => setActiveTab('check')} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className={`text-[17px] ${activeTab === 'check' ? 'opacity-100' : 'opacity-40 grayscale'}`}>🔍</span>
            <span className={`text-[10px] font-bold ${activeTab === 'check' ? 'text-blue-500' : 'text-slate-400'}`}>내 예약</span>
          </button>
          <button onClick={() => setActiveTab('map')} className="flex-1 flex flex-col items-center justify-center gap-1">
            <span className={`text-[17px] ${activeTab === 'map' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📍</span>
            <span className={`text-[10px] font-bold ${activeTab === 'map' ? 'text-blue-500' : 'text-slate-400'}`}>오시는 길</span>
          </button>
        </div>
      </nav>
    </div>
  );
}