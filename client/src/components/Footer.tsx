import { GraduationCap } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 py-12 bg-muted/30">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">EdKonnect Academy</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connecting parents and tutors for personalized learning experiences.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">For Parents</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tutors" className="hover:text-primary transition-colors">
                  Find Tutors
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-primary transition-colors">
                  Browse Courses
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-primary transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">For Tutors</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/signup" className="hover:text-primary transition-colors">
                  Become a Tutor
                </Link>
              </li>
              <li>
                <Link href="/tutor/dashboard" className="hover:text-primary transition-colors">
                  Tutor Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="/promote" className="hover:text-primary transition-colors">
                  Promote with us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 EdKonnect Academy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
