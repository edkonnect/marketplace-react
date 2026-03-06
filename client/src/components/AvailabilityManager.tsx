import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { COMMON_TIMEZONES } from "@/../../shared/timezone-utils";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function AvailabilityManager() {

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const { data: availability, isLoading, refetch } = trpc.tutorAvailability.getAvailability.useQuery();
  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery();

  const tutorTimezone = tutorProfile?.timezone || 'America/New_York';
  const timezoneAbbr = useMemo(() => {
    // Extract abbreviation from label e.g. "India Standard Time (IST)" → "IST"
    const tz = COMMON_TIMEZONES.find(t => t.value === tutorTimezone);
    if (tz) {
      const match = tz.label.match(/\(([^)]+)\)$/);
      return match ? match[1] : tz.label;
    }
    return tutorTimezone;
  }, [tutorTimezone]);

  const createSlotMutation = trpc.tutorAvailability.createSlot.useMutation({
    onSuccess: () => {
      toast.success("Availability added", {
        description: "Your availability slot has been created successfully.",
      });
      refetch();
      setIsAddDialogOpen(false);
      // Reset form
      setSelectedDay(1);
      setStartTime("09:00");
      setEndTime("17:00");
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const deleteSlotMutation = trpc.tutorAvailability.deleteSlot.useMutation({
    onSuccess: () => {
      toast.success("Availability removed", {
        description: "Your availability slot has been deleted.",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const handleAddSlot = () => {
    createSlotMutation.mutate({
      dayOfWeek: selectedDay,
      startTime,
      endTime,
    });
  };

  const handleDeleteSlot = (id: number) => {
    if (confirm("Are you sure you want to delete this availability slot?")) {
      deleteSlotMutation.mutate({ id });
    }
  };

  // Group availability by day
  const availabilityByDay = DAYS_OF_WEEK.map((day) => ({
    ...day,
    slots: (availability || []).filter((slot) => slot.dayOfWeek === day.value && slot.isActive),
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>Loading your availability...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weekly Availability</CardTitle>
            <CardDescription>
              Set your regular weekly schedule to let parents know when you're available
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Time Slot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Availability Slot</DialogTitle>
                <DialogDescription>
                  Set a time period when you're available to tutor
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="day">Day of Week</Label>
                  <Select
                    value={selectedDay.toString()}
                    onValueChange={(value) => setSelectedDay(parseInt(value))}
                  >
                    <SelectTrigger id="day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSlot}
                  disabled={createSlotMutation.isPending}
                >
                  {createSlotMutation.isPending ? "Adding..." : "Add Slot"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {availabilityByDay.map((day) => (
            <div key={day.value} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">{day.label}</h3>
              {day.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No availability set</p>
              ) : (
                <div className="space-y-2">
                  {day.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between bg-muted rounded-md p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        {timezoneAbbr && (
                          <span className="text-xs text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">
                            {timezoneAbbr}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
