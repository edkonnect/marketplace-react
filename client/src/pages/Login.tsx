import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { FormInput } from "@/components/forms/FormInput";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { email as emailValidator, required } from "@/lib/validation";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const form = useValidatedForm(
    { email: "", password: "" },
    {
      email: [required("Email is required"), emailValidator()],
      password: required("Password is required"),
    }
  );
  const { values, register, validateForm } = form;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              New here? <Link href="/signup" className="text-primary">Create an account</Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
