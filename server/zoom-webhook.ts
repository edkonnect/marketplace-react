/**
 * Zoom Webhook Handler
 *
 * Receives webhooks from Zoom when recordings are completed
 * Automatically fetches transcripts and stores them in the database
 */

import type { Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { fetchZoomTranscript, getZoomRecording } from "./zoom-service";
import { getDb } from "./db";
import { zoomMeetingRecordings, InsertZoomMeetingRecording } from "../drizzle/schema";

type ZoomWebhookEvent = {
  event: string;
  payload: {
    account_id: string;
    object: {
      uuid: string;
      id: number;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      recording_files?: Array<{
        id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_size: number;
        download_url: string;
      }>;
    };
  };
  event_ts: number;
};

/**
 * Verify Zoom webhook signature
 * https://developers.zoom.us/docs/api/rest/webhook-reference/#verify-webhook-events
 */
function verifyZoomWebhookSignature(
  payload: string,
  signature: string | undefined,
  timestamp: string | undefined
): boolean {
  if (!ENV.zoomWebhookSecret) {
    console.warn('[Zoom Webhook] No webhook secret configured, skipping verification');
    return true; // Allow in dev if no secret is set
  }

  if (!signature || !timestamp) {
    console.error('[Zoom Webhook] Missing signature or timestamp headers');
    return false;
  }

  // Construct the message to sign
  const message = `v0:${timestamp}:${payload}`;

  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', ENV.zoomWebhookSecret);
  hmac.update(message);
  const expectedSignature = `v0=${hmac.digest('hex')}`;

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

/**
 * Handle Zoom webhook events
 */
export async function handleZoomWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-zm-signature'] as string | undefined;
    const timestamp = req.headers['x-zm-request-timestamp'] as string | undefined;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyZoomWebhookSignature(payload, signature, timestamp)) {
      console.error('[Zoom Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event: ZoomWebhookEvent = req.body;

    console.log('[Zoom Webhook] Received event:', event.event);

    // Handle URL validation (Zoom sends this to verify your endpoint)
    if (event.event === 'endpoint.url_validation') {
      const plainToken = req.body.payload.plainToken;
      const encryptedToken = crypto
        .createHmac('sha256', ENV.zoomWebhookSecret || '')
        .update(plainToken)
        .digest('hex');

      return res.status(200).json({
        plainToken,
        encryptedToken,
      });
    }

    // Handle recording completed event
    if (event.event === 'recording.completed') {
      // Process asynchronously (don't block webhook response)
      processRecordingCompleted(event).catch(error => {
        console.error('[Zoom Webhook] Error processing recording:', error);
      });

      return res.status(200).json({ success: true });
    }

    // Handle other events
    console.log('[Zoom Webhook] Unhandled event type:', event.event);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Zoom Webhook] Error handling webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Process recording completed event
 * Fetches transcript and stores in database
 */
async function processRecordingCompleted(event: ZoomWebhookEvent) {
  const { uuid, id: meetingId, topic, host_id, start_time, duration } = event.payload.object;

  console.log(`[Zoom Webhook] Processing recording for meeting ${meetingId}`);

  const db = await getDb();
  if (!db) {
    console.error('[Zoom Webhook] Database not available');
    return;
  }

  try {
    // Mark as processing
    await db.insert(zoomMeetingRecordings).values({
      id: uuid,
      meetingId: String(meetingId),
      topic,
      hostId: host_id,
      recordedAt: new Date(start_time),
      durationMinutes: Math.round(duration),
      status: 'processing',
    } as InsertZoomMeetingRecording).onDuplicateKeyUpdate({
      set: { status: 'processing' }
    });

    // Check if transcript file exists
    const hasTranscript = event.payload.object.recording_files?.some(
      file => file.file_type === 'TRANSCRIPT'
    );

    if (!hasTranscript) {
      console.warn(`[Zoom Webhook] No transcript found for meeting ${meetingId}`);
      await db.insert(zoomMeetingRecordings).values({
        id: uuid,
        meetingId: String(meetingId),
        status: 'failed',
        errorMessage: 'No transcript available. Ensure audio transcript is enabled in Zoom settings.',
      } as InsertZoomMeetingRecording).onDuplicateKeyUpdate({
        set: {
          status: 'failed',
          errorMessage: 'No transcript available',
        }
      });
      return;
    }

    // Fetch transcript from Zoom
    const transcriptData = await fetchZoomTranscript(String(meetingId));
    const recording = await getZoomRecording(String(meetingId));

    // Save transcript to database
    await db.insert(zoomMeetingRecordings).values({
      id: uuid,
      meetingId: String(meetingId),
      topic: recording.topic,
      hostId: recording.host_id,
      transcriptText: transcriptData.transcript,
      rawTranscript: transcriptData.rawTranscript,
      durationMinutes: Math.round(recording.duration),
      recordedAt: new Date(recording.start_time),
      processedAt: new Date(),
      status: 'completed',
      shareUrl: recording.share_url,
    } as InsertZoomMeetingRecording).onDuplicateKeyUpdate({
      set: {
        transcriptText: transcriptData.transcript,
        rawTranscript: transcriptData.rawTranscript,
        processedAt: new Date(),
        status: 'completed',
      }
    });

    console.log(`[Zoom Webhook] Successfully processed recording ${uuid}`);

    // TODO: Trigger AI processing here (generate summary, homework, progress)
    // You can call your existing Gemini summary generation code here
    // Example:
    // await generateAIInsights(uuid, transcriptData.transcript);

  } catch (error) {
    console.error(`[Zoom Webhook] Error processing recording ${uuid}:`, error);

    // Update status to failed
    await db.insert(zoomMeetingRecordings).values({
      id: uuid,
      meetingId: String(meetingId),
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    } as InsertZoomMeetingRecording).onDuplicateKeyUpdate({
      set: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    });
  }
}
