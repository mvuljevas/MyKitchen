const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3}) ([+-]\d{2}):(\d{2})/;
const miningSignalPattern = /\bMining at\b/i;
const defaultSampleSeconds = 30;
const maxSignalGapSeconds = 120;

export function calculateChoppingSummary(logWindows, now = new Date()) {
  const signals = collectMiningSignals(logWindows);
  const intervals = buildIntervals(signals);
  const history = buildLastSevenDays(intervals, now);
  const totalHours = history.reduce((total, item) => total + item.hours, 0);

  return {
    source: signals.length > 0 ? "logs" : "none",
    signalCount: signals.length,
    intervalCount: intervals.length,
    totalHours: roundHours(totalHours),
    history,
    lastSignalAt: signals.at(-1)?.timestamp.toISOString() ?? null,
  };
}

function collectMiningSignals(logWindows) {
  const signals = [];

  for (const logWindow of logWindows) {
    for (const line of logWindow.lines) {
      if (!miningSignalPattern.test(line)) {
        continue;
      }

      const timestamp = parseLogTimestamp(line);

      if (!timestamp) {
        continue;
      }

      signals.push({
        timestamp,
        source: logWindow.relativePath,
      });
    }
  }

  return signals
    .sort((left, right) => left.timestamp - right.timestamp)
    .filter((signal, index, list) => {
      const previous = list[index - 1];
      return !previous || previous.timestamp.getTime() !== signal.timestamp.getTime();
    });
}

function buildIntervals(signals) {
  if (signals.length === 0) {
    return [];
  }

  const intervals = [];
  let start = signals[0].timestamp;
  let end = addSeconds(signals[0].timestamp, defaultSampleSeconds);

  for (const signal of signals.slice(1)) {
    const gapSeconds = (signal.timestamp - end) / 1000;

    if (gapSeconds > maxSignalGapSeconds) {
      intervals.push({ start, end });
      start = signal.timestamp;
    }

    end = addSeconds(signal.timestamp, defaultSampleSeconds);
  }

  intervals.push({ start, end });
  return intervals;
}

function buildLastSevenDays(intervals, now) {
  const days = [];
  const todayStart = startOfLocalDay(now);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayStart = addDays(todayStart, -offset);
    const dayEnd = addDays(dayStart, 1);
    const seconds = intervals.reduce(
      (total, interval) => total + overlapSeconds(interval, dayStart, dayEnd),
      0,
    );

    days.push({
      day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dayStart),
      date: new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(dayStart),
      isoDate: formatLocalDate(dayStart),
      hours: roundHours(seconds / 3600),
    });
  }

  return days;
}

function overlapSeconds(interval, windowStart, windowEnd) {
  const start = Math.max(interval.start.getTime(), windowStart.getTime());
  const end = Math.min(interval.end.getTime(), windowEnd.getTime());
  return Math.max(0, (end - start) / 1000);
}

function parseLogTimestamp(line) {
  const match = line.match(timestampPattern);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, millisecond, offsetHour, offsetMinute] =
    match;
  const isoValue = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${offsetHour}:${offsetMinute}`;
  const timestamp = new Date(isoValue);

  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return timestamp;
}

function startOfLocalDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addSeconds(value, seconds) {
  return new Date(value.getTime() + seconds * 1000);
}

function formatLocalDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundHours(value) {
  return Math.round(value * 100) / 100;
}
