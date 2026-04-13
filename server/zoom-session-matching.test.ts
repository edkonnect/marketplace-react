import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { resolveSessionForZoomRecording, getDb } from "./db";

/**
 * Integration tests for resolveSessionForZoomRecording().
 * Requires a live DB connection. Tests are skipped if DB is unavailable.
 *
 * Scenario: one tutor uses a single permanent Zoom room (zoomMeetingId).
 * Two sessions are scheduled on the same day at 6:00 PM and 7:30 PM.
 * Each recording webhook must resolve to the correct session by timestamp.
 */
describe("resolveSessionForZoomRecording", () => {
  let dbAvailable = false;
  let tutorUserId = 0;
  let parentUserId = 0;
  let courseId = 0;
  let session6pmId = 0;
  let session730pmId = 0;

  const ZOOM_MEETING_ID = `test-zoom-room-${Date.now()}`;

  // Fixed base day: 2024-01-15, sessions at 18:00 and 19:30 UTC
  const sixPmMs   = new Date("2024-01-15T18:00:00.000Z").getTime();
  const sevenThirtyMs = new Date("2024-01-15T19:30:00.000Z").getTime();

  beforeAll(async () => {
    tutorUserId = await db.createUser({
      openId: `test-tutor-zoom-match-${Date.now()}`,
      name: "Zoom Match Tutor",
      email: `tutor-zoom-match-${Date.now()}@test.com`,
      role: "tutor",
    }) || 0;

    parentUserId = await db.createUser({
      openId: `test-parent-zoom-match-${Date.now()}`,
      name: "Zoom Match Parent",
      email: `parent-zoom-match-${Date.now()}@test.com`,
      role: "parent",
    }) || 0;

    courseId = await db.createCourse({
      title: "Zoom Match Test Course",
      description: "Course for testing Zoom session matching",
      subject: "Mathematics",
      price: "50.00",
      duration: 60,
      isActive: true,
    }) || 0;

    if (!tutorUserId || !parentUserId || !courseId) return;

    // Create tutor profile with a known zoomMeetingId (skip real Zoom API)
    const drizzleDb = await getDb();
    if (!drizzleDb) return;

    const { tutorProfiles } = await import("../drizzle/schema");

    // Insert tutor profile directly with our test zoomMeetingId
    await drizzleDb
      .insert(tutorProfiles)
      .values({
        userId: tutorUserId,
        bio: "Test tutor",
        zoomMeetingId: ZOOM_MEETING_ID,
        hourlyRate: "50.00",
        subjects: "Mathematics",
      } as any)
      .onDuplicateKeyUpdate({ set: { zoomMeetingId: ZOOM_MEETING_ID } });

    // Create a subscription to satisfy FK
    const subId = await db.createSubscription({
      parentId: parentUserId,
      tutorId: tutorUserId,
      courseId,
      status: "active",
      paymentStatus: "paid",
      sessionsCompleted: 0,
      sessionsTotal: 10,
      paymentType: "subscription",
    }) || 0;

    if (!subId) return;

    // Create 6:00 PM session
    session6pmId = await db.createSession({
      tutorId: tutorUserId,
      parentId: parentUserId,
      subscriptionId: subId,
      courseId,
      scheduledAt: sixPmMs,
      duration: 60,
      status: "scheduled",
    }) || 0;

    // Create 7:30 PM session
    session730pmId = await db.createSession({
      tutorId: tutorUserId,
      parentId: parentUserId,
      subscriptionId: subId,
      courseId,
      scheduledAt: sevenThirtyMs,
      duration: 60,
      status: "scheduled",
    }) || 0;

    if (tutorUserId && parentUserId && courseId && session6pmId && session730pmId) {
      dbAvailable = true;
    }
  });

  it("matches the 6:00 PM recording to the 6:00 PM session", async () => {
    if (!dbAvailable) return;

    const result = await resolveSessionForZoomRecording({
      meetingId: ZOOM_MEETING_ID,
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(sixPmMs),
      durationMinutes: 60,
    });

    expect(result.reason).toBe("matched");
    expect(result.sessionId).toBe(session6pmId);
    expect(result.tutorId).toBe(tutorUserId);
  });

  it("matches the 7:30 PM recording to the 7:30 PM session", async () => {
    if (!dbAvailable) return;

    const result = await resolveSessionForZoomRecording({
      meetingId: ZOOM_MEETING_ID,
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(sevenThirtyMs),
      durationMinutes: 60,
    });

    expect(result.reason).toBe("matched");
    expect(result.sessionId).toBe(session730pmId);
    expect(result.tutorId).toBe(tutorUserId);
  });

  it("returns no_match when recording is more than 30 minutes from any session", async () => {
    if (!dbAvailable) return;

    // 3:00 PM — far outside the tolerance window of both sessions
    const threePmMs = new Date("2024-01-15T15:00:00.000Z").getTime();

    const result = await resolveSessionForZoomRecording({
      meetingId: ZOOM_MEETING_ID,
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(threePmMs),
      durationMinutes: 60,
    });

    expect(result.reason).toBe("no_match");
    expect(result.sessionId).toBeNull();
    expect(result.tutorId).toBe(tutorUserId);
  });

  it("returns ambiguous when two sessions are equidistant from the recording start", async () => {
    if (!dbAvailable) return;

    // Recording at exactly 18:45 — equidistant from 6:00 PM (45 min) and 7:30 PM (45 min)
    const midpointMs = new Date("2024-01-15T18:45:00.000Z").getTime();

    const result = await resolveSessionForZoomRecording({
      meetingId: ZOOM_MEETING_ID,
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(midpointMs),
      durationMinutes: 60,
    });

    expect(result.reason).toBe("ambiguous");
    expect(result.sessionId).toBeNull();
    expect(result.tutorId).toBe(tutorUserId);
  });

  it("returns no_tutor_found when the meetingId has no matching tutor profile", async () => {
    if (!dbAvailable) return;

    const result = await resolveSessionForZoomRecording({
      meetingId: "nonexistent-zoom-room-999",
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(sixPmMs),
      durationMinutes: 60,
    });

    expect(result.reason).toBe("no_tutor_found");
    expect(result.sessionId).toBeNull();
    expect(result.tutorId).toBeNull();
  });

  it("returns identical results on repeated calls (idempotent)", async () => {
    if (!dbAvailable) return;

    const params = {
      meetingId: ZOOM_MEETING_ID,
      hostId: "zoom-host-abc",
      recordingStartTime: new Date(sixPmMs),
      durationMinutes: 60,
    };

    const result1 = await resolveSessionForZoomRecording(params);
    const result2 = await resolveSessionForZoomRecording(params);

    expect(result1).toEqual(result2);
    expect(result1.reason).toBe("matched");
    expect(result1.sessionId).toBe(session6pmId);
  });
});
