'use client';

// 🎯 상위에서 다크모드 상태를 주입받도록 인터페이스 확장
interface MapSectionProps {
  isDarkMode?: boolean;
}

export default function MapSection({ isDarkMode = false }: MapSectionProps) {
  const address = "광주광역시 북구 북문대로98번길 20";
  const facilityName = "운암복합문화체육센터";
  const query = `${address} ${facilityName}`;
  const encodedQuery = encodeURIComponent(query);

  const MAP_LINKS = {
    kakao: `https://map.kakao.com/?q=${encodedQuery}`,
    naver: `https://map.naver.com/v5/search/${encodedQuery}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`
  };

  return (
    <div className="w-full max-w-md mx-auto mt-6 animate-fade-in px-1 space-y-6">
      
      {/* 문장형 볼드 헤더 */}
      <div className="space-y-2 animate-fade-in px-1">
        <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase font-mono">LOCATION INFO</span>
        <h2 className={`text-xl font-black tracking-tight leading-snug transition-colors ${
          isDarkMode ? 'text-slate-100' : 'text-slate-900'
        }`}>
          {facilityName}으로<br />
          오시는 길입니다
        </h2>
      </div>

      {/* 인터랙티브 구글 지도 영역 (다크모드 시 인버트 필터로 블랙맵 처리 킬링포인트!) */}
      <div className="space-y-4">
        <div className={`w-full h-64 rounded-2xl overflow-hidden border transition-all shadow-sm ${
          isDarkMode ? 'border-slate-800 bg-[#22222a]' : 'border-slate-100 bg-slate-50'
        }`}>
          <iframe 
            title="위치 안내"
            src={`https://maps.google.com/maps?q=${encodedQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
            className={`w-full h-full border-none transition-all duration-300 ${
              isDarkMode ? 'invert-[0.9] hue-rotate-180 contrast-[1.2] saturate-[0.8]' : 'contrast-[1.02] saturate-[1.05]'
            }`}
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* 외부 내비게이션 맵 연결 그리드 */}
        <div className="grid grid-cols-3 gap-2">
          <a 
            href={MAP_LINKS.naver} 
            target="_blank" 
            className="flex items-center justify-center bg-[#03C75A] text-white text-[11px] font-bold py-3.5 rounded-2xl shadow-sm transition-transform active:scale-[0.97] text-center"
          >
            네이버지도
          </a>
          <a 
            href={MAP_LINKS.kakao} 
            target="_blank" 
            className="flex items-center justify-center bg-[#FEE500] text-[#191919] text-[11px] font-bold py-3.5 rounded-2xl shadow-sm transition-transform active:scale-[0.97] text-center"
          >
            카카오맵
          </a>
          <a 
            href={MAP_LINKS.google} 
            target="_blank" 
            className={`flex items-center justify-center text-[11px] font-bold py-3.5 rounded-2xl shadow-sm transition-all active:scale-[0.97] text-center ${
              isDarkMode ? 'bg-[#22222a] text-slate-300 border border-slate-800' : 'bg-slate-100 text-slate-700 border border-slate-200/60'
            }`}
          >
            구글맵
          </a>
        </div>
      </div>
    </div>
  );
}