'use client';

interface DashboardTabProps {
  selectedDate: string;
  dayOfWeek: string;
  timeSlots: any[];
  weekdayRules: any;
  dbReservations: any[];
  getTimeLockStatus: (startTime: string) => 'none' | 'past' | 'imminent';
  getSlotStatusInfo: (slotId: string, startTime: string) => any;
  onSlotClick: (slot: any) => void;
}

export default function DashboardTab({
  selectedDate, dayOfWeek, timeSlots, weekdayRules, dbReservations, getTimeLockStatus, getSlotStatusInfo, onSlotClick
}: DashboardTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200 animate-fadeIn">
      <h2 className="text-xl font-bold text-gray-800 mb-2">📋 {selectedDate} 체육관 예약 운영 현황</h2>
      <p className="text-xs text-gray-500 mb-5">총 3코트 규모이며, 시간대별 최대 2가지 종목 혼합 운영 제한 규정이 실시간 반영됩니다.</p>

      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-left text-sm border-collapse bg-white">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 text-xs font-bold">
              <th className="p-4 w-2/5">프로그램 시간대</th>
              <th className="p-4 w-3/5">현재 운영 확정 종목 및 시설 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-800">
            {timeSlots.map((slot) => {
              const restriction = weekdayRules[dayOfWeek]?.[slot.id];
              const slotReservations = dbReservations.filter((res) => res.slot_time.startsWith(slot.startTime));
              const lockStatus = getTimeLockStatus(slot.startTime);
              const status = getSlotStatusInfo(slot.id, slot.startTime);
              const canQuickLink = !restriction && lockStatus === 'none' && !status.isFull;

              return (
                <tr 
                  key={slot.id} 
                  onClick={() => canQuickLink && onSlotClick(slot)}
                  className={`transition-colors ${canQuickLink ? 'hover:bg-blue-50/70 cursor-pointer' : 'hover:bg-gray-50/50'}`}
                >
                  <td className="p-4 font-semibold text-gray-700 flex flex-col">
                    <span>{slot.name}</span>
                    {canQuickLink && <span className="text-[10px] text-blue-500 font-normal">누르면 즉시 예약이동</span>}
                  </td>
                  <td className="p-4">
                    {restriction ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-100">{restriction}</span>
                    ) : lockStatus === 'past' ? (
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">이용 시간 종료</span>
                    ) : lockStatus === 'imminent' ? (
                      <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">인터넷 마감</span>
                    ) : status.isFull ? (
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">🔒 3코트 전체 마감</span>
                    ) : slotReservations.length === 0 ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-200 font-semibold shadow-sm">🟢 3코트 전부 비어있음</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {slotReservations.map((res, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white shadow-sm">코트 {idx + 1}: {res.sport_name}</span>
                          ))}
                        </div>
                        <div className="text-[11px] font-semibold text-blue-600 mt-1 flex flex-col gap-0.5">
                          <span>⚡ {status.remainingCourts}코트 신청 가능 (현재 운영: {status.activeSports.join(', ')})</span>
                          {status.isBadmintonLessonTime && (<span className="text-red-500 text-[10px] font-medium">*강좌 시간: 일반 예약은 오직 배드민턴만 허용됩니다.</span>)}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}