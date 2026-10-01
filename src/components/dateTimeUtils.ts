export function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDateTime(dateValue: string, timeValue: string) {
  const date = parseLocalDate(dateValue) ?? new Date();
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (timeMatch) {
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return date;
}

export function parseLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 10) return parseLocalDate(value);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? parseLocalDate(value) : date;
}

export function formatLocalTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatLocalDateTime(date: Date) {
  return `${formatLocalDate(date)}T${formatLocalTime(date)}:00`;
}
