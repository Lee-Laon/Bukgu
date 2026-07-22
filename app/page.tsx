'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRawUserInfo, hashPassword } from './utils/crypto';

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
  const [dynamicTimeConfigs, setDynamicTimeConfigs] = useState<any[]>([]);
  const [globalSports, setGlobalSports] = useState<string[]>(['배드민턴', '피클볼', '농구']);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [dbReservations, setDbReservations] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  const [maxBookingDays, setMaxBookingDays] = useState<number>(30);
  const [blockingRules, setBlockingRules] = useState<any[]>([]);
  const [dateErrorMessage, setDateErrorMessage] = useState<string>('');

  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successDetails, setSuccessDetails] = useState<{
    name: string;
    sport: string;
    date: string;
    time: string;
    courtCount: number;
  } | null>(null);

  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelDetails, setCancelDetails] = useState<{
    name: string;
    sport: string;
    date: string;
    time: string;
  } | null>(null);

  const [dateRange, setDateRange] = useState<Array<{ dateStr: string; dayNum: string; dayName: string }>>([]);

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
    setDateErrorMessage(''); 

    fetchReservations(selectedDate);
    fetchTimeConfigs(calculatedDay); 
    fetchBlockingRules(); 

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const selectedMidnight = new Date(selectedDate);
    selectedMidnight.setHours(0, 0, 0, 0);

    const maxAllowedMidnight = new Date(todayMidnight);
    maxAllowedMidnight.setDate(todayMidnight.getDate() + maxBookingDays);

    if (selectedMidnight > maxAllowedMidnight) {
      if (maxBookingDays === 0) {
        setDateErrorMessage('예약이 불가능한 기간입니다. (당일 대관만 신청 허용)');
      } else {
        setDateErrorMessage(`예약이 불가능한 기간입니다. (오늘 기준 최대 ${maxBookingDays}일 이내만 가능)`);
      }
    }
  }, [selectedDate, maxBookingDays]);

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
      .from('sports_master').select('sport_name').order('id', { ascending: true });
    if (data) setGlobalSports(data.map(d => d.sport_name));
  };

  const fetchBlockingRules = async () => {
    const { data } = await supabase.from('blocking_rules').select('*');
    if (data) setBlockingRules(data);
  };

  useEffect(() => {
    fetchMasterSports(); 
    fetchBlockingRules();
    const loadBookingLimit = async () => {
      const { data, error } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'max_booking_days')
        .single();

      if (data && !error) {
        const limitDays = parseInt(data.value, 10);
        setMaxBookingDays(limitDays);
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
    
    const isEmergencyBlocked = slotReservations.some(res => res.sport_name === '행정 통제');
    if (isEmergencyBlocked) {
      return {
        allocatedCourts: 0,
        remainingCourts: 0,
        isFull: true,
        sportCount: 1,
        activeSports: ['임시 예약 불가'],
        isSportLimitReached: true,
        allowedSports: []
      };
    }

    const allocatedCourts = slotReservations.reduce((sum, res) => {
      const match = res.user_name.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
      const val = match ? parseFloat(match[2]) : 1;
      return sum + val;
    }, 0);
    
    const activeSports = Array.from(new Set(slotReservations.map((res) => res.sport_name as string)));
    const currentSlotConfig = dynamicTimeConfigs.find(s => s.start_time === startTime);
    const maxCourts = currentSlotConfig ? parseFloat(currentSlotConfig.max_courts) : 3; 

    let allowedSports = currentSlotConfig?.allowed_sports 
      ? currentSlotConfig.allowed_sports 
      : ['배드민턴', '피클볼', '농구'];

    if (activeSports.length >= 2) {
      allowedSports = allowedSports.filter((sport: string) => activeSports.includes(sport));
    }

    return {
      allocatedCourts,
      remainingCourts: maxCourts - allocatedCourts,
      isFull: allocatedCourts >= maxCourts,
      sportCount: activeSports.length,
      activeSports,
      isSportLimitReached: activeSports.length >= 2,
      allowedSports 
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

  const handleUserCancel = async (id: number, inputPass: string): Promise<boolean> => {
    const target = myReservations.find(res => res.id === id);
    if (!target) return false;
    
    const { password } = parseRawUserInfo(target.user_name);
    const name = target.user_name.split(' (')[0];
    const hashedInput = await hashPassword(inputPass);
    
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
    }
    return false;
  };

  // 🎯 [중복 예약 방지 엔진 적용] 동일 일자/동일 시간대 2회 이상 예약 신청 전면 차단
  const handleReservationSubmit = async (
    slot: any, 
    sport: string, 
    name: string, 
    phone: string, 
    pass: string, 
    headCount: number = 1, 
    courtCount: number = 1
  ): Promise<boolean> => {
    
    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    // 🔒 [중복 검증 가드] 동일 날짜, 동일 시간대에 해당 연락처나 성함으로 이미 예약된 건이 있는지 체크
    const { data: existingRecords, error: checkError } = await supabase
      .from('reservations')
      .select('user_name')
      .eq('reservation_date', selectedDate)
      .eq('slot_time', slot.startTime);

    if (!checkError && existingRecords) {
      const isDuplicate = existingRecords.some((record) => {
        return record.user_name.includes(`(${cleanPhone})`) || record.user_name.startsWith(cleanName);
      });

      if (isDuplicate) {
        alert(`❌ 이미 ${selectedDate} ${slot.startTime} 시간대에 신청된 예약 내역이 존재합니다.\n동일 시간대에는 중복 신청이 불가능합니다.`);
        return false;
      }
    }

    // 인원수 비례 코트 제한 가드
    if (sport === '배드민턴' || sport === '피클볼') {
      if (headCount >= 1 && headCount <= 4) {
        if (courtCount > 1) {
          alert('1명 ~ 4명 이하 인원은 최대 1코트까지만 예약이 가능합니다.');
          return false;
        }
      } else if (headCount >= 5 && headCount <= 8) {
        if (courtCount > 2) {
          alert('5명 ~ 8명 인원은 최대 2코트까지만 예약이 가능합니다.');
          return false;
        }
      } else if (headCount >= 9) {
        if (courtCount > 3) {
          alert('9명 이상 인원은 최대 3코트까지만 예약이 가능합니다.');
          return false;
        }
      }
    }

    const hashedPassword = await hashPassword(pass.trim());
    const combined = `${cleanName} (${cleanPhone}) [${hashedPassword}] {${headCount}명/${courtCount}코트}`;
    
    const { error } = await supabase.from('reservations').insert([{ 
      user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slot.startTime 
    }]);
    
    if (!error) {
      setSuccessDetails({
        name: cleanName,
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

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => {
    const statusInfo = getSlotStatusInfo(c.id, c.start_time);
    return { 
      id: c.id, 
      name: c.slot_name, 
      startTime: c.start_time, 
      allowedSports: statusInfo.allowedSports 
    };
  });

  const activeBlockingRule = blockingRules.find(rule => {
    const target = new Date(selectedDate);
    target.setHours(0, 0, 0, 0);
    const start = new Date(rule.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rule.end_date);
    end.setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  });

  return (
    <div className={`min-h-screen w-full font-sans antialiased flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-[#17171c]' : 'bg-slate-100'}`}>
      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-32 flex flex-col">
        {activeTab !== 'map' && (
          <div className="w-full mt-4 space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">조회 일정 선택</label>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border transition-colors duration-300 ${isDarkMode ? 'bg-[#22222a] text-blue-400 border-slate-800' : 'bg-white text-blue-600 border-slate-200/40'}`}>
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
                      isSelected ? 'bg-blue-600 border-blue-600 text-white font-black scale-[1.02] ring-4 ring-blue-600/10' : isDarkMode ? 'bg-[#22222a] border-slate-800/80 text-slate-300 hover:bg-slate-800/40' : 'bg-white border-slate-200/60 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-[10px] font-extrabold ${isSelected ? 'text-blue-100' : isSunday ? 'text-rose-500' : isSaturday ? 'text-blue-500' : 'text-slate-400'}`}>{item.dayName}</span>
                    <span className="text-xs font-mono font-black tracking-tight">{item.dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full flex-1 transition-all duration-300 ease-out transform animate-fade-in mt-2">
          {activeTab === 'booking' && (
            activeBlockingRule || dateErrorMessage ? (
              <div className={`w-full rounded-3xl p-8 text-center shadow-sm border transition-all duration-300 mt-4 ${
                isDarkMode ? 'bg-[#22222a] border-slate-800/60 text-slate-200 shadow-black/20' : 'bg-white border-slate-100 text-slate-800'
              }`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse ${isDarkMode ? 'bg-rose-950/40' : 'bg-rose-50'}`}>
                  <span className="text-2xl">🛑</span>
                </div>
                <h3 className="text-sm font-black tracking-tight">체육관 예약 불가 안내</h3>
                <div className={`mt-2.5 px-3 py-1.5 rounded-xl inline-block ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                  <p className="text-[11px] text-rose-500 font-extrabold">사유: {activeBlockingRule ? activeBlockingRule.reason : dateErrorMessage}</p>
                </div>
                <p className={`text-[11px] mt-3.5 font-bold leading-relaxed transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  해당 일정은 공단 내부 운영 규칙에 따라<br />예약이 불가능한 기간입니다.
                </p>
              </div>
            ) : (
              <div className="transition-opacity duration-300 opacity-100">
                <BookingTab timeSlots={adaptedTimeSlots} sports={globalSports} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onReservationSubmit={handleReservationSubmit} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} isDarkMode={isDarkMode} />
              </div>
            )
          )}
          {activeTab === 'dashboard' && (
            <div className="transition-opacity duration-300 opacity-100">
              <DashboardTab selectedDate={selectedDate} dayOfWeek={dayOfWeek} timeSlots={adaptedTimeSlots} weekdayRules={{}} dbReservations={dbReservations} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onSlotClick={(slot) => { triggerHaptic(); setSelectedSlot(slot); setActiveTab('booking'); }} sports={globalSports} isDarkMode={isDarkMode} />
            </div>
          )}
          {activeTab === 'check' && (
            <div className="transition-opacity duration-300 opacity-100">
              <CheckTab myReservations={myReservations} hasSearched={hasSearched} onSearch={async (t, v) => { triggerHaptic(); await handleStrictSearch(t, v); }} onCancel={async (id, pass) => { triggerHaptic(); return await handleUserCancel(id, pass); }} isDarkMode={isDarkMode} />
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

      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t pb-safe shadow-lg backdrop-blur-lg transition-colors duration-300 ${isDarkMode ? 'bg-[#17171c]/95 border-slate-800' : 'bg-white/95 border-slate-200/50'}`}>
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

      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center transform scale-100 border transition-colors ${isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <h3 className="text-base font-black tracking-tight mb-1">체육관 예약 신청 완료</h3>
            <p className="text-xs text-slate-400 font-semibold mb-4">예약이 정상적으로 처리되었습니다.</p>
            <div className={`rounded-2xl p-4 text-left text-xs font-bold space-y-2 mb-5 ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
              <div className="flex justify-between"><span className="text-slate-400">대표 신청자</span><span>{successDetails.name} 님</span></div>
              <div className="flex justify-between"><span className="text-slate-400">선택 종목</span><span className="text-blue-500 font-black">{successDetails.sport}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">이용 일정</span><span>{successDetails.date} ({successDetails.time})</span></div>
              <div className="flex justify-between"><span className="text-slate-400">배정 코트수</span><span>{successDetails.courtCount}코트</span></div>
            </div>
            <button type="button" onClick={handleCloseSuccessModal} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md active:scale-98 transition-all">확인 및 메인으로 이동</button>
          </div>
        </div>
      )}

      {showCancelModal && cancelDetails && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center transform scale-100 border transition-colors ${isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-rose-600 dark:text-rose-400">✕</span>
            </div>
            <h3 className="text-base font-black tracking-tight mb-1">예약 취소 완료</h3>
            <p className="text-xs text-slate-400 font-semibold mb-4">신청하신 대관 예약이 정상적으로 삭제되었습니다.</p>
            <div className={`rounded-2xl p-4 text-left text-xs font-bold space-y-2 mb-5 ${isDarkMode ? 'bg-[#1d1d24]' : 'bg-slate-50'}`}>
              <div className="flex justify-between"><span className="text-slate-400">기존 예약자</span><span>{cancelDetails.name} 님</span></div>
              <div className="flex justify-between"><span className="text-rose-500 font-black">{cancelDetails.sport}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">대관 일자</span><span>{cancelDetails.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">대관 시간</span><span>{cancelDetails.time}</span></div>
            </div>
            <button type="button" onClick={() => { triggerHaptic(); setShowCancelModal(false); setCancelDetails(null); }} className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md active:scale-98 transition-all">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}