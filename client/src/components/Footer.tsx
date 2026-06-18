import { GraduationCap, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";

const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

export default function Footer() {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  return (
    <footer className="border-t border-border/50 py-12 bg-muted/30">
      <div className="container">
        {/* Top row: brand + navigation links */}
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <Link href="/" onClick={scrollToTop} className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity cursor-pointer w-fit">
              <GraduationCap className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">EdKonnect Academy</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Connecting parents and tutors for personalized learning experiences.
            </p>
            <div className="flex items-center gap-3">
             <a href="https://www.facebook.com/profile.php?id=61589222931105" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/edkonnect.academy/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/company/114544238/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/channel/UCTkLqe4ERRtffZJjrSt4RAA" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-muted-foreground hover:text-primary transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">For Parents</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tutors" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Find Tutors
                </Link>
              </li>
              <li>
                <Link href="/courses" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Browse Courses
                </Link>
              </li>
              <li>
                <Link href="/signup" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Sign Up
                </Link>
              </li>
              <li>
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="hover:text-primary transition-colors text-left"
                >
                  Cancel Subscription
                </button>
              </li>
              <li>
  <a href="/mytest" className="hover:text-primary transition-colors">
    Take your test
  </a>
</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">For Tutors</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tutor-registration" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Become a Tutor
                </Link>
              </li>
              <li>
                <Link href="/tutor/dashboard" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Tutor Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
  <Link href="/terms-and-conditions" onClick={scrollToTop} className="hover:text-primary transition-colors">
    Terms &amp; Conditions
  </Link>
</li>
<li>
  <Link href="/privacy-policy" onClick={scrollToTop} className="hover:text-primary transition-colors">
    Privacy Policy
  </Link>
</li>
              <li>
                <a href="/promote" onClick={scrollToTop} className="hover:text-primary transition-colors">
                  Promote with us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Popular Courses section */}
        <div className="border-t border-border/50 pt-8">
          <h3 className="font-semibold mb-6 text-base">Popular Courses</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* SAT & ACT Test Prep */}
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">SAT &amp; ACT Prep</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li><Link href="/course/1" onClick={scrollToTop} className="hover:text-primary transition-colors">SAT Math</Link></li>
                <li><Link href="/course/25" onClick={scrollToTop} className="hover:text-primary transition-colors">SAT English</Link></li>
                <li><Link href="/course/92" onClick={scrollToTop} className="hover:text-primary transition-colors">ACT Math</Link></li>
                <li><Link href="/course/75" onClick={scrollToTop} className="hover:text-primary transition-colors">ACT English</Link></li>
                <li><Link href="/course/281" onClick={scrollToTop} className="hover:text-primary transition-colors">PSAT / NMSQT</Link></li>
                <li><Link href="/course/26" onClick={scrollToTop} className="hover:text-primary transition-colors">GRE Verbal</Link></li>
                <li><Link href="/course/282" onClick={scrollToTop} className="hover:text-primary transition-colors">GRE Quantitative</Link></li>
              </ul>
            </div>

            {/* AP Courses */}
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">AP Courses</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li><Link href="/course/33" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Calculus AB</Link></li>
                <li><Link href="/course/67" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Calculus BC</Link></li>
                <li><Link href="/course/71" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Biology</Link></li>
                <li><Link href="/course/82" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Chemistry</Link></li>
                <li><Link href="/course/84" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Physics 1</Link></li>
                <li><Link href="/course/59" onClick={scrollToTop} className="hover:text-primary transition-colors">AP US Government</Link></li>
                <li><Link href="/course/69" onClick={scrollToTop} className="hover:text-primary transition-colors">AP Computer Science</Link></li>
              </ul>
            </div>

            {/* K-12 Math & Science */}
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">Math &amp; Science</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li><Link href="/course/28" onClick={scrollToTop} className="hover:text-primary transition-colors">Algebra 1</Link></li>
                <li><Link href="/course/30" onClick={scrollToTop} className="hover:text-primary transition-colors">Algebra 2</Link></li>
                <li><Link href="/course/31" onClick={scrollToTop} className="hover:text-primary transition-colors">Geometry</Link></li>
                <li><Link href="/course/32" onClick={scrollToTop} className="hover:text-primary transition-colors">Pre-Calculus</Link></li>
                <li><Link href="/course/89" onClick={scrollToTop} className="hover:text-primary transition-colors">High School Statistics</Link></li>
<li><Link href="/course/274" onClick={scrollToTop} className="hover:text-primary transition-colors">Math Olympiad</Link></li>
              </ul>
            </div>

            {/* Language & Tech */}
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">Language &amp; Technology</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li><Link href="/course/42" onClick={scrollToTop} className="hover:text-primary transition-colors">IELTS Academic</Link></li>
                <li><Link href="/course/19" onClick={scrollToTop} className="hover:text-primary transition-colors">TOEFL Prep</Link></li>
                <li><Link href="/course/65" onClick={scrollToTop} className="hover:text-primary transition-colors">Spanish Course</Link></li>
                <li><Link href="/course/62" onClick={scrollToTop} className="hover:text-primary transition-colors">French Course</Link></li>
                <li><Link href="/course/12" onClick={scrollToTop} className="hover:text-primary transition-colors">Python Programming</Link></li>
                <li><Link href="/course/13" onClick={scrollToTop} className="hover:text-primary transition-colors">Web Development</Link></li>
                <li><Link href="/course/50" onClick={scrollToTop} className="hover:text-primary transition-colors">Data Science</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 EdKonnect Academy. All rights reserved.</p>
        </div>
      </div>

      <CancelSubscriptionModal open={cancelModalOpen} onOpenChange={setCancelModalOpen} />
    </footer>
  );
}
