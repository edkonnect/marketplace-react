import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

interface AvailabilitySlot {
  monday?: string[];
  tuesday?: string[];
  wednesday?: string[];
  thursday?: string[];
  friday?: string[];
  saturday?: string[];
  sunday?: string[];
}

interface AvailabilityCalendarProps {
  availability: string | null;
  tutorName?: string;
}

export default function AvailabilityCalendar({ availability, tutorName }: AvailabilityCalendarProps) {
  // Parse availability JSON
  let availabilityData: AvailabilitySlot = {};
  try {
    if (availability) {
      availabilityData = JSON.parse(availability);
    }
  } catch (error) {
    console.error("Failed to parse availability:", error);
  }

  const daysOfWeek = [
    { key: "monday", label: "Monday", short: "Mon" },
    { key: "tuesday", label: "Tuesday", short: "Tue" },
    { key: "wednesday", label: "Wednesday", short: "Wed" },
    { key: "thursday", label: "Thursday", short: "Thu" },
    { key: "friday", label: "Friday", short: "Fri" },
    { key: "saturday", label: "Saturday", short: "Sat" },
    { key: "sunday", label: "Sunday", short: "Sun" },
  ];

  const hasAnyAvailability = Object.values(availabilityData).some(
    (slots) => Array.isArray(slots) && slots.length > 0
  );

  if (!hasAnyAvailability) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Availability
          </CardTitle>
          <CardDescription>Weekly schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No availability information available. Please contact the tutor directly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          General Availability
        </CardTitle>
        <CardDescription>
          {tutorName ? `${tutorName}'s typical weekly schedule` : "Typical weekly availability schedule"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {daysOfWeek.map((day) => {
            const slots = availabilityData[day.key as keyof AvailabilitySlot] || [];
            const hasSlots = slots.length > 0;

            return (
              <div
                key={day.key}
                className={`flex items-start gap-4 p-3 rounded-lg border transition-colors ${
                  hasSlots
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border"
                }`}
              >
                <div className="min-w-[80px]">
                  <p className={`text-sm font-medium ${hasSlots ? "text-foreground" : "text-muted-foreground"}`}>
                    {day.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{day.short}</p>
                </div>

                <div className="flex-1">
                  {hasSlots ? (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {slot}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not available</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Time slots shown are in your local timezone. Actual availability may vary based on
            existing bookings. Please confirm specific times when booking a session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
