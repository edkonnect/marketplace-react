import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const countryCodes = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+91", label: "India (+91)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+971", label: "UAE (+971)" },
];

const initialForm = {
  name: "",
  parentName: "",
  email: "",
  countryCode: "+1",
  phone: "",
  message: "",
  bestAvailability: "",
};

export function RequestInfoModal({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const submitLeadMutation = trpc.home.submitLead.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.parentName ||
      !form.email ||
      !form.phone
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    submitLeadMutation.mutate({
      name: form.name,
      parentName: form.parentName,
      email: form.email,
      phone: `${form.countryCode} ${form.phone}`,
      message: form.message || undefined,
      bestAvailability: form.bestAvailability || undefined,
    });
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Reset after close animation
      setTimeout(() => {
        setForm(initialForm);
        setSubmitted(false);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <CheckCircle className="w-12 h-12 text-primary" />
            <h3 className="text-xl font-semibold">Thanks! We've got your info.</h3>
            <p className="text-sm text-muted-foreground">
              Our team will contact you within 2-3 business days.
            </p>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request Info</DialogTitle>
              <DialogDescription>
                Tell us a bit about your student and we'll match you with the right tutor.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentName">Parent Name *</Label>
                  <Input
                    id="parentName"
                    value={form.parentName}
                    onChange={(e) => handleChange("parentName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.countryCode}
                    onValueChange={(value) => handleChange("countryCode", value)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodes.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    className="flex-1"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  placeholder="What subject or support are you looking for?"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bestAvailability">Best time to reach you</Label>
                <Textarea
                  id="bestAvailability"
                  rows={2}
                  value={form.bestAvailability}
                  onChange={(e) => handleChange("bestAvailability", e.target.value)}
                  placeholder="E.g. Weekday evenings after 6 PM"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitLeadMutation.isPending}
              >
                {submitLeadMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}