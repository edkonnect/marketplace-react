import Navigation from "@/components/Navigation";
import { GraduationCap, Shield, Mail } from "lucide-react";
import Footer from "@/components/Footer";

const sections = [
  {
    id: "information-about",
    title: "Information about this Website",
    content: `EdKonnect Academy is an online tutoring platform connecting parents with qualified tutors for Math and ELA subjects. Students ages 8–18 can learn from anywhere, with sessions conducted online via video.

"This Website" refers to:
• This website (edkonnect.com), including its subdomains and any other website through which the Owner makes its Service available
• The Service — including course enrollment, session booking, progress tracking, and tutor/parent communication`,
  },
  {
    id: "at-a-glance",
    title: "What the User Should Know at a Glance",
    content: `• EdKonnect is intended for adults (parents and tutors). Students who are minors may use the platform only under parental supervision.
• A registered account is required to book sessions, make payments, or communicate with tutors. Most features are not accessible without signing in.
• Parents are responsible for their account activity and any enrollments or bookings made on behalf of their children.
• Tutors must complete the registration and onboarding process before their profile becomes visible to parents.
• All users must provide accurate information at signup and keep their account details up to date.`,
  },
  {
    id: "terms-of-use",
    title: "Terms of Use",
    content: `These Terms apply to all use of this Website and the EdKonnect Service. By creating an account or using the platform, you agree to these Terms.

To use this platform you must:
• Be 18 years of age or older (or the legal age of majority in your jurisdiction)
• Register an account — nearly all platform features (course enrollment, session booking, messaging, payments) require a verified account
• If you are a parent registering on behalf of a minor student, you take full responsibility for that student's participation and your account activity

Minors may not create their own accounts. They may only access the Service through their parent's or guardian's account.`,
  },
  {
    id: "account-registration",
    title: "Account Registration",
    content: `To use the Service, users must register an account and provide accurate, complete information including their name, email address, and timezone. Registration is available for two roles:

• Parent — enrolls students in courses, books sessions, manages payments and progress
• Tutor — creates and delivers courses, manages availability, receives payouts

After registration, email verification is required before accessing the platform. Until your email is verified, account access is restricted.

If you were referred by an existing user, you may enter a referral code during signup. This links you to the referrer for purposes of the referral reward program.

Users are responsible for keeping their login credentials confidential. You are responsible for all activity that occurs under your account. If you believe your account has been compromised, contact us immediately at support@edkonnect.com.

Additional conditions:
• Automated registrations (bots, scripts) are not permitted
• Each person may hold only one account per role
• Accounts may not be shared with other individuals`,
  },
  {
    id: "account-termination",
    title: "Account Termination & Suspension",
    content: `Users can terminate their account at any time by emailing support@edkonnect.com. Please note that account termination does not automatically cancel active subscriptions or trigger refunds — those are handled separately per the cancellation policy below.

The Owner reserves the right, at its sole discretion, to suspend or delete any User account at any time and without prior notice if it deems the account inappropriate, abusive, or in violation of these Terms. This includes but is not limited to: fraudulent activity, misuse of the referral or coupon system, harassment of other users, or repeated session no-shows.

Suspension or deletion of an account does not entitle Users to compensation and does not exempt them from any outstanding payment obligations.`,
  },
  {
    id: "content",
    title: "Content on this Website",
    content: `Unless where otherwise specified or clearly recognizable, all content available on this Website is owned or provided by the Owner or its licensors. The Owner holds and reserves all intellectual property rights for any such content.

Users may not copy, download, share (beyond the limits set forth below), modify, translate, transform, publish, transmit, sell, sublicense, edit, transfer/assign to third parties or create derivative works from the content available on this Website, nor allow any third party to do so through the User or their device, even without the User's knowledge.

The Owner allows Users to upload, share or provide their own content to this Website. By providing content to this Website, Users confirm that they are legally allowed to do so and that they are not infringing any statutory provisions and/or third-party rights.`,
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    content: `This Website and the Service may only be used within the scope of what they are provided for, under these Terms and applicable law. Users are solely responsible for making sure that their use of this Website and/or the Service violates no applicable law, regulations or third-party rights.

The Owner reserves the right to take appropriate measures to protect its legitimate interests including by denying Users access to this Website or the Service, terminating contracts, or reporting any misconduct to the competent authorities whenever Users:
• Violate laws, regulations and/or these Terms
• Infringe any third-party rights
• Considerably impair the Owner's legitimate interests
• Offend the Owner or any third party`,
  },
  {
    id: "terms-of-sale",
    title: "Terms and Conditions of Sale",
    content: `EdKonnect offers three payment models depending on the course type. All prices are shown before checkout and are subject to change for new enrollments.

1. Full Upfront Payment
The full course price is charged as a single payment at the time of enrollment. This option is typically available for test prep and fixed-duration courses.

2. 3-Installment Plan
The course price is split into 3 equal monthly payments, automatically charged via Stripe on the same date each month. All 3 installments must be completed. Failure to pay an installment may result in suspension of access to sessions.

3. Usage-Based Monthly Billing (per-session)
Available for ongoing tutor and homework help courses. A per-session rate is agreed at enrollment. At the end of each billing month, the total number of completed sessions is counted and a single invoice is generated and charged via Stripe. If no sessions were completed in a given month, no charge is made.

All payments are processed securely by Stripe. EdKonnect does not store or handle your card details directly — only a confirmation of successful payment is received by the platform.`,
  },
  {
    id: "offers-coupons",
    title: "Offers, Discounts & Coupons",
    content: `EdKonnect offers two discount mechanisms:

Referral Coupons
When an existing user invites a friend via the referral program and that friend enrolls in their first course, both the referrer and the new user each receive a discount coupon (up to $25 off) delivered by email. Coupons are single-use, tied to the account they were issued to, and non-transferable.

Sibling Discount
Parents who have 2 or more active course enrollments across their children may be eligible for a sibling discount. This is a percentage reduction applied automatically at checkout.

General Coupon Rules:
• Each coupon is single-use — it can only be applied once and is marked used immediately upon enrollment
• Coupons cannot be combined with other coupons or applied cumulatively
• The full coupon value is applied at the time of purchase; partial redemption is not permitted
• Coupons are for personal, non-commercial use only and may not be resold or transferred
• Expired coupons cannot be reactivated`,
  },
  {
    id: "subscriptions",
    title: "Subscriptions & Trial Period",
    content: `Trial Lessons
New parents may book up to 2 trial lessons across the platform. Trial lessons are charged at $1 per session (not free). A trial lesson does not automatically enroll you in a course — you must separately choose a course and payment plan to continue.

Course Subscriptions
Once enrolled in a course, your subscription begins on the date your first payment is received. The subscription continues according to the payment model chosen (full, installment, or monthly usage-based).

To maintain active access to sessions, payments must be kept up to date. Missed payments on installment or usage-based plans may result in session access being paused until the outstanding balance is resolved.

Cancellation
You may cancel an active subscription at any time by contacting support@edkonnect.com. Cancellations take effect within 7 business days of the request being received. Sessions already scheduled and completed prior to cancellation remain billable.`,
  },
  {
    id: "right-of-withdrawal",
    title: "Right of Withdrawal",
    content: `You may cancel your enrollment or subscription at any time by contacting support@edkonnect.com.

Session Cancellations
If you need to cancel an individual session, please do so at least 24 hours before the scheduled start time. Cancellations made with less than 24 hours' notice may not be eligible for a refund of that session.

Subscription Cancellations & Refunds
Refunds for subscription payments are handled on a case-by-case basis. If you cancel within a reasonable period after your most recent charge and have not used sessions in that billing cycle, we will work with you on a fair resolution. To request a refund, email support@edkonnect.com with your account details and the reason for the request. We will respond within 5 business days.

Trial Lesson Refunds
The $1 trial lesson fee is non-refundable once the session has been conducted.`,
  },
  {
    id: "liability",
    title: "Liability and Indemnification",
    content: `Disclaimer of Warranties: This Website is provided strictly on an "as is" and "as available" basis. Use of the Service is at Users' own risk. The Owner expressly disclaims all conditions, representations, and warranties — whether express, implied, statutory or otherwise.

Limitations of liability: To the maximum extent permitted by applicable law, in no event shall the Owner be liable for any indirect, punitive, incidental, special, consequential or exemplary damages, including without limitation damages for loss of profits, goodwill, use, data or other intangible losses, arising out of or relating to the use of, or inability to use, the Service.

Indemnification: The User agrees to defend, indemnify and hold the Owner and its subsidiaries, affiliates, officers, directors, agents, co-branders, partners, suppliers and employees harmless from and against any and all claims or demands, damages, obligations, losses, liabilities, costs or debt, and expenses arising from the User's use of and access to the Service.`,
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property Rights",
    content: `Without prejudice to any more specific provision of these Terms, any intellectual property rights, such as copyrights, trademark rights, patent rights and design rights related to this Website are the exclusive property of the Owner or its licensors and are subject to the protection granted by applicable laws or international treaties relating to intellectual property.

All trademarks — nominal or figurative — and all other marks, trade names, service marks, word marks, illustrations, images, or logos appearing in connection with this Website are, and remain, the exclusive property of the Owner or its licensors.`,
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    content: `The Owner reserves the right to amend or otherwise modify these Terms at any time. In such cases, the Owner will appropriately inform the User of these changes. Such changes will only affect the relationship with the User for the future.

The continued use of the Service will signify the User's acceptance of the revised Terms. If Users do not wish to be bound by the changes, they must stop using the Service.`,
  },
  {
    id: "governing-law",
    title: "Governing Law & Jurisdiction",
    content: `These Terms are governed by the laws of the Commonwealth of Massachusetts, United States, without regard to conflict of laws principles.

Any disputes arising from or related to these Terms or the use of the EdKonnect platform shall be subject to the exclusive jurisdiction of the state and federal courts located in Worcester County, Massachusetts.`,
  },
  {
    id: "dispute-resolution",
    title: "Dispute Resolution",
    content: `Users may bring any disputes to the Owner who will try to resolve them amicably. While Users' right to take legal action shall always remain unaffected, in the event of any controversy regarding the use of this Website or the Service, Users are kindly asked to contact the Owner at the contact details provided in this document.

The User may submit the complaint including a brief description and if applicable, the details of the related order, purchase, or account, to the Owner's email address specified in this document. The Owner will process the complaint without undue delay and within 14 days of receiving it.`,
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
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Terms &amp; Conditions</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Please read these terms carefully before using EdKonnect Academy's platform and services.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Last updated: March 2026</p>
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
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base">EdKonnect Academy LLC</p>
                  <p className="text-sm text-muted-foreground mt-0.5">P.O. BOX 18, Shrewsbury, MA 01545</p>
                  <a
                    href="mailto:admin@edkonnect.com"
                    className="inline-flex items-center gap-1.5 text-sm text-primary mt-1.5 hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    admin@edkonnect.com
                  </a>
                </div>
              </div>
            </div>

            {/* Intro */}
            <div className="rounded-xl border border-border bg-card p-6 mb-2">
              <p className="text-muted-foreground leading-relaxed">
                These Terms govern the use of this Website, and any other related Agreement or legal relationship
                with the Owner in a legally binding way. Capitalized words are defined in the relevant dedicated
                section of this document. The User must read this document carefully.
              </p>
            </div>

            {/* Sections */}
            {sections.map((section, i) => (
              <div
                key={section.id}
                id={section.id}
                className="rounded-xl border border-border bg-card p-6 scroll-mt-28"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h2 className="text-xl font-semibold leading-snug">{section.title}</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm lg:text-base">
                  {section.content}
                </div>
              </div>
            ))}

            {/* Footer note */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:admin@edkonnect.com" className="text-primary font-medium hover:underline">
                  admin@edkonnect.com
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Terms and Conditions — Latest update: March 2026
              </p>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
