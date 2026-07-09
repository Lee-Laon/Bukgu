'use client';

import { useState, useEffect, useRef } from 'react';
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

  // 🎯 [자유대화 생성형 AI 챗봇 스테이트]
  const [isBotOpen, setIsBotOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const [botMessages, setBotMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    { sender: 'bot', text: '안녕하세요! 운암복합문화체육센터의 똑똑한 가이드 AI입니다. 🏛️\n\n궁금한 점을 자유롭게 입력하시거나 위의 추천 질문을 터치해 보세요!' }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBotOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [botMessages, isBotOpen, isBotTyping]);

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
    if (selectedDate < todayStr) { alert('❌ 과거 날짜에는 예약을 진행할 수 없습니다.'); return; }
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

  const adaptedTimeSlots = dynamicTimeConfigs.map(c => ({
    id: c.id, 
    name: c.slot_name, 
    startTime: c.start_time, 
    allowedSports: c.allowed_sports
  }));

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputDate = e.target.value;
    if (inputDate < todayStr) {
      alert('📅 과거 날짜는 조회 및 예약이 불가능합니다. 오늘 날짜로 자동 복귀합니다.');
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(inputDate);
    }
  };

  // 🎯 [생성형 AI 전송 로직 핵심부]
  const executeAiResponse = (userText: string) => {
    setIsBotTyping(true);

    setTimeout(() => {
      let response = `제안해주신 '${userText}'에 대해 열심히 분석해 보았어요. 🔍\n\n현재 센터 정책 데이터에 따르면, 원하시는 세부 예약 일정이나 취소 조율은 시스템 내 '예약하기' 및 '내 예약' 탭 터치 한 번으로 안전하게 처리하실 수 있습니다. 혹시 더 구체적인 이용 수칙이나 종목 제한 규정이 궁금하신가요?`;

      if (userText.includes('안녕') || userText.includes('하이')) {
        response = '안녕하세요! 반갑습니다. 😊 운암복합문화체육센터를 이용하시는 데 불편함이 없도록 실시간 가이드를 도와드리는 지능형 봇입니다. 무엇을 도와드릴까요?';
      } else if (userText.includes('며칠') || userText.includes('언제') || userText.includes('오픈') || userText.includes('날짜')) {
        response = '📅 예약 가능 범위는 시스템 설정 모듈에 따라 오늘을 기준으로 최대 7일간 열려있어요!\n\n매일 정각이 되면 Supabase 실시간 연동 파이프라인을 타고 새로운 날짜의 예약 슬롯이 자동으로 생성되어 열리니 참고해 주세요.';
      } else if (userText.includes('종목') || userText.includes('배드민턴') || userText.includes('농구') || userText.includes('피클볼')) {
        response = '🏸 종목 개설 제한 규칙을 알려드릴게요!\n\n센터 안전 및 원활한 매칭을 위해 한 시간대(슬롯)에는 최대 2개의 서로 다른 종목까지만 예약이 허용됩니다. 3번째 종목을 개설하려고 하면 시스템이 안전하게 차단하니까 걱정 마세요!';
      } else if (userText.includes('비용') || userText.includes('가격') || userText.includes('얼마') || userText.includes('무료')) {
        response = '💸 이용 요금은 전액 무료입니다!\n\n현재 운암복합문화체육센터 모바일 예약 연동 릴리즈를 기념하여 별도의 결제 없이 무료로 대관을 지원하고 있습니다. 부담 없이 편하게 예약해 보세요.';
      } else if (userText.includes('준비물') || userText.includes('신발') || userText.includes('실내화')) {
        response = '👟 필수 지참 준비물 안내입니다!\n\n체육관 바닥 코트 보호를 위해 구두나 실외 운동화 착용은 엄격히 가드 처리됩니다. 반드시 깨끗한 [실내 전용 운동화/실내화]를 지참하여 현장에 입장해 주세요!';
      } else if (userText.includes('취소') || userText.includes('삭제') || userText.includes('비밀번호')) {
        response = '🔍 예약 확인 및 취소 방법입니다!\n\n하단의 세 번째 [내 예약] 탭으로 이동하셔서 성함이나 전화번호를 입력하시면 원페이지 원띵 플로우로 내역이 정돈됩니다. 대관 예약 시 입력하셨던 비밀번호 4자리를 치시면 0.1초 만에 안전하게 즉시 취소됩니다.';
      } else if (userText.includes('위치') || userText.includes('지도') || userText.includes('어디') || userText.includes('주소')) {
        response = '📍 센터 오시는 길 안내입니다!\n\n광주광역시 북구 북문대로98번길 20 (운암복합문화체육센터)에 위치하고 있습니다. 네 번째 [오시는 길] 탭을 터치하시면 토스 다크 테마가 연동된 반응형 지도 스케일과 네이버/카카오맵 원터치 연동 칩을 바로 확인하실 수 있어요!';
      }

      setBotMessages(prev => [...prev, { sender: 'bot', text: response }]);
      setIsBotTyping(false);
    }, 600);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isBotTyping) return;
    const userText = chatInput.trim();
    setBotMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    executeAiResponse(userText);
  };

  // 🎯 [반투명 말풍선 칩 클릭 시 자동 입력 수령 레일]
  const handleChipClick = (question: string) => {
    if (isBotTyping) return;
    setBotMessages(prev => [...prev, { sender: 'user', text: question }]);
    executeAiResponse(question);
  };

  return (
    <div className={`min-h-screen w-full font-sans antialiased selection:bg-blue-100 transition-colors duration-300 flex flex-col ${
      isDarkMode ? 'bg-[#17171c] text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* 상단 테마 토글 스위치 */}
      <div className="w-full max-w-md mx-auto pt-4 px-5 flex justify-end">
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-tight transition-all active:scale-[0.95] shadow-sm border ${
            isDarkMode ? 'bg-[#22222a] border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          {isDarkMode ? '☀️ 라이트 모드로' : '🌙 다크 모드로'}
        </button>
      </div>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-32 flex flex-col">
        {activeTab !== 'map' && (
          <div className="w-full mt-3 animate-fade-in">
            <div className={`flex flex-col gap-1.5 p-4 rounded-2xl border transition-colors shadow-sm ${
              isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200/60'
            }`}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">조회 기준일 선택</label>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                  isDarkMode ? 'bg-blue-950/40 text-blue-400 border-blue-900' : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                  {dayOfWeek}요일
                </span>
              </div>
              <input 
                type="date"
                value={selectedDate}
                min={todayStr}
                max={maxDateStr}
                onChange={handleDateChange}
                className={`w-full text-xs font-bold focus:outline-none bg-transparent cursor-pointer pt-0.5 ${
                  isDarkMode ? 'text-slate-100' : 'text-slate-800'
                }`}
              />
            </div>
          </div>
        )}

        <div className={`w-full flex-1 ${isDarkMode ? 'dark' : ''}`}>
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
              isDarkMode={isDarkMode}
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
              sports={globalSports}
              isDarkMode={isDarkMode}
            />
          )}
          
          {activeTab === 'check' && (
            <CheckTab 
              myReservations={myReservations} 
              hasSearched={hasSearched} 
              onSearch={handleStrictSearch} 
              onCancel={handleUserCancel} 
              isDarkMode={isDarkMode}
            />
          )}
          
          {activeTab === 'map' && (
            <MapSection isDarkMode={isDarkMode} />
          )}
        </div>
      </main>

      {/* 📱 플로팅 챗봇 버튼 */}
      <div className="fixed bottom-20 right-4 z-40 max-w-md w-full flex justify-end px-4 pointer-events-none">
        <button
          type="button"
          onClick={() => setIsBotOpen(true)}
          className="pointer-events-auto w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center justify-center text-lg font-bold hover:scale-110 active:scale-[0.95] transition-all animate-bounce"
        >
          💬
        </button>
      </div>

      {/* 📱 ⚡ [고도화 빌드] 입력창 레이어 교정 및 반투명 FAQ 칩 챗봇 모달 */}
      {isBotOpen && (
        <div 
          onClick={() => setIsBotOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl border-t p-5 shadow-2xl animate-slide-up h-[80vh] flex flex-col transition-colors pb-8 ${
              isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 opacity-50 cursor-pointer" onClick={() => setIsBotOpen(false)} />
            
            <div className="flex justify-between items-center border-b pb-2 mt-2 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <h3 className="text-sm font-black tracking-tight">🏛️ 가이드 코파일럿</h3>
              </div>
              <button onClick={() => setIsBotOpen(false)} className="text-xs text-slate-400 font-bold hover:text-slate-600">닫기</button>
            </div>

            {/* 실시간 챗 스크롤 스트림 박스 (하단 여백 확보로 인풋과 차단) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-3 text-xs flex flex-col mb-2">
              {botMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed font-semibold shadow-sm whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : isDarkMode ? 'bg-[#17171c] text-slate-200 rounded-bl-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="flex justify-start animate-pulse">
                  <div className={`rounded-2xl px-4 py-2.5 text-[11px] font-bold ${
                    isDarkMode ? 'bg-[#17171c] text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>
                    AI가 최적의 답변 문장을 조합하는 중... ⚡
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 🎯 ⚡ [요청 반영] 입력창 위에 둥둥 떠 있는 반투명 가이드 말풍선 칩들 */}
            <div className="w-full pb-2 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                type="button"
                onClick={() => handleChipClick('📅 몇일 전부터 예약 가능해?')}
                className={`flex-shrink-0 px-3 py-2 text-[10px] font-extrabold rounded-full backdrop-blur-md border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-100/80 border-slate-200/60 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📅 오픈 기준
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('🏸 한 타임에 몇개 종목까지 개설돼?')}
                className={`flex-shrink-0 px-3 py-2 text-[10px] font-extrabold rounded-full backdrop-blur-md border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-100/80 border-slate-200/60 text-slate-700 hover:bg-slate-200'
                }`}
              >
                🏸 종목 제한 규정
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('💸 이용 요금은 얼마야?')}
                className={`flex-shrink-0 px-3 py-2 text-[10px] font-extrabold rounded-full backdrop-blur-md border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-100/80 border-slate-200/60 text-slate-700 hover:bg-slate-200'
                }`}
              >
                💸 대관 가격
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('👟 필수 준비물이 있어?')}
                className={`flex-shrink-0 px-3 py-2 text-[10px] font-extrabold rounded-full backdrop-blur-md border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800' 
                    : 'bg-slate-100/80 border-slate-200/60 text-slate-700 hover:bg-slate-200'
                }`}
              >
                👟 신발/준비물
              </button>
            </div>

            {/* 💬 입력 영역 가드 배치 (하단 패딩 및 마진 조정으로 사파리 내비 바 완전 극복) */}
            <form onSubmit={handleSendChatMessage} className="flex gap-2 w-full pb-4">
              <input
                type="text"
                placeholder="질문을 입력하거나 위의 칩을 터치하세요"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className={`flex-1 px-4 py-3 rounded-xl text-xs font-semibold focus:outline-none transition-colors border ${
                  isDarkMode 
                    ? 'bg-[#17171c] border-slate-800 text-slate-100 focus:border-blue-500 placeholder-slate-600' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-600 placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isBotTyping}
                className={`px-4 rounded-xl text-xs font-extrabold transition-all shadow-sm ${
                  chatInput.trim() && !isBotTyping
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    : isDarkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                전송
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 하단 내비게이션 바 고정 */}
      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur-lg transition-colors ${
        isDarkMode ? 'bg-[#17171c]/95 border-slate-800' : 'bg-white/95 border-slate-200/50'
      }`}>
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <button onClick={() => { setActiveTab('dashboard'); setResultMessage(null); }} className="flex-1 flex flex-col items-center justify-center h-full transition-all gap-1 active:scale-[0.93]">
            <span className={`text-[17px] ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📋</span>
            <span className={`text-[10px] tracking-tight font-bold ${activeTab === 'dashboard' ? 'text-blue-500 font-black' : 'text-slate-400 font-semibold'}`}>지금 현황</span>
          </button>
          <button onClick={() => { setActiveTab('booking'); setSelectedSlot(null); setResultMessage(null); }} className="flex-1 flex flex-col items-center justify-center h-full transition-all gap-1 active:scale-[0.93]">
            <span className={`text-[17px] ${activeTab === 'booking' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📅</span>
            <span className={`text-[10px] tracking-tight font-bold ${activeTab === 'booking' ? 'text-blue-500 font-black' : 'text-slate-400 font-semibold'}`}>예약하기</span>
          </button>
          <button onClick={() => { setActiveTab('check'); setResultMessage(null); }} className="flex-1 flex flex-col items-center justify-center h-full transition-all gap-1 active:scale-[0.93]">
            <span className={`text-[17px] ${activeTab === 'check' ? 'opacity-100' : 'opacity-40 grayscale'}`}>🔍</span>
            <span className={`text-[10px] tracking-tight font-bold ${activeTab === 'check' ? 'text-blue-500 font-black' : 'text-slate-400 font-semibold'}`}>내 예약</span>
          </button>
          <button onClick={() => { setActiveTab('map'); setResultMessage(null); }} className="flex-1 flex flex-col items-center justify-center h-full transition-all gap-1 active:scale-[0.93]">
            <span className={`text-[17px] ${activeTab === 'map' ? 'opacity-100' : 'opacity-40 grayscale'}`}>📍</span>
            <span className={`text-[10px] tracking-tight font-bold ${activeTab === 'map' ? 'text-blue-500 font-black' : 'text-slate-400 font-semibold'}`}>오시는 길</span>
          </button>
        </div>
      </nav>

      {/* 최종 피드백 모달 */}
      {resultMessage && resultMessage.message && (
        <div onClick={() => setResultMessage(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in cursor-pointer">
          <div onClick={(e) => e.stopPropagation()} className={`border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 cursor-default transition-colors ${
            isDarkMode ? 'bg-[#22222a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="text-xs leading-relaxed font-semibold whitespace-pre-line">{resultMessage.message}</div>
            <button onClick={() => setResultMessage(null)} className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm ${resultMessage.success ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}