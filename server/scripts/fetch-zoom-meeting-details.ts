/**
 * Script to fetch Zoom meeting details for manually assigned meetings.
 * Usage: pnpm tsx server/scripts/fetch-zoom-meeting-details.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";
const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";

const MEETING_IDS = ["8442544927", "5028597626", "8284931787"];
const NAMES = ["Shriti", "Maya", "User2"];
const USER_IDS = [18, 18, 2];

async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Missing ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET in .env");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Zoom access token: ${errorText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function getMeetingRecordings(meetingId: string, token: string) {
  const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}/recordings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch recordings for meeting ${meetingId}: ${errorText}`);
  }

  return response.json() as Promise<any>;
}

async function getMeetingDetails(meetingId: string, token: string) {
  const response = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch meeting ${meetingId}: ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log("Fetching Zoom access token...\n");
  const token = await getZoomAccessToken();
  console.log("Token obtained successfully.\n");

  for (let i = 0; i < MEETING_IDS.length; i++) {
    const meetingId = MEETING_IDS[i];
    const name = NAMES[i];
    const userId = USER_IDS[i];

    console.log(`========== ${name} (Meeting ID: ${meetingId}) ==========`);

    try {
      const details = await getMeetingDetails(meetingId, token) as any;

      console.log(`zoomMeetingId:       ${details.id}`);
      console.log(`zoomJoinUrl:         ${details.join_url}`);
      console.log(`zoomHostUrl:         ${details.start_url}`);
      console.log(`zoomMeetingPassword: ${details.password ?? "(none)"}`);
      console.log(`Topic:               ${details.topic}`);
      console.log(`Type:                ${details.type}`);
      console.log("");
      console.log("--- SQL to run ---");
      console.log(`UPDATE tutorProfiles`);
      console.log(`SET`);
      console.log(`  zoomMeetingId = '${details.id}',`);
      console.log(`  zoomJoinUrl = '${details.join_url}',`);
      console.log(`  zoomHostUrl = '${details.start_url}',`);
      console.log(`  zoomMeetingPassword = '${details.password ?? ""}',`);
      console.log(`  zoomCreatedAt = NOW()`);
      console.log(`WHERE userId = ${userId};  -- ${name}`);

      // Fetch cloud recordings
      console.log("");
      console.log("--- Cloud Recordings ---");
      try {
        const rec = await getMeetingRecordings(meetingId, token);
        if (!rec.recording_files || rec.recording_files.length === 0) {
          console.log("No recordings found.");
        } else {
          console.log(`Total recordings: ${rec.recording_files.length}`);
          for (const file of rec.recording_files) {
            console.log(`  [${file.recording_type}] ${file.file_type} | status: ${file.status}`);
            console.log(`    play_url:     ${file.play_url ?? "(none)"}`);
            console.log(`    download_url: ${file.download_url ?? "(none)"}`);
            console.log(`    start: ${file.recording_start} | end: ${file.recording_end}`);
            console.log(`    file_size: ${file.file_size} bytes`);
          }
          console.log("");
          console.log("Share URL:", rec.share_url ?? "(none)");
          console.log("Password: ", rec.password ?? "(none)");
        }
      } catch (recErr) {
        console.error(`  Could not fetch recordings:`, recErr);
      }
    } catch (err) {
      console.error(`Error for ${name}:`, err);
    }

    console.log("");
  }
}

main().catch(console.error);
