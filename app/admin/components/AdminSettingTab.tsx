'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState<boolean>(false);

  const [maxBookingDays, setMaxBookingDays] = useState<number>(30);
  const [isConfigSaving, setIsConfigSaving] = useState<boolean>(false);
  
  const [sportsMasterList, setSportsMasterList] = useState<string[]>([]);
  const [newSportInput, setNewSportInput] = useState<string>('');

  const [startAmpm, setStartAmpm] = useState<'오전' | '오후'>('오전');
  const [startHour, setStartHour] = useState('09');
  const [startMin, setStartMin] = useState('30');
  const [endAmpm, setEndAmpm] = useState<'오전' | '오후'>('오전');
  const [endHour, setEndHour] = useState('11');
  const [endMin, setEndMin] = useState('30');

  const [newMaxCourts, setNewMaxCourts] = useState<number>(3);
  const [newAllowedSports, setNewAllowedSports] = useState<string[]>([]);

  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('체육관 내부 바닥 샌딩 공사');

  const [emergencyBlockedSlots, setEmergencyBlockedSlots] = useState<string[]>([]);

  // 상세 정보 편집 모달 제어용 상태 관리
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedConfig, setSelectedSlotConfig] = useState<any | null>(null);
  const [editSlotName, setEditSlotName] = useState<string>('');
  const [editMaxCourts, setEditMaxCourts] = useState<number>(3);
  const [editAllowedSports, setEditAllowedSports] = useState<string[]>([]);

  // 공통 시스템 안내 알림용 모달 상태
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    type: 'alert',
    onConfirm: () => {}
  });

  const showAlert = (message: string) => {
    setModalConfig({
      isOpen: true,
      message,
      type: 'alert',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showConfirm = (message: string, onConfirmAction: () => void) => {
    setModalConfig({
      isOpen: true,
      message,
      type: 'confirm',
      onConfirm: () => {
        onConfirmAction();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const fetchSportsMaster = async () => {
    const { data } = await supabase.from('sports_master').select('sport_name').order('id', { ascending: true });
    if (data) {
      const sports = data.map(item => item.sport_name);
      setSportsMasterList(sports);
      setNewAllowedSports(sports); 
    }
  };

  const fetchSystemConfigs = async () => {
    const { data } = await supabase.from('system_configs').select('value').eq('key', 'max_booking_days').single();
    if (data) setMaxBookingDays(parseInt(data.value, 10));
  };

  const fetchCurrentDayEmergencyBlocks = async () => {
    if (!selectedDate) return;
    const { data } = await supabase
      .from('reservations')
      .select('slot_time')
      .eq('reservation_date', selectedDate)
      .eq('sport_name', '행정 통제');
    
    if (data) {
      setEmergencyBlockedSlots(data.map(r => r.slot_time));
    } else {
      setEmergencyBlockedSlots([]);
    }
  };

  useEffect(() => {
    setMounted(true); 
    fetchSystemConfigs();
    fetchSportsMaster();
    fetchCurrentDayEmergencyBlocks();
    if (dayOfWeek) setTargetDay(dayOfWeek);
  }, [dayOfWeek, selectedDate]);

  const handleAddSportMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSport = newSportInput.trim();
    if (!cleanSport) return;

    const { error } = await supabase.from('sports_master').insert([{ sport_name: cleanSport }]);
    if (!error) {
      showAlert(`새로운 운영 종목 [${cleanSport}]이 등록되었습니다.`);
      setNewSportInput('');
      await fetchSportsMaster();
    }
  };

  const handleDeleteSportMaster = async (sportName: string) => {
    showConfirm(`[${sportName}] 종목을 파기하시겠습니까?`, async () => {
      await supabase.from('sports_master').delete().eq('sport_name', sportName);
      await fetchSportsMaster();
    });
  };

  const handleSaveBookingDays = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfigSaving(true);
    await supabase.from('system_configs').upsert({ key: 'max_booking_days', value: String(maxBookingDays) });
    setIsConfigSaving(false);
    showAlert(`예약 제한 기간을 ${maxBookingDays}일로 저장했습니다.`);
  };

  const handleSportToggle = (sport: string) => {
    if (newAllowedSports.includes(sport)) {
      setNewAllowedSports(newAllowedSports.filter((s) => s !== sport));
    } else {
      setNewAllowedSports([...newAllowedSports, sport]);
    }
  };

  const handleEditSportToggle = (sport: string) => {
    if (editAllowedSports.includes(sport)) {
      setEditAllowedSports(editAllowedSports.filter((s) => s !== sport));
    } else {
      setEditAllowedSports([...editAllowedSports, sport]);
    }
  };

  const handleAddSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    let calcStartHour = parseInt(startHour, 10);
    if (startAmpm === '오후' && calcStartHour !== 12) calcStartHour += 12;
    if (startAmpm === '오전' && calcStartHour === 12) calcStartHour = 0;
    const finalStartTime = `${String(calcStartHour).padStart(2, '0')}:${startMin}`;
    const finalSlotName = `${startAmpm} ${startHour}:${startMin} ~ ${endAmpm} ${endHour}:${endMin}`;

    const { error } = await supabase.from('time_configs').insert([
      { day_of_week: targetDay, slot_name: finalSlotName, start_time: finalStartTime, max_courts: newMaxCourts, allowed_sports: newAllowedSports },
    ]);

    if (!error) {
      showAlert('운영 시간대가 성공적으로 추가되었습니다.');
      await fetchTimeConfigs(targetDay); 
    }
  };

  const handleDeleteSlotConfig = async (id: number) => {
    showConfirm('운영 시간대 규칙을 제거하시겠습니까?', async () => {
      const { error } = await supabase.from('time_configs').delete().eq('id', id);
      if (!error) await fetchTimeConfigs(targetDay);
    });
  };

  const handleOpenDetailModal = (cfg: any) => {
    setSelectedSlotConfig(cfg);
    setEditSlotName(cfg.slot_name);
    setEditMaxCourts(cfg.max_courts || 3);
    setEditAllowedSports(Array.isArray(cfg.allowed_sports) ? cfg.allowed_sports : []);
    setIsDetailModalOpen(true);
  };

  const handleUpdateSlotConfig = async () => {
    if (!selectedConfig) return;
    if (editAllowedSports.length === 0) {
      showAlert('최소 한 개 이상의 허용 종목을 지정해야 합니다.');
      return;
    }

    const { error } = await supabase
      .from('time_configs')
      .update({
        slot_name: editSlotName,
        max_courts: editMaxCourts,
        allowed_sports: editAllowedSports
      })
      .eq('id', selectedConfig.id);

    if (!error) {
      setIsDetailModalOpen(false);
      await fetchTimeConfigs(targetDay);
      showAlert('선택한 시간대의 세부 속성이 성공적으로 변경되었습니다.');
    } else {
      showAlert('업데이트 수행 중 오류가 발생했습니다.');
    }
  };

  const handleEmergencyBlock = async (startTime: string) => {
    showConfirm(`[${startTime}] 타임의 접수를 긴급 차단하시겠습니까?`, async () => {
      const combined = `[공단 행정 긴급 통제] (010-0000-0000) [0000] {0명/99코트}`;
      const { error } = await supabase.from('reservations').insert([{ 
        user_name: combined, 
        sport_name: '행정 통제', 
        reservation_date: selectedDate, 
        slot_time: startTime 
      }]);
      
      if (!error) {
        await fetchReservations(selectedDate);
        await fetchCurrentDayEmergencyBlocks();
        showAlert('선택한 타임슬롯이 정상적으로 차단 조치되었습니다.');
      }
    });
  };

  const handleCancelEmergencyBlock = async (startTime: string) => {
    showConfirm(`[${startTime}] 타임에 걸려있는 행정 통제를 원격 해제하시겠습니까?`, async () => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('reservation_date', selectedDate)
        .eq('slot_time', startTime)
        .eq('sport_name', '행정 통제');

      if (!error) {
        await fetchReservations(selectedDate);
        await fetchCurrentDayEmergencyBlocks();
        showAlert('행정 통제가 해제되어 대관 접수가 정상 복구되었습니다.');
      }
    });
  };

  const handleBatchBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('blocking_rules').insert([{ start_date: blockStartDate, end_date: blockEndDate, reason: blockReason }]);
    await fetchBlockingRules();
    showAlert('지정 기간 통제가 적용되었습니다.');
  };

  const hoursArray = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minsArray = ['00', '30'];
  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="space-y-4">
      {/* 운영 종목 마스터 보드 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-teal-900/40 shadow-xl space-y-3">
        <p className="text-xs font-bold text-teal-400">개설할 운동</p>
        <form onSubmit={handleAddSportMaster} className="flex gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <input type="text" placeholder="새 종목 입력" value={newSportInput} onChange={(e) => setNewSportInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none" />
          <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1 rounded text-xs">등록</button>
        </form>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {sportsMasterList.map((sport) => (
            <span key={sport} className="inline-flex items-center gap-1 bg-slate-950 text-slate-300 font-bold px-2 py-1 rounded-md text-[11px] border border-slate-800">
              {sport}
              <button type="button" onClick={() => handleDeleteSportMaster(sport)} className="text-red-500 font-extrabold ml-1">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* 예약 기간 관리 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-blue-900/40 shadow-xl space-y-3">
        <p className="text-xs font-bold text-blue-400">예약할 수 있는 기간 설정</p>
        <form onSubmit={handleSaveBookingDays} className="flex gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[11px] text-slate-400">오늘 기준 최대</span>
            <input type="number" value={maxBookingDays} onChange={(e) => setMaxBookingDays(parseInt(e.target.value, 10) || 0)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-center text-white w-20 focus:outline-none" />
            <span className="text-[11px] text-slate-400">일 후까지 개방</span>
          </div>
          <button type="submit" className="bg-blue-600 text-white font-bold px-3 py-1 rounded text-xs shadow">저장</button>
        </form>
      </div>

      {/* 시간대 규칙 설정 및 명단 제어 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <p className="text-xs font-bold text-slate-400">예약 가능 시간 설정 (관측일자: {selectedDate})</p>
        <form onSubmit={handleAddSlotConfig} className="space-y-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold">예약 대상 요일 선택</label>
            <div className="grid grid-cols-7 gap-1 bg-slate-900 p-1 rounded border border-slate-800">
              {weekDays.map((day) => (
                <button key={day} type="button" onClick={async () => { setTargetDay(day); await fetchTimeConfigs(day); }} className={`py-1 rounded text-xs font-bold transition-all ${targetDay === day ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}>{day}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold">예약 시작 시간</label>
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
              <label className="block text-[10px] text-slate-400 font-bold">예약 종료 시간</label>
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

          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold">허용 운동 종목 지정</label>
            <div className="flex flex-wrap gap-4 bg-slate-900 p-2.5 rounded border border-slate-800">
              {sportsMasterList.map((sport) => (
                <label key={sport} className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={newAllowedSports.includes(sport)} onChange={() => handleSportToggle(sport)} className="w-4 h-4 bg-slate-950 border-slate-800 rounded text-blue-600 focus:ring-0" />
                  <span>{sport}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold">운영 가능한 코트: {newMaxCourts}개</span>
            <input type="range" min={1} max={5} step={0.5} value={newMaxCourts} onChange={(e) => setNewMaxCourts(parseFloat(e.target.value))} className="w-2/3 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs shadow">[{targetDay}요일]에 스케줄 규칙 배치</button>
        </form>

        {/* 규칙 목록 인터페이스 */}
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-[11px] font-bold text-slate-400">현재 [{targetDay}요일] 규칙 명단 ({dynamicTimeConfigs?.length || 0}개)</p>
          {dynamicTimeConfigs.map((cfg) => {
            const isCurrentlyBlocked = emergencyBlockedSlots.includes(cfg.start_time);
            return (
              <div key={cfg.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800/60 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-400">{cfg.slot_name}</span>
                    {isCurrentlyBlocked && (
                      <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1 rounded border border-rose-500/30 font-black animate-pulse">행정 차단됨</span>
                    )}
                  </div>
                </div>
                
                {/* 🎯 [중중 중복 코드 완전 숙청] 이제 상세 정보와 제거 단추만 깨끗하게 남겨 레이아웃 꼬임을 방지합니다. */}
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => handleOpenDetailModal(cfg)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded text-xs border border-slate-700 transition-colors"
                  >
                    상세 정보
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteSlotConfig(cfg.id)} 
                    className="bg-red-600/20 hover:bg-red-600 text-red-400 font-bold px-3 py-1.5 rounded text-xs ml-1"
                  >
                    제거
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 기간별 통제 */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
        <p className="text-xs font-bold text-slate-400">기간별 예약 통제</p>
        <form onSubmit={handleBatchBlockSubmit} className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input type="date" value={blockStartDate} onChange={(e) => setBlockStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
            </div>
            <div>
              <input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
            </div>
          </div>
          <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
          <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2 rounded text-xs">통제 적용</button>
        </form>
      </div>

      {/* 시간대 세부 속성 편집 및 긴급 통제 컴포저 모달창 */}
      {mounted && isDetailModalOpen && selectedConfig && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[9998]">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 z-10 text-left">
            <div>
              <h3 className="text-sm font-black text-slate-200">운영 규칙 상세 설정</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">선택한 타임슬롯의 전역 규칙을 변경합니다.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold">운영 시간 타이틀 (텍스트)</label>
              <input 
                type="text" 
                value={editSlotName} 
                onChange={(e) => setEditSlotName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400 font-bold">최대 가용 코트수 ({editMaxCourts}개)</label>
              </div>
              <input 
                type="range" 
                min={1} max={5} step={0.5} 
                value={editMaxCourts} 
                onChange={(e) => setEditMaxCourts(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 font-bold">허용 운동 종목 지정</label>
              <div className="flex flex-wrap gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {sportsMasterList.map((sport) => (
                  <label key={sport} className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={editAllowedSports.includes(sport)} 
                      onChange={() => handleEditSportToggle(sport)} 
                      className="w-4 h-4 bg-slate-900 border-slate-800 rounded text-blue-600 focus:ring-0" 
                    />
                    <span>{sport}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsDetailModalOpen(false)} 
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs border border-slate-700 transition-all"
                >
                  닫기
                </button>
                <button 
                  type="button" 
                  onClick={handleUpdateSlotConfig}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  변경사항 저장
                </button>
              </div>

              {/* 모달 창 내부 하단으로 이관 배치된 긴급 통제 조작 노브 단추 구성 */}
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsDetailModalOpen(false); handleEmergencyBlock(selectedConfig.start_time); }} 
                  className="flex-1 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white font-bold text-xs border border-amber-600/30 transition-all"
                >
                  긴급 점검
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsDetailModalOpen(false); handleCancelEmergencyBlock(selectedConfig.start_time); }} 
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs border border-emerald-600/30 transition-all"
                >
                  점검 해제
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 시스템 알림 확인 공통 모달 컨테이너 */}
      {mounted && modalConfig.isOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center z-10">
            <p className="text-sm font-bold text-slate-200 whitespace-pre-line mb-6">{modalConfig.message}</p>
            <div className="flex gap-2 justify-center">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button type="button" onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs">취소</button>
                  <button type="button" onClick={modalConfig.onConfirm} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs">확인</button>
                </>
              ) : (
                <button type="button" onClick={modalConfig.onConfirm} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs">확인</button>
              )}
            </div>
          </div>
        </div>,
        document.body 
      )}
    </div>
  );
}