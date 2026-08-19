import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { toast } from "sonner";
import App from "./App";
import "./index.css";
import { AuthProvider, useAuthContext } from "./contexts/AuthContext";
import { SuperUserProvider } from "./contexts/SuperUserContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  },
});

let isRefreshing = false;

const redirectToLoginIfUnauthorized = async (
  error: unknown,
  kind: "query" | "mutation" = "query"
) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // Attempt one silent token refresh before giving up and redirecting
  if (isRefreshing) return; // already attempting refresh, don't stack calls
  isRefreshing = true;
  try {
    const res = await fetch("/api/auth/refresh-token", { method: "POST", credentials: "include" });
    if (res.ok) {
      if (kind === "mutation") {
        // Session was renewed, but the in-flight save/update was still lost —
        // let her know so she can retry the action instead of assuming it saved.
        toast.error("Your session was renewed. Please try that action again.");
      }
      // Token refreshed — invalidate all cached queries so they re-fetch with the new token
      queryClient.invalidateQueries();
      return;
    }
  } catch {
    // refresh request itself failed (network error etc.)
  } finally {
    isRefreshing = false;
  }

  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error, "query");
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error, "mutation");
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

function SuperUserBridge() {
  const { user } = useAuthContext();
  return (
    <SuperUserProvider userId={user?.id ?? null}>
      <App />
    </SuperUserProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SuperUserBridge />
      </AuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);