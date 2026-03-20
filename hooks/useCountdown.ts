import { useEffect, useState } from 'react';

export interface CountdownResult {
  hours: number;
  mins: number;
  urgent: boolean;
}

// Pure calculation — exported so it can be tested without React
export function calcCountdown(endTime: string, now: Date = new Date()): CountdownResult {
  const end = new Date(now);
  const [h, m] = endTime.split(':').map(Number);
  end.setHours(h, m, 0, 0);

  // Wrap to next day if endTime has already passed today
  if (end.getTime() <= now.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  const diff = end.getTime() - now.getTime();
  const totalMins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  return { hours, mins, urgent: totalMins < 30 };
}

export function useCountdown(endTime: string): CountdownResult & { label: string } {
  const [result, setResult] = useState<CountdownResult>(() => calcCountdown(endTime));

  useEffect(() => {
    function tick() {
      setResult(calcCountdown(endTime));
    }
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [endTime]);

  const label =
    result.hours > 0
      ? `${result.hours}h ${result.mins}m`
      : `${result.mins}m`;

  return { ...result, label };
}
