import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const COUNTRY_CODES = [
  { code: "+1", country: "US", flag: "🇺🇸", label: "United States", timezone: "America/New_York" },
  { code: "+91", country: "IN", flag: "🇮🇳", label: "India", timezone: "Asia/Kolkata" },
];

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  onTimezoneDetected?: (timezone: string) => void;
  currentTimezone?: string;
  label?: string;
  required?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  onTimezoneDetected,
  currentTimezone,
  label = "Phone Number",
  required = false,
}: PhoneInputProps) {
  // Detect initial country code from value
  const getInitialCode = () => {
    if (value?.startsWith("+91")) return "+91";
    return "+1";
  };

  const [selectedCode, setSelectedCode] = useState(getInitialCode);

  // Strip existing country code prefix from value to get just the number
  const getNumberOnly = () => {
    for (const c of COUNTRY_CODES) {
      if (value?.startsWith(c.code)) return value.slice(c.code.length).trim();
    }
    return value || "";
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCode(code);
    const country = COUNTRY_CODES.find(c => c.code === code);
    if (country && onTimezoneDetected) {
      onTimezoneDetected(country.timezone);
    }
    const numberOnly = getNumberOnly();
    onChange(numberOnly ? `${code} ${numberOnly}` : "");
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numberOnly = e.target.value.replace(/[^\d\s\-().]/g, "");
    onChange(numberOnly ? `${selectedCode} ${numberOnly}` : "");
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === selectedCode);

  // Warn if phone country code doesn't match the selected timezone
  const hasMismatch = (() => {
    if (!currentTimezone || !selectedCountry) return false;
    const INDIAN_TZS = ["Asia/Kolkata", "Asia/Calcutta"];
    const US_TZS = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"];
    const isIndianTz = INDIAN_TZS.includes(currentTimezone);
    const isUsTz = US_TZS.some(tz => currentTimezone.startsWith("America/") || currentTimezone.startsWith("Pacific/Honolulu"));
    if (selectedCountry.code === "+91" && isUsTz && !isIndianTz) return true;
    if (selectedCountry.code === "+1" && isIndianTz) return true;
    return false;
  })();

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <select
          value={selectedCode}
          onChange={handleCodeChange}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
          style={{ minWidth: "100px" }}
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          value={getNumberOnly()}
          onChange={handleNumberChange}
          placeholder={selectedCountry?.code === "+91" ? "98765 43210" : "(555) 123-4567"}
          className={`flex-1 ${hasMismatch ? "border-yellow-500 focus-visible:ring-yellow-500" : ""}`}
        />
      </div>
      {hasMismatch ? (
        <p className="text-xs text-yellow-600 font-medium">
          ⚠️ Your phone country ({selectedCountry?.label}) doesn't match your selected timezone. Please check both are correct.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {selectedCountry?.flag} {selectedCountry?.label}
        </p>
      )}
    </div>
  );
}
