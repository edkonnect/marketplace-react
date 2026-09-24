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

// Grouped bookings by subscriptionId — mirrors website's session.myBookings
mobileRouter.get("/bookings", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const rows = await db.getSessionsByParentId(user.id);
    const sessions = rows.map(mapSession);

    const grouped: Record<string, any[]> = {};
    sessions.forEach((session: any) => {
      const subId = String(session.subscriptionId);
      if (!grouped[subId]) grouped[subId] = [];
      grouped[subId].push(session);
    });

    res.json({ bookings: grouped });
  } catch (error) {
    console.error("[Mobile Bookings] Error:", error);
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

// Reschedule a single session
mobileRouter.post("/sessions/:id/reschedule", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const sessionId = Number(req.params.id);
    const { newScheduledAt } = req.body;
    if (!newScheduledAt) return res.status(400).json({ error: "newScheduledAt is required" });

    const session = await db.getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.parentId !== user.id) return res.status(403).json({ error: "Not authorized" });

    await db.updateSession(sessionId, { scheduledAt: newScheduledAt });

    if (session.tutorId) {
      const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
      const course = subscription ? await db.getCourseById(subscription.courseId) : null;
      const oldDate = new Date(session.scheduledAt);
      const newDate = new Date(newScheduledAt);
      const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

      await db.createInAppNotification({
        userId: session.tutorId,
        title: 'Session Rescheduled',
        message: `${user.name || 'A parent'} rescheduled ${course?.title || 'a session'} from ${formatDate(oldDate)} to ${formatDate(newDate)}`,
        type: 'new_booking',
        relatedId: sessionId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Mobile Reschedule] Error:", error);
    res.status(500).json({ error: "Failed to reschedule session" });
  }
});

// Reschedule an entire series
mobileRouter.post("/subscriptions/:id/reschedule-series", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const subscriptionId = Number(req.params.id);
    const { newStartDate, frequency } = req.body;
    if (!newStartDate || !["weekly", "biweekly"].includes(frequency)) {
      return res.status(400).json({ error: "newStartDate and frequency ('weekly'|'biweekly') are required" });
    }

    const sessions = await db.getSessionsByParentId(user.id);
    const seriesSessions = sessions
      .filter((s: any) => s.session?.subscriptionId === subscriptionId && s.session?.status === 'scheduled')
      .sort((a: any, b: any) => (a.session?.scheduledAt || 0) - (b.session?.scheduledAt || 0));

    if (seriesSessions.length === 0) return res.status(404).json({ error: "No scheduled sessions found" });

    const subscription = await db.getSubscriptionById(subscriptionId);
    const course = subscription ? await db.getCourseById(subscription.courseId) : null;
    const firstOldDate = seriesSessions[0]?.session?.scheduledAt ? new Date(seriesSessions[0].session.scheduledAt) : null;
    const firstNewDate = new Date(newStartDate);
    let tutorId: number | null = null;

    const intervalDays = frequency === 'weekly' ? 7 : 14;
    const startDate = new Date(newStartDate);

    for (let i = 0; i < seriesSessions.length; i++) {
      const newDate = new Date(startDate);
      newDate.setDate(newDate.getDate() + i * intervalDays);
      if (seriesSessions[i].session?.id) {
        await db.updateSession(seriesSessions[i].session.id, { scheduledAt: newDate.getTime() });
        if (!tutorId && seriesSessions[i].session.tutorId) tutorId = seriesSessions[i].session.tutorId;
      }
    }

    if (tutorId && firstOldDate) {
      const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      await db.createInAppNotification({
        userId: tutorId,
        title: 'Series Rescheduled',
        message: `${user.name || 'A parent'} rescheduled ${seriesSessions.length} ${course?.title || 'sessions'}. New start: ${formatDate(firstNewDate)} (was ${formatDate(firstOldDate)})`,
        type: 'new_booking',
        relatedId: seriesSessions[0]?.session?.id || null,
      });
    }

    res.json({ success: true, rescheduledCount: seriesSessions.length });
  } catch (error) {
    console.error("[Mobile Reschedule Series] Error:", error);
    res.status(500).json({ error: "Failed to reschedule series" });
  }
});

// Cancel a single session
mobileRouter.post("/sessions/:id/cancel", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const sessionId = Number(req.params.id);
    const { reason } = req.body;

    const session = await db.getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.parentId !== user.id) return res.status(403).json({ error: "Not authorized" });

    await db.updateSession(sessionId, {
      status: 'cancelled',
      notes: reason ? `Canceled: ${reason}` : 'Canceled by parent',
    });

    if (session.tutorId) {
      const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
      const course = subscription ? await db.getCourseById(subscription.courseId) : null;
      const sessionDate = new Date(session.scheduledAt);
      const formattedDate = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

      await db.createInAppNotification({
        userId: session.tutorId,
        title: 'Session Cancelled',
        message: `${user.name || 'A parent'} cancelled ${course?.title || 'a session'} scheduled for ${formattedDate}${reason ? `. Reason: ${reason}` : ''}`,
        type: 'session_cancelled',
        relatedId: sessionId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Mobile Cancel] Error:", error);
    res.status(500).json({ error: "Failed to cancel session" });
  }
});

// Cancel an entire series
mobileRouter.post("/subscriptions/:id/cancel-series", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const subscriptionId = Number(req.params.id);
    const { reason } = req.body;

    const sessions = await db.getSessionsByParentId(user.id);
    const seriesSessions = sessions.filter(
      (s: any) => s.session?.subscriptionId === subscriptionId && s.session?.status === 'scheduled'
    );
    if (seriesSessions.length === 0) return res.status(404).json({ error: "No scheduled sessions found" });

    const subscription = await db.getSubscriptionById(subscriptionId);
    const course = subscription ? await db.getCourseById(subscription.courseId) : null;
    let tutorId: number | null = null;

    for (const s of seriesSessions) {
      if (s.session?.id) {
        await db.updateSession(s.session.id, {
          status: 'cancelled',
          notes: reason ? `Canceled: ${reason}` : 'Canceled by parent',
        });
        if (!tutorId && s.session.tutorId) tutorId = s.session.tutorId;
      }
    }

    if (tutorId) {
      await db.createInAppNotification({
        userId: tutorId,
        title: 'Session Series Cancelled',
        message: `${user.name || 'A parent'} cancelled a series of ${seriesSessions.length} ${course?.title || 'sessions'}${reason ? `. Reason: ${reason}` : ''}`,
        type: 'session_cancelled',
        relatedId: seriesSessions[0]?.session?.id || null,
      });
    }

    res.json({ success: true, canceledCount: seriesSessions.length });
  } catch (error) {
    console.error("[Mobile Cancel Series] Error:", error);
    res.status(500).json({ error: "Failed to cancel series" });
  }
});

// Rate a completed session
mobileRouter.post("/sessions/:id/rate", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const sessionId = Number(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }

    const session = await db.getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.parentId !== user.id) return res.status(403).json({ error: "Not authorized" });
    if (session.status !== 'completed' && session.status !== 'no_show') {
      return res.status(400).json({ error: "Can only rate completed sessions" });
    }
    if (session.scheduledAt > Date.now()) {
      return res.status(400).json({ error: "Session has not started yet" });
    }

    const existingRating = await db.getSessionRating(sessionId);
    if (existingRating) return res.status(409).json({ error: "Session already rated" });

    const newRating = await db.createSessionRating({
      sessionId,
      parentId: user.id,
      tutorId: session.tutorId,
      rating,
      comment: comment || null,
    });

    res.json({ success: true, rating: newRating });
  } catch (error) {
    console.error("[Mobile Rate Session] Error:", error);
    res.status(500).json({ error: "Failed to rate session" });
  }
});

// Get rating for a session
mobileRouter.get("/sessions/:id/rating", async (req: any, res) => {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.role !== "parent") return res.status(403).json({ error: "Parent access required" });

    const sessionId = Number(req.params.id);
    const session = await db.getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.parentId !== user.id) return res.status(403).json({ error: "Not authorized" });

    const rating = await db.getSessionRating(sessionId);
    res.json({ rating: rating || null });
  } catch (error) {
    console.error("[Mobile Get Rating] Error:", error);
    res.status(500).json({ error: "Failed to get rating" });
  }
});

export { mobileRouter };