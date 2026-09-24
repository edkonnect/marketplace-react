import { Router } from "express";
import { jwtVerify } from "jose";
import { ENV } from "../env";
import { ACCESS_TOKEN_COOKIE } from "@shared/const";
import * as db from "../../db";

const mobileRouter = Router();

const accessSecret = new TextEncoder().encode(ENV.cookieSecret);

async function getUserFromCookie(req: any) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    const data = payload as any;
    const user = await db.getUserById(data.sub);
    return user;
  } catch (e) {
    return null;
  }
}
function mapSession(row: any) {
  const session = row.session || row;
  return {
    id: String(session.id),
    subscriptionId: session.subscriptionId ?? null,
    tutorName: row.tutorName || "TBD",
    courseTitle: row.courseTitle || "TBD",
    studentFirstName: session.studentFirstName || "",
    studentLastName: session.studentLastName || "",
    isTrial: !!session.isTrial,
    scheduledAt: Number(session.scheduledAt),
    duration: session.duration,
    status: session.status,
    zoomLink: session.meetingUrl || undefined,
    feedbackFromTutor: session.feedbackFromTutor || undefined,
  };
}
mobileRouter.get("/calendar", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const role = user.role === "tutor" ? "tutor" : "parent";
    const upcomingRows = await db.getUpcomingSessions(user.id, role);
    const bookedSessions = upcomingRows.map(mapSession);

    res.json({
      bookedSessions,
      availableSlots: [],
    });
  } catch (error) {
    console.error("[Mobile Calendar] Error:", error);
    res.status(500).json({ error: "Failed to load calendar" });
  }
});
mobileRouter.get("/history", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const historyRows =
      user.role === "tutor"
        ? await db.getCompletedSessionsByTutorId(user.id)
        : await db.getCompletedSessionsByParentId(user.id);

    const sessionHistory = historyRows.map(mapSession);

    res.json({ sessionHistory });
  } catch (error) {
    console.error("[Mobile History] Error:", error);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// Admin-only: all sessions across the whole platform (all tutors/parents),
// mirrors the website's admin dashboard "getAllSessions" data source.
mobileRouter.get("/admin/sessions", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const allSessions = await db.getAllSessionsWithDetails();

    // Sort by scheduled date, most recent first
    const sorted = allSessions.sort((a: any, b: any) => {
      const aSession = a.session || a;
      const bSession = b.session || b;
      return Number(bSession.scheduledAt) - Number(aSession.scheduledAt);
    });

    const mapped = sorted.map((row: any) => {
      const session = row.session || row;
      return {
        id: String(session.id),
        tutorName: row.tutorName || "TBD",
        parentName: row.parentName || "",
        courseTitle: row.courseTitle || "TBD",
        studentFirstName: session.studentFirstName || "",
        studentLastName: session.studentLastName || "",
        isTrial: !!session.isTrial,
        scheduledAt: Number(session.scheduledAt),
        duration: session.duration,
        status: session.status,
      };
    });

    res.json({ sessions: mapped, total: mapped.length });
  } catch (error) {
    console.error("[Mobile Admin Sessions] Error:", error);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

export { mobileRouter };