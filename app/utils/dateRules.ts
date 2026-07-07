
export interface CustomSlot {
  id: string;
  name: string;
  startTime: string;
  allowedSports?: string[]; // 특정 종목만 가능할 때 제한
  maxCourts?: number;      // 특정 시간대 코트 수 제한
  note?: string;           // 화면에 보여줄 안내 문구
}

export const DAILY_TIME_CONFIG: { [key: string]: CustomSlot[] } = {
  '월': [
    { id: 'mon-1', name: '09:30 ~ 10:30', startTime: '09:30' },
    { id: 'mon-2', name: '13:30 ~ 15:30', startTime: '13:30' },
    { id: 'mon-3', name: '16:00 ~ 18:00', startTime: '16:00' },
  ],
  '화': [
    { id: 'tue-1', name: '09:30 ~ 11:30', startTime: '09:30', allowedSports: ['배드민턴'], maxCourts: 2, note: '🏸 배드민턴 전용 (2코트)' },
    { id: 'tue-2', name: '13:30 ~ 15:30', startTime: '13:30' },
    { id: 'tue-3', name: '18:00 ~ 20:00', startTime: '18:00' },
    { id: 'tue-4', name: '20:00 ~ 22:00', startTime: '20:00' },
  ],
  '수': [
    { id: 'wed-1', name: '09:30 ~ 11:30', startTime: '09:30' },
    { id: 'wed-2', name: '13:30 ~ 15:30', startTime: '13:30' },
  ],
  '목': [
    { id: 'thu-1', name: '09:30 ~ 11:30', startTime: '09:30', allowedSports: ['배드민턴'], maxCourts: 2, note: '🏸 배드민턴 전용 (2코트)' },
    { id: 'thu-2', name: '16:00 ~ 18:00', startTime: '16:00' },
    { id: 'thu-3', name: '18:00 ~ 20:00', startTime: '18:00' },
    { id: 'thu-4', name: '20:00 ~ 22:00', startTime: '20:00' },
  ],
  '금': [
    { id: 'fri-1', name: '09:30 ~ 10:30', startTime: '09:30' },
    { id: 'fri-2', name: '13:30 ~ 15:30', startTime: '13:30' },
  ],
  '토': [
    { id: 'sat-1', name: '09:30 ~ 11:30', startTime: '09:30' },
    { id: 'sat-2', name: '13:30 ~ 15:30', startTime: '13:30' },
    { id: 'sat-3', name: '16:00 ~ 18:00', startTime: '16:00' },
  ],
  '일': [
    { id: 'sun-1', name: '09:30 ~ 11:30', startTime: '09:30' },
    { id: 'sun-2', name: '13:30 ~ 15:30', startTime: '13:30' },
    { id: 'sun-3', name: '16:00 ~ 18:00', startTime: '16:00' },
  ],
};