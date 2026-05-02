import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSuperUser } from "@/contexts/SuperUserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock } from "lucide-react";
import { NOT_SUPER_USER_ERR_MSG } from "@shared/const";

export function SuperUserGate({ children }: { children: React.ReactNode }) {
  const { isUnlocked, isChecking, unlock, lock } = useSuperUser();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: statusData } = trpc.adminSuperUser.getPasswordStatus.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000, // cache for 5 min — password-set status rarely changes
  });

  // Listen for FORBIDDEN errors from sensitive tRPC calls and re-lock if cookie expired
  trpc.useUtils(); // ensure context is available — re-lock handled via onError in each query

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  const isPasswordNotSet = statusData?.isSet === false;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await unlock(password);
      setPassword("");
    } catch (err: any) {
      setError(err.message ?? "Incorrect password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-sm shadow-lg border-2">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Secure Area</CardTitle>
          <p className="text-sm text-muted-foreground">
            This section requires super-user verification.
          </p>
        </CardHeader>
        <CardContent>
          {isPasswordNotSet ? (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                No super-user password has been set yet. Go to{" "}
                <strong>Settings → Security</strong> to create one before accessing this area.
              </span>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-password">Super-user password</Label>
                <Input
                  id="su-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter super-user password"
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? "Verifying…" : "Unlock"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { NOT_SUPER_USER_ERR_MSG };
