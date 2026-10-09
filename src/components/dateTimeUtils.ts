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
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/.exec(
      value,
    );
  if (!match) return null;

  const date = parseLocalDate(match[1]);
  if (!date) return null;
  if (!match[2]) return date;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

export function formatLocalTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatLocalDateTime(date: Date) {
  return `${formatLocalDate(date)}T${formatLocalTime(date)}:00`;
}
