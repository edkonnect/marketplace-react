import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function TrialWelcomeDialog() {
  const { user, isAuthenticated } = useAuth();
  const isTutor = user?.role === "tutor";
  const utils = trpc.useUtils();

  const { data: pending = [] } = trpc.trialWelcome.getPending.useQuery(undefined, {
    enabled: isAuthenticated && isTutor,
  });

  const [dismissed, setDismissed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sendMutation = trpc.trialWelcome.send.useMutation({
    onSuccess: (res) => {
      toast.success(res.emailSent ? "Welcome message sent" : "Message sent (email could not be delivered)");
      setSelectedKey(null);
      utils.trialWelcome.getPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Could not send the message"),
  });

  if (!isTutor || pending.length === 0) return null;

  const keyOf = (p: any) => `${p.parentId}-${p.studentKey}`;
  const selected = pending.find((p: any) => keyOf(p) === selectedKey) ?? null;

  // Popup closed: keep a button on screen so the tutor can reopen it
  if (dismissed) {
    return (
      <Button
        onClick={() => setDismissed(false)}
        className="fixed bottom-4 left-4 z-50 shadow-lg"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {pending.length} welcome message{pending.length > 1 ? "s" : ""} pending
      </Button>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setSelectedKey(null);
          setDismissed(true);
        }
      }}
    >
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Message for {selected.parentName}</DialogTitle>
              <DialogDescription>
                This is exactly what will be sent for {selected.studentName}, in Messages and by email.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
              {selected.previewText}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                disabled={sendMutation.isPending}
                onClick={() => setSelectedKey(null)}
              >
                Back
              </Button>
              <Button
                disabled={sendMutation.isPending}
                onClick={() =>
                  sendMutation.mutate({ parentId: selected.parentId, studentKey: selected.studentKey })
                }
              >
                {sendMutation.isPending ? "Sending..." : "Send message"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Welcome your new trial students</DialogTitle>
              <DialogDescription>
                These students have a trial lesson with you. Please preview and send each one a welcome message.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {pending.map((p: any) => (
                <div key={keyOf(p)} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{p.studentName}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.courseTitle} &bull; Parent: {p.parentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trial: {new Date(p.nextTrialAt).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedKey(keyOf(p))}>
                    Preview &amp; send
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDismissed(true)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}