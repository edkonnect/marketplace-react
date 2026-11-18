import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_CHARS = 600;

export function TrialWelcomeSettings() {
  const utils = trpc.useUtils();
  const { data } = trpc.trialWelcome.getMyMessage.useQuery();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(data?.text ?? "");
      setPreview(null);
    }
  }, [open, data?.text]);

  const previewMutation = trpc.trialWelcome.previewMessage.useMutation({
    onSuccess: (res) => setPreview(res.text),
    onError: (err) => toast.error(err.message || "Could not build the preview"),
  });

  const saveMutation = trpc.trialWelcome.saveMyMessage.useMutation({
    onSuccess: () => {
      toast.success("Welcome message saved");
      utils.trialWelcome.getMyMessage.invalidate();
      utils.trialWelcome.getPending.invalidate();
      setOpen(false);
    },
    onError: (err) => toast.error(err.message || "Could not save"),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Welcome Message
          </CardTitle>
          <CardDescription>
            Write a short personal message that is sent to parents of your new students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {data?.text ? "You have a custom message saved." : "Using the default message."}
          </p>
          <Button onClick={() => setOpen(true)}>
            {data?.text ? "Edit welcome message" : "Write welcome message"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Welcome message</DialogTitle>
            <DialogDescription>
              Write your own introduction. Your profile link, sign-up and sign-in links and the admin
              contact line are added automatically. You can use {"{parent}"} and {"{student}"}.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="max-h-[60vh] min-h-[260px] overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
              {preview}
            </div>
          ) : (
            <div>
              <Textarea
                value={text}
                maxLength={MAX_CHARS}
                rows={10}
                className="min-h-[240px] text-base"
                placeholder="I'm ..., I have ... years of experience teaching .... I'm looking forward to working with {student}!"
                onChange={(e) => setText(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {text.length}/{MAX_CHARS}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {preview ? (
              <Button variant="outline" onClick={() => setPreview(null)}>
                Back to editing
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={previewMutation.isPending}
                  onClick={() => previewMutation.mutate({ text })}
                >
                  Preview
                </Button>
                {data?.text && (
                  <Button
                    variant="outline"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ text: "" })}
                  >
                    Use default
                  </Button>
                )}
              </>
            )}
            <Button
              disabled={saveMutation.isPending || !text.trim()}
              onClick={() => saveMutation.mutate({ text })}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}