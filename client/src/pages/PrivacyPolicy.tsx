import Navigation from "@/components/Navigation";
import { Shield, Mail, MapPin } from "lucide-react";
import Footer from "@/components/Footer";

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: `Because our platform connects students, parents, and educators, we collect information in a few different ways:

Account & Profile Data: Names, email addresses, phone numbers, profile pictures, and user bios.

Marketplace Transaction Data: Payment details (processed securely through third-party gateways such as Stripe), order history, and booking details.

Educational & Performance Data: Course selections, reviews, ratings, and any messages or assignments submitted through our messaging features.

Usage Data: IP addresses, browser types, device information, and interactions with our website (via cookies).`,
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: `We use the information we collect to facilitate our education marketplace and improve your user experience:

To Provide Services: Matching students with tutors, processing payments, and enabling course access.

To Communicate: Sending booking confirmations, newsletters, marketing offers, and responding to customer support inquiries.

To Improve Our Platform: Analyzing usage trends, testing features, and ensuring platform security.`,
  },
  {
    id: "how-we-share",
    title: "3. How We Share Your Information",
    content: `We do not sell your personal information. We only share it in the following limited circumstances:

Between Users: To facilitate learning, the student's name and learning progress may be shared with the specific educator/vendor, and vice-versa.

Service Providers: We share data with trusted third-party vendors who assist us with hosting, analytics, email delivery, and payment processing.

Legal Obligations: We may disclose your information if required to do so by law or in response to valid requests by public authorities.`,
  },
  {
    id: "data-security",
    title: "4. Data Security",
    content: `We implement appropriate technical and organizational security measures to protect your personal data from unauthorized access, alteration, or disclosure. However, no transmission over the internet is completely secure.`,
  },
  {
    id: "your-choices",
    title: "5. Your Choices and Rights",
    content: `Depending on your location, you may have the following rights regarding your data:

Access & Update: You can access and update your profile information at any time via your account dashboard.

Deletion: You may request that we delete your account and personal information.

Opt-Out: You can opt out of receiving promotional emails by clicking the "unsubscribe" link in those communications.`,
  },
  {
    id: "childrens-privacy",
    title: "6. Children's Privacy",
    content: `Our marketplace is generally intended for use by adults (18+), though students under 18 may use our services only under the supervision and registration of a parent, guardian, or authorized school representative. We do not knowingly collect personal information directly from children under 13 without verifiable parental consent.`,
  },
  {
    id: "changes",
    title: "7. Changes to This Privacy Policy",
    content: `We may update this policy to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the new policy on this page.`,
  },
  {
    id: "contact-us",
    title: "8. Contact Us",
    content: `If you have questions or concerns about this privacy policy or our data practices, please contact us at:

EdKonnect Academy LLC
30 Lyman Street, Westborough, MA
admin@edkonnect-academy.com
508-444-8714`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b border-border mt-20">
        <div className="container py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            How we collect, use, and protect your personal information at EdKonnect Academy.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Effective Date: 01/01/2026</p>
        </div>
      </div>

      <div className="flex-1 container py-12 max-w-6xl">
        <div className="grid lg:grid-cols-4 gap-10">

          {/* Sticky Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-3">
                Contents
              </p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-2">
            {/* Owner Info Card */}
            <div className="rounded-xl border border-border bg-card p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base">EdKonnect Academy LLC</p>
                  <p className="text-sm text-muted-foreground mt-0.5">30 Lyman Street, Westborough, MA</p>
                  <a
                    href="mailto:admin@edkonnect-academy.com"
                    className="inline-flex items-center gap-1.5 text-sm text-primary mt-1.5 hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    admin@edkonnect-academy.com
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">508-444-8714</p>
                </div>
              </div>
            </div>

            {/* Intro */}
            <div className="rounded-xl border border-border bg-card p-6 mb-2">
              <p className="text-muted-foreground leading-relaxed">
                At EdKonnect ("we," "our," or "us"), we are committed to protecting your privacy. This policy
                explains how we collect, use, and disclose your personal information when you use our education
                marketplace.
              </p>
            </div>

            {/* Sections */}
            {sections.map((section) => (
              <div
                key={section.id}
                id={section.id}
                className="rounded-xl border border-border bg-card p-6 scroll-mt-28"
              >
                <h2 className="text-xl font-semibold leading-snug mb-4">{section.title}</h2>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm lg:text-base">
                  {section.content}
                </div>
              </div>
            ))}

            {/* Footer note */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:admin@edkonnect-academy.com" className="text-primary font-medium hover:underline">
                  admin@edkonnect-academy.com
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Privacy Policy — Effective Date: 01/01/2026
              </p>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}