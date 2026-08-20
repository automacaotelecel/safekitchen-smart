type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const explicitTimeZonePattern = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getPartsAt(date: Date, timeZone: string): DateTimeParts {
  const values = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function isValidParts(parts: DateTimeParts) {
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return false;
  }

  const normalized = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );

  return (
    normalized.getUTCFullYear() === parts.year &&
    normalized.getUTCMonth() === parts.month - 1 &&
    normalized.getUTCDate() === parts.day &&
    normalized.getUTCHours() === parts.hour &&
    normalized.getUTCMinutes() === parts.minute &&
    normalized.getUTCSeconds() === parts.second
  );
}

function matchesParts(actual: DateTimeParts, expected: DateTimeParts) {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second
  );
}

/**
 * Converts an ISO instant or a browser datetime-local value into a Date.
 * Values without an explicit offset are interpreted in the restaurant's IANA
 * time zone instead of the server's local time zone.
 */
export function parseClientDateTime(
  value: string,
  timeZone = 'America/Sao_Paulo'
): Date | null {
  const input = value.trim();

  if (explicitTimeZonePattern.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = localDateTimePattern.exec(input);
  if (!match) return null;

  const expected: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
  const milliseconds = Number((match[7] || '').padEnd(3, '0'));

  if (!isValidParts(expected)) return null;

  try {
    const wallClockUtc = Date.UTC(
      expected.year,
      expected.month - 1,
      expected.day,
      expected.hour,
      expected.minute,
      expected.second,
      milliseconds
    );
    let candidate = new Date(wallClockUtc);

    // Two passes handle time zones whose UTC offset changes near this instant.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const localParts = getPartsAt(candidate, timeZone);
      const candidateWholeSecond = Math.floor(candidate.getTime() / 1000) * 1000;
      const offset =
        Date.UTC(
          localParts.year,
          localParts.month - 1,
          localParts.day,
          localParts.hour,
          localParts.minute,
          localParts.second
        ) - candidateWholeSecond;

      candidate = new Date(wallClockUtc - offset);
    }

    // Reject nonexistent wall-clock times (for example, during a DST jump).
    return matchesParts(getPartsAt(candidate, timeZone), expected) ? candidate : null;
  } catch {
    return null;
  }
}
