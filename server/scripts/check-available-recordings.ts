/**
 * Script to check what recordings are available in Zoom
 * Useful for debugging why transcripts aren't appearing
 *
 * Usage:
 *   pnpm tsx server/scripts/check-available-recordings.ts
 */

import { listZoomRecordings } from "../zoom-service";

async function checkRecordings() {
  try {
    console.log('📡 Checking Zoom recordings from the past week...\n');

    const recordings = await listZoomRecordings({
      from: '2026-02-25',
      to: '2026-03-10',
    });

    console.log(`✅ Total recordings found: ${recordings.total_records}\n`);

    if (recordings.meetings && recordings.meetings.length > 0) {
      recordings.meetings.forEach((meeting: any) => {
        console.log(`📹 Meeting ID: ${meeting.id}`);
        console.log(`   Topic: ${meeting.topic}`);
        console.log(`   Start Time: ${meeting.start_time}`);
        console.log(`   Duration: ${meeting.duration} min`);
        console.log(`   Recording Count: ${meeting.recording_count}`);
        console.log('');
      });
    } else {
      console.log('❌ No recordings found in this date range.');
      console.log('\nPossible reasons:');
      console.log('  1. Meeting is still being processed by Zoom (wait 10-30 min)');
      console.log('  2. Meeting just ended - recordings need time to process');
      console.log('  3. Cloud recording was not enabled for the meeting');
      console.log('  4. The meeting happened outside the date range');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRecordings();
