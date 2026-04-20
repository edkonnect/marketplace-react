import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  GraduationCap,
  Heart,
  Users,
  BookOpen,
  Calendar,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Star,
  Target,
  Globe,
} from "lucide-react";

const whoItsFor = [
  {
    icon: Users,
    label: "Parents",
    heading: "You want the best for your child — without the hassle",
    body: "You've probably tried finding a tutor through WhatsApp groups, word of mouth, or random Google searches. It's exhausting. EdKonnect gives you a single place to find vetted tutors, book sessions, and actually see how your child is progressing — without the back-and-forth.",
  },
  {
    icon: BookOpen,
    label: "Students",
    heading: "Learning that fits around your life",
    body: "Whether you're struggling with algebra or want to get ahead before exams, EdKonnect connects you with a tutor who matches how you learn. Sessions happen online, on a schedule that works for you — not just the tutor.",
  },
  {
    icon: Star,
    label: "Tutors",
    heading: "Focus on teaching, not admin",
    body: "If you're a tutor, you know how much time goes into scheduling, chasing payments, and keeping track of student progress. EdKonnect handles all of that so you can spend your energy on what you're actually good at — helping kids learn.",
  },
];

const differences = [
  {
    icon: CheckCircle,
    title: "Simple by design",
    body: "We didn't build this for tech people. We built it for a mum who just wants to book a maths tutor for her 12-year-old. Every screen, every button, every flow — designed to be obvious.",
  },
  {
    icon: Heart,
    title: "Trust is built in",
    body: "Every tutor on the platform goes through a review process. Parents can see ratings, read reviews from other families, and message a tutor before committing to anything. No surprises.",
  },
  {
    icon: TrendingUp,
    title: "Progress you can actually see",
    body: "After each session, tutors leave structured notes on what was covered and how the student is doing. Parents get visibility. Students stay accountable. It's not just tutoring — it's a feedback loop.",
  },
  {
    icon: MessageSquare,
    title: "Everything in one place",
    body: "No more juggling WhatsApp, Venmo, Google Calendar, and email. Scheduling, messaging, payments, and progress tracking all live inside EdKonnect.",
  },
];


export default function AboutUs() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b border-border mt-20">
        <div className="container py-20 max-w-4xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-5 leading-tight">
          We built EdKonnect because finding a good tutor at an affordable price shouldn't be hard.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            EdKonnect Academy is an online tutoring platform connecting parents and students with qualified tutors — making it easy to book sessions, track progress, and actually see results.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our Mission</p>
              <h2 className="text-3xl font-bold mb-5 leading-snug">
                Every child deserves access to a great tutor — not just kids whose parents know the right people
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Right now, finding a tutor is mostly luck. You ask a friend, someone recommends someone, you exchange a few texts, and hope it works out. There's no way to check if the tutor is actually good, no easy way to track whether your child is improving, and no structure to the whole thing.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We wanted to fix that. Not by creating a marketplace that just lists names and prices — but by building a platform that makes the entire tutoring relationship work better: from the first search to the last session.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Target, label: "Clear goals", sub: "Every session has a purpose" },
                { icon: CheckCircle, label: "Accountability", sub: "Progress tracked after every lesson" },
                { icon: Users, label: "Right match", sub: "Tutors filtered for fit, not just availability" },
                { icon: Globe, label: "Learn anywhere", sub: "Online sessions, any timezone" },
              ].map((item) => (
                <Card key={item.label} className="border-border/50">
                  <CardContent className="pt-5 pb-4">
                    <item.icon className="w-6 h-6 text-primary mb-2" />
                    <p className="font-semibold text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our Story</p>
          <h2 className="text-3xl font-bold mb-8">It started with a frustrated parent</h2>
          <div className="space-y-5 text-muted-foreground leading-relaxed text-left">
            <p>
              The idea for EdKonnect came from a simple, frustrating experience: a parent trying to find a reliable Math tutor for their child, spending weeks asking around, scheduling trial sessions, and still not knowing whether the tutor was actually helping.
            </p>
            <p>
              The tools available were either too expensive, too complicated, or just listings with no real structure. There was no easy way to book a session, no way to message the tutor in one place, and no way to know if the child was actually making progress.
            </p>
            <p>
              So we decided to build what we wished existed: a platform that makes it simple to find a trusted tutor, schedule sessions around real life, communicate without friction, and track whether it's actually working.
            </p>
            <p>
              EdKonnect Academy LLC is based in Shrewsbury, MA. We focus on Math and ELA tutoring for students aged 8–18, and we serve families across the US — with plans to grow further.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">What We Do</p>
            <h2 className="text-3xl font-bold">One platform, the whole tutoring relationship</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Find the right tutor", body: "Browse verified tutors filtered by subject, grade level, availability, and price. Read real reviews from other parents before you book." },
              { icon: Calendar, title: "Book sessions easily", body: "See a tutor's real availability and book directly. Set up recurring sessions, get reminders, and reschedule without the back-and-forth." },
              { icon: MessageSquare, title: "Communicate in one place", body: "No more juggling texts and emails. All messages between parents and tutors live inside the platform, tied to the right course and student." },
              { icon: TrendingUp, title: "Track progress", body: "After every session, tutors leave structured notes. Parents get a clear picture of what was covered and how their child is doing." },
              { icon: BookOpen, title: "Manage multiple students", body: "One parent account can manage different children, each with their own courses, sessions, and tutor relationships." },
              { icon: CheckCircle, title: "Secure payments", body: "Pay by course or per session through Stripe. No cash, no awkward invoices — payments are handled automatically and securely." },
            ].map((item) => (
              <Card key={item.title} className="border-border/50 hover:border-primary/40 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Who It's For</p>
            <h2 className="text-3xl font-bold">Built for everyone in the learning relationship</h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {whoItsFor.map((item) => (
              <Card key={item.label} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold text-lg">{item.label}</span>
                  </div>
                  <p className="font-semibold text-sm mb-2">{item.heading}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">What Makes Us Different</p>
            <h2 className="text-3xl font-bold">We care about outcomes, not just features</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              A lot of tutoring platforms focus on how many tutors they have listed. We focus on whether the tutoring is actually working.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {differences.map((item) => (
              <div key={item.title} className="flex gap-4 p-6 rounded-xl border border-border/50 bg-card">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1.5">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to find the right tutor?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Join families across the US who are using EdKonnect to give their children a better shot at learning.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8">
              <Link href="/tutors">Browse Tutors</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
