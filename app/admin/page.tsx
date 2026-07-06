'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MasterPanel from '../components/MasterPanel';

export default function AdminPage() {
  const todayStr = '2026-07-06';
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dbReservations, setDbReservations] = useState<any[]>([]);

  useEffect(() => {
    fetchReservations(selectedDate);
  }, [selectedDate]);

  const fetchReservations = async (date: string) => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('reservation_date', date)
      .order('slot_time', { ascending: true });
      
    if (data) setDbReservations(data);
  };

  const handleMasterCancel = async (id: number) => {
    if (!confirm('데스크 마스터 직권으로 이 예약을 강제 취소하시겠습니까?')) return;
    await supabase.from('reservations').delete().eq('id', id);
    alert('강제 취소 처리가 완료되었습니다.');
    fetchReservations(selectedDate);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-2xl w-full space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-slate-200">🏛️ 운암복합문화체육센터 백오피스</h1>
          <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full font-bold border border-red-500/30">데스크 마스터 권한</span>
        </div>

        {/* 관리자 전용 날짜 제어바 */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-center gap-4 shadow-xl">
          <label className="font-semibold text-slate-400 text-sm">관제 기준일 관측:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="border border-slate-700 rounded-lg p-2 font-medium bg-slate-800 text-sm text-white focus:outline-none" 
          />
        </div>

        {/* 기존에 만들어 둔 마스터 패널 컴포넌트를 독채로 입주시켜 줍니다 🎯 */}
        <MasterPanel 
          selectedDate={selectedDate} 
          dbReservations={dbReservations} 
          onMasterCancel={handleMasterCancel} 
        />
      </div>
    </main>
  );
}