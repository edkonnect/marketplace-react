import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface TutorAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorId: number;
  tutorName?: string;
  availability: Array<{
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
}

export function TutorAvailabilityModal({
  open,
  onOpenChange,
  tutorId,
  tutorName,
  availability,
}: TutorAvailabilityModalProps) {
  const [activeTab, setActiveTab] = useState("this-week");

  // Fetch upcoming sessions for this tutor
  const { data: upcomingSessions = [] } = trpc.session.getUpcomingByTutorId.useQuery(
    { tutorId },
    { enabled: open }
  );

  // Calculate available time slots with details for next 7 days
  const calculateDetailedSlots = () => {
    const result: Record<number, { count: number; slots: string[] }> = {};
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    availability.forEach(slot => {
      if (!slot.isActive) return;

      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);

      for (let d = new Date(now); d <= oneWeekFromNow; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === slot.dayOfWeek) {
          const slotStart = new Date(d);
          slotStart.setHours(startHour, startMin, 0, 0);
          const slotEnd = new Date(d);
          slotEnd.setHours(endHour, endMin, 0, 0);

          const currentSlotTime = new Date(slotStart);
          const availableSlots: string[] = [];

          while (currentSlotTime < slotEnd) {
            const nextSlotTime = new Date(currentSlotTime.getTime() + 60 * 60 * 1000);

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

  const availabilityByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    slots: availability.filter(slot => slot.dayOfWeek === day.value && slot.isActive),
    availableCount: detailedSlotsByDay[day.value]?.count || 0,
    availableTimeSlots: detailedSlotsByDay[day.value]?.slots || [],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {tutorName ? `${tutorName}'s Availability` : "Tutor Availability"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="this-week">This Week</TabsTrigger>
            <TabsTrigger value="general">General Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="this-week" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Clock className="w-4 h-4" />
                <span>Available time slots for the next 7 days (after considering bookings)</span>
              </div>

              <div className="space-y-2">
                {availabilityByDay
                  .filter(day => day.slots.length > 0)
                  .map(day => (
                    <div key={day.value} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-base">{day.label}</span>
                        <Badge variant={day.availableCount > 0 ? "default" : "secondary"}>
                          {day.availableCount} {day.availableCount === 1 ? 'slot' : 'slots'} available
                        </Badge>
                      </div>

                      {day.availableTimeSlots.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {day.availableTimeSlots.map((timeSlot, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-center gap-1 text-sm bg-primary/10 text-primary px-2 py-1.5 rounded"
                            >
                              <Clock className="w-3 h-3" />
                              <span className="text-xs sm:text-sm">{timeSlot}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No available slots</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="general" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <CalendarIcon className="w-4 h-4" />
                <span>Typical weekly schedule (recurring availability)</span>
              </div>

              <div className="space-y-3">
                {DAYS_OF_WEEK.map(day => {
                  const daySlots = availability.filter(slot => slot.dayOfWeek === day.value && slot.isActive);
                  return (
                    <div
                      key={day.value}
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        daySlots.length > 0
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/30 border-border"
                      }`}
                    >
                      <div className="min-w-[100px]">
                        <p className={`text-sm font-semibold ${daySlots.length > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {day.label}
                        </p>
                      </div>
                      <div className="flex-1">
                        {daySlots.length > 0 ? (
                          <div className="space-y-1">
                            {daySlots.map(slot => (
                              <div key={slot.id} className="flex items-center gap-2 text-sm">
                                <Clock className="w-3 h-3 text-primary" />
                                <span>{slot.startTime} - {slot.endTime}</span>
                              </div>
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
