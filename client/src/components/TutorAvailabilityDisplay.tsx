import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface TutorAvailabilityDisplayProps {
  availability: Array<{
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
  tutorId: number;
}

export default function TutorAvailabilityDisplay({ availability, tutorId }: TutorAvailabilityDisplayProps) {
  // Fetch upcoming sessions for this tutor
  const { data: upcomingSessions = [] } = trpc.session.getUpcomingByTutorId.useQuery({ tutorId });

  // Calculate available time slots with details
  const calculateDetailedSlots = () => {
    const result: Record<number, { count: number; slots: string[] }> = {};
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    availability.forEach(slot => {
      if (!slot.isActive) return;

      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);

      // Find all occurrences of this day in the next week
      for (let d = new Date(now); d <= oneWeekFromNow; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === slot.dayOfWeek) {
          const slotStart = new Date(d);
          slotStart.setHours(startHour, startMin, 0, 0);
          const slotEnd = new Date(d);
          slotEnd.setHours(endHour, endMin, 0, 0);

          // Generate 1-hour time slots
          const currentSlotTime = new Date(slotStart);
          const availableSlots: string[] = [];

          while (currentSlotTime < slotEnd) {
            const nextSlotTime = new Date(currentSlotTime.getTime() + 60 * 60 * 1000);

            // Check if this slot overlaps with any booked session
            const isBooked = upcomingSessions.some(session => {
              const sessionStart = new Date(session.scheduledAt);
              const sessionEnd = new Date(session.scheduledAt + (session.duration || 60) * 60 * 1000);
              return currentSlotTime < sessionEnd && nextSlotTime > sessionStart;
            });

            if (!isBooked && currentSlotTime >= now) {
              const timeStr = currentSlotTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              availableSlots.push(timeStr);
            }

            currentSlotTime.setTime(nextSlotTime.getTime());
          }

          if (!result[slot.dayOfWeek]) {
            result[slot.dayOfWeek] = { count: 0, slots: [] };
          }
          result[slot.dayOfWeek].count += availableSlots.length;
          result[slot.dayOfWeek].slots.push(...availableSlots);
        }
      }
    });

    return result;
  };

  const detailedSlotsByDay = calculateDetailedSlots();

  // Group availability by day
  const availabilityByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    slots: availability.filter(slot => slot.dayOfWeek === day.value && slot.isActive),
    availableCount: detailedSlotsByDay[day.value]?.count || 0,
    availableTimeSlots: detailedSlotsByDay[day.value]?.slots || [],
  }));

  // Check if tutor has any availability set
  const hasAvailability = availability.some(slot => slot.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Available Slots (Next 7 Days)
        </CardTitle>
        <CardDescription>
          Actual available time slots after considering booked sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAvailability ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No availability schedule set</p>
            <p className="text-sm">Contact the tutor to discuss scheduling options</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availabilityByDay
              .filter(day => day.slots.length > 0)
              .map(day => (
                <div key={day.value} className="group relative">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                    <span className="font-medium text-sm">{day.label}</span>
                    <Badge variant={day.availableCount > 0 ? "default" : "secondary"} className="text-xs">
                      {day.availableCount} {day.availableCount === 1 ? 'slot' : 'slots'} available
                    </Badge>
                  </div>

                  {/* Hover/Click Tooltip */}
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 hidden group-hover:block group-focus-within:block">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-md">
                      <h4 className="font-semibold text-sm mb-3 text-foreground">{day.label} - Available Times</h4>
                      {day.availableTimeSlots.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                          {day.availableTimeSlots.map((timeSlot, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-2 py-1.5 rounded"
                            >
                              <Clock className="w-3 h-3" />
                              <span>{timeSlot}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No available slots</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
