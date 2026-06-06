import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/users";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https://*.amazonaws.com", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://images.unsplash.com"],
          connectSrc: ["'self'", "https://*.amazonaws.com", "https://www.google-analytics.com", "https://analytics.google.com", "https://stats.g.doubleclick.net", "https://region1.google-analytics.com", ...(ENV.referralAppUrl ? [ENV.referralAppUrl] : [])],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          mediaSrc: ["'self'", "https://*.amazonaws.com"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  );

  const { handleStripeWebhook, handleStripeInrWebhook } = await import("../payments/stripeWebhook");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/stripe/webhook-inr", express.raw({ type: "application/json" }), handleStripeInrWebhook);

  const { handleAcuityWebhook } = await import("../acuity-webhook");
  app.post("/api/webhooks/acuity", express.raw({ type: "application/json" }), handleAcuityWebhook);

  app.use(
    cors({
      origin: ENV.corsOrigin,
      credentials: true,
    })
  );
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
  });

  if (process.env.NODE_ENV !== "production") {
    const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL ?? "").replace(/\/+$/, "");
    const localPrefixes = ["http://localhost", "http://127.0.0.1", ""];
    const isLocalForge = localPrefixes.some(p => forgeUrl === p || forgeUrl.startsWith(p + ":"));
    if (isLocalForge) {
      const { createLocalDevStorageRouter, createLocalDevStaticRouter } = await import("../storage/localDevStorage");
      const preferredPort = parseInt(process.env.PORT || "3000");
      const devBaseUrl = forgeUrl || `http://localhost:${preferredPort}`;
      app.use(createLocalDevStorageRouter(devBaseUrl));
      app.use(createLocalDevStaticRouter());
      console.log(`[LocalDevStorage] Active — files saved to uploads/, served at ${devBaseUrl}/uploads/`);
    }
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const { handleZoomWebhook } = await import("../zoom/zoom-webhook");
  app.post("/api/webhooks/zoom", handleZoomWebhook);

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/users", userRouter);

  const { pdfRouter } = await import("../pdf/pdfRoute");
  app.use("/api/pdf", pdfRouter);

  const { fileProxyRouter } = await import("./routes/fileProxy");
  app.use("/api/files/proxy", fileProxyRouter);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Promote app redirect
  app.get("/promote", (_req, res) => {
    res.redirect(301, "https://promote.edkonnect-academy.com");
  });

  // Test platform SSO redirect
  app.get("/mytest", async (req, res) => {
    const SSO_SECRET = process.env.SSO_SECRET;
    const TEST_PLATFORM_URL = "https://test.edkonnect-academy.com";

    if (!SSO_SECRET) {
      return res.redirect(302, TEST_PLATFORM_URL);
    }

    try {
      const { authenticateRequest } = await import("./services/authService");
      const user = await authenticateRequest(req);

      const email = user.email || "";
      const name = user.name || `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim();

      if (!email) {
        return res.redirect(302, `${TEST_PLATFORM_URL}/login`);
      }

      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(SSO_SECRET);
      const token = await new SignJWT({ email, name })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("5m")
        .setIssuedAt()
        .sign(secret);

      return res.redirect(302, `${TEST_PLATFORM_URL}/auth/sso?token=${token}`);
    } catch {
      // Not logged in
      return res.redirect(302, `${TEST_PLATFORM_URL}/login`);
    }
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  const { startBillingCron, processUsageBilling, startReminderCron, startSessionNotesReminderCron, startAcuitySyncCron } = await import("../cron");
  if (process.env.NODE_ENV === 'production') {
    startBillingCron();
  } else {
    console.log("[Cron] Billing cron SKIPPED (not production)");
  }

  if (process.env.NODE_ENV === 'production') {
    startSessionNotesReminderCron();
  } else {
    console.log("[Cron] Session notes reminder cron SKIPPED (not production)");
  }

  if (process.env.NODE_ENV === 'production') {
    startAcuitySyncCron(60);
  } else {
    console.log("[Cron] Acuity sync cron SKIPPED (not production)");
  }

  const { getUsageBasedSubscriptionsDue } = await import("../db");
  const overdue = await getUsageBasedSubscriptionsDue();
  if (overdue.length > 0) {
    console.log(`[Cron] ${overdue.length} overdue billing cycle(s) found on startup — running catch-up billing`);
    processUsageBilling().catch((err: any) => console.error("[Cron] Startup catch-up billing failed:", err?.message));
  }
}

startServer().catch(console.error);