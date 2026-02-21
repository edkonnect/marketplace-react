import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { FormInput } from "@/components/forms/FormInput";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { email as emailValidator, required } from "@/lib/validation";

const REMEMBER_ME_KEY = "rememberMe";
const SAVED_EMAIL_KEY = "savedEmail";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showResendSetup, setShowResendSetup] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const form = useValidatedForm(
    { email: "", password: "" },
    {
      email: [required("Email is required"), emailValidator()],
      password: required("Password is required"),
    }
  );
  const { values, register, validateForm, setValue } = form;

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    if (saved) {
      const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY) || "";
      setRememberMe(true);
      if (savedEmail) setValue("email", savedEmail);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, "true");
      localStorage.setItem(SAVED_EMAIL_KEY, values.email);
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }
    setLoading(true);
    try {
      const user = await login(values.email, values.password);
      const firstName = user?.name?.split(" ")[0] || "there";
      toast.success(`Welcome, ${firstName}!`);
      if (user?.role === "tutor") {
        setLocation("/tutor/dashboard");
      } else if (user?.role === "admin") {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/parent/dashboard");
      }
    } catch (error: any) {
      toast.error(error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resendEmail) {
      toast.error("Please enter your email");
      return;
    }

    setResendLoading(true);

    try {
      const response = await fetch("/api/auth/resend-setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send setup link");
      }

      toast.success(data.message || "Setup link sent! Check your email.");
      setShowResendSetup(false);
      setResendEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send setup link");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <section className="flex-1 flex items-center justify-center py-16 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in with your email and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <FormInput
                field={register("email")}
                label="Email"
                required
                type="email"
                placeholder="you@example.com"
              />
              <FormInput
                field={register("password")}
                label="Password"
                required
                type="password"
                placeholder="••••••••"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Remember me
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              New here? <Link href="/signup" className="text-primary">Create an account</Link>
            </p>

            <div className="mt-4 text-center text-sm border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowResendSetup(!showResendSetup)}
                className="text-primary hover:underline"
              >
                Haven't received your account setup link?
              </button>
            </div>

            {showResendSetup && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <p className="text-sm mb-2 text-muted-foreground">
                  Enter your email to receive a new setup link:
                </p>
                <form onSubmit={handleResendSetup} className="space-y-2">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your.email@example.com"
                    required
                    disabled={resendLoading}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resendLoading}
                  >
                    {resendLoading ? "Sending..." : "Send Setup Link"}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
