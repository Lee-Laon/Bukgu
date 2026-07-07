'use client';

import { parseRawUserInfo } from '../utils/crypto';

interface MasterPanelProps {
  selectedDate: string;
  dbReservations: any[]; // 🎯 부모(page.tsx)가 Supabase Realtime으로 수신한 실시간 예약 배열
  onMasterCancel: (id: number) => Promise<void>;
}

export default function MasterPanel({ selectedDate, dbReservations = [], onMasterCancel }: MasterPanelProps) {
  
  // 🎯 [핵심 수리 완료] 
  // 기존에 내부 상태(useState)에 복사해서 쓰던 무거운 로직을 전면 제거했습니다.
  // 부모가 실시간 채널을 통해 Supabase로부터 전달받은 dbReservations 배열을 "직접(Direct)" 읽어서 렌더링하므로,
  // 새로고침을 누르지 않아도 데이터가 들어오는 즉시 관리자 화면 명단이 실시간으로 동적 갱신됩니다.

  return (
    <div className="space-y-2 animate-fadeIn text-white">
      {dbReservations.length === 0 ? (
        <div className="text-center py-8 bg-slate-950 rounded-xl border border-slate-800/60">
          <p className="text-xs text-slate-500 font-medium">
            📅 {selectedDate}에는 아직 등록된 대관 예약 내역이 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1">
          {dbReservations.map((res) => {
            // DB에 저장된 단일 결합 문자열 포맷 해체 작업
            // 포맷: "홍길동 (010-1234-5678) [1234] {4명/2코트}"
            const { phone } = parseRawUserInfo(res.user_name);
            const cleanName = res.user_name.split(' (')[0] || '알 수 없음';

            // 정밀 코트 수 및 입장 인원수 데이터 추출을 위한 정규식 연동
            const headMatch = res.user_name.match(/\{([\d.]+)명/);
            const courtMatch = res.user_name.match(/\/([\d.]+)코트\}/);
            const showHead = headMatch ? `${headMatch[1]}명` : '1명';
            const showCourt = courtMatch ? `${courtMatch[1]}코트` : '1코트';

            // 행정 통제(블로킹) 데이터 여부 판별 가드
            const isEmergencyBlock = res.sport_name === '행정 통제' || cleanName.includes('공단 행정 긴급 통제');

            return (
              <div
                key={res.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  isEmergencyBlock
                    ? 'bg-amber-950/20 border-amber-500/30 shadow-inner' // 🔒 블로킹 전용 스킨
                    : 'bg-slate-950 border-slate-800 hover:bg-slate-900/60' // 일반 예약자 스킨
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      className={`font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm ${
                        isEmergencyBlock 
                          ? 'bg-amber-500 text-slate-950' 
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {res.sport_name}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {isEmergencyBlock ? '🚫 행정 명령 시설 통제 구간' : `👤 ${cleanName} 고객 (${phone})`}
                    </span>
                  </div>
                  
                  <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <span>⏱️ 확정 타임: <span className="text-slate-300 font-bold">{res.slot_time}</span></span>
                    <span className="text-slate-700">|</span>
                    <span className="text-blue-400 font-bold">👥 {showHead}</span>
                    <span className="text-slate-700">|</span>
                    <span className="text-green-400 font-bold">🏸 {showCourt} 점유 중</span>
                  </div>
                </div>

                {/* 데스크 마스터 직권 강제 제어 시스템 */}
                <div className="self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onMasterCancel(res.id)}
                    className={`font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all shadow-md ${
                      isEmergencyBlock
                        ? 'bg-amber-600 hover:bg-amber-700 text-white' // 블로킹 해제 버튼 역할
                        : 'bg-red-600/80 hover:bg-red-600 text-white active:scale-95' // 강제 취소 버튼 역할
                    }`}
                  >
                    {isEmergencyBlock ? '🔓 통제 해제' : '💥 강제 취소'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}