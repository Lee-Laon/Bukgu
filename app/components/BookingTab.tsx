'use client';

import { useState } from 'react';

interface BookingTabProps {
  timeSlots: any[];
  weekdayRules: any;
  dayOfWeek: string;
  sports: string[];
  getTimeLockStatus: (startTime: string) => 'none' | 'past' | 'imminent';
  getSlotStatusInfo: (slotId: string, startTime: string) => any;
  onReservationSubmit: (slot: any, sport: string, name: string, phone: string, pass: string) => Promise<void>;
  resultMessage: { success: boolean; message: string } | null;
  setResultMessage: any;
  selectedSlot: any;
  setSelectedSlot: any;
}

export default function BookingTab({
  timeSlots, weekdayRules, dayOfWeek, sports, getTimeLockStatus, getSlotStatusInfo,
  onReservationSubmit, resultMessage, setResultMessage, selectedSlot, setSelectedSlot
}: BookingTabProps) {
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handlePhoneFormat = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length > 3 && raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length > 7) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    return raw;
  };

  const openModal = (sportName: string) => {
    if (!selectedSlot) return;
    const slotId = timeSlots.find(s => s.startTime === selectedSlot.startTime)?.id || '';
    const restriction = weekdayRules[dayOfWeek]?.[slotId];

    if (restriction === '배드민턴 강좌' && sportName !== '배드민턴') {
      alert('해당 시간대는 배드민턴 강좌 전용 시간대이므로 배드민턴 종목만 예약이 가능합니다.');
      return;
    }
    setSelectedSport(sportName);
    setResultMessage(null);
    setIsModalOpen(false);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200 animate-fadeIn">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">원하시는 시간대를 선택하세요</label>
        <div className="grid grid-cols-2 gap-2">
          {timeSlots.map((slot) => {
            const restriction = weekdayRules[dayOfWeek]?.[slot.id];
            const lockStatus = getTimeLockStatus(slot.startTime);
            const status = getSlotStatusInfo(slot.id, slot.startTime);
            const isSelectable = !restriction && lockStatus === 'none' && !status.isFull;

            return (
              <button
                key={slot.id} disabled={!isSelectable}
                onClick={() => { setSelectedSlot({ name: slot.name, startTime: slot.startTime }); setResultMessage(null); setSelectedSport(''); }}
                className={`py-3 px-4 rounded-lg font-medium text-sm transition-all border text-left flex justify-between items-center ${
                  !isSelectable ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-60' : selectedSlot?.name === slot.name ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col">
                  <span>{slot.name}</span>
                  {!restriction && lockStatus === 'none' && <span className="text-[10px] text-gray-400 font-normal">잔여: {status.remainingCourts}코트</span>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-md font-semibold tracking-wide shadow-sm ${restriction ? 'bg-red-100 text-red-700' : lockStatus === 'past' ? 'bg-gray-100 text-gray-500 border border-gray-200' : lockStatus === 'imminent' ? 'bg-orange-100 text-orange-700 border border-orange-200' : status.isFull ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{restriction ? restriction : lockStatus === 'past' ? '예약불가' : lockStatus === 'imminent' ? '현장예약' : status.isFull ? '코트마감' : '예약 가능'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedSlot && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. [ {selectedSlot.name} ] 에 신청할 종목 선택</label>
          <div className="grid grid-cols-3 gap-2">
            {sports.map((sport) => (
              <button key={sport} onClick={() => openModal(sport)} className={`py-3 px-4 rounded-lg font-medium text-sm transition-colors border ${selectedSport === sport ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{sport}</button>
            ))}
          </div>
        </div>
      )}

      {resultMessage && <div className={`p-4 rounded-lg border text-sm font-medium transition-all ${resultMessage.success ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>{resultMessage.message}</div>}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-6 text-black">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">📋 예약자 정보 입력</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">예약자명</label>
                <input type="text" placeholder="이름을 입력하세요" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">연락처</label>
                <input type="text" maxLength={13} placeholder="010-XXXX-XXXX" value={userPhone} onChange={(e) => setUserPhone(handlePhoneFormat(e.target.value))} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-black focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">🔑 예약 취소용 비밀번호 (숫자 4자리)</label>
                <input type="password" maxLength={4} placeholder="숫자 4자리 입력" value={userPassword} onChange={(e) => setUserPassword(e.target.value.replace(/[^0-9]/g, ''))} className="w-full border border-blue-300 rounded-lg p-2 text-sm font-bold text-blue-900 bg-blue-50 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm border">취소</button>
              <button onClick={() => { onReservationSubmit(selectedSlot, selectedSport, userName, userPhone, userPassword); setIsModalOpen(false); }} className="flex-1 bg-blue-600 text-white font-medium py-2 rounded-lg text-sm shadow-md">예약하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}