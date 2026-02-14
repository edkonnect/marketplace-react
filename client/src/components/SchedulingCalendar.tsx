import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Session {
  id: number;
  title: string;
  start: Date;
  end: Date;
  status: string;
}

interface SchedulingCalendarProps {
  subscriptionId: number;
  tutorId: number;
  parentId: number;
  onSessionCreated?: () => void;
}

export default function SchedulingCalendar({ subscriptionId, tutorId, parentId, onSessionCreated }: SchedulingCalendarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [duration, setDuration] = useState<string>("60");
  const slotStepMinutes = 30;

  const { data: sessions, refetch: refetchSessions } = trpc.session.myUpcoming.useQuery();
  const { data: availabilityData, refetch: refetchAvailability } = trpc.subscription.getAvailability.useQuery({ subscriptionId });
  const createSessionMutation = trpc.session.create.useMutation();

  const effectiveTutorId = availabilityData?.tutorId ?? tutorId;

  const availability = availabilityData?.availability ?? [];
  const bookedSessions = availabilityData?.booked ?? [];

  // Only show sessions that belong to this subscription's tutor on the calendar.
  // Using all parent sessions (myUpcoming) caused other students' sessions with
  // different tutors to appear as blocked slots on this tutor's calendar.
  const calendarEvents: Session[] = (sessions || [])
    .filter((session: any) => session.tutorId === effectiveTutorId)
    .map((session) => ({
      id: session.id,
      title: `Tutoring Session`,
      start: new Date(session.scheduledAt),
      end: new Date(new Date(session.scheduledAt).getTime() + session.duration * 60000),
      status: session.status,
    }));

  const blockedEvents: Session[] = bookedSessions.map((session) => ({
    id: session.id,
    title: `Booked`,
    start: new Date(session.scheduledAt),
    end: new Date(session.scheduledAt + session.duration * 60000),
    status: "booked",
  }));

  const allEvents = useMemo(() => [...calendarEvents, ...blockedEvents], [calendarEvents, blockedEvents]);

  function isWithinAvailability(slotStart: Date, slotEnd: Date) {
    if (!availability.length) return true; // no availability defined -> allow all
    const day = slotStart.getDay(); // 0 Sunday
    const dayWindows = availability.filter((a: any) => a.dayOfWeek === day);
    if (!dayWindows.length) return false;

    const minutesFromMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes();
    const startMin = minutesFromMidnight(slotStart);
    const endMin = minutesFromMidnight(slotEnd);

    return dayWindows.some((w: any) => {
      const [sh, sm] = w.startTime.split(":").map(Number);
      const [eh, em] = w.endTime.split(":").map(Number);
      const winStart = sh * 60 + sm;
      const winEnd = eh * 60 + em;
      return startMin >= winStart && endMin <= winEnd;
    });
  }

  function overlapsBooked(slotStart: Date, slotEnd: Date) {
    // Only check against this tutor's booked sessions — not sessions from
    // other students of this parent who may have different tutors
    return blockedEvents.some(evt => {
      const evStart = evt.start.getTime();
      const evEnd = evt.end.getTime();
      return slotStart.getTime() < evEnd && slotEnd.getTime() > evStart;
    });
  }

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    const now = Date.now();
    if (slotInfo.start.getTime() <= now) {
      toast.error("You can't book a time that has already passed");
      return;
    }
    if (!isWithinAvailability(slotInfo.start, slotInfo.end)) {
      toast.error("Selected time is outside tutor availability");
      return;
    }
    if (overlapsBooked(slotInfo.start, slotInfo.end)) {
      toast.error("That slot is already booked");
      return;
    }
    setSelectedSlot(slotInfo);
    setIsDialogOpen(true);
  };

  const handleCreateSession = async () => {
    if (!selectedSlot) return;

    try {
      await createSessionMutation.mutateAsync({
        subscriptionId,
        tutorId: effectiveTutorId,
        parentId,
        scheduledAt: selectedSlot.start.getTime(),
        duration: parseInt(duration),
      });

      toast.success("Session scheduled successfully!");
      setIsDialogOpen(false);
      setSelectedSlot(null);
      await Promise.all([refetchSessions(), refetchAvailability()]);
      onSessionCreated?.();
    } catch (error) {
      toast.error("Failed to schedule session");
    }
  };

  return (
    <>
      <div className="h-[600px] bg-card rounded-lg border border-border p-4">
        <Calendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          selectable
          onSelectSlot={handleSelectSlot}
          views={["month", "week", "day"]}
          defaultView="week"
          step={slotStepMinutes}
          timeslots={2}
          eventPropGetter={(event: Session) => ({
            style: {
              backgroundColor:
                event.status === "booked"
                  ? "#f87171" // red for unavailable/booked
                  : event.status === "completed"
                    ? "#10b981"
                    : "#3b82f6",
              borderRadius: "4px",
              opacity: 0.8,
              color: "white",
              border: "0px",
              display: "block",
            },
          })}
          slotPropGetter={(date) => {
            if (!availability.length) return {};
            const slotStart = date;
            const slotEnd = new Date(date.getTime() + slotStepMinutes * 60000);
            const allowed = isWithinAvailability(slotStart, slotEnd);
          return allowed
            ? {}
            : {
                style: {
                  backgroundColor: "rgba(248,113,113,0.25)", // light red
                },
              };
          }}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Tutoring Session</DialogTitle>
            <DialogDescription>
              Create a new tutoring session for the selected time slot
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <div className="space-y-4">
              <div>
                <Label>Date & Time</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSlot.start.toLocaleString()}
                </p>
              </div>

              <div>
                <Label htmlFor="duration">Session Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSession} disabled={createSessionMutation.isPending}>
                  {createSessionMutation.isPending ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
