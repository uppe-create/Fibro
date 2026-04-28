export function parseBRDate(dateStr: string): Date | null {
  const [day, month, year] = dateStr.split('/');
  if (!day || !month || !year) return null;

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;

  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysUntil(dateStr: string, now = new Date()): number | null {
  const target = parseBRDate(dateStr);
  if (!target) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExpiringInDays(dateStr: string, days: number): boolean {
  const diff = daysUntil(dateStr);
  return diff !== null && diff >= 0 && diff <= days;
}

export function getAgeFromBRDate(dateStr: string, now = new Date()): number | null {
  const birthDate = parseBRDate(dateStr);
  if (!birthDate) return null;

  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getAgeBucket(age: number): '0-18' | '19-30' | '31-50' | '51-65' | '65+' {
  if (age <= 18) return '0-18';
  if (age <= 30) return '19-30';
  if (age <= 50) return '31-50';
  if (age <= 65) return '51-65';
  return '65+';
}
