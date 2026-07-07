'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminSettingTabProps {
  dayOfWeek: string;
  dynamicTimeConfigs: any[];
  blockingRules: any[];
  fetchTimeConfigs: (day: string) => Promise<void>;
  fetchBlockingRules: () => Promise<void>;
  selectedDate: string;
  fetchReservations: (date: string) => Promise<void>;
  setSelectedDate: (date: string) => void;
}

export default function AdminSettingTab({
  dayOfWeek,
  dynamicTimeConfigs,
  blockingRules,
  fetchTimeConfigs,
  fetchBlockingRules,
  selectedDate,
  fetchReservations,
}: AdminSettingTabProps) {
  const [targetDay, setTargetDay] = useState<string>(dayOfWeek || '화');

  // 예약 가능 기간 및 종목 마스터 상태
  const [maxBookingDays, setMaxBookingDays] = useState<number>(30);
  const [isConfigSaving, setIsConfigSaving] = useState<boolean>(false);
  
  // 🎯 [신규] DB에서 실시간으로 불러올 운동 종목 마스터 명단
  const [sportsMasterList, setSportsMasterList] = useState<string[]>([]);
  const [newSportInput, setNewSportInput] = useState<string>('');

  // 시간대 컴포저 세분화 상태
  const [startAmpm, setStartAmpm] = useState<'오전' | '오후'>('오전');
  const [startHour, setStartHour] = useState('09');
  const [startMin, setStartMin] = useState('30');
  const [endAmpm, setEndAmpm] = useState<'오전' | '오후'>('오전');
  const [endHour, setEndHour] = useState('11');
  const [endMin, setEndMin] = useState('30');

  const [newMaxCourts, setNewMaxCourts] = useState<number>(3);
  const [newAllowedSports, setNewAllowedSports] = useState<string[]>([]);

  // 장기 공사 통제 상태
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('체육관 내부 바닥 샌딩 공사');

  // 🎯 [신규] 종목 마스터 데이터 패치 함수
  const fetchSportsMaster = async () => {
    const { data } = await supabase.from('sports_master').select('sport_name').order('id', { ascending: true });
    if (data) {
      const sports = data.map(item => item.sport_name);
      setSportsMasterList(sports);
      setNewAllowedSports(sports); // 시간대 추가 기본값으로 전체 선택되도록 동적 할당
    }
  };

  const fetchSystemConfigs = async () => {
    const { data } = await supabase.from('system_configs').select('value').eq('key', 'max_booking_days').single();
    if (data) setMaxBookingDays(parseInt(data.value, 10));
  };

  useEffect(() => {
    fetchSystemConfigs();
    fetchSportsMaster();
    if (dayOfWeek) setTargetDay(dayOfWeek);
  }, [dayOfWeek]);

  // 🎯 [신규] 종목 추가 핸들러
  const handleAddSportMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSport = newSportInput.trim();
    if (!cleanSport) return;

    const { error } = await supabase.from('sports_master').insert([{ sport_name: cleanSport }]);
    if (!error) {
      alert(`🏸 새로운 운영 종목 [${cleanSport}]이 전역 마스터 보드에 등록되었습니다.`);
      setNewSportInput('');
      await fetchSportsMaster();
    } else {
      alert('⚠️ 이미 등록된 종목이거나 오류가 발생했습니다.');
    }
  };

  // 🎯 [신규] 종목 삭제 핸들러
  const handleDeleteSportMaster = async (sportName: string) => {
    if (!confirm(`🛑 [${sportName}] 종목을 센터 운영 명단에서 파기하시겠습니까?\n(기존에 등록된 시간대 규칙은 유지되나 새로 추가할 때 제외됩니다.)`)) return;
    
    await supabase.from('sports_master').delete().eq('sport_name', sportName);
    await fetchSportsMaster();
  };

  // 대관 범위 예약 가능 기간 변경 및 저장
  const handleSaveBookingDays = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfigSaving(true);
    const { error } = await supabase.from('system_configs').upsert({ key: 'max_booking_days', value: String(maxBookingDays), description: '이용자가 오늘 기준으로 미래 몇 일까지 예약할 수 있는지 제한' });
    setIsConfigSaving(false);
    if (!error) alert(`⚙️ 이용자 예약 가능 범위를 오늘부터 [${maxBookingDays}일 뒤]까지로 일괄 업데이트했습니다!`);
  };

  // 종목 체크박스 토글 핸들러
  const handleSportToggle = (sport: string) => {
    if (newAllowedSports.includes(sport)) {
      setNewAllowedSports(newAllowedSports.filter((s) => s !== sport));
    } else {
      setNewAllowedSports([...newAllowedSports, sport]);
    }
  };

  // 운영 시간대 추가 핸들러
  const handleAddSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAllowedSports.length === 0) {
      alert('⚠️ 최소 한 개 이상의 허용 운동 종목을 선택해 주세요.');
      return;
    }

    let calcStartHour = parseInt(startHour, 10);
    if (startAmpm === '오후' && calcStartHour !== 12) calcStartHour += 12;
    if (startAmpm === '오전' && calcStartHour === 12) calcStartHour = 0;
    const finalStartTime = `${String(calcStartHour).padStart(2, '0')}:${startMin}`;
    const finalSlotName = `${startAmpm} ${startHour}:${startMin} ~ ${endAmpm} ${endHour}:${endMin}`;

    const { error } = await supabase.from('time_configs').insert([
      { day_of_week: targetDay, slot_name: finalSlotName, start_time: finalStartTime, max_courts: newMaxCourts, allowed_sports: newAllowedSports },
    ]);

    if (!error) {
      alert(`🎯 [${targetDay}요일]에 새로운 운영 시간대 규칙이 완벽히 반영되었습니다!`);
      await fetchTimeConfigs(targetDay); 
    }
  };

  // 운영 시간대 삭제 핸들러
  const handleDeleteSlotConfig = async (id: number) => {
    if (!confirm('🛑 선택하신 운영 시간대 규칙을 파기하시겠습니까?')) return;
    const { error } = await supabase.from('time_configs').delete().eq('id', id);
    if (!error) await fetchTimeConfigs(targetDay);
  };

  // 당일 특정 시간 긴급 차단
  const handleEmergencyBlock = async (startTime: string) => {
    if (!confirm('🔒 시설 보수를 위해 해당 타임을 긴급 차단하시겠습니까?')) return;
    const combined = `[공단 행정 긴급 통제] (010-0000-0000) [0000] {0명/3코트}`;
    await supabase.from('reservations').insert([{ user_name: combined, sport_name: '행정 통제', reservation_date: selectedDate, slot_time: startTime }]);
    await fetchReservations(selectedDate);
  };

  // 장기 공사/기간 통제 룰 배포 핸들러
  const handleBatchBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStartDate || !blockEndDate) { alert('📅 기간을 정확히 지정해 주세요.'); return; }
    if (!confirm(`🔒 ${blockStartDate}부터 ${blockEndDate}까지 [${blockReason}] 사유로 대관 통제 룰을 배포합니까?`)) return;

    const { error } = await supabase.from('blocking_rules').insert([{ start_date: blockStartDate, end_date: blockEndDate, reason: blockReason }]);
    if (!error) {
      setBlockStartDate(''); setBlockEndDate(''); await fetchBlockingRules();
      alert('🎯 지정 기간 장기 행정 차단 제어 장치가 전면 가동되었습니다.');
    }
  };

  // 장기 공사/기간 통제 룰 철회 핸들러
  const handleDeleteBlockingRule = async (id: number) => {
    if (!confirm('🔓 해당 공사/행사 일괄 차단 규칙을 해제하고 대관 창구를 다시 개방하시겠습니까?')) return;
    await supabase.from('blocking_rules').delete().eq('id', id);
    await fetchBlockingRules();
    alert('🔓 대관 통제 락이 해제되었습니다.');
  };

  const hoursArray = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minsArray = ['00', '30'];
  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* 🎯 [대타격 신규 추가] 파트 0: 체육관 전역 운영 종목 설정 관리 마스터 보드 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-teal-900/40 shadow-xl space-y-3">
        <p className="text-xs font-bold text-teal-400">🏸 체육관 전역 운영 종목 커스텀 마스터 보드</p>
        <form onSubmit={handleAddSportMaster} className="flex gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <input
            type="text"
            placeholder="새로운 스포츠 종목 입력 (예: 탁구, 족구)"
            value={newSportInput}
            onChange={(e) => setNewSportInput(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none placeholder-slate-500"
          />
          <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1 rounded text-xs transition-all shadow">
            ➕ 종목 등록
          </button>
        </form>
        
        {/* 현재 등록된 마스터 종목 태그 리스트 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {sportsMasterList.map((sport) => (
            <span key={sport} className="inline-flex items-center gap-1 bg-slate-950 text-slate-300 font-bold px-2 py-1 rounded-md text-[11px] border border-slate-800">
              {sport}
              <button type="button" onClick={() => handleDeleteSportMaster(sport)} className="text-red-500 hover:text-red-400 font-extrabold ml-1 text-xs">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* 대민 서비스 정책: 실시간 예약 허용 기간 제어 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-blue-900/40 shadow-xl space-y-3">
        <p className="text-xs font-bold text-blue-400">🌐 대민 서비스 정책: 실시간 예약 허용 기간 제어</p>
        <form onSubmit={handleSaveBookingDays} className="flex gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">오늘 기준으로 최대</span>
            <input
              type="number"
              min={1} max={365}
              value={maxBookingDays}
              onChange={(e) => setMaxBookingDays(parseInt(e.target.value, 10) || 30)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-center text-white w-20 focus:outline-none font-mono"
            />
            <span className="text-[11px] font-bold text-slate-400">일 후까지 예약창 개방</span>
          </div>
          <button type="submit" disabled={isConfigSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded text-xs transition-all shadow disabled:opacity-50">
            {isConfigSaving ? '저장 중..' : '⚙️ 설정 저장'}
          </button>
        </form>
      </div>

      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center text-xs text-blue-400 font-bold">
        ⚙️ 현재 관측 요일: [{dayOfWeek}요일] | 설정 타깃 요일: [{targetDay}요일]
      </div>

      {/* ⏱️ 파트 A: 운영 시간 규격 설정 폼 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <p className="text-xs font-bold text-slate-400">⏱️ 월별 프로그램 반영: 운영 시간 규격 설정</p>

        <form onSubmit={handleAddSlotConfig} className="space-y-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold">📆 규칙을 등록할 대상 요일 선택</label>
            <div className="grid grid-cols-7 gap-1 bg-slate-900 p-1 rounded border border-slate-800">
              {weekDays.map((day) => (
                <button
                  key={day} type="button"
                  onClick={async () => { setTargetDay(day); await fetchTimeConfigs(day); }}
                  className={`py-1 rounded text-xs font-bold transition-all ${targetDay === day ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold">⏱️ 대관 시작 시간</label>
              <div className="flex gap-1 bg-slate-900 p-1 rounded border border-slate-800">
                <select value={startAmpm} onChange={(e) => setStartAmpm(e.target.value as any)} className="bg-slate-950 text-xs p-1 rounded text-white font-bold flex-1">
                  <option value="오전">오전</option><option value="오후">오후</option>
                </select>
                <select value={startHour} onChange={(e) => setStartHour(e.target.value)} className="bg-slate-950 text-xs p-1 rounded text-white font-mono flex-1">
                  {hoursArray.map((h) => <option key={h} value={h}>{h}시</option>)}
                </select>
                <select value={startMin} onChange={(e) => setStartMin(e.target.value)} className="bg-slate-950 text-xs p-1 rounded text-white font-mono flex-1">
                  {minsArray.map((m) => <option key={m} value={m}>{m}분</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold">⏱️ 대관 종료 시간</label>
              <div className="flex gap-1 bg-slate-900 p-1 rounded border border-slate-800">
                <select value={endAmpm} onChange={(e) => setEndAmpm(e.target.value as any)} className="bg-slate-950 text-xs p-1 rounded text-white font-bold flex-1">
                  <option value="오전">오전</option><option value="오후">오후</option>
                </select>
                <select value={endHour} onChange={(e) => setEndHour(e.target.value)} className="bg-slate-950 text-xs p-1 rounded text-white font-mono flex-1">
                  {hoursArray.map((h) => <option key={h} value={h}>{h}시</option>)}
                </select>
                <select value={endMin} onChange={(e) => setEndMin(e.target.value)} className="bg-slate-950 text-xs p-1 rounded text-white font-mono flex-1">
                  {minsArray.map((m) => <option key={m} value={m}>{m}분</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 🎯 [동적 리팩토링 완료] 마스터 리스트를 기반으로 동적 체크박스 구현 */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold">🏸 허용 운동 종목 지정 (마스터 보드 연동됨)</label>
            <div className="flex flex-wrap gap-4 bg-slate-900 p-2.5 rounded border border-slate-800">
              {sportsMasterList.length === 0 ? (
                <span className="text-xs text-slate-500">상단 마스터 보드에서 종목을 먼저 추가해 주세요.</span>
              ) : (
                sportsMasterList.map((sport) => (
                  <label key={sport} className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newAllowedSports.includes(sport)}
                      onChange={() => handleSportToggle(sport)}
                      className="w-4 h-4 bg-slate-950 border-slate-800 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>{sport}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold">🏸 최대 제한 코트: {newMaxCourts}개</span>
            <input type="range" min={1} max={5} step={0.5} value={newMaxCourts} onChange={(e) => setNewMaxCourts(parseFloat(e.target.value))} className="w-2/3 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs shadow">
            ⚡ [{targetDay}요일]에 이 운영 시간대 즉시 추가
          </button>
        </form>

        {/* 현재 요일 규칙 리스트 */}
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-[11px] font-bold text-slate-400">
            📋 현재 선택된 요일 [{targetDay}요일] 배포 규칙 목록 ({dynamicTimeConfigs?.length || 0}개)
          </p>
          {!dynamicTimeConfigs || dynamicTimeConfigs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4 bg-slate-950/40 rounded border border-dashed border-slate-800">등록된 가변 스케줄이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {dynamicTimeConfigs.map((cfg) => (
                <div key={cfg.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800/60 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-400">⏱️ {cfg.slot_name}</span>
                    <div className="text-[10px] text-slate-500">
                      허용 종목: {Array.isArray(cfg.allowed_sports) ? cfg.allowed_sports.join(', ') : '전체'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => handleEmergencyBlock(cfg.start_time)} className="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white font-bold px-2 py-0.5 rounded text-[10px] border border-amber-600/30">🔒 차단</button>
                    <button type="button" onClick={() => handleDeleteSlotConfig(cfg.id)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold px-2 py-0.5 rounded text-[10px] border border-red-600/30">🗑️ 제거</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 일자별 공사 통제 모듈 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <p className="text-xs font-bold text-slate-400">🔨 일자별 공사 및 특이사항 시설 기간 설정 통제</p>
        <form onSubmit={handleBatchBlockSubmit} className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">📅 통제 시작일</label>
              <input type="date" value={blockStartDate} onChange={(e) => setBlockStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">📅 통제 종료일</label>
              <input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1">💬 일괄 통제 사유 기입</label>
            <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white focus:outline-none" />
          </div>
          <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded text-xs shadow">🔒 해당 기간 전 코트 일괄 대관 차단 스케줄 적용</button>
        </form>

        {/* 실시간 통제 규칙 모니터 */}
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-[11px] font-bold text-slate-400 flex justify-between items-center">
            <span>📋 현재 공단 행정 지시 장기 통제 규칙 명단 ({blockingRules?.length || 0}건)</span>
          </p>
          {!blockingRules || blockingRules.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4 bg-slate-950/40 rounded border border-dashed border-slate-800">예정된 장기 공사 통제 규칙이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {blockingRules.map((rule) => (
                <div key={rule.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-amber-900/30 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-400">🔨 {rule.reason}</div>
                    <div className="text-[10px] text-slate-500 font-mono">🗓️ 기간: {rule.start_date} ~ {rule.end_date}</div>
                  </div>
                  <button type="button" onClick={() => handleDeleteBlockingRule(rule.id)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white font-bold px-2.5 py-1 rounded text-[10px] border border-green-600/30 transition-all">🔓 통제해제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}