import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function SuperUserSettings() {
  const { data: statusData, isLoading, refetch } = trpc.adminSuperUser.getPasswordStatus.useQuery();
  const setPasswordMutation = trpc.adminSuperUser.setPassword.useMutation();

  const [currentSuperPassword, setCurrentSuperPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const isSet = statusData?.isSet ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      await setPasswordMutation.mutateAsync({
        newPassword,
        currentSuperPassword: isSet ? currentSuperPassword : null,
      });
      toast.success(isSet ? "Super-user password updated" : "Super-user password set");
      setCurrentSuperPassword("");
      setNewPassword("");
      setConfirmPassword("");
      refetch();
    } catch (err: any) {
      setError(err.message ?? "Failed to update password");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Security</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isSet ? "Change Super-User Password" : "Set Super-User Password"}
          </CardTitle>
          <CardDescription>
            {isSet
              ? "This password is required to access sensitive sections like Payments and Analytics."
              : "Set a separate super-user password to protect sensitive sections of the admin dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSet && (
              <div className="space-y-1.5">
                <Label htmlFor="current-su-password">Current super-user password</Label>
                <Input
                  id="current-su-password"
                  type="password"
                  value={currentSuperPassword}
                  onChange={e => setCurrentSuperPassword(e.target.value)}
                  placeholder="Current super-user password"
                  autoComplete="current-password"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="new-su-password">New super-user password</Label>
              <Input
                id="new-su-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-su-password">Confirm new password</Label>
              <Input
                id="confirm-su-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={setPasswordMutation.isPending || !newPassword || !confirmPassword || (isSet && !currentSuperPassword)}
            >
              {setPasswordMutation.isPending ? "Saving…" : isSet ? "Update password" : "Set password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
