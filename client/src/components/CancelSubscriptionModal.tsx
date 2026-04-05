import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BookOpen, CheckCircle, LogIn, Clock } from "lucide-react";
import { Link } from "wouter";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "confirm" | "done";

function getRequestedIds(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`cancel_requests_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveRequestedId(userId: number, subId: number) {
  try {
    const ids = getRequestedIds(userId);
    ids.add(subId);
    localStorage.setItem(`cancel_requests_${userId}`, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function CancelSubscriptionModal({ open, onOpenChange }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState<Step>("select");
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());
  const pendingSubIdRef = useRef<number | null>(null);

  // Load previously requested IDs for this user
  useEffect(() => {
    if (open && isAuthenticated && user?.id) {
      setRequestedIds(getRequestedIds(user.id));
    }
  }, [open, isAuthenticated, user?.id]);

  const { data: subscriptions, isLoading } = trpc.subscription.mySubscriptions.useQuery(undefined, {
    enabled: open && isAuthenticated,
  });

  const activeSubscriptions = subscriptions?.filter(s => s.subscription.status === "active") ?? [];
  const selectedEntry = activeSubscriptions.find(s => s.subscription.id === selectedSubId);

  const mutation = trpc.subscription.requestCancellation.useMutation({
    onSuccess: () => {
      if (user?.id && pendingSubIdRef.current) {
        saveRequestedId(user.id, pendingSubIdRef.current);
        setRequestedIds(getRequestedIds(user.id));
      }
      pendingSubIdRef.current = null;
      setStep("done");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send request. Please try again.");
    },
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("select");
        setSelectedSubId(null);
        setReason("");
      }, 300);
    }
  }, [open]);

  // Auto-close after success
  useEffect(() => {
    if (step === "done") {
      toast.success("Cancellation request sent. Our team will contact you within 1–2 business days.");
      const t = setTimeout(() => onOpenChange(false), 3000);
      return () => clearTimeout(t);
    }
  }, [step, onOpenChange]);

  function handleSubmit() {
    if (!selectedSubId) return;
    pendingSubIdRef.current = selectedSubId;
    mutation.mutate({ subscriptionId: selectedSubId, reason: reason.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            Select the course you'd like to cancel. Our support team will process your request.
          </DialogDescription>
        </DialogHeader>

        {/* Not logged in */}
        {!isAuthenticated && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <LogIn className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Please log in to manage your subscriptions.
            </p>
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        )}

        {/* Step: select */}
        {isAuthenticated && step === "select" && (
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading your subscriptions…</p>
            ) : activeSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You have no active subscriptions to cancel.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeSubscriptions.map(({ subscription, course, tutor }) => {
                  const studentName = [subscription.studentFirstName, subscription.studentLastName]
                    .filter(Boolean).join(" ") || "Student";
                  const isSelected = selectedSubId === subscription.id;
                  const alreadyRequested = requestedIds.has(subscription.id);
                  return (
                    <button
                      key={subscription.id}
                      onClick={() => !alreadyRequested && setSelectedSubId(subscription.id)}
                      disabled={alreadyRequested}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        alreadyRequested
                          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 cursor-default"
                          : isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{course?.title ?? "Course"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {studentName}{tutor?.name ? ` · with ${tutor.name}` : ""}
                          </p>
                        </div>
                        {alreadyRequested && (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Request sent
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button
                disabled={!selectedSubId || requestedIds.has(selectedSubId)}
                onClick={() => setStep("confirm")}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step: confirm */}
        {isAuthenticated && step === "confirm" && selectedEntry && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedEntry.course?.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {[selectedEntry.subscription.studentFirstName, selectedEntry.subscription.studentLastName]
                  .filter(Boolean).join(" ") || "Student"}
                {selectedEntry.tutor?.name ? ` · with ${selectedEntry.tutor.name}` : ""}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="Let us know why you'd like to cancel…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              This will send a cancellation request to our support team at{" "}
              <span className="font-medium">support@edkonnect-academy.com</span>. Your subscription
              remains active until the team processes your request.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Sending…" : "Send Request"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <div>
              <p className="font-semibold">Request Sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Our team will contact you within 1–2 business days.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
