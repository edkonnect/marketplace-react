/**
 * Zoom API Service
 *
 * Handles OAuth authentication and fetching cloud recording transcripts from Zoom.
 * Works for meetings joined via browser or Zoom app - transcripts are stored in Zoom cloud.
 */

import { ENV } from "./_core/env";

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";
const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";

// In-memory token cache (consider using Redis in production)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get OAuth access token using Server-to-Server OAuth
 */
export async function getZoomAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const { zoomAccountId, zoomClientId, zoomClientSecret } = ENV;

  if (!zoomAccountId || !zoomClientId || !zoomClientSecret) {
    throw new Error(
      "Zoom credentials not configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in .env"
    );
  }

  // Create Basic Auth header
  const credentials = Buffer.from(`${zoomClientId}:${zoomClientSecret}`).toString("base64");

  const response = await fetch(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${zoomAccountId}`,
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
    throw new Error(
      `Zoom OAuth failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedAccessToken!;
}

/**
 * Create a permanent Zoom meeting for a tutor
 * Returns meeting details including join URL and host URL
 *
 * @param tutorName - Full name of the tutor for meeting topic
 * @param tutorEmail - Email of the tutor (not used but kept for future features)
 * @returns Object with meetingId, joinUrl, hostUrl, and password
 */
export async function createPermanentZoomMeeting(tutorName: string, tutorEmail: string) {
  const accessToken = await getZoomAccessToken();

  const meetingData = {
    topic: `${tutorName}'s Tutoring Room`,
    type: 3, // Recurring meeting with no fixed time
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true, // Allow students to join before tutor
      waiting_room: false, // No waiting room for smooth experience
      audio: "both",
      auto_recording: "cloud", // Always record to cloud for transcripts
      meeting_authentication: false, // Allow anyone with link to join
    },
  };

  const response = await fetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(meetingData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create Zoom meeting: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const meeting = await response.json();

  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    hostUrl: meeting.start_url,
    password: meeting.password ? String(meeting.password) : null,
  };
}

/**
 * Zoom API response types
 */
export type ZoomRecording = {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  share_url: string;
  recording_files: ZoomRecordingFile[];
};

export type ZoomRecordingFile = {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: "MP4" | "M4A" | "TIMELINE" | "TRANSCRIPT" | "CHAT" | "CC" | "CSV";
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: string;
};

export type ZoomRecordingsListResponse = {
  from: string;
  to: string;
  page_count: number;
  page_size: number;
  total_records: number;
  next_page_token?: string;
  meetings: ZoomRecording[];
};

/**
 * List cloud recordings for a user or across the account
 */
export async function listZoomRecordings(options?: {
  userId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  pageSize?: number;
  nextPageToken?: string;
}): Promise<ZoomRecordingsListResponse> {
  const accessToken = await getZoomAccessToken();
  const userId = options?.userId || "me";

  const params = new URLSearchParams({
    page_size: String(options?.pageSize || 30),
  });

  if (options?.from) params.append("from", options.from);
  if (options?.to) params.append("to", options.to);
  if (options?.nextPageToken) params.append("next_page_token", options.nextPageToken);

  const response = await fetch(
    `${ZOOM_API_BASE_URL}/users/${userId}/recordings?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to list Zoom recordings: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Get recording details for a specific meeting
 */
export async function getZoomRecording(meetingId: string): Promise<ZoomRecording> {
  const accessToken = await getZoomAccessToken();

  const response = await fetch(
    `${ZOOM_API_BASE_URL}/meetings/${meetingId}/recordings`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get Zoom recording: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Fetch and parse transcript from Zoom recording
 * Returns plain text transcript (parses VTT format)
 */
export async function fetchZoomTranscript(meetingId: string): Promise<{
  transcript: string;
  rawTranscript: string;
  duration: number;
  startTime: string;
  recordingUrl?: string;
}> {
  const recording = await getZoomRecording(meetingId);

  // Find transcript file
  const transcriptFile = recording.recording_files.find(
    (file) => file.file_type === "TRANSCRIPT"
  );

  if (!transcriptFile) {
    throw new Error(
      `No transcript found for meeting ${meetingId}. Make sure cloud recording and audio transcript are enabled.`
    );
  }

  const accessToken = await getZoomAccessToken();

  // Download transcript file (VTT format)
  const response = await fetch(transcriptFile.download_url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to download transcript: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const vttContent = await response.text();

  // Parse VTT to plain text
  const plainTextTranscript = parseVTTToPlainText(vttContent);

  return {
    transcript: plainTextTranscript,
    rawTranscript: vttContent,
    duration: recording.duration,
    startTime: recording.start_time,
    recordingUrl: recording.share_url,
  };
}

/**
 * Parse VTT (WebVTT) format to plain text
 * VTT format includes timestamps and speaker info
 */
function parseVTTToPlainText(vttContent: string): string {
  const lines = vttContent.split("\n");
  const textLines: string[] = [];

  let isTextLine = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip VTT header
    if (trimmed.startsWith("WEBVTT") || trimmed.startsWith("Kind:") || trimmed.startsWith("Language:")) {
      continue;
    }

    // Skip timestamp lines (format: 00:00:01.000 --> 00:00:05.000)
    if (trimmed.includes("-->")) {
      isTextLine = true;
      continue;
    }

    // Skip empty lines
    if (trimmed === "") {
      isTextLine = false;
      continue;
    }

    // Skip cue identifiers (numeric lines)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    // Collect text lines
    if (isTextLine && trimmed) {
      // Remove VTT tags like <v Speaker Name>
      const cleanedText = trimmed.replace(/<v\s+([^>]+)>/g, "$1: ").replace(/<\/?[^>]+>/g, "");
      textLines.push(cleanedText);
    }
  }

  return textLines.join("\n").trim();
}

/**
 * Download recording file (video/audio)
 */
export async function downloadZoomRecordingFile(
  meetingId: string,
  fileType: "MP4" | "M4A" = "MP4"
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const recording = await getZoomRecording(meetingId);

  const recordingFile = recording.recording_files.find(
    (file) => file.file_type === fileType
  );

  if (!recordingFile) {
    throw new Error(`No ${fileType} recording found for meeting ${meetingId}`);
  }

  const accessToken = await getZoomAccessToken();

  const response = await fetch(recordingFile.download_url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to download recording: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = fileType === "MP4" ? "video/mp4" : "audio/mp4";
  const fileName = `zoom-recording-${meetingId}.${fileType.toLowerCase()}`;

  return { buffer, mimeType, fileName };
}
