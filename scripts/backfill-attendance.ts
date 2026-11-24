import "dotenv/config";
import { eq, and, isNull, isNotNull, gte } from "drizzle-orm";
import * as db from "../server/db";
import { zoomMeetingRecordings, users } from "../drizzle/schema";
import { getRecordingAttendance } from "../server/zoom/zoom-service";

const apply = process.argv.includes("--apply");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const days = daysArg ? Number(daysArg.split("=")[1]) : 30;

const low = (v: any) => String(v || "").trim().toLowerCase();
const toks = (v: any) =>
  low(v).split(/[^a-z]+/).filter((w) => w.length >= 3 && !["edkonnect", "academy"].includes(w));
const botWords = ["read.ai", "fireflies", "otter", "notetaker", "notes", "bot"];
const isBot = (n: string) => botWords.some((b) => low(n).includes(b));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const database: any = await db.getDb();
  if (!database) throw new Error("DB not available");
  const since = new Date(Date.now() - days * 86400000);

  const recs = await database
    .select({ id: zoomMeetingRecordings.id, sessionId: zoomMeetingRecordings.sessionId, recordedAt: zoomMeetingRecordings.recordedAt })
    .from(zoomMeetingRecordings)
    .where(and(isNotNull(zoomMeetingRecordings.sessionId), isNull(zoomMeetingRecordings.attendance), gte(zoomMeetingRecordings.recordedAt, since)));

  console.log("Mode: " + (apply ? "APPLY (writing)" : "DRY RUN (no writes)") + " | last " + days + " days | recordings to check: " + recs.length + "\n");

  let saved = 0, noZoom = 0, both = 0, tutorOnly = 0, none = 0;
  const unmatched: string[] = [];

  for (const r of recs) {
    const session: any = await db.getSessionById(r.sessionId);
    if (!session) continue;
    const getUser = async (id: any) => {
      if (!id) return null;
      const rows = await database.select({ name: users.name, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, id)).limit(1);
      return rows[0] || null;
    };
    const tutor = await getUser(session.tutorId);
    const parent = await getUser(session.parentId);

    const att: any[] = await getRecordingAttendance(r.id);
    await sleep(250);
    const label = "session " + r.sessionId + " " + (r.recordedAt ? new Date(r.recordedAt).toISOString().slice(0, 16) : "") + " " + (session.studentFirstName || "?");
    if (att.length === 0) { noZoom++; console.log("NO ZOOM DATA  " + label); continue; }

    const tutorTokens = [...toks(tutor?.name), ...toks(tutor?.firstName), ...toks(tutor?.lastName)];
    const studentTokens = [...toks(session.studentFirstName), ...toks(parent?.name), ...toks(parent?.firstName), ...toks(parent?.lastName)];
    const tutorRec = att.find((x) => !isBot(x.name) && tutorTokens.some((w) => low(x.name).includes(w))) || att.find((x) => !isBot(x.name) && low(x.email).endsWith("@edkonnect.com")) || null;
    const studentRec = att.find((x) => x !== tutorRec && !isBot(x.name) && studentTokens.some((w) => low(x.name).includes(w))) || null;

    if (tutorRec && studentRec) both++;
    else if (tutorRec) tutorOnly++;
    else none++;

    if (!studentRec) {
      const others = att.filter((x) => x !== tutorRec && !isBot(x.name)).map((x) => x.name).join(" | ");
      unmatched.push(label + "\n     student not found. others in call: " + others);
    }

    if (apply) {
      await database.update(zoomMeetingRecordings).set({ attendance: JSON.stringify(att) }).where(eq(zoomMeetingRecordings.id, r.id));
      saved++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log("tutor + student found: " + both);
  console.log("tutor only (student not matched): " + tutorOnly);
  console.log("neither matched: " + none);
  console.log("no Zoom data (too old / not available): " + noZoom);
  if (apply) console.log("saved to DB: " + saved);
  if (unmatched.length) console.log("\n=== STUDENT NOT FOUND ===\n" + unmatched.join("\n"));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
