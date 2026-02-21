import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TutorListing from "./pages/TutorListing";
import TutorDetail from "./pages/TutorDetail";
import CourseListing from "./pages/CourseListing";
import CourseDetail from "./pages/CourseDetail";
import ParentDashboard from "./pages/ParentDashboard";
import TutorDashboard from "./pages/TutorDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import Messages from "./pages/Messages";
// RoleSelection removed - users get role assigned during registration
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import SetupPassword from "./pages/SetupPassword";
import BookSession from "./pages/BookSession";
import { ManageBooking } from "./pages/ManageBooking";
import SessionNotesHistory from "./pages/SessionNotesHistory";
import { FindTutors } from "./pages/FindTutors";
import TutorRegistration from "./pages/TutorRegistration";
import TutorProfile from "./pages/TutorProfile";
import ParentPayments from "./pages/ParentPayments";
import ParentNotifications from "./pages/ParentNotifications";
import TutorNotifications from "./pages/TutorNotifications";
import TutorPayments from "./pages/TutorPayments";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/signup"} component={SignUp} />
      <Route path={"/login"} component={Login} />
      <Route path={"/setup-password"} component={SetupPassword} />
      {/* RoleSelection removed - users get role assigned during registration */}
      <Route path={"/tutors"} component={TutorListing} />
      <Route path={"/find-tutors"} component={FindTutors} />
      <Route path={"/tutor-registration"} component={TutorRegistration} />
      {/* Put specific tutor routes before the dynamic :id route to avoid collisions (e.g., /tutor/dashboard) */}
      <Route path={"/tutor/dashboard"} component={TutorDashboard} />
      <Route path={"/tutor/notifications"} component={TutorNotifications} />
      <Route path={"/tutor/payments"} component={TutorPayments} />
      <Route path={"/tutor-profile/:id"} component={TutorProfile} />
      <Route path={"/tutor/:id"} component={TutorDetail} />
      <Route path={"/courses"} component={CourseListing} />
      <Route path={"/course/:id"} component={CourseDetail} />
      <Route path={"/parent/dashboard"} component={ParentDashboard} />
      <Route path={"/parent/payments"} component={ParentPayments} />
      <Route path={"/parent/notifications"} component={ParentNotifications} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/book-session/:id"} component={BookSession} />
      <Route path={"/manage-booking/:token"} component={ManageBooking} />
      <Route path={"/session-notes"} component={SessionNotesHistory} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
