'use client';

export default function MapSection() {
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
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 animate-fadeIn text-black mt-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        📍 오시는 길 및 시설 위치 안내
      </h2>
      <p className="text-xs text-gray-500 mb-4 font-medium">
        🏢 주소: {address} ({facilityName})
      </p>

      <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-200 shadow-inner mb-4">
        <iframe 
          title="위치 안내"
          src={`https://maps.google.com/maps?q=${encodedQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
          className="w-full h-full border-none"
          allowFullScreen
          loading="lazy"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={MAP_LINKS.kakao} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#FEE500] text-[#191919] text-xs font-bold py-3 rounded-xl shadow-sm">💛 카카오맵</a>
        <a href={MAP_LINKS.naver} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#03C75A] text-white text-xs font-bold py-3 rounded-xl shadow-sm">💚 네이버지도</a>
        <a href={MAP_LINKS.google} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-gray-100 text-gray-800 text-xs font-bold py-3 rounded-xl shadow-sm border border-gray-300">🌐 구글맵</a>
      </div>
    </div>
  );
}