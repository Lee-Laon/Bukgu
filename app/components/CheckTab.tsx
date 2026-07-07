'use client';

import { useState } from 'react';
import { parseRawUserInfo } from '../utils/crypto';

interface CheckTabProps {
  myReservations: any[];
  hasSearched: boolean;
  onSearch: (type: 'name' | 'phone', value: string) => Promise<void>;
  onCancel: (id: number, inputPass: string) => Promise<boolean>;
}

export default function CheckTab({ myReservations, hasSearched, onSearch, onCancel }: CheckTabProps) {
  const [searchType, setSearchType] = useState<'name' | 'phone'>('name');
  const [searchValue, setSearchValue] = useState('');
  
  // 비밀번호 입력 및 찾기 관리용 상태 배열
  const [passwords, setPasswords] = useState<{ [key: number]: string }>({});
  const [findPassTarget, setFindPassTarget] = useState<any | null>(null);
  const [middlePhoneInput, setMiddlePhoneInput] = useState('');

  // ⏱️ [UX] 연락처 검색 시 하이픈(-)을 자동으로 넣어주는 가이드 헬퍼
  const handleSearchValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (searchType === 'phone') {
      const raw = val.replace(/[^0-9]/g, '');
      let formatted = raw;
      if (raw.length <= 3) formatted = raw;
      else if (raw.length <= 7) formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
      else formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
      setSearchValue(formatted);
    } else {
      setSearchValue(val);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchType, searchValue);
    setFindPassTarget(null); // 검색 시 비밀번호 찾기 모달/창 초기화
  };

  // 🔒 [보안 추가] 마스킹된 가운데 자리를 정확히 입력했는지 판별하는 엔진
  const verifyAndShowPassword = () => {
    if (!findPassTarget) return;
    
    // DB의 user_name 데이터 구조: "홍길동 (010-1234-5678) [1234] {인원/코트}"
    const { phone, password } = parseRawUserInfo(findPassTarget.user_name);
    
    // 하이픈 기준으로 분할하여 가운데 자리만 추출 ("1234")
    const phoneParts = phone.split('-');
    const realMiddleNumber = phoneParts[1] || '';

    if (realMiddleNumber === middlePhoneInput.trim()) {
      alert(`🔑 검증 성공!\n해당 예약의 비밀번호는 [ ${password} ] 입니다.`);
      setFindPassTarget(null);
      setMiddlePhoneInput('');
    } else {
      alert('❌ 입력하신 휴대전화 가운데 자리가 일치하지 않습니다. 다시 확인해 주세요.');
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5 animate-fadeIn text-black">
      
      {/* 검색 서식 영역 */}
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <p className="text-sm font-bold text-gray-700">🔍 예약 내역 조회 및 취소 창구</p>
        <div className="flex gap-2">
          <select
            value={searchType}
            onChange={(e) => { setSearchType(e.target.value as 'name' | 'phone'); setSearchValue(''); }}
            className="border rounded-lg p-2 text-sm bg-gray-50 font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="name">이름 검색</option>
            <option value="phone">연락처 검색</option>
          </select>
          <input
            type="text"
            required
            placeholder={searchType === 'name' ? '예약자 성함을 입력하세요' : '010-0000-0000'}
            maxLength={searchType === 'phone' ? 13 : 20}
            value={searchValue}
            onChange={handleSearchValueChange}
            className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 rounded-lg text-sm transition-all shadow-sm">
            조회
          </button>
        </div>
      </form>

      {/* 🔐 [보안 고도화] 비밀번호 분실 시 가운데 자리 맞추기 서식 인터페이스 */}
      {findPassTarget && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-blue-200 pb-1.5">
            <span className="text-xs font-bold text-blue-800">🔑 예약 비밀번호 찾기 (보안 검증)</span>
            <button type="button" onClick={() => { setFindPassTarget(null); setMiddlePhoneInput(''); }} className="text-xs text-gray-400 hover:text-gray-600 font-bold">닫기</button>
          </div>
          
          {/* 마스킹 처리 가이드 출력 */}
          <p className="text-xs text-gray-600">
            예약 정보 보호를 위해 가운데 자리가 마스킹 처리되었습니다.<br />
            실제 본인의 예약이 맞다면 가려진 <span className="font-bold text-blue-600">가운데 4자리(또는 3자리) 숫자</span>를 입력해 주세요.
          </p>

          <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-2 border rounded-lg font-mono text-sm text-gray-400 tracking-wider">
              {(() => {
                const { phone } = parseRawUserInfo(findPassTarget.user_name);
                const parts = phone.split('-');
                return `${parts[0] || '010'}-****-${parts[2] || '0000'}`;
              })()}
            </div>
            <input
              type="text"
              placeholder="가운데 번호 입력"
              maxLength={4}
              value={middlePhoneInput}
              onChange={(e) => setMiddlePhoneInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-32 border rounded-lg p-2 text-sm text-center font-bold focus:outline-none focus:border-blue-500 bg-white"
            />
            <button
              type="button"
              onClick={verifyAndShowPassword}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition-all shadow"
            >
              확인인
            </button>
          </div>
        </div>
      )}

      {/* 조회 결과 리스트 */}
      {hasSearched && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500">조회 결과: 총 {myReservations.length}건의 예약 발견</p>
          
          {myReservations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 font-medium">일치하는 예약 내역이 존재하지 않습니다. 🗓️</p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {myReservations.map((res) => {
                const { phone } = parseRawUserInfo(res.user_name);
                const cleanName = res.user_name.split(' (')[0];

                // 코트수와 인원수 문자열 파싱 기법
                const headMatch = res.user_name.match(/\{([\d.]+)명/);
                const courtMatch = res.user_name.match(/\/([\d.]+)코트\}/);
                const showHead = headMatch ? `${headMatch[1]}명` : '1명';
                const showCourt = courtMatch ? `${courtMatch[1]}코트` : '1코트';

                return (
                  <div key={res.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-hover hover:bg-gray-50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">{res.sport_name}</span>
                        <span className="text-sm font-bold text-gray-800">{cleanName}님 ({phone})</span>
                      </div>
                      <div className="text-xs font-semibold text-gray-500">
                        🗓️ 날짜: {res.reservation_date} | ⏱️ 시간: {res.slot_time}
                      </div>
                      <div className="text-[11px] font-bold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded inline-block">
                        👥 입장: {showHead} / 🏸 대관: {showCourt}
                      </div>
                    </div>

                    {/* 제어 기믹 인터페이스 구역 */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => { setFindPassTarget(res); setMiddlePhoneInput(''); }}
                        className="text-[10px] font-bold text-blue-600 hover:underline mr-1"
                      >
                        비밀번호 분실?
                      </button>
                      <input
                        type="password"
                        placeholder="비밀번호 4자리"
                        maxLength={4}
                        value={passwords[res.id] || ''}
                        onChange={(e) => setPasswords({ ...passwords, [res.id]: e.target.value.replace(/[^0-9]/g, '') })}
                        className="w-24 border rounded-lg p-1.5 text-xs text-center focus:outline-none focus:border-red-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const inputPass = passwords[res.id] || '';
                          if (!inputPass) { alert('비밀번호를 입력해 주세요.'); return; }
                          const success = await onCancel(res.id, inputPass);
                          if (success) { setPasswords({ ...passwords, [res.id]: '' }); }
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
                      >
                        취소요청
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}