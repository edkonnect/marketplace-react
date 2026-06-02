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

  // Trust the first proxy (nginx) so rate-limiting uses the real client IP
  // instead of the proxy IP (which would cause all users to share one bucket)
  app.set("trust proxy", 1);

  // Security & middleware
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
  // Stripe webhook MUST be registered before CORS and express.json() middleware
  // Stripe sends from its own servers so CORS must not apply here
  const { handleStripeWebhook, handleStripeInrWebhook } = await import("../payments/stripeWebhook");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/stripe/webhook-inr", express.raw({ type: "application/json" }), handleStripeInrWebhook);

  // Acuity webhook requires raw body for HMAC-SHA256 signature verification.
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

  // Local dev storage shim must be registered BEFORE express.json() so it can
  // read the raw multipart body itself. Active only when Forge URL is localhost.
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

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Zoom webhook for recording notifications
  const { handleZoomWebhook } = await import("../zoom/zoom-webhook");
  app.post("/api/webhooks/zoom", handleZoomWebhook);

  // Auth routes
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/users", userRouter);
  
  // PDF download route
  const { pdfRouter } = await import("../pdf/pdfRoute");
  app.use("/api/pdf", pdfRouter);

  // Course file proxy — streams S3 files without exposing S3 URLs
  const { fileProxyRouter } = await import("./routes/fileProxy");
  app.use("/api/files/proxy", fileProxyRouter);

  // tRPC API
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

  // development mode uses Vite, production mode uses static files
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

  // Start monthly usage billing cron
  const { startBillingCron, processUsageBilling, startReminderCron, startSessionNotesReminderCron, startAcuitySyncCron } = await import("../cron");
  if (process.env.NODE_ENV === 'production') {
    startBillingCron();
  } else {
    console.log("[Cron] Billing cron SKIPPED (not production)");
  }

  // Start session reminder cron (24h, 1h, 15min before sessions)
  // startReminderCron(); // DISABLED — re-enable when ready to send reminders
  if (process.env.NODE_ENV === 'production') {
    startSessionNotesReminderCron();
  } else {
    console.log("[Cron] Session notes reminder cron SKIPPED (not production)");
  }

  // Acuity session sync — hourly for now, change to daily (1440) when stable
  if (process.env.NODE_ENV === 'production') {
    startAcuitySyncCron(60);
  } else {
    console.log("[Cron] Acuity sync cron SKIPPED (not production)");
  }

  // Catch-up: if any billing cycles were missed (e.g. server was down on the 1st), run immediately
  const { getUsageBasedSubscriptionsDue } = await import("../db");
  const overdue = await getUsageBasedSubscriptionsDue();
  if (overdue.length > 0) {
    console.log(`[Cron] ${overdue.length} overdue billing cycle(s) found on startup — running catch-up billing`);
    processUsageBilling().catch((err: any) => console.error("[Cron] Startup catch-up billing failed:", err?.message));
  }
}

startServer().catch(console.error);
