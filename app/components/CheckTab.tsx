'use client';

import React, { useState } from 'react';

interface Reservation {
  id: number;
  reservation_date: string;
  slot_time: string;
  sport_name: string;
  user_name: string;
}

interface CheckTabProps {
  myReservations: Reservation[];
  hasSearched: boolean;
  onSearch: (type: 'name' | 'phone', value: string) => Promise<void>;
  onCancel: (id: number, inputPass: string) => Promise<boolean>;
  isDarkMode?: boolean;
}

export default function CheckTab({
  myReservations,
  hasSearched,
  onSearch,
  onCancel,
  isDarkMode = false,
}: CheckTabProps) {
  const [searchType, setSearchType] = useState<'name' | 'phone'>('name');
  const [searchValue, setSearchValue] = useState('');
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [inputPass, setInputPass] = useState('');
  
  const [isViewingResults, setIsViewingResults] = useState(true);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSearch(searchType, searchValue);
    setSelectedRes(null);
    setIsViewingResults(true); 
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes) return;
    const success = await onCancel(selectedRes.id, inputPass);
    if (success) {
      setInputPass('');
      setSelectedRes(null);
    }
  };

  // user_name 컬럼에 조합된 [비밀번호] 및 명세 파싱 유틸
  const parseDisplayInfo = (rawName: string) => {
    if (!rawName) return { name: '', phone: '', password: '', head: '', court: '' };
    const namePart = rawName.split(' (')[0] || '';
    
    // 비밀번호 추출 구문 추가
    const passMatch = rawName.match(/\[(.*?)\]/);
    const specMatch = rawName.match(/\{([\d.]+)명\/([\d.]+)코트\}/);
    
    return {
      name: namePart,
      password: passMatch ? passMatch[1] : '****',
      head: specMatch ? specMatch[1] : '1',
      court: specMatch ? specMatch[2] : '1',
    };
  };

  // 🎯 문자 메시지(SMS) 내보내기 핸들러 추가
  const handleShareViaSMS = () => {
    if (!selectedRes) return;
    const details = parseDisplayInfo(selectedRes.user_name);
    
    // 💌 활기차면서도 예의 바른 공식 예약 알림 문자 본문 구성
    const smsBody = `[운암복합문화체육센터]

✨ 주민의 건강한 일상 파트너! ✨
운암복합문화체육센터 시설 예약이 정보를 알려드립니다!

📅 예약 일정 : ${selectedRes.reservation_date}
⏰ 예약 시간 : ${selectedRes.slot_time.slice(0, 5)}
👤 예약자 성함 : ${details.name} 님
🏸 예약 종목 : ${selectedRes.sport_name} (${details.court}코트 / ${details.head}명)
🔐 비밀번호 : ${details.password}

💡 이용 시 주의사항
- 깨끗하고 안전한 시설 관리를 위해 실내 운동화를 꼭 지참해 주세요!
- 다른 주민분들의 원활한 이용을 위해, 불가피한 사정으로 사용이 어려우실 경우 반드시 예약을 사전에 취소해 주시는 배려를 부탁드립니다!

오늘도 활기차고 건강한 하루 보내세요! 감동을 드리는 운암복합문화체육센터 드림`;

    // 📱 기기별 웹 표준 SMS 공유 링크 작동 처리 (공백 및 특수문자 인코딩)
    const encodedBody = encodeURIComponent(smsBody);
    
    // iOS/macOS 환경과 안드로이드 환경에 맞는 구분자 분기 처리
    const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const smsUrl = isApple ? `sms:&body=${encodedBody}` : `sms:?body=${encodedBody}`;
    
    window.location.href = smsUrl;
  };

  const currentDisplay = selectedRes ? parseDisplayInfo(selectedRes.user_name) : null;
  const firstResultDisplay = myReservations.length > 0 ? parseDisplayInfo(myReservations[0].user_name) : null;

  return (
    <div className="w-full max-w-md mx-auto py-12 md:py-16 space-y-8 transition-all duration-300 ease-out">
      
      {hasSearched && isViewingResults && (
        <div className={`rounded-2xl p-3 flex items-center justify-between text-xs font-semibold animate-fade-in shadow-sm transition-colors ${
          isDarkMode ? 'bg-[#22222a]' : 'bg-slate-100/60'
        }`}>
          <button
            type="button"
            onClick={() => {
              if (selectedRes) {
                setSelectedRes(null);
              } else {
                setIsViewingResults(false);
                setSearchValue('');
              }
            }}
            className={`transition-colors font-bold px-2 ${
              isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ← {selectedRes ? '목록으로' : '다시 조회하기'}
          </button>
        </div>
      )}

      <div className="space-y-2 px-1">
        <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">RESERVATION CHECK</span>
        <h2 className={`text-xl font-black tracking-tight leading-snug transition-colors whitespace-pre-line ${
          isDarkMode ? 'text-slate-100' : 'text-slate-900'
        }`}>
          {selectedRes && currentDisplay
            ? `${currentDisplay.name} 님의\n상세 예약 내역입니다`
            : hasSearched && isViewingResults && firstResultDisplay
              ? `${firstResultDisplay.name} 님의\n예약 목록을 찾았어요`
              : '어떤 정보로\n예약을 조회할까요?'}
        </h2>
      </div>

      {(!hasSearched || !isViewingResults) && !selectedRes && (
        <form onSubmit={handleSearchSubmit} className="space-y-4 animate-fade-in">
          <div className={`p-5 rounded-2xl border transition-colors shadow-sm ${
            isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200/60'
          }`}>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSearchType('name')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm ${
                  searchType === 'name'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : isDarkMode ? 'bg-[#1d1d24] text-slate-400' : 'bg-slate-50 text-slate-500'
                }`}
              >
                이름으로 검색
              </button>
              <button
                type="button"
                onClick={() => setSearchType('phone')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm ${
                  searchType === 'phone'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : isDarkMode ? 'bg-[#1d1d24] text-slate-400' : 'bg-slate-50 text-slate-500'
                }`}
              >
                전화번호 검색
              </button>
            </div>

            <input
              type="text"
              autoFocus
              placeholder={searchType === 'name' ? '예약자 성함을 입력하세요' : '전화번호 뒷자리를 입력하세요'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={`w-full border-b-2 px-1 py-3 text-sm font-semibold focus:outline-none bg-transparent transition-colors ${
                isDarkMode 
                  ? 'border-slate-800 focus:border-blue-500 text-slate-100 placeholder-slate-600' 
                  : 'border-slate-200 focus:border-blue-600 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={!searchValue.trim()}
            className={`w-full font-extrabold text-xs py-4 rounded-2xl transition-all shadow-md duration-150 ${
              searchValue.trim()
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98] shadow-blue-600/10'
                : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            예약 조회하기
          </button>
        </form>
      )}

      {hasSearched && isViewingResults && !selectedRes && (
        <div className="space-y-3 animate-slide-up px-1">
          <p className={`text-[11px] font-bold transition-colors ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            조회된 예약 중 확인할 일정을 선택해 주세요 (총 {myReservations.length}건)
          </p>
          <div className="space-y-2">
            {myReservations.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  조회된 대관 내역이 없습니다. 정보를 다시 확인해 주세요. 🔍
                </p>
                <button
                  type="button"
                  onClick={() => { setIsViewingResults(false); setSearchValue(''); }}
                  className="inline-block text-[11px] text-blue-500 font-extrabold border-b border-blue-500/40 pb-0.5"
                >
                  돌아가서 다시 입력하기
                </button>
              </div>
            ) : (
              myReservations.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setSelectedRes(res)}
                  className={`w-full px-5 py-4 rounded-2xl border text-left transition-all flex items-center justify-between group shadow-sm duration-150 active:scale-[0.995] ${
                    isDarkMode 
                      ? 'bg-[#22222a] border-slate-800/80 text-slate-200 hover:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-800 hover:border-blue-600'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-extrabold tracking-tight">
                      {res.reservation_date}
                    </span>
                    <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      시작 시간: {res.slot_time.slice(0, 5)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {res.sport_name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedRes && currentDisplay && (
        <div className="space-y-5 animate-slide-up">
          
          <div className={`p-6 rounded-2xl border transition-colors shadow-sm space-y-4 ${
            isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200/60'
          }`}>
            <div className="flex justify-between items-center border-b pb-3 transition-colors border-slate-100 dark:border-slate-800/60">
              <h3 className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>확인된 대관 티켓</h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                isDarkMode ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                조회 매칭 완료
              </span>
            </div>
            
            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-slate-400">예약한 시간</span>
                <span className={`font-mono font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{selectedRes.reservation_date} ({selectedRes.slot_time.slice(0, 5)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">예약한 사람</span>
                <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{currentDisplay.name} 님</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">예약한 종목</span>
                <span className="font-extrabold text-blue-500">{selectedRes.sport_name}</span>
              </div>
              <div className="flex justify-between border-t pt-2.5 transition-colors border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">이용 자원 명세</span>
                <span className={`font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{currentDisplay.head}명 / {currentDisplay.court}코트</span>
              </div>
            </div>
          </div>

          {/* 🎯 [대개정] 카카오톡 대신 예의 바르고 활기찬 문장 포맷의 SMS 내보내기 연동 */}
          <button
            type="button"
            onClick={handleShareViaSMS}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-4 rounded-2xl transition-all shadow-md shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <span>💬</span> 예약 정보 문자(SMS)로 공유하기
          </button>

          <form onSubmit={handleCancelSubmit} className={`p-6 rounded-2xl border transition-colors shadow-sm space-y-4 ${
            isDarkMode ? 'bg-[#22222a] border-slate-800' : 'bg-white border-slate-200/60'
          }`}>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-rose-500">이 예약을 취소할까요?</h3>
              <p className="text-[10px] text-slate-400 font-medium">본인 확인을 위해 예약 당시 설정한 비밀번호 4자리를 입력해 주세요.</p>
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="password"
                maxLength={4}
                placeholder="비밀번호 4자리"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value.replace(/[^0-9]/g, ''))}
                className={`flex-1 border-b-2 px-1 py-2 text-center text-xs font-mono font-bold tracking-widest focus:outline-none bg-transparent transition-colors ${
                  isDarkMode 
                    ? 'border-slate-800 focus:border-blue-500 text-slate-100 placeholder-slate-700' 
                    : 'border-slate-200 focus:border-blue-600 text-slate-800 placeholder-slate-300'
                }`}
              />
              <button
                type="submit"
                disabled={inputPass.length !== 4}
                className={`px-5 py-3 rounded-xl text-[11px] font-extrabold transition-all shrink-0 shadow-sm ${
                  inputPass.length === 4
                    ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.96]'
                    : isDarkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                예약 취소하기
              </button>
            </div>
          </form>

        </div>
      )}
    </div>
  );
}