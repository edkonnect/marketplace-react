import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import { StillNeedHelpCard } from "@/components/StillNeedHelpCard";
import {
  MessageSquare,
  Mail,
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
        <div className="grid lg:grid-cols-5 gap-10 items-start">

          {/* Contact Card — mirrors the FAQ sidebar */}
          <div className="lg:col-span-2">
            <StillNeedHelpCard />
          </div>

          {/* Right side — context + reasons */}
          <div className="lg:col-span-3 space-y-8">
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

          </div>
        </div>

        {/* Address bar — full width, centered */}
        <div className="mt-8 rounded-xl border border-border/50 bg-muted/30 p-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div>
            <h3 className="font-semibold">EdKonnect Academy LLC</h3>
            <p className="text-sm text-muted-foreground">30 Lyman St, Westborough, MA 01581</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-border/60" />
          <a
            href="mailto:admin@edkonnect-academy.com"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Mail className="w-3.5 h-3.5" />
            admin@edkonnect-academy.com
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}