import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

export function TimeBlockManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  // Get time blocks for the next 3 months (fixed on mount to avoid re-query loops)
  const { rangeStart, rangeEnd } = useMemo(() => {
    const start = Date.now();
    return {
      rangeStart: start,
      rangeEnd: start + 90 * 24 * 60 * 60 * 1000,
    };
  }, []);

  const { data: timeBlocks, isLoading, refetch } = trpc.tutorAvailability.getTimeBlocks.useQuery({
    startTime: rangeStart,
    endTime: rangeEnd,
  });

  const createBlockMutation = trpc.tutorAvailability.createTimeBlock.useMutation({
    onSuccess: () => {
      toast.success("Time block added", {
        description: "The time period has been marked as unavailable.",
      });
      refetch();
      setIsAddDialogOpen(false);
      // Reset form
      setStartDate("");
      setStartTime("09:00");
      setEndDate("");
      setEndTime("17:00");
      setReason("");
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const deleteBlockMutation = trpc.tutorAvailability.deleteTimeBlock.useMutation({
    onSuccess: () => {
      toast.success("Time block removed", {
        description: "The time period is now available again.",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const handleAddBlock = () => {
    if (!startDate || !endDate) {
      toast.error("Missing dates", {
        description: "Please select both start and end dates.",
      });
      return;
    }

    // Combine date and time
    const startDateTime = new Date(`${startDate}T${startTime}`).getTime();
    const endDateTime = new Date(`${endDate}T${endTime}`).getTime();

    if (startDateTime >= endDateTime) {
      toast.error("Invalid time range", {
        description: "End time must be after start time.",
      });
      return;
    }

    createBlockMutation.mutate({
      startTime: startDateTime,
      endTime: endDateTime,
      reason: reason || undefined,
    });
  };

  const handleDeleteBlock = (id: number) => {
    if (confirm("Are you sure you want to remove this time block?")) {
      deleteBlockMutation.mutate({ id });
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Blocks</CardTitle>
          <CardDescription>Loading your blocked time periods...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Sort blocks by start time
  const sortedBlocks = [...(timeBlocks || [])].sort((a, b) => a.startTime - b.startTime);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Time Blocks</CardTitle>
            <CardDescription>
              Block out time for vacations, appointments, or other unavailable periods
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Time Block
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Time Block</DialogTitle>
                <DialogDescription>
                  Mark a time period as unavailable for bookings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Start Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                    />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Vacation, Conference, Personal appointment"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
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
                  onClick={handleAddBlock}
                  disabled={createBlockMutation.isPending}
                >
                  {createBlockMutation.isPending ? "Adding..." : "Add Block"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {sortedBlocks.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No time blocks set. You're available during your regular schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedBlocks.map((block) => (
              <div
                key={block.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {formatDateTime(block.startTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-muted-foreground text-sm ml-6">to</span>
                      <span className="font-medium text-sm">
                        {formatDateTime(block.endTime)}
                      </span>
                    </div>
                    {block.reason && (
                      <p className="text-sm text-muted-foreground mt-2 ml-6">
                        {block.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(block.id)}
                    disabled={deleteBlockMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
