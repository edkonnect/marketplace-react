import { useEffect, useState } from "react";
import { detectUserTimezone, COMMON_TIMEZONES } from "@/../../shared/timezone-utils";
import { Clock } from "lucide-react";

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  label?: string;
  showDetected?: boolean;
  className?: string;
}

export function TimezoneSelector({
  value,
  onChange,
  label = "Time Zone",
  showDetected = true,
  className = "",
}: TimezoneSelectorProps) {
  const [detectedTimezone, setDetectedTimezone] = useState<string>("");

  useEffect(() => {
    const detected = detectUserTimezone();
    setDetectedTimezone(detected);

    // Auto-set to detected timezone if value is empty
    if (!value) {
      onChange(detected);
    }
  }, []);

  const getTimezoneLabel = (tz: string) => {
    const found = COMMON_TIMEZONES.find(t => t.value === tz);
    return found ? found.label : tz;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium flex items-center gap-2">
        <Clock className="w-4 h-4" />
        {label}
      </label>

      {showDetected && detectedTimezone && (
        <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 border border-border rounded-md p-2 sm:p-3">
          <span className="font-medium">Detected:</span>{" "}
          <span className="text-foreground">{getTimezoneLabel(detectedTimezone)}</span>
        </div>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      >
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>

      <p className="text-xs text-muted-foreground">
        All session times will be displayed in your selected timezone.
      </p>
    </div>
  );
}
