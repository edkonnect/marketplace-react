import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SAT_FEELING, SAT_CHALLENGE, SAT_PAID, SAT_WANTS, SAT_CONTACT } from "@shared/satFeedback";

function Radios({ name, options, value, onChange }: {
  name: string; options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} className="accent-primary" />
          {o}
        </label>
      ))}
    </div>
  );
}

function Checks({ options, values, onChange }: {
  options: readonly string[]; values: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((x) => x !== o) : [...values, o]);
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={values.includes(o)} onChange={() => toggle(o)} className="accent-primary" />
          {o}
        </label>
      ))}
    </div>
  );
}

const Q = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <Label className="text-sm font-semibold block mb-2">
    {children} {hint && <span className="font-normal text-muted-foreground">({hint})</span>}
  </Label>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-bold text-primary border-b pb-1 pt-4">{children}</h2>
);

export default function SatFeedback() {
  // Keep the page at the top on load and make sure the nav bar is shown
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const reset = () => {
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("scroll")); // tells the nav bar to show itself
    };
    reset();
    const t1 = setTimeout(reset, 300);
    const t2 = setTimeout(reset, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [feeling, setFeeling] = useState("");
  const [moreInFuture, setMoreInFuture] = useState("");
  const [topicsHelp, setTopicsHelp] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [challenge, setChallenge] = useState("");
  const [refs, setRefs] = useState(["", "", ""]);
  const [paid, setPaid] = useState("");
  const [testDate, setTestDate] = useState("");
  const [wants, setWants] = useState<string[]>([]);
  const [contactMethod, setContactMethod] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [done, setDone] = useState(false);

  const submit = trpc.satFeedback.submit.useMutation({
    onSuccess: () => { setDone(true); window.scrollTo(0, 0); },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter your name.");
    if (!contact.trim()) return toast.error("Please enter your phone / WhatsApp / email.");
    if (!paid) return toast.error("Please answer: Would you like to join our paid SAT classes?");

    submit.mutate({
      name, contact,
      prepFeeling: (feeling || undefined) as any,
      moreInFuture: moreInFuture || undefined,
      topicsHelp: topicsHelp || undefined,
      targetScore: targetScore || undefined,
      biggestChallenge: (challenge || undefined) as any,
      referrals: refs,
      paidInterest: paid as any,
      testDate: testDate || undefined,
      paidWants: wants as any,
      contactMethod: (contactMethod || undefined) as any,
      website,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="flex-1 container py-16 max-w-2xl mt-20">
        {done ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
              <h1 className="text-2xl font-bold">Thank you for your feedback!</h1>
              <p className="text-muted-foreground">
                Questions? WhatsApp/call +91 98236 70412 (India) or +1 508-444-8714 (US)
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">SAT Free Classes – Feedback</CardTitle>
              <CardDescription>
                Thank you for attending our 10 free SAT classes! Your honest feedback helps us improve.
                It takes about 3 minutes. Tick one option unless it says ‘any’.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5 relative">
                <Section>About you</Section>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Q>Name</Q><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} /></div>
                  <div><Q>Phone / WhatsApp / Email</Q><Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={320} /></div>
                </div>

                <Section>About the classes</Section>
                <div><Q>How do you feel about your SAT prep now?</Q>
                  <Radios name="feeling" options={SAT_FEELING} value={feeling} onChange={setFeeling} /></div>
                <div><Q hint="optional">What would you like to see more of in future classes?</Q>
                  <Textarea rows={3} value={moreInFuture} onChange={(e) => setMoreInFuture(e.target.value)} maxLength={2000} /></div>
                <div><Q hint="optional">Which SAT topics would you like more help with?</Q>
                  <Textarea rows={3} value={topicsHelp} onChange={(e) => setTopicsHelp(e.target.value)} maxLength={2000} /></div>

                <Section>Your SAT goals</Section>
                <div className="sm:w-1/2">
                  <Q>Target SAT score</Q>
                  <Input value={targetScore} onChange={(e) => setTargetScore(e.target.value)} maxLength={20} />
                </div>
                <div><Q>What is your biggest challenge right now?</Q>
                  <Radios name="challenge" options={SAT_CHALLENGE} value={challenge} onChange={setChallenge} /></div>

                <Section>Referrals</Section>
                <p className="text-sm text-muted-foreground">
                  Know a friend or classmate who’d like free SAT help? Share their details and we’ll reach out to them.
                </p>
                <div>
                  <Q hint="optional">Friends’ names and phone / email</Q>
                  <div className="space-y-2">
                    {refs.map((r, i) => (
                      <Input key={i} value={r} maxLength={300}
                        onChange={(e) => setRefs((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
                    ))}
                  </div>
                </div>

                <Section>Paid classes</Section>
                <div><Q>Would you like to join our paid SAT classes?</Q>
                  <Radios name="paid" options={SAT_PAID} value={paid} onChange={setPaid} /></div>
                <div><Q hint="if known">When is your SAT test date?</Q>
                  <Input value={testDate} onChange={(e) => setTestDate(e.target.value)} maxLength={100} /></div>
                <div><Q hint="tick any">What would you want in a paid program?</Q>
                  <Checks options={SAT_WANTS} values={wants} onChange={setWants} /></div>
                <div><Q>Best way to share details with you</Q>
                  <Radios name="cm" options={SAT_CONTACT} value={contactMethod} onChange={setContactMethod} /></div>

                               {/* honeypot: hidden from humans */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{ position: "absolute", top: 0, left: "-9999px", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                  aria-hidden="true"
                />
                <Button type="submit" className="w-full" disabled={submit.isPending}>
                  {submit.isPending ? "Submitting..." : "Submit feedback"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
}