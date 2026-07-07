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

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dayOfWeek, setDayOfWeek] = useState<string>('월');

  // 관리자 설정 동적 최대 예약 기간 연동 상태
  const [maxDateStr, setMaxDateStr] = useState<string>(todayStr);

  // 관리자가 생성한 최신 DB 시간 규격들을 저장할 상태 배열
  const [dynamicTimeConfigs, setDynamicTimeConfigs] = useState<any[]>([]);

  // DB에서 실시간으로 읽어와 대민창구에 뿌려줄 운동 종목 마스터 상태
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

  // 날짜 변경 시 해당 요일 계산 및 데이터 로드
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

  // 현재 요일에 맞는 시간대 설정을 DB에서 동적으로 로드
  const fetchTimeConfigs = async (day: string) => {
    const { data } = await supabase
      .from('time_configs')
      .select('*')
      .eq('day_of_week', day)
      .order('start_time', { ascending: true });
    if (data) setDynamicTimeConfigs(data);
  };

  // DB에서 실시간 전역 운영 종목 명단 패치
  const fetchMasterSports = async () => {
    const { data } = await supabase
      .from('sports_master')
      .select('sport_name')
      .order('id', { ascending: true });
    if (data) {
      setGlobalSports(data.map(d => d.sport_name));
    }
  };

  // Supabase 환경설정(예약 가능 일수) 및 종목 마스터 실시간 동기화 파이프라인
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

    const channelConfig = supabase.channel('public-system-config-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_configs', filter: 'key=eq.max_booking_days' }, (payload) => {
        const limitDays = parseInt(payload.new.value, 10);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + limitDays);
        const yyyy = maxDate.getFullYear();
        const mm = String(maxDate.getMonth() + 1).padStart(2, '0');
        const dd = String(maxDate.getDate()).padStart(2, '0');
        setMaxDateStr(`${yyyy}-${mm}-${dd}`);
      })
      .subscribe();

    const channelSports = supabase.channel('public-sports-master-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_master' }, () => {
        fetchMasterSports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelConfig);
      supabase.removeChannel(channelSports);
    };
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

  // 실시간 코트 점유 계산 엔진
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

      let filteredData = data || [];
      if (type === 'name') {
        filteredData = filteredData.filter(res => res.user_name && res.user_name.split(' (')[0].includes(cleanValue));
      } else {
        filteredData = filteredData.filter(res => res.user_name && res.user_name.match(/\((.*?)\)/)?.[1].includes(cleanValue));
      }

      setMyReservations(filteredData);
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
    // 🎯 [코드 레벨 더블 가드] 유저가 브라우저 개발자 도구 등으로 min 속성을 변조해 진입했을 때를 대비한 백엔드 서브 가드
    if (selectedDate < todayStr) {
      alert('❌ 과거 날짜에는 예약을 진행할 수 없습니다.');
      return;
    }
    
    if (!name.trim() || !phone.trim() || !pass.trim()) {
      setResultMessage({ success: false, message: '❌ 모든 입력 필드를 정확히 채워주세요.' });
      return;
    }

    const status = getSlotStatusInfo(slot.id, slot.startTime);

    if (status.isFull || courtCount > status.remainingCourts) {
      setResultMessage({ success: false, message: `❌ 예약 실패: 잔여 코트가 부족합니다. (남은 코트: ${status.remainingCourts}개)` });
      return;
    }

    if (!(status.activeSports as string[]).includes(sport) && status.isSportLimitReached) {
      setResultMessage({ success: false, message: `❌ 예약 실패: 한 시간대 최대 2개 종목만 대관할 수 있습니다. (현재 개설: ${status.activeSports.join(', ')})` });
      return;
    }

    if (slot.allowedSports && !slot.allowedSports.includes(sport)) {
      setResultMessage({ success: false, message: `❌ 해당 시간대에는 [${slot.allowedSports.join(', ')}] 종목만 예약이 가능합니다.` });
      return;
    }

    const combined = `${name.trim()} (${phone.trim()}) [${pass.trim()}] {${headCount}명/${courtCount}코트}`;
    const { error } = await supabase.from('reservations').insert([{ 
      user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slot.startTime 
    }]);

    if (error) {
      setResultMessage({ success: false, message: `저장 실패: ${error.message}` });
    } else { 
      setResultMessage({ success: true, message: '🎉 예약이 성공적으로 등록되었습니다!' }); 
      setTimeout(() => { fetchReservations(selectedDate); }, 200);
    }
  };

  // DB 규격(start_time 등)을 BookingTab 카멜케이스 포맷과 맞춤 맵핑
  const adaptedTimeSlots = dynamicTimeConfigs.map(c => ({
    id: c.id, 
    name: c.slot_name, 
    startTime: c.start_time, 
    allowedSports: c.allowed_sports
  }));

  // 🎯 [인풋 핸들러 안전 장치] 사용자가 수동으로 타이핑하여 과거 일자를 치고 들어올 때 자동 보정
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputDate = e.target.value;
    if (inputDate < todayStr) {
      alert('📅 과거 날짜는 조회 및 예약이 불가능합니다. 오늘 날짜로 자동 복귀합니다.');
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(inputDate);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">🏛️ 운암복합문화체육센터</h1>

        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('booking')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'booking' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500'}`}>📅 예약</button>
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500'}`}>📋 현황</button>
          <button onClick={() => setActiveTab('check')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'check' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500'}`}>🔍 확인</button>
          <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'map' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500'}`}>📍 위치</button>
        </div>

        {/* 🎯 [완벽한 더블 가드 완성] min={todayStr} 바인딩 및 onChange={handleDateChange} 스위칭 가동 */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center gap-4">
          <label className="font-semibold text-gray-700 text-sm">조회/예약 기준일 선택:</label>
          <input 
            type="date" 
            value={selectedDate} 
            min={todayStr} 
            max={maxDateStr} 
            onChange={handleDateChange} 
            className="border border-gray-300 rounded-lg p-2 font-medium bg-white text-sm text-black focus:outline-none" 
          />
          <span className="text-md font-bold text-blue-600">({dayOfWeek}요일)</span>
        </div>

        {activeTab === 'booking' && (
          <BookingTab 
            timeSlots={adaptedTimeSlots} 
            sports={globalSports} 
            getTimeLockStatus={getTimeLockStatus} 
            getSlotStatusInfo={getSlotStatusInfo} 
            onReservationSubmit={handleReservationSubmit} 
            resultMessage={resultMessage} 
            setResultMessage={setResultMessage} 
            selectedSlot={selectedSlot} 
            setSelectedSlot={setSelectedSlot} 
          />
        )}
        
        {activeTab === 'dashboard' && (
          <DashboardTab 
            selectedDate={selectedDate} 
            dayOfWeek={dayOfWeek} 
            timeSlots={adaptedTimeSlots} 
            weekdayRules={{}} 
            dbReservations={dbReservations} 
            getTimeLockStatus={getTimeLockStatus} 
            getSlotStatusInfo={getSlotStatusInfo} 
            onSlotClick={(slot) => { setSelectedSlot(slot); setActiveTab('booking'); }} 
            sports={globalSports} // 🎯 [이 한 줄만 추가!] 자식 현황판에 마스터 종목 배열을 전달합니다.
          />
        )}
        
        {activeTab === 'check' && (
          <CheckTab 
            myReservations={myReservations} 
            hasSearched={hasSearched} 
            onSearch={handleStrictSearch} 
            onCancel={handleUserCancel} 
          />
        )}
        
        {activeTab === 'map' && <MapSection />}
      </div>
    </main>
  );
}