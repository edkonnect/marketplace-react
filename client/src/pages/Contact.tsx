import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  GraduationCap,
  MessageSquare,
  Mail,
  Clock,
  Users,
  BookOpen,
  HelpCircle,
} from "lucide-react";

const contactReasons = [
  {
    icon: BookOpen,
    title: "Enrollment help",
    body: "Questions about signing up, picking a course, or getting started with a tutor.",
  },
  {
    icon: Users,
    title: "Finding the right tutor",
    body: "Not sure who's the best fit for your child? We'll help you narrow it down.",
  },
  {
    icon: MessageSquare,
    title: "Account or billing issues",
    body: "Problems with your account, a payment, or a subscription — we'll sort it out.",
  },
  {
    icon: HelpCircle,
    title: "General questions",
    body: "Anything else about how the platform works or what we offer.",
  },
];

export default function Contact() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b border-border mt-20">
        <div className="container py-16 text-center max-w-3xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Get in Touch</h1>
          <p className="text-lg text-muted-foreground">
            Whether you have a question about enrollment, need help with your account, or just want to find the right tutor — we're here to help.
          </p>
        </div>
      </section>

      <div className="flex-1 container py-16 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-10 items-start">

          {/* Contact Card — mirrors the FAQ sidebar */}
          <div className="lg:col-span-1">
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
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Live chat
                    </span>
                    <span className="text-primary font-semibold">Weekdays 9a–6p</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </span>
                    <a
                      href="mailto:support@edkonnect.com"
                      className="font-semibold text-right hover:text-primary transition-colors break-all"
                    >
                      support@edkonnect.com
                    </a>
                  </div>
                </div>

                <Button asChild className="w-full gap-2">
                  <a href="mailto:support@edkonnect.com">
                    <Mail className="w-4 h-4" />
                    Email Us
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/tutors">Find a Tutor</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right side — context + reasons */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-3">How can we help?</h2>
              <p className="text-muted-foreground leading-relaxed">
                We typically respond to emails within one business day. For faster answers, check the{" "}
                <Link href="/#faq" className="text-primary hover:underline">
                  FAQ section
                </Link>{" "}
                on our homepage — most common questions are answered there.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {contactReasons.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 p-5 rounded-xl border border-border/50 bg-card"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/30 p-6">
              <h3 className="font-semibold mb-1">EdKonnect Academy LLC</h3>
              <p className="text-sm text-muted-foreground">P.O. BOX 18, Shrewsbury, MA 01545</p>
              <a
                href="mailto:admin@edkonnect.com"
                className="inline-flex items-center gap-1.5 text-sm text-primary mt-2 hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                admin@edkonnect.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
