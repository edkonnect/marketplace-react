import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Clock, Globe } from "lucide-react";
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

export function TutorAvailabilityManager() {
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Default to Monday
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const { data: tutorsData, isLoading: tutorsLoading } = trpc.admin.getAllTutorsWithAvailability.useQuery();
  const { data: availabilityData, refetch: refetchAvailability } = trpc.admin.getTutorAvailability.useQuery(
    { tutorId: selectedTutorId! },
    { enabled: !!selectedTutorId }
  );

  // Fetch the selected tutor's profile to get their timezone
  const { data: tutorProfile } = trpc.tutorProfile.get.useQuery(
    { userId: selectedTutorId! },
    { enabled: !!selectedTutorId }
  );

  const setAvailabilityMutation = trpc.admin.setTutorAvailability.useMutation({
    onSuccess: () => {
      toast.success("Availability slot added successfully");
      refetchAvailability();
      // Reset form
      setStartTime("09:00");
      setEndTime("17:00");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteAvailabilityMutation = trpc.admin.deleteTutorAvailability.useMutation({
    onSuccess: () => {
      toast.success("Availability slot deleted successfully");
      refetchAvailability();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddSlot = () => {
    if (!selectedTutorId) {
      toast.error("Please select a tutor first");
      return;
    }

    setAvailabilityMutation.mutate({
      tutorId: selectedTutorId,
      dayOfWeek,
      startTime,
      endTime,
    });
  };

  const handleDeleteSlot = (id: number) => {
    if (confirm("Are you sure you want to delete this availability slot?")) {
      deleteAvailabilityMutation.mutate({ id });
    }
  };

  const selectedTutor = tutorsData?.find(t => t.id === selectedTutorId);

  // Get timezone display information
  const tutorTimezone = tutorProfile?.timezone || 'America/New_York';
  const tutorTimezoneFriendlyName = useMemo(() => {
    const tz = COMMON_TIMEZONES.find(t => t.value === tutorTimezone);
    return tz?.label || tutorTimezone;
  }, [tutorTimezone]);

  // Group availability by day of week
  const availabilityByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    slots: (availabilityData || []).filter(slot => slot.dayOfWeek === day.value),
  }));

  if (tutorsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tutor Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Tutor</CardTitle>
          <CardDescription>Choose a tutor to manage their availability schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedTutorId?.toString() || ""}
            onValueChange={(value) => setSelectedTutorId(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a tutor" />
            </SelectTrigger>
            <SelectContent>
              {tutorsData?.map((tutor) => (
                <SelectItem key={tutor.id} value={tutor.id.toString()}>
                  {tutor.name || tutor.email || `Tutor #${tutor.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTutorId && (
        <>
          {/* Timezone Display */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Tutor's Time Zone:</span>
            </div>
            <span className="text-blue-800 dark:text-blue-200 font-medium ml-7 sm:ml-0">
              {tutorTimezoneFriendlyName}
            </span>
            {!tutorProfile?.timezone && (
              <span className="text-xs text-amber-700 dark:text-amber-300 ml-7 sm:ml-auto bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">
                ⚠️ Timezone not set (using default: ET)
              </span>
            )}
            <span className="text-xs text-blue-700/70 dark:text-blue-300/70 ml-7 sm:ml-auto">
              All times shown in tutor's local timezone
            </span>
          </div>

          {/* Add New Availability Slot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Availability Slot
              </CardTitle>
              <CardDescription>
                Set when {selectedTutor?.name || "this tutor"} is available for sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dayOfWeek">Day of Week</Label>
                  <Select
                    value={dayOfWeek.toString()}
                    onValueChange={(value) => setDayOfWeek(parseInt(value))}
                  >
                    <SelectTrigger id="dayOfWeek">
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

              <Button
                onClick={handleAddSlot}
                disabled={setAvailabilityMutation.isPending}
                className="w-full md:w-auto"
              >
                {setAvailabilityMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Slot
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Weekly Schedule View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Weekly Schedule
              </CardTitle>
              <CardDescription>
                Current availability for {selectedTutor?.name || "this tutor"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availabilityByDay.map((day) => (
                  <div key={day.value} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{day.label}</h3>
                    {day.slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No availability set</p>
                    ) : (
                      <div className="space-y-2">
                        {day.slots.map((slot) => (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between bg-muted p-2 rounded"
                          >
                            <span className="text-sm">
                              {slot.startTime} - {slot.endTime}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlot(slot.id)}
                              disabled={deleteAvailabilityMutation.isPending}
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
        </>
      )}
    </div>
  );
}
