'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** Target number to animate to */
  end: number;
  /** Animation duration in ms (default 800) */
  duration?: number;
  /** Text placed before the number, e.g. "₹" */
  prefix?: string;
  /** Text placed after the number, e.g. "%", "h" */
  suffix?: string;
  /** Decimal places to display (default 0) */
  decimals?: number;
  /** Use Indian locale number grouping (default true) */
  locale?: boolean;
  /** Extra CSS class on the wrapping <span> */
  className?: string;
}

/**
 * Animated count-up number display.
 *
 * Animates from 0 → `end` on mount, and smoothly transitions between
 * values when `end` changes. Uses ease-out-cubic for a natural deceleration feel.
 * Respects `prefers-reduced-motion`.
 *
 * @example
 * <CountUp end={1500} />                         // → "1,500"
 * <CountUp end={45000} prefix="₹" />             // → "₹45,000"
 * <CountUp end={15.5} suffix="%" decimals={1} />  // → "15.5%"
 */
function formatNumber(n: number, dec: number, loc: boolean): string {
  if (loc) {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(n);
  }
  return n.toFixed(dec);
}

export function CountUp({
  end,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  locale = true,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState<string>(() => formatNumber(0, decimals, locale));
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);

  useEffect(() => {
    // Respect reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setDisplay(formatNumber(end, decimals, locale));
      fromRef.current = end;
      return;
    }

    const from = fromRef.current;
    const delta = end - from;

    // Nothing to animate
    if (delta === 0) {
      setDisplay(formatNumber(end, decimals, locale));
      return;
    }

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: fast start, gentle stop
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = from + delta * eased;
      setDisplay(formatNumber(current, decimals, locale));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we land exactly on the end value
        setDisplay(formatNumber(end, decimals, locale));
        fromRef.current = end;
      }
    };

    startRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, decimals, locale]);

  return (
    <span className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
