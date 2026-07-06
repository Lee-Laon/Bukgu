'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { parseRawUserInfo } from './utils/crypto';

import BookingTab from './components/BookingTab';
import DashboardTab from './components/DashboardTab';
import CheckTab from './components/CheckTab';
import MasterPanel from './components/MasterPanel';

const TIME_SLOTS = [
  { id: '1', name: '9:20 ~ 10:50', startTime: '09:20' },
  { id: '2', name: '11:00 ~ 11:50', startTime: '11:00' },
  { id: '3', name: '12:00 ~ 13:00', startTime: '12:00' },
  { id: '4', name: '13:30 ~ 15:30', startTime: '13:30' },
  { id: '5', name: '15:30 ~ 16:00', startTime: '15:30' },
  { id: '6', name: '16:00 ~ 18:00', startTime: '16:00' },
  { id: '7', name: '18:00 ~ 20:00', startTime: '18:00' },
  { id: '8', name: '20:00 ~ 22:00', startTime: '20:00' },
];

const WEEKDAY_RULES: { [key: string]: { [key: string]: string } } = {
  '월': { '2': '피클볼 강좌', '3': '휴게시간', '5': '체육관 정비', '7': '피클볼 강좌', '8': '피클볼 강좌' },
  '화': { '1': '배드민턴 강좌', '3': '휴게시간', '5': '체육관 정비', '6': '놀이체육교실' },
  '수': { '3': '휴게시간', '5': '체육관 정비', '6': '유아농구 강좌', '7': '유관시설 대관', '8': '유관시설 대관' },
  '목': { '1': '배드민턴 강좌', '3': '휴게시간', '5': '체육관 정비' },
  '금': { '2': '피클볼 강좌', '3': '휴게시간', '5': '체육관 정비' },
  '토': { '3': '휴게시간', '5': '체육관 정비', '7': '운영종료', '8': '운영종료' },
  '일': { '3': '휴게시간', '5': '체육관 정비', '7': '운영종료', '8': '운영종료' },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'booking' | 'check' | 'dashboard'>('booking');

  const todayStr = '2026-07-06';
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dayOfWeek, setDayOfWeek] = useState<string>('월');
  const maxDateStr = '2026-07-13';

  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  
  // 데이터 동기화 상태 원본
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
    setDayOfWeek(days[dateObj.getDay()]);
    setSelectedSlot(null);
    setResultMessage(null);
    fetchReservations(selectedDate);
  }, [selectedDate]);

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

  const getSlotStatusInfo = (slotId: string, startTime: string) => {
    const slotReservations = dbReservations.filter((res) => res.slot_time.startsWith(startTime));
    const restriction = WEEKDAY_RULES[dayOfWeek]?.[slotId];
    const allocatedCourts = slotReservations.length;
    return {
      allocatedCourts,
      remainingCourts: 3 - allocatedCourts,
      activeSports: Array.from(new Set(slotReservations.map((res) => res.sport_name))),
      isFull: 3 - allocatedCourts <= 0,
      sportCount: Array.from(new Set(slotReservations.map((res) => res.sport_name))).length,
      isBadmintonLessonTime: restriction === '배드민턴 강좌'
    };
  };

  // DB 핸들러 모음 
  const handleStrictSearch = async (name: string, phone: string) => {
    const { data } = await supabase.from('reservations').select('*').like('user_name', `${name.trim()} (${phone.trim()})%`);
    setMyReservations(data || []);
    setHasSearched(true);
  };

  const handleUserCancel = async (id: number, inputPass: string) => {
    const target = myReservations.find(res => res.id === id);
    if (!target) return false;
    const { password } = parseRawUserInfo(target.user_name);

    if (inputPass !== password) { alert('비밀번호가 일치하지 않습니다.'); return false; }
    await supabase.from('reservations').delete().eq('id', id);
    alert('예약이 정상 취소되었습니다.');
    fetchReservations(selectedDate);
    handleStrictSearch(searchNameFromForm(target.user_name), searchPhoneFromForm(target.user_name));
    return true;
  };

  const handleMasterCancel = async (id: number) => {
    if (!confirm('데스크 마스터 직권으로 예약을 강제 취소하시겠습니까?')) return;
    await supabase.from('reservations').delete().eq('id', id);
    alert('강제 취소 완료');
    fetchReservations(selectedDate);
  };

  const handleReservationSubmit = async (slot: any, sport: string, name: string, phone: string, pass: string) => {
    const combined = `${name} (${phone}) [${pass}]`;
    const { error } = await supabase.from('reservations').insert([{ user_name: combined, sport_name: sport, reservation_date: selectedDate, slot_time: slot.startTime }]);
    if (error) setResultMessage({ success: false, message: `저장 실패: ${error.message}` });
    else { setResultMessage({ success: true, message: '🎉 예약이 성공적으로 등록되었습니다!' }); fetchReservations(selectedDate); }
  };

  const searchNameFromForm = (str: string) => str.split(' (')[0];
  const searchPhoneFromForm = (str: string) => str.split(' (')[1]?.split(')')[0] || '';

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">🏛️ 운암복합문화체육센터 예약 시스템</h1>

        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
          <button onClick={() => setActiveTab('booking')} className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${activeTab === 'booking' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>📅 예약 신청</button>
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>📋 실시간 현황판</button>
          <button onClick={() => setActiveTab('check')} className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${activeTab === 'check' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>🔍 예약 확인</button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center gap-4">
          <label className="font-semibold text-gray-700 text-sm">조회/예약 기준일 선택:</label>
          <input type="date" value={selectedDate} min={todayStr} max={maxDateStr} onChange={(e) => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-lg p-2 font-medium bg-white text-sm text-black focus:outline-none" />
          <span className="text-md font-bold text-blue-600">({dayOfWeek}요일)</span>
        </div>

        {/* 원띵 컴포넌트들 조율 분기점 */}
        {activeTab === 'booking' && (
          <BookingTab timeSlots={TIME_SLOTS} weekdayRules={WEEKDAY_RULES} dayOfWeek={dayOfWeek} sports={['배드민턴', '피클볼', '농구']} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onReservationSubmit={handleReservationSubmit} resultMessage={resultMessage} setResultMessage={setResultMessage} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab selectedDate={selectedDate} dayOfWeek={dayOfWeek} timeSlots={TIME_SLOTS} weekdayRules={WEEKDAY_RULES} dbReservations={dbReservations} getTimeLockStatus={getTimeLockStatus} getSlotStatusInfo={getSlotStatusInfo} onSlotClick={(slot) => { setSelectedSlot(slot); setActiveTab('booking'); }} />
        )}
        {activeTab === 'check' && (
          <CheckTab myReservations={myReservations} hasSearched={hasSearched} onSearch={handleStrictSearch} onCancel={handleUserCancel} />
        )}

        <MasterPanel selectedDate={selectedDate} dbReservations={dbReservations} onMasterCancel={handleMasterCancel} />
      </div>
    </main>
  );
}