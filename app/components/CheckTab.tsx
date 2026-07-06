'use client';

import { useState } from 'react';
import { getMaskedUserInfo, parseRawUserInfo } from '../utils/crypto';

interface CheckTabProps {
  myReservations: any[];
  hasSearched: boolean;
  onSearch: (name: string, phone: string) => Promise<void>;
  onCancel: (id: number, inputPass: string) => Promise<boolean>;
}

export default function CheckTab({ myReservations, hasSearched, onSearch, onCancel }: CheckTabProps) {
  const [searchName, setSearchName] = useState<string>('');
  const [searchPhone, setSearchPhone] = useState<string>('');
  
  // 모달 팝업 상태 서랍 분리 관리
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);
  const [isFindPassOpen, setIsFindPassOpen] = useState<boolean>(false);

  const [selectedRes, setSelectedRes] = useState<any | null>(null);
  const [inputPass, setInputPass] = useState<string>('');
  const [isUnmasked, setIsUnmasked] = useState<boolean>(false);
  const [findPhoneLast4, setFindPhoneLast4] = useState<string>('');

  const handlePhoneFormat = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length > 3 && raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length > 7) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    return raw;
  };

  const handleVerifyDetail = () => {
    if (!selectedRes) return;
    const { password } = parseRawUserInfo(selectedRes.user_name);
    if (inputPass === password) { setIsUnmasked(true); setInputPass(''); } 
    else { alert('비밀번호가 일치하지 않습니다.'); }
  };

  const handleFindPassword = () => {
    if (!selectedRes) return;
    const { phone, password } = parseRawUserInfo(selectedRes.user_name);
    if (findPhoneLast4 === phone.replace(/[^0-9]/g, '').slice(-4)) {
      alert(`확인 완료: 예약 비밀번호는 [ ${password} ] 입니다.`);
      setIsFindPassOpen(false);
      setFindPhoneLast4('');
    } else { alert('연락처 끝 4자리가 일치하지 않습니다.'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200 animate-fadeIn">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">🔍 나의 예약 정보 확인</h2>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <input type="text" placeholder="예약자 성명 입력" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none" />
        <input type="text" placeholder="연락처 입력" value={searchPhone} maxLength={13} onChange={(e) => setSearchPhone(handlePhoneFormat(e.target.value))} className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none" />
      </div>
      <button onClick={() => onSearch(searchName, searchPhone)} className="w-full bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors shadow-sm mb-4">예약 내역 실시간 조회</button>

      {hasSearched && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          {myReservations.length === 0 ? (
            <p className="text-center p-6 text-sm text-gray-500 bg-gray-50">일치하는 예약 내역이 존재하지 않습니다.</p>
          ) : (
            <table className="w-full text-left text-sm border-collapse bg-white">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 text-xs font-bold"><th className="p-3">예약 정보 (마스킹)</th><th className="p-3">일시</th><th className="p-3">종목</th><th className="p-3 text-center">작업</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {myReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 text-gray-800">
                    <td className="p-3 font-medium text-xs">{getMaskedUserInfo(res.user_name)}</td>
                    <td className="p-3 text-xs text-gray-600">{res.reservation_date} ({res.slot_time.slice(0, 5)})</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-xs font-medium">{res.sport_name}</span></td>
                    <td className="p-3 text-center flex justify-center gap-1">
                      <button onClick={() => { setSelectedRes(res); setIsUnmasked(false); setInputPass(''); setIsDetailOpen(true); }} className="px-2 py-1 text-xs bg-blue-50 border text-blue-600 rounded">상세보기</button>
                      <button onClick={() => { setSelectedRes(res); setInputPass(''); setIsCancelOpen(true); }} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded">취소</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 상세보기 모달 */}
      {isDetailOpen && selectedRes && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-sm w-full text-black">
            <h3 className="text-lg font-bold border-b pb-2 mb-3">📋 예약 상세 정보</h3>
            <div className="space-y-2 mb-5 text-xs bg-gray-50 p-4 rounded-xl">
              <p><strong>예약 일시:</strong> {selectedRes.reservation_date} ({selectedRes.slot_time.slice(0, 5)})</p>
              <p><strong>확정 종목:</strong> {selectedRes.sport_name}</p>
              {!isUnmasked ? (
                <>
                  <p><strong>예약자명:</strong> {getMaskedUserInfo(selectedRes.user_name).split(' (')[0]}</p>
                  <p><strong>연락처:</strong> {getMaskedUserInfo(selectedRes.user_name).split(' (')[1].replace(')', '')}</p>
                </>
              ) : (
                <>
                  <p className="bg-yellow-50 p-1 rounded"><strong>성명 (원본):</strong> {parseRawUserInfo(selectedRes.user_name).name}</p>
                  <p className="bg-yellow-50 p-1 rounded"><strong>연락처 (원본):</strong> {parseRawUserInfo(selectedRes.user_name).phone}</p>
                </>
              )}
            </div>
            {!isUnmasked && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">🔒 상세 보기용 비밀번호 4자리 입력</label>
                <div className="flex gap-1.5">
                  <input type="password" maxLength={4} placeholder="비밀번호" value={inputPass} onChange={(e) => setInputPass(e.target.value.replace(/[^0-9]/g, ''))} className="flex-1 border rounded-lg p-2 text-sm text-center font-bold tracking-widest focus:outline-none" />
                  <button onClick={handleVerifyDetail} className="bg-blue-600 text-white text-xs font-bold px-4 rounded-lg">해제</button>
                </div>
                <button onClick={() => { setIsFindPassOpen(true); setFindPhoneLast4(''); }} className="text-[11px] text-gray-400 mt-2 underline block text-left bg-transparent">비밀번호를 분실하셨습니까?</button>
              </div>
            )}
            <button onClick={() => setIsDetailOpen(false)} className="w-full bg-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-lg">닫기</button>
          </div>
        </div>
      )}

      {/* 자가 취소 인증 모달 */}
      {isCancelOpen && selectedRes && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-xs w-full text-black">
            <h3 className="text-md font-bold mb-2 border-b pb-1">예약 취소 인증</h3>
            <p className="text-xs text-gray-500 mb-4">예약 등록 시 설정하셨던 숫자 4자리 비밀번호를 입력해 주십시오.</p>
            <input type="password" maxLength={4} placeholder="비밀번호" value={inputPass} onChange={(e) => setInputPass(e.target.value.replace(/[^0-9]/g, ''))} className="w-full border border-red-300 rounded-lg p-2.5 text-center font-bold text-xl tracking-widest text-red-700 bg-red-50 focus:outline-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setIsCancelOpen(false)} className="flex-1 bg-gray-100 text-xs font-semibold py-2 rounded-lg border">닫기</button>
              <button onClick={async () => { const success = await onCancel(selectedRes.id, inputPass); if (success) setIsCancelOpen(false); }} className="flex-1 bg-red-600 text-white text-xs font-semibold py-2 rounded-lg">인증 및 취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 찾기 모달 */}
      {isFindPassOpen && selectedRes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-xs w-full text-black">
            <h4 className="text-sm font-bold text-blue-700 mb-2">🔑 비밀번호 실시간 조회</h4>
            <p className="text-[11px] text-gray-500 mb-4">연락처의 마지막 끝 4자리 숫자를 입력해 주십시오.</p>
            <input type="text" maxLength={4} placeholder="예: 5678" value={findPhoneLast4} onChange={(e) => setFindPhoneLast4(e.target.value.replace(/[^0-9]/g, ''))} className="w-full border border-blue-300 rounded-lg p-2 text-center font-bold text-lg text-blue-900 bg-blue-50 focus:outline-none mb-4" />
            <div className="flex gap-1.5">
              <button onClick={() => setIsFindPassOpen(false)} className="flex-1 bg-gray-100 text-xs font-semibold py-2 rounded-lg border">취소</button>
              <button onClick={handleFindPassword} className="flex-1 bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg">번호 확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}