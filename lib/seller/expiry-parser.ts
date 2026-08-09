export type ExpiryConfidence = "high" | "low";

export type ExpiryResult = {
  date: string | null;
  confidence: ExpiryConfidence;
  raw: string;
};

const KEYWORD_PATTERN =
  /(годен до|срок годности|до)\s*[:\-]?\s*(.*)$/i;
const EXACT_PATTERNS = [
  /(?<day>\d{2})[./-](?<month>\d{2})[./-](?<year>\d{4})/,
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
];
const MONTH_YEAR_PATTERN = /(?<month>\d{2})[/-](?<year>\d{4})/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isValidDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function getMonthEnd(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseCandidate(text: string): Omit<ExpiryResult, "raw"> | null {
  for (const pattern of EXACT_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.groups) {
      continue;
    }

    const year = Number(match.groups.year);
    const month = Number(match.groups.month);
    const day = Number(match.groups.day);

    if (isValidDate(year, month, day)) {
      return {
        confidence: "high",
        date: toIsoDate(year, month, day),
      };
    }
  }

  const monthYearMatch = text.match(MONTH_YEAR_PATTERN);

  if (!monthYearMatch?.groups) {
    return null;
  }

  const year = Number(monthYearMatch.groups.year);
  const month = Number(monthYearMatch.groups.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return {
    confidence: "low",
    date: toIsoDate(year, month, getMonthEnd(year, month)),
  };
}

export function parseExpiryDate(rawText: string): ExpiryResult {
  const normalized = rawText.trim();
  const keywordMatch = normalized.match(KEYWORD_PATTERN);
  const candidate = keywordMatch?.[2]?.trim() || normalized;
  const parsed = parseCandidate(candidate);

  if (!parsed) {
    return {
      confidence: "low",
      date: null,
      raw: rawText,
    };
  }

  return {
    ...parsed,
    raw: rawText,
  };
}
