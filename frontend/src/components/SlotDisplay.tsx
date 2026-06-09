import { useEffect, useRef, useState } from "react";

interface Props {
  values: string[];       // pool to spin through
  finalValue: string;     // what to land on
  isSpinning: boolean;
  onStop?: () => void;
  height?: number;
  fontSize?: string;
  color?: string;
}

// All AFL clubs for spinning display
const CLUBS = [
  "Adelaide","Brisbane Lions","Carlton","Collingwood","Essendon","Fitzroy",
  "Fremantle","Geelong","Gold Coast","GWS Giants","Hawthorn","Melbourne",
  "North Melbourne","Port Adelaide","Richmond","St Kilda","Sydney","West Coast",
  "Western Bulldogs","University",
];

const DECADES = [
  "1960s","1970s","1980s","1990s","2000s","2010s","2020s",
];

export function SlotDisplay({
  values,
  finalValue,
  isSpinning,
  onStop,
  height = 80,
  fontSize = "2.8rem",
  color = "var(--gold)",
}: Props) {
  const [displayValue, setDisplayValue] = useState(values[0] ?? finalValue);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef    = useRef(0);

  useEffect(() => {
    if (!isSpinning) {
      // Clear and show final
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
      setDisplayValue(finalValue);
      return;
    }

    // Fast spin
    let speed = 60;
    indexRef.current = 0;

    const spin = () => {
      intervalRef.current = setInterval(() => {
        indexRef.current = (indexRef.current + 1) % values.length;
        setDisplayValue(values[indexRef.current]);
      }, speed);
    };

    spin();

    // Slow down at 4s, stop at 5.5s
    const slowTimeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      speed = 160;
      spin();
    }, 4000);

    const stopTimeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayValue(finalValue);
      onStop?.();
    }, 5500);

    timeoutRef.current = stopTimeout;

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(slowTimeout);
      clearTimeout(stopTimeout);
    };
  }, [isSpinning, finalValue, values, onStop]);

  return (
    <div
      className="slot-reel flex items-center justify-center"
      style={{
        height,
        background: "rgba(0,0,0,0.4)",
        border: "1px solid var(--border)",
        borderRadius: "2px",
        padding: "0 24px",
        minWidth: "280px",
      }}
    >
      <span
        className="font-display text-center leading-none"
        style={{
          fontSize,
          color,
          letterSpacing: "0.03em",
          textShadow: isSpinning
            ? "0 0 30px rgba(245,200,66,0.5)"
            : "0 0 20px rgba(245,200,66,0.3)",
          transition: "text-shadow 0.5s ease",
          display: "block",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

export { CLUBS, DECADES };
