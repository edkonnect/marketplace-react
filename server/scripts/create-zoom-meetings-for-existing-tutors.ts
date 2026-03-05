/**
 * Script to create Zoom meetings for all existing tutors who don't have one yet
 *
 * Usage:
 *   pnpm tsx server/scripts/create-zoom-meetings-for-existing-tutors.ts
 */

import { getDb } from "../db";
import { users, tutorProfiles } from "../../drizzle/schema";
import { eq, isNull } from "drizzle-orm";
import { createPermanentZoomMeeting } from "../zoom-service";

async function createZoomMeetingsForExistingTutors() {
  console.log("🚀 Starting Zoom meeting creation for existing tutors...\n");

  const database = await getDb();
  if (!database) {
    console.error("❌ Database not available");
    process.exit(1);
  }

  // Get all tutors who don't have a Zoom meeting yet
  const tutorsWithoutZoom = await database
    .select({
      userId: tutorProfiles.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      profileId: tutorProfiles.id,
    })
    .from(tutorProfiles)
    .innerJoin(users, eq(tutorProfiles.userId, users.id))
    .where(isNull(tutorProfiles.zoomJoinUrl));

  if (tutorsWithoutZoom.length === 0) {
    console.log("✅ All tutors already have Zoom meetings!");
    process.exit(0);
  }

  console.log(`Found ${tutorsWithoutZoom.length} tutors without Zoom meetings:\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const tutor of tutorsWithoutZoom) {
    const fullName = `${tutor.firstName} ${tutor.lastName}`;
    console.log(`\n📝 Processing: ${fullName} (${tutor.email})`);

    try {
      // Create Zoom meeting
      const zoomMeeting = await createPermanentZoomMeeting(fullName, tutor.email);

      // Update tutor profile
      const updateData: any = {
        zoomMeetingId: zoomMeeting.meetingId,
        zoomJoinUrl: zoomMeeting.joinUrl,
        zoomHostUrl: zoomMeeting.hostUrl,
        zoomCreatedAt: new Date(),
      };

      // Only set password if it exists
      if (zoomMeeting.password) {
        updateData.zoomMeetingPassword = zoomMeeting.password;
      }

      await database
        .update(tutorProfiles)
        .set(updateData)
        .where(eq(tutorProfiles.userId, tutor.userId));

      console.log(`   ✅ Success!`);
      console.log(`   📎 Join URL: ${zoomMeeting.joinUrl}`);
      successCount++;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failureCount++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📝 Total: ${tutorsWithoutZoom.length}`);

  process.exit(failureCount > 0 ? 1 : 0);
}

// Run the script
createZoomMeetingsForExistingTutors().catch((error) => {
  console.error("\n💥 Script failed:", error);
  process.exit(1);
});
