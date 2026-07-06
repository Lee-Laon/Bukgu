'use client';

interface MasterPanelProps {
  selectedDate: string;
  dbReservations: any[];
  onMasterCancel: (id: number) => Promise<void>;
}

export default function MasterPanel({ selectedDate, dbReservations, onMasterCancel }: MasterPanelProps) {
  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-lg p-8 border border-slate-800">
      <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-blue-400">⚙️ 데스크 마스터 통제 패널</h2>
      <p className="text-xs text-slate-400 mb-4">선택된 날짜 [{selectedDate}] 실시간 통제창 (관리자는 비번 없이 프리패스 강제 취소 가능)</p>
      
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        {dbReservations.length === 0 ? (
          <p className="text-center p-6 text-sm text-slate-400 bg-slate-800">오늘 등록된 예약 건이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-sm bg-slate-800">
            <thead>
              <tr className="bg-slate-700 text-slate-300 text-xs font-bold border-b border-slate-600">
                <th className="p-3">승인 시간</th>
                <th className="p-3">종목</th>
                <th className="p-3">예약 정보 원본 데이터</th>
                <th className="p-3 text-center">직권 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 text-slate-200">
              {dbReservations.map((res) => (
                <tr key={res.id} className="hover:bg-slate-750 transition-colors">
                  <td className="p-3 font-semibold text-yellow-400">{res.slot_time.slice(0, 5)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-900 text-blue-200 border border-blue-700">{res.sport_name}</span></td>
                  <td className="p-3 text-xs text-slate-300">{res.user_name}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => onMasterCancel(res.id)} className="px-3 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors">강제 취소</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}