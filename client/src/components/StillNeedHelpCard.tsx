import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { RequestInfoModal } from "@/components/RequestInfoModal";
import { MessageSquare, Mail, Clock } from "lucide-react";

export function StillNeedHelpCard() {
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);

  return (
    <>
      <Card className="border-border/60 shadow-sm sticky top-24">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Still need help?</h3>
              <p className="text-sm text-muted-foreground">
                Talk with our team for enrollment questions or to match with a tutor faster.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/60 p-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-foreground">Live Chat</span>
              </div>
              <div className="pl-5 font-semibold text-primary">Mon - Fri, 9:00 AM - 6:00 PM ET</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-foreground">Email</span>
              </div>
              <a
                href="mailto:admin@edkonnect-academy.com"
                className="pl-5 font-semibold text-primary hover:underline transition-colors break-all"
              >
                admin@edkonnect-academy.com
              </a>
            </div>
          </div>

          <Button onClick={() => setRequestInfoOpen(true)} className="w-full gap-2">
            <MessageSquare className="w-4 h-4" />
            Talk to Us
          </Button>
          <Button asChild variant="outline" className="w-full gap-2">
            <a href="mailto:admin@edkonnect-academy.com">
              <Mail className="w-4 h-4" />
              Email Us
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/tutors">Find a Tutor</Link>
          </Button>
        </CardContent>
      </Card>

      <RequestInfoModal open={requestInfoOpen} onOpenChange={setRequestInfoOpen} />
    </>
  );
}