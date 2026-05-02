import { clearAuthCookies, verifyPassword, hashPassword } from "./_core/services/authService";
import { ENV } from "./_core/env";
import { validateReferralPromo, redeemReferralPromo } from "./integrations/referralApp";
import { systemRouter } from "./_core/systemRouter";
import { notifyOwner } from "./_core/notification";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { NOT_SUPER_USER_ERR_MSG } from "@shared/const";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { searchFaq, logUnansweredQuestion, logQuery } from "./faq-search";
import { checkChatbotRateLimit, bookingRateLimiter } from "./chatbot-rate-limiter";
import { sendWelcomeEmail, sendBookingConfirmation, sendEnrollmentConfirmation, sendTutorEnrollmentNotification, sendNoShowNotification, formatEmailDate, formatEmailTime, formatEmailPrice, sendTutorApplicationReceivedEmail, sendReferralInviteEmail, sendCouponRewardEmail, sendAdminNewUserNotification } from "./email-helpers";
import { generateBookingToken, isValidBookingToken } from "./booking-management";
import { sendCancellationConfirmationEmail } from "./cancellation-email";
import { generateCurriculumPDF } from "./pdf-generator";
import { sendSessionNotesEmail } from "./session-notes-email";
import { emailService } from "./email-service";
import { storagePut } from "./storage";
import { uploadProfileImageToS3, deleteProfileImageFromS3, uploadCourseFileToS3, deleteCourseFileFromS3, getCourseFilePresignedUrl } from "./s3Storage";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { subscriptions as subscriptionsTable, tutorProfiles, users } from "../drizzle/schema";

// Helper to check if user is a tutor
const tutorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'tutor' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only tutors can access this resource' });
  }
  return next({ ctx });
});

// Helper to check if user is a parent
const parentProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'parent' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only parents can access this resource' });
  }
  return next({ ctx });
});

// Helper to check if user is an admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only administrators can access this resource' });
  }
  return next({ ctx });
});

// Admin + super-user second-password verification required
const superAdminProcedure = adminProcedure.use(({ ctx, next }) => {
  if (!ctx.superUserVerified) {
    throw new TRPCError({ code: 'FORBIDDEN', message: NOT_SUPER_USER_ERR_MSG });
  }
  return next({ ctx });
});

// Helper to check if user is a coordinator
const coordinatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'coordinator' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only coordinators can access this resource' });
  }
  return next({ ctx });
});

const SIBLING_DISCOUNT_PERCENT = 5;

/**
 * Returns true if the given student (by first+last name) qualifies for a sibling discount.
 * Conditions:
 *  1. The parent has at least one non-cancelled enrollment for ANY student.
 *  2. This specific student (first+last name) has ZERO previous non-cancelled enrollments.
 */
async function checkSiblingDiscount(
  parentId: number,
  studentFirstName: string,
  studentLastName: string
): Promise<boolean> {
  const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
  const targetFirst = normalize(studentFirstName);
  const targetLast = normalize(studentLastName);

  const existing = await db.getSubscriptionsByParentId(parentId);
  const active = existing.filter((s: any) => s.subscription?.status !== "cancelled");

  // Must have at least one existing enrollment (for any child)
  if (active.length === 0) return false;

  // This student must have zero previous enrollments
  const studentHasEnrollment = active.some((s: any) => {
    const sub = s.subscription;
    return (
      normalize(sub?.studentFirstName) === targetFirst &&
      normalize(sub?.studentLastName) === targetLast
    );
  });

  return !studentHasEnrollment;
}

/**
 * Called after a parent's FIRST enrollment is confirmed.
 * Issues 25% coupon to both the referred user and their referrer, sends reward emails.
 * Safe to call even if the user wasn't referred — it simply does nothing in that case.
 */
/**
 * Called after the referred user's FIRST enrollment is confirmed.
 * Only rewards the REFERRER — the referred user already got their coupon at email verification.
 */
async function triggerReferralReward(parentId: number): Promise<void> {
  try {
    // Must be first enrollment
    const isFirstEnrollment = !(await db.hasUserAlreadyEnrolled(parentId));
    if (!isFirstEnrollment) return;

    const parentUser = await db.getUserById(parentId);
    if (!parentUser || !parentUser.referredBy) return;

    // Find the referral record
    const referral = await db.getReferralByReferredUserId(parentId);
    if (!referral || referral.status === "rewarded") return;

    // Find the referrer
    const referrerUser = await db.getUserByReferralCode(parentUser.referredBy);
    if (!referrerUser) return;

    // Create coupon for the referrer (amounts are 0; applied at their next enrollment)
    const referrerCoupon = await db.createCoupon({
      userId: referrerUser.id,
      sourceReferralId: referral.id,
    });

    // Mark referral as fully rewarded
    await db.updateReferralRewarded(referral.id);

    // Email the referrer their reward
    if (referrerCoupon && referrerUser.email) {
      const parentName = `${parentUser.firstName} ${parentUser.lastName}`.trim();
      const referrerName = `${referrerUser.firstName} ${referrerUser.lastName}`.trim();
      await sendCouponRewardEmail({
        userEmail: referrerUser.email,
        userName: referrerName,
        couponCode: referrerCoupon.code,
        reason: "referrer",
        friendName: parentName,
      }).catch(err => console.error("[Referral] Failed to send reward email to referrer:", err));
    }
  } catch (err) {
    console.error("[Referral] triggerReferralReward failed:", err);
  }
}

/**
 * Get tutor's permanent Zoom meeting URL
 * Returns join URL for students or host URL for tutors
 * Falls back to fake URL if tutor doesn't have Zoom meeting yet
 */
async function getTutorZoomUrl(tutorId: number, isHost: boolean = false): Promise<string | null> {
  const database = await db.getDb();
  if (!database) return null;

  const profile = await database
    .select({
      joinUrl: tutorProfiles.zoomJoinUrl,
      hostUrl: tutorProfiles.zoomHostUrl,
      meetingId: tutorProfiles.zoomMeetingId,
    })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, tutorId))
    .limit(1);

  if (profile.length === 0 || !profile[0].joinUrl) {
    return null; // Tutor doesn't have Zoom meeting yet
  }

  if (isHost && profile[0].meetingId) {
    // ZAK tokens in stored host URLs expire within hours — fetch a fresh one from Zoom API.
    // Falls back to stored URL if API call fails (e.g. network issue, rate limit).
    const { getFreshHostUrl } = await import('./zoom-service');
    const freshUrl = await getFreshHostUrl(profile[0].meetingId);
    if (freshUrl) return freshUrl;
    console.warn(`[ZoomUrl] Could not fetch fresh host URL for tutorId=${tutorId}, falling back to stored URL`);
  }

  return isHost ? profile[0].hostUrl : profile[0].joinUrl;
}

/**
 * Legacy fake URL generator for backwards compatibility
 * Only used as fallback if tutor doesn't have real Zoom meeting yet
 */
function generateFallbackJoinUrl(sessionId: number) {
  const padded = sessionId.toString().padStart(9, "0");
  return `https://zoom.us/j/9${padded}`;
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;
      const { passwordHash, ...rest } = user as any;
      return rest;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearAuthCookies(ctx.req as any, ctx.res as any);
      return { success: true } as const;
    }),
    updateRole: adminProcedure
      .input(z.object({ role: z.enum(['parent', 'tutor', 'coordinator']) }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.updateUserRole(ctx.user.id, input.role as 'parent' | 'tutor' | 'admin');
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update role' });
        }

        // Send welcome email (async, don't wait)
        if (ctx.user.email && ctx.user.name) {
          sendWelcomeEmail({
            userEmail: ctx.user.email,
            userName: ctx.user.name,
            userRole: input.role as 'parent' | 'tutor',
          }).catch(err => console.error('[Email] Failed to send welcome email:', err));
        }

        return { success: true };
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
        timezone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { timezone, ...profileUpdates } = input;
        const success = await db.updateUserProfile(ctx.user.id, profileUpdates);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' });
        }
        if (timezone) {
          await db.updateUserTimezone(ctx.user.id, timezone);
        }
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
        }
        const newHash = await hashPassword(input.newPassword);
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
        await database.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),

  // User Management
  users: router({
    getById: coordinatorProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify coordinator has access to this user (if they're a parent)
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        const hasAccess = assignments.some(a => a.parentId === input.userId);

        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to view this user' });
        }

        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        // Don't return sensitive data
        const { passwordHash, ...safeUser } = user as any;
        return safeUser;
      }),
  }),

  // Tutor Profile Management
  tutorProfile: router({
    get: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const profile = await db.getTutorProfileByUserId(input.userId);
        return profile;
      }),
    
    getMy: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorProfileByUserId(ctx.user.id);
    }),

    /**
     * Manually create/recreate Zoom meeting for a tutor
     * Used when tutor doesn't have a Zoom meeting yet or wants to recreate it
     */
    createZoomMeeting: tutorProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.user.id;

      const database = await db.getDb();
      if (!database) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // Get tutor info
      const tutor = await database
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(tutorProfiles)
        .innerJoin(users, eq(tutorProfiles.userId, users.id))
        .where(eq(tutorProfiles.userId, userId))
        .limit(1);

      if (tutor.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor profile not found' });
      }

      const { firstName, lastName, email } = tutor[0];
      const fullName = `${firstName} ${lastName}`;

      const { createPermanentZoomMeeting } = await import('./zoom-service');
      const zoomMeeting = await createPermanentZoomMeeting(fullName, email);

      // Update profile
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
        .where(eq(tutorProfiles.userId, userId));

      return {
        success: true,
        joinUrl: zoomMeeting.joinUrl,
        hostUrl: zoomMeeting.hostUrl,
        password: zoomMeeting.password,
      };
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const profile = await db.getTutorProfileById(input.id);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor profile not found' });
        }
        // Only return approved profiles for public access
        if (profile.approvalStatus !== 'approved') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor profile not available' });
        }
        return profile;
      }),

    register: publicProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        bio: z.string(),
        qualifications: z.string(),
        yearsOfExperience: z.number(),
        hourlyRate: z.number(),
        subjects: z.array(z.string()),
        gradeLevels: z.array(z.string()),
        timezone: z.string().optional(),
        // Optional profile photo included at registration time
        profileImage: z.object({
          base64Data: z.string(),
          fileName: z.string().max(255),
          fileType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
          fileSize: z.number().max(5 * 1024 * 1024),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Determine if user is authenticated
        const isAuthenticated = !!ctx.user;
        let userId: number;

        if (isAuthenticated && ctx.user) {
          // EXISTING FLOW: User is logged in, use their ID
          userId = ctx.user.id;

          // Check for existing profile
          const existingProfile = await db.getTutorProfileByUserId(userId);
          if (existingProfile && existingProfile.approvalStatus !== 'rejected') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'You already have a tutor profile' });
          }

          // Name and email are read-only for logged-in users on this form.
          // Account details must be changed via Account Settings.
        } else {
          // NEW FLOW: User is NOT logged in
          // Check if email already exists
          const existingUser = await db.getUserByEmail(input.email);

          if (existingUser) {
            // Email exists - check if they have a tutor profile
            const existingProfile = await db.getTutorProfileByUserId(existingUser.id);

            if (existingProfile && existingProfile.approvalStatus !== 'rejected') {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'A tutor application already exists for this email. Please sign in or use a different email.'
              });
            }

            // Update name on the existing user account in case it changed
            const nameParts = input.name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || nameParts[0];
            const dbConn = await db.getDb();
            if (dbConn) {
              await dbConn.update(users)
                .set({ name: input.name, firstName, lastName })
                .where(eq(users.id, existingUser.id));
            }

            userId = existingUser.id;
          } else {
            // Create new user account without password (will be set via setup link)
            // Split name into first/last
            const nameParts = input.name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || nameParts[0];

            const newUser = await db.createAuthUser({
              email: input.email,
              passwordHash: null,
              firstName,
              lastName,
              role: 'parent', // Will change to 'tutor' on approval
            });

            if (!newUser) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user account' });
            }

            userId = newUser.id;

            // Notify admin of new tutor account creation (fire-and-forget)
            sendAdminNewUserNotification({
              userName: input.name,
              userEmail: input.email,
              role: 'tutor',
            }).catch(err => console.error('[TutorRegistration] Failed to send admin new user notification:', err));
          }
        }

        // Common profile data for both flows
        const profileData = {
          bio: input.bio,
          qualifications: input.qualifications,
          yearsOfExperience: input.yearsOfExperience,
          hourlyRate: input.hourlyRate.toString(),
          subjects: JSON.stringify(input.subjects),
          gradeLevels: JSON.stringify(input.gradeLevels),
          approvalStatus: 'pending' as const,
        };

        let profileId: number;
        const existingProfile = await db.getTutorProfileByUserId(userId);

        if (existingProfile) {
          // Re-application after rejection: update the existing profile and clear rejection reason
          await db.updateTutorProfile(userId, { ...profileData, isActive: false, rejectionReason: null });
          profileId = existingProfile.id;
        } else {
          // Create tutor profile with pending approval status
          const created = await db.createTutorProfile({ userId, ...profileData });
          if (created === null) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create tutor profile' });
          }
          profileId = created;
        }

        // Save timezone to users table if provided
        if (input.timezone) {
          await db.updateUserTimezone(userId, input.timezone).catch(() => {});
        }

        // Upload profile image to S3 (or local dev storage) — non-fatal if it fails
        if (input.profileImage) {
          try {
            const img = input.profileImage;
            const base64Regex = /^[A-Za-z0-9+/]+=*$/;
            const stripped = img.base64Data.replace(/\s/g, '');
            const byteLength = Math.floor((stripped.length * 3) / 4);
            if (base64Regex.test(stripped) && byteLength <= 500 * 1024) {
              const imageBuffer = Buffer.from(stripped, 'base64');
              const imageUrl = await uploadProfileImageToS3(imageBuffer, img.fileType, userId);
              await db.updateTutorProfile(userId, { profileImageUrl: imageUrl });
            }
          } catch (imgErr) {
            // Non-fatal: profile is created, image storage failure shouldn't block registration
            console.error('[TutorRegistration] Profile image upload failed:', imgErr);
          }
        }

        // Notify admin about new tutor registration
        try {
          await notifyOwner({
            title: 'New Tutor Registration',
            content: `A new tutor has registered and is pending approval:\n\nName: ${input.name}\nEmail: ${input.email}\nSubjects: ${input.subjects.join(', ')}\nExperience: ${input.yearsOfExperience} years\nHourly Rate: $${input.hourlyRate}\n\nPlease review and approve/reject this application in the admin dashboard.`
          });
        } catch (error) {
          console.error('[TutorRegistration] Failed to send admin notification:', error);
        }

        // Send confirmation email to applicant
        try {
          await sendTutorApplicationReceivedEmail({
            tutorName: input.name,
            tutorEmail: input.email,
            subjects: input.subjects,
          });
        } catch (error) {
          console.error('[TutorRegistration] Failed to send confirmation email to applicant:', error);
          // Don't fail the registration if email fails
        }

        return { success: true, userId, profileId };
      }),

    create: tutorProcedure
      .input(z.object({
        bio: z.string().optional(),
        qualifications: z.string().optional(),
        subjects: z.string(), // JSON string
        gradeLevels: z.string(), // JSON string
        hourlyRate: z.string(),
        yearsOfExperience: z.number().optional(),
        availability: z.string().optional(), // JSON string
        profileImageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createTutorProfile({
          userId: ctx.user.id,
          ...input,
        });
        if (!id) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create profile' });
        }
        return { id };
      }),

    update: tutorProcedure
      .input(z.object({
        bio: z.string().optional(),
        qualifications: z.string().optional(),
        subjects: z.string().optional(),
        gradeLevels: z.string().optional(),
        hourlyRate: z.string().optional(),
        yearsOfExperience: z.number().optional(),
        availability: z.string().optional(),
        profileImageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.updateTutorProfile(ctx.user.id, input);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' });
        }
        return { success: true };
      }),

    list: publicProcedure.query(async () => {
      return await db.getAllActiveTutors();
    }),
    
    getCourses: publicProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCoursesByTutorId(input.tutorId);
      }),

    uploadIntroVideo: tutorProcedure
      .input(z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate file type
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowedTypes.includes(input.fileType)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file type. Only MP4, WebM, and MOV videos are allowed.',
          });
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        if (input.fileSize > maxSize) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'File size exceeds 50MB limit.',
          });
        }

        // Upload to S3
        const { storagePut } = await import('./storage');
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileKey = `tutor-videos/${ctx.user.id}-${Date.now()}-${input.fileName}`;
        
        const result = await storagePut(fileKey, buffer, input.fileType);

        // Update tutor profile with video URL
        const success = await db.updateTutorProfile(ctx.user.id, {
          introVideoUrl: result.url,
          introVideoKey: fileKey,
        });

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update profile with video',
          });
        }

        return { videoUrl: result.url };
      }),

    deleteIntroVideo: tutorProcedure
      .mutation(async ({ ctx }) => {
        const success = await db.updateTutorProfile(ctx.user.id, {
          introVideoUrl: null,
          introVideoKey: null,
        });

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete video',
          });
        }

        return { success: true };
      }),

    uploadProfileImage: tutorProcedure
      .input(z.object({
        fileName: z.string().max(255),
        fileType: z.string(),
        fileSize: z.number(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate MIME type — images only
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(input.fileType)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
          });
        }

        // Client already resizes to ≤400×400 @ 0.8 quality (~50–80KB).
        // Enforce a generous 500KB ceiling on the decoded bytes as a safety net.
        const maxBytes = 500 * 1024;
        if (input.fileSize > maxBytes) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Image size exceeds the 500 KB limit. Please crop to a smaller area.',
          });
        }

        // Validate that base64Data is actually base64 (prevents data-URI injection)
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        const stripped = input.base64Data.replace(/\s/g, '');
        if (!base64Regex.test(stripped)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid image data.',
          });
        }

        // Server-side byte length check on decoded data
        const byteLength = Math.floor((stripped.length * 3) / 4);
        if (byteLength > maxBytes) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Image size exceeds the 500 KB limit.',
          });
        }

        // Decode base64 → Buffer and upload to S3 (or local dev storage)
        const imageBuffer = Buffer.from(stripped, 'base64');

        // Delete old image from S3 before replacing (best-effort)
        const existingProfile = await db.getTutorProfileByUserId(ctx.user.id);
        if (existingProfile?.profileImageUrl) {
          await deleteProfileImageFromS3(existingProfile.profileImageUrl).catch(() => {});
        }

        const imageUrl = await uploadProfileImageToS3(imageBuffer, input.fileType, ctx.user.id);

        const success = await db.updateTutorProfile(ctx.user.id, { profileImageUrl: imageUrl });

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save profile image.',
          });
        }

        return { imageUrl };
      }),

    deleteProfileImage: tutorProcedure
      .mutation(async ({ ctx }) => {
        // Remove from S3 (or local dev storage) before clearing the DB record
        const existingProfile = await db.getTutorProfileByUserId(ctx.user.id);
        if (existingProfile?.profileImageUrl) {
          await deleteProfileImageFromS3(existingProfile.profileImageUrl).catch(() => {});
        }

        const success = await db.updateTutorProfile(ctx.user.id, {
          profileImageUrl: null,
        });

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to remove profile image.',
          });
        }

        return { success: true };
      }),

    getSimilar: publicProcedure
      .input(z.object({
        tutorId: z.number(),
        limit: z.number().optional().default(2),
      }))
      .query(async ({ input }) => {
        return await db.getSimilarTutors(input.tutorId, input.limit);
      }),

    getNotificationPreferences: tutorProcedure.query(async ({ ctx }) => {
      const prefs = await db.getNotificationPreferences(ctx.user.id);
      if (!prefs) {
        return {
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: false,
          timing24h: true,
          timing1h: true,
          timing15min: true,
        };
      }
      return prefs;
    }),

    updateNotificationPreferences: tutorProcedure
      .input(z.object({
        emailEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        smsEnabled: z.boolean().optional(),
        timing24h: z.boolean().optional(),
        timing1h: z.boolean().optional(),
        timing15min: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.upsertNotificationPreferences(ctx.user.id, input);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update preferences' });
        }
        return { success: true };
      }),
  }),

  // Parent Profile Management
  parentProfile: router({
    get: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const profile = await db.getParentProfileByUserId(input.userId);
        return profile;
      }),

    getMy: parentProcedure.query(async ({ ctx }) => {
      return await db.getParentProfileByUserId(ctx.user.id);
    }),

    create: parentProcedure
      .input(z.object({
        childrenInfo: z.string().optional(), // JSON string
        preferences: z.string().optional(), // JSON string
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createParentProfile({
          userId: ctx.user.id,
          ...input,
        });
        if (!id) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create profile' });
        }
        return { id };
      }),

    update: parentProcedure
      .input(z.object({
        childrenInfo: z.string().optional(),
        preferences: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.updateParentProfile(ctx.user.id, input);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' });
        }
        return { success: true };
      }),

    // Dashboard data
    getUpcomingSessions: parentProcedure.query(async ({ ctx }) => {
      return await db.getParentUpcomingSessions(ctx.user.id);
    }),

    getPastSessions: parentProcedure
      .input(z.object({ limit: z.number().optional().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getParentPastSessions(ctx.user.id, input.limit);
      }),

    getSessionNotes: parentProcedure
      .input(z.object({ limit: z.number().optional().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getParentSessionNotes(ctx.user.id, input.limit);
      }),

    getPayments: parentProcedure.query(async ({ ctx }) => {
      return await db.getParentPayments(ctx.user.id);
    }),

    getDashboardStats: parentProcedure.query(async ({ ctx }) => {
      return await db.getParentDashboardStats(ctx.user.id);
    }),

    getLastLogin: parentProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { lastSignedIn: user?.lastSignedIn ?? null };
    }),

    // Notification preferences (open to all authenticated users so tutors can reuse)
    getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getNotificationPreferences(ctx.user.id);
      if (!prefs) {
        // Return default preferences
        return {
          userId: ctx.user.id,
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: false,
          timing24h: true,
          timing1h: false,
          timing15min: false,
        };
      }
      return prefs;
    }),

    updateNotificationPreferences: protectedProcedure
      .input(z.object({
        emailEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        smsEnabled: z.boolean().optional(),
        timing24h: z.boolean().optional(),
        timing1h: z.boolean().optional(),
        timing15min: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.upsertNotificationPreferences(ctx.user.id, input);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update preferences' });
        }
        return { success: true };
      }),

    getNotificationHistory: parentProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ ctx, input }) => {
        return await db.getNotificationLogs(ctx.user.id, input.limit);
      }),

    getInAppNotifications: parentProcedure
      .input(z.object({ includeRead: z.boolean().optional().default(false) }))
      .query(async ({ ctx, input }) => {
        return await db.getInAppNotifications(ctx.user.id, input.includeRead);
      }),

    markNotificationRead: parentProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.markNotificationAsRead(input.notificationId);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark notification as read' });
        }
        return { success: true };
      }),

    markAllNotificationsRead: parentProcedure.mutation(async ({ ctx }) => {
      const success = await db.markAllNotificationsAsRead(ctx.user.id);
      if (!success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark all notifications as read' });
      }
      return { success: true };
    }),

    getUnreadCount: parentProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotificationCount(ctx.user.id);
    }),
  }),

  // Course Management
  course: router({
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const course = await db.getCourseById(input.id);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        
        // Get tutors for this course
        const tutors = await db.getTutorsForCourse(input.id);
        
        return {
          ...course,
          tutors,
        };
      }),

    getTutorsWithAvailability: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        // Get tutors for this course
        const tutors = await db.getTutorsForCourse(input.courseId);
        
        // Fetch availability for each tutor
        const tutorsWithAvailability = await Promise.all(
          tutors.map(async (tutor) => {
            const availability = await db.getTutorAvailability(tutor.user.id);
            return {
              ...tutor,
              availability,
            };
          })
        );
        
        return tutorsWithAvailability;
      }),

    list: publicProcedure
      .input(z.object({
        region: z.enum(["global", "us", "india"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const courses = await db.getAllActiveCourses(input?.region);

        // Add tutors to each course
        const coursesWithTutors = await Promise.all(
          courses.map(async (course) => {
            const tutors = await db.getTutorsForCourse(course.id);
            return { ...course, tutors };
          })
        );

        return coursesWithTutors;
      }),

    search: publicProcedure
      .input(z.object({
        subject: z.string().optional(),
        gradeLevel: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        searchTerm: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.searchCourses(input);
      }),

    myCoursesAsTutor: tutorProcedure.query(async ({ ctx }) => {
      return await db.getCoursesByTutorId(ctx.user.id);
    }),

    create: tutorProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        subject: z.string(),
        gradeLevel: z.string().optional(),
        price: z.string(),
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createCourse(input);
        if (!id) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create course' });
        }
        
        // Link the tutor to the course as primary tutor
        await db.addTutorToCourse(id, ctx.user.id, true);
        
        return { id };
      }),

    update: tutorProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        subject: z.string().optional(),
        gradeLevel: z.string().optional(),
        price: z.string().optional(),
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        
        // Verify ownership
        const isTutorOfCourse = await db.isTutorOfCourse(id, ctx.user.id);
        if (!isTutorOfCourse && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to update this course' });
        }

        const success = await db.updateCourse(id, updates);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update course' });
        }
        return { success: true };
      }),

    requestTutorAssignment: parentProcedure
      .input(z.object({
        courseId: z.number(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        const { tutorAssignmentRequests } = await import('../drizzle/schema');
        const drizzleDb = await db.getDb();
        if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
        const existing = await drizzleDb
          .select()
          .from(tutorAssignmentRequests)
          .where(and(eq(tutorAssignmentRequests.parentId, ctx.user.id), eq(tutorAssignmentRequests.courseId, input.courseId)))
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'You have already requested a tutor for this course.' });
        }
        await drizzleDb.insert(tutorAssignmentRequests).values({
          parentId: ctx.user.id,
          courseId: input.courseId,
          message: input.message ?? null,
        });
        const parent = ctx.user;
        const html = `
          <h2>Tutor Assignment Request</h2>
          <p>A parent has requested a tutor for a course that currently has no assigned tutor.</p>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 12px;font-weight:bold">Course</td><td style="padding:6px 12px">${course.title} (ID: ${course.id})</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold">Subject</td><td style="padding:6px 12px">${course.subject ?? 'N/A'}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold">Parent Name</td><td style="padding:6px 12px">${parent.name ?? 'N/A'}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold">Parent Email</td><td style="padding:6px 12px">${parent.email}</td></tr>
            ${input.message ? `<tr><td style="padding:6px 12px;font-weight:bold">Message</td><td style="padding:6px 12px">${input.message}</td></tr>` : ''}
          </table>
          <p style="margin-top:16px">Please assign a tutor to this course as soon as possible.</p>
        `;
        await emailService.sendEmail({
          to: 'support@edkonnect-academy.com',
          subject: `Tutor Assignment Request: ${course.title}`,
          html,
        });
        return { success: true };
      }),

    checkTutorRequest: parentProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { tutorAssignmentRequests } = await import('../drizzle/schema');
        const drizzleDb = await db.getDb();
        if (!drizzleDb) return { requested: false };
        const existing = await drizzleDb
          .select()
          .from(tutorAssignmentRequests)
          .where(and(eq(tutorAssignmentRequests.parentId, ctx.user.id), eq(tutorAssignmentRequests.courseId, input.courseId)))
          .limit(1);
        return { requested: existing.length > 0 };
      }),

    createCheckoutSession: parentProcedure
      .input(z.object({
        courseId: z.number(),
        preferredTutorId: z.number().optional(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
        origin: z.string(),
        promoCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let subscriptionId: number | null = null;

        try {
          const { createCheckoutSession: stripeCheckout } = await import("./stripe");

          // Get course details
          const course = await db.getCourseById(input.courseId);
          if (!course) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
          }

          // Prevent duplicate enrollment for the same student + same course
          const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
          const targetFirst = normalize(input.studentFirstName);
          const targetLast = normalize(input.studentLastName);
          const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
          const duplicateCourse = existingSubscriptions.some((s: any) => {
            const sub = s.subscription;
            if (!sub) return false;
            if (sub.status === "cancelled") return false;
            return (
              normalize(sub.studentFirstName) === targetFirst &&
              normalize(sub.studentLastName) === targetLast &&
              sub.courseId === input.courseId
            );
          });
          if (duplicateCourse) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This student is already enrolled in this course.",
            });
          }

          // Get primary tutor for the course
          const tutors = await db.getTutorsForCourse(input.courseId);
          const primaryTutor = tutors.find(t => t.isPrimary) || tutors[0];
          if (!primaryTutor) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'No tutor found for this course' });
          }

          const selectedTutorId = input.preferredTutorId || primaryTutor.tutorId;

          // Check sibling discount before creating subscription
          const hasSiblingDiscount = await checkSiblingDiscount(
            ctx.user.id,
            input.studentFirstName,
            input.studentLastName
          );
          const coursePrice = parseFloat(course.price);
          // 5% loyalty discount for ALL course types on pay-in-full
          const LOYALTY_DISCOUNT_PERCENT = 5;
          const totalPercentDiscount = Math.min(100,
            LOYALTY_DISCOUNT_PERCENT + (hasSiblingDiscount ? SIBLING_DISCOUNT_PERCENT : 0)
          );
          const discountAmount = totalPercentDiscount > 0
            ? Math.round(coursePrice * totalPercentDiscount) / 100
            : 0;

          // Validate promo code if provided before creating the subscription
          let promoDiscountUsd = 0;
          let appliedCouponId: number | null = null;
          if (input.promoCode) {
            if (input.promoCode.toUpperCase().startsWith("EDK-")) {
              // External referral app promo code — validate against referral app API
              const parentUser = await db.getUserById(ctx.user.id);
              const result = await validateReferralPromo(input.promoCode, parentUser?.email ?? "");
              if (!result.valid) {
                throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Invalid or expired promo code." });
              }
              promoDiscountUsd = Math.round(coursePrice * 10) / 100; // 10% of course price
              // appliedCouponId stays null — no local coupon record for EDK- codes
            } else {
              // Existing REF- refer-and-earn coupon logic
              const coupon = await db.getCouponByCode(input.promoCode);
              if (!coupon || coupon.isUsed || coupon.userId !== ctx.user.id) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired promo code." });
              }
              const referralDiscount = await db.getReferralDiscountForPrice(coursePrice);
              promoDiscountUsd = referralDiscount.usd;
              await db.updateCouponAmounts(coupon.id, { usd: referralDiscount.usd, inr: referralDiscount.inr });
              appliedCouponId = coupon.id;
            }
          }

          // Create local subscription row (pending payment)
          const now = new Date();
          subscriptionId = await db.createSubscription({
            parentId: ctx.user.id,
            courseId: input.courseId,
            preferredTutorId: selectedTutorId,
            studentFirstName: input.studentFirstName,
            studentLastName: input.studentLastName,
            studentGrade: input.studentGrade,
            status: "active",
            startDate: now,
            paymentStatus: "pending",
            paymentPlan: "full",
            siblingDiscountApplied: hasSiblingDiscount,
            loyaltyDiscountApplied: true,
            promoDiscountAmount: promoDiscountUsd.toString(),
            appliedCouponId,
            discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
          });

          if (!subscriptionId) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create enrollment" });
          }

          // STRIPE_BYPASS=true — skip payment, mark as paid immediately
          if (ENV.stripeBypass) {
            await db.updateSubscription(subscriptionId, { paymentStatus: 'paid' });
            if (appliedCouponId) await db.markCouponUsed(appliedCouponId);
            if (input.promoCode?.toUpperCase().startsWith("EDK-") && ctx.user.email) {
              await redeemReferralPromo(input.promoCode, ctx.user.email).catch(console.error);
            }
            await triggerReferralReward(ctx.user.id);
            return { success: true, subscriptionId, checkoutUrl: null };
          }

          // Build discount label
          const discountParts: string[] = [];
          discountParts.push(`${LOYALTY_DISCOUNT_PERCENT}% loyalty`);
          if (hasSiblingDiscount) discountParts.push(`${SIBLING_DISCOUNT_PERCENT}% sibling`);
          if (promoDiscountUsd > 0) discountParts.push(`$${promoDiscountUsd} promo`);
          const discountLabel = discountParts.length > 0 ? discountParts.join(" + ") : undefined;

          // Create Stripe Checkout session (one-time payment)
          const session = await stripeCheckout({
            priceAmount: coursePrice,
            courseName: course.title,
            courseId: course.id,
            userId: ctx.user.id,
            userEmail: ctx.user.email,
            userName: ctx.user.name,
            origin: input.origin,
            subscriptionId,
            tutorId: selectedTutorId,
            discountPercent: totalPercentDiscount > 0 ? totalPercentDiscount : undefined,
            discountAmountUsd: promoDiscountUsd > 0 ? promoDiscountUsd : undefined,
            discountLabel,
            externalPromoCode: input.promoCode?.toUpperCase().startsWith("EDK-") ? input.promoCode.toUpperCase() : undefined,
            externalPromoEmail: input.promoCode?.toUpperCase().startsWith("EDK-") ? ctx.user.email ?? undefined : undefined,
          });

          return { success: true, subscriptionId, checkoutUrl: session.url, siblingDiscount: hasSiblingDiscount };
        } catch (err) {
          console.error('[createCheckoutSession] Enrollment flow failed:', err);
          if (err instanceof TRPCError) throw err;
          if (subscriptionId) {
            return { success: true, subscriptionId, checkoutUrl: null, warning: 'post-create step failed' };
          }
          return { success: false, message: 'Failed to process enrollment', checkoutUrl: null };
        }
      }),

    enrollWithoutPayment: parentProcedure
      .input(z.object({
        courseId: z.number(),
        preferredTutorId: z.number().optional(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
        origin: z.string(),
        promoCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get course details
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }

        // Prevent duplicate enrollment for the same student + same course
        const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
        const targetFirst = normalize(input.studentFirstName);
        const targetLast = normalize(input.studentLastName);
        const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
        const duplicateCourse = existingSubscriptions.some((s: any) => {
          const sub = s.subscription;
          if (!sub) return false;
          if (sub.status === "cancelled") return false;
          return (
            normalize(sub.studentFirstName) === targetFirst &&
            normalize(sub.studentLastName) === targetLast &&
            sub.courseId === input.courseId
          );
        });
        if (duplicateCourse) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This student is already enrolled in this course.",
          });
        }

        // Get primary tutor for the course
        const tutors = await db.getTutorsForCourse(input.courseId);
        const primaryTutor = tutors.find((t: any) => t.isPrimary) || tutors[0];
        if (!primaryTutor) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No tutor found for this course' });
        }
        const selectedTutorId = input.preferredTutorId || primaryTutor.tutorId;

        // Check sibling discount
        const hasSiblingDiscount = await checkSiblingDiscount(
          ctx.user.id,
          input.studentFirstName,
          input.studentLastName
        );
        const coursePrice = parseFloat(course.price);
        const discountAmount = hasSiblingDiscount
          ? Math.round(coursePrice * SIBLING_DISCOUNT_PERCENT) / 100
          : 0;

        // Validate promo code if provided
        let promoDiscountUsd = 0;
        let appliedCouponId: number | null = null;
        if (input.promoCode) {
          if (input.promoCode.toUpperCase().startsWith("EDK-")) {
            const parentUser = await db.getUserById(ctx.user.id);
            const result = await validateReferralPromo(input.promoCode, parentUser?.email ?? "");
            if (!result.valid) {
              throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Invalid or expired promo code." });
            }
            promoDiscountUsd = Math.round(coursePrice * 10) / 100;
          } else {
            const coupon = await db.getCouponByCode(input.promoCode);
            if (!coupon || coupon.isUsed || coupon.userId !== ctx.user.id) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired promo code.' });
            }
            // Resolve fixed discount amount based on course price tier
            const referralDiscount = await db.getReferralDiscountForPrice(coursePrice);
            promoDiscountUsd = referralDiscount.usd;
            await db.updateCouponAmounts(coupon.id, { usd: referralDiscount.usd, inr: referralDiscount.inr });
            appliedCouponId = coupon.id;
          }
        }

        // For Tutor/Homework courses: compute usage billing fields.
        // First billing cycle: enrollment date → enrollment date + 1 month (rolling).
        // Subsequent cycles charged by cron after billingCycleEnd passes.
        const isUsageBased = course.courseType === "tutor" || course.courseType === "homework";
        let billingCycleStart: Date | undefined;
        let billingCycleEnd: Date | undefined;
        let perSessionRateCents: number | undefined;
        let upfrontCents: number | undefined;
        if (isUsageBased) {
          const now2 = new Date();
          // Rolling window: today → exactly 1 month later
          billingCycleStart = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate()));
          billingCycleEnd = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth() + 1, now2.getUTCDate()));
          // Apply sibling + promo discounts to the per-session rate
          const discountedCoursePrice = Math.max(0, coursePrice - discountAmount - promoDiscountUsd);
          const sessionsPerMonth = (course.sessionsPerWeek ?? 1) * 4;
          const totalSessionsForRate = course.totalSessions ?? sessionsPerMonth;
          perSessionRateCents = Math.round((discountedCoursePrice / totalSessionsForRate) * 100);
          // Upfront charge = one full month of expected sessions
          upfrontCents = sessionsPerMonth * perSessionRateCents;
        }

        // Create local subscription row (billing anchored to today)
        const now = new Date();
        const subscriptionId = await db.createSubscription({
          parentId: ctx.user.id,
          courseId: input.courseId,
          preferredTutorId: selectedTutorId,
          studentFirstName: input.studentFirstName,
          studentLastName: input.studentLastName,
          studentGrade: input.studentGrade,
          status: 'active',
          startDate: now,
          paymentStatus: 'pending',
          paymentPlan: 'monthly',
          siblingDiscountApplied: hasSiblingDiscount,
          promoDiscountAmount: promoDiscountUsd.toString(),
          appliedCouponId,
          discountAmount: hasSiblingDiscount ? discountAmount.toFixed(2) : null,
          ...(isUsageBased && billingCycleStart && billingCycleEnd && perSessionRateCents !== undefined
            ? { billingCycleStart, billingCycleEnd, perSessionRateCents }
            : {}),
        });

        if (!subscriptionId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create enrollment' });
        }

        // STRIPE_BYPASS=true — skip payment collection, mark as paid immediately
        if (ENV.stripeBypass) {
          await db.updateSubscription(subscriptionId, { paymentStatus: 'paid' });
          if (appliedCouponId) await db.markCouponUsed(appliedCouponId);
          if (input.promoCode?.toUpperCase().startsWith("EDK-") && ctx.user.email) {
            await redeemReferralPromo(input.promoCode, ctx.user.email).catch(console.error);
          }
          await triggerReferralReward(ctx.user.id);
          return { success: true, subscriptionId, setupUrl: null };
        }

        const edkPromoCode = input.promoCode?.toUpperCase().startsWith("EDK-") ? input.promoCode.toUpperCase() : undefined;
        const edkPromoEmail = edkPromoCode ? (ctx.user.email ?? undefined) : undefined;

        // For usage-based (tutor/homework): Stripe Checkout charges upfront first month.
        // For non-usage-based courses using this path: Setup Checkout to collect card.
        let setupUrl: string | null = null;
        if (ctx.user.email) {
          try {
            const { getOrCreateStripeCustomer, createSetupCheckoutSession, createUsageEnrollmentCheckout } = await import("./stripe");
            const parentUser = await db.getUserById(ctx.user.id);
            const stripeCustomerId = await getOrCreateStripeCustomer({
              userId: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name,
              existingStripeCustomerId: parentUser?.stripeCustomerId,
            });

            // Always persist — handles case where old customer ID was stale/deleted
            if (stripeCustomerId !== parentUser?.stripeCustomerId) {
              await db.updateUserStripeCustomerId(ctx.user.id, stripeCustomerId);
            }

            if (isUsageBased && upfrontCents !== undefined) {
              // Upfront payment checkout — charges first month immediately and saves card for future cron billing
              const checkoutSession = await createUsageEnrollmentCheckout({
                stripeCustomerId,
                amountCents: upfrontCents,
                courseName: course.title,
                courseId: input.courseId,
                userId: ctx.user.id,
                subscriptionId,
                origin: input.origin,
                externalPromoCode: edkPromoCode,
                externalPromoEmail: edkPromoEmail,
              });
              setupUrl = checkoutSession.url;
            } else {
              // Non-usage-based: Setup Checkout to collect card (Stripe Subscription created in webhook)
              const setupSession = await createSetupCheckoutSession({
                stripeCustomerId,
                origin: input.origin,
                courseId: input.courseId,
                subscriptionId,
                externalPromoCode: edkPromoCode,
                externalPromoEmail: edkPromoEmail,
              });
              setupUrl = setupSession.url;
            }
          } catch (err) {
            // Non-fatal — local enrollment still created
            console.error('[enrollWithoutPayment] Failed to create Stripe checkout:', err);
          }
        }

        return { success: true, subscriptionId, setupUrl, siblingDiscount: hasSiblingDiscount };
      }),

    enrollWithInstallments: parentProcedure
      .input(z.object({
        courseId: z.number(),
        preferredTutorId: z.number().optional(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
        origin: z.string(),
        promoCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        if (course.courseType !== "test_prep") {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Installment plans are only available for Test Prep courses.' });
        }

        // Prevent duplicate enrollment
        const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
        const targetFirst = normalize(input.studentFirstName);
        const targetLast = normalize(input.studentLastName);
        const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
        const duplicateCourse = existingSubscriptions.some((s: any) => {
          const sub = s.subscription;
          if (!sub || sub.status === "cancelled") return false;
          return (
            normalize(sub.studentFirstName) === targetFirst &&
            normalize(sub.studentLastName) === targetLast &&
            sub.courseId === input.courseId
          );
        });
        if (duplicateCourse) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This student is already enrolled in this course." });
        }

        const tutors = await db.getTutorsForCourse(input.courseId);
        const primaryTutor = tutors.find((t: any) => t.isPrimary) || tutors[0];
        if (!primaryTutor) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No tutor found for this course' });
        }
        const selectedTutorId = input.preferredTutorId || primaryTutor.tutorId;

        const hasSiblingDiscount = await checkSiblingDiscount(ctx.user.id, input.studentFirstName, input.studentLastName);
        const coursePrice = parseFloat(course.price);

        // Validate promo code
        let promoDiscountUsd = 0;
        let appliedCouponId: number | null = null;
        if (input.promoCode) {
          if (input.promoCode.toUpperCase().startsWith("EDK-")) {
            const parentUser = await db.getUserById(ctx.user.id);
            const result = await validateReferralPromo(input.promoCode, parentUser?.email ?? "");
            if (!result.valid) {
              throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Invalid or expired promo code." });
            }
            promoDiscountUsd = Math.round(coursePrice * 10) / 100;
          } else {
            const coupon = await db.getCouponByCode(input.promoCode);
            if (!coupon || coupon.isUsed || coupon.userId !== ctx.user.id) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired promo code.' });
            }
            const referralDiscount = await db.getReferralDiscountForPrice(coursePrice);
            promoDiscountUsd = referralDiscount.usd;
            await db.updateCouponAmounts(coupon.id, { usd: referralDiscount.usd, inr: referralDiscount.inr });
            appliedCouponId = coupon.id;
          }
        }

        // Apply sibling + promo discounts to full price (loyalty discount is full-pay only)
        const siblingPct = hasSiblingDiscount ? SIBLING_DISCOUNT_PERCENT : 0;
        const afterSiblingCents = Math.round(coursePrice * 100 * (1 - siblingPct / 100));
        const discountedTotalCents = Math.max(0, afterSiblingCents - Math.round(promoDiscountUsd * 100));

        const numberOfInstallments = 3;
        const installmentAmountCents = Math.round(discountedTotalCents / numberOfInstallments);
        // Last installment absorbs rounding remainder
        const lastInstallmentCents = discountedTotalCents - installmentAmountCents * (numberOfInstallments - 1);

        const now = new Date();
        const subscriptionId = await db.createSubscription({
          parentId: ctx.user.id,
          courseId: input.courseId,
          preferredTutorId: selectedTutorId,
          studentFirstName: input.studentFirstName,
          studentLastName: input.studentLastName,
          studentGrade: input.studentGrade,
          status: 'active',
          startDate: now,
          paymentStatus: 'pending',
          paymentPlan: 'installment',
          numberOfInstallments,
          firstInstallmentAmount: (installmentAmountCents / 100).toFixed(2),
          secondInstallmentAmount: (installmentAmountCents / 100).toFixed(2),
          thirdInstallmentAmount: (lastInstallmentCents / 100).toFixed(2),
          siblingDiscountApplied: hasSiblingDiscount,
          promoDiscountAmount: promoDiscountUsd.toString(),
          appliedCouponId,
          discountAmount: (coursePrice - discountedTotalCents / 100).toFixed(2),
        });

        if (!subscriptionId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create enrollment' });
        }

        if (ENV.stripeBypass) {
          await db.updateSubscription(subscriptionId, { paymentStatus: 'paid' });
          if (appliedCouponId) await db.markCouponUsed(appliedCouponId);
          await triggerReferralReward(ctx.user.id);
          return { success: true, subscriptionId, setupUrl: null };
        }

        let setupUrl: string | null = null;
        if (ctx.user.email) {
          try {
            const { getOrCreateStripeCustomer } = await import("./stripe");
            const stripe = (await import("./stripe")).getStripe();
            const parentUser = await db.getUserById(ctx.user.id);
            const stripeCustomerId = await getOrCreateStripeCustomer({
              userId: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name,
              existingStripeCustomerId: parentUser?.stripeCustomerId,
            });
            if (stripeCustomerId !== parentUser?.stripeCustomerId) {
              await db.updateUserStripeCustomerId(ctx.user.id, stripeCustomerId);
            }

            // Use a setup checkout with type=installment_setup so the webhook
            // creates an installment Stripe subscription (not a standard monthly one)
            const setupSession = await stripe.checkout.sessions.create({
              mode: "setup",
              customer: stripeCustomerId,
              currency: "usd",
              metadata: {
                type: "installment_setup",
                subscription_id: subscriptionId.toString(),
                course_id: input.courseId.toString(),
                installment_amount_cents: installmentAmountCents.toString(),
              },
              success_url: `${input.origin}/parent/dashboard?setup=success`,
              cancel_url: `${input.origin}/course/${input.courseId}?setup=cancelled`,
            });
            setupUrl = setupSession.url;
          } catch (err) {
            console.error('[enrollWithInstallments] Failed to create Stripe setup:', err);
          }
        }

        return { success: true, subscriptionId, setupUrl };
      }),

    retryCheckout: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        origin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCheckoutSession: stripeCheckout } = await import("./stripe");

        const localSub = await db.getSubscriptionById(input.subscriptionId);
        if (!localSub || localSub.parentId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
        }
        if (localSub.paymentStatus !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not pending payment" });
        }

        const course = await db.getCourseById(localSub.courseId);
        if (!course) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        }

        const LOYALTY_DISCOUNT_PERCENT = 5;
        const siblingPct = localSub.siblingDiscountApplied ? SIBLING_DISCOUNT_PERCENT : 0;
        // Loyalty always applies on pay-in-full (even if original enrollment was installment plan)
        const loyaltyPct = LOYALTY_DISCOUNT_PERCENT;
        const totalPct = Math.min(100, siblingPct + loyaltyPct);
        const promoUsd = parseFloat(localSub.promoDiscountAmount ?? "0");

        const discountLabel = (() => {
          const parts = [];
          if (loyaltyPct > 0) parts.push(`${loyaltyPct}% loyalty`);
          if (siblingPct > 0) parts.push(`${siblingPct}% sibling`);
          if (promoUsd > 0) parts.push(`$${promoUsd} promo`);
          return parts.length > 0 ? parts.join(" + ") : undefined;
        })();

        const session = await stripeCheckout({
          priceAmount: parseFloat(course.price),
          courseName: course.title,
          courseId: course.id,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          origin: input.origin,
          subscriptionId: input.subscriptionId,
          tutorId: localSub.preferredTutorId ?? undefined,
          discountPercent: totalPct > 0 ? totalPct : undefined,
          discountAmountUsd: promoUsd > 0 ? promoUsd : undefined,
          discountLabel,
          convertPendingPlanToFull: localSub.paymentPlan !== "full",
        });

        return { checkoutUrl: session.url };
      }),

    retryInstallmentCheckout: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        origin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const localSub = await db.getSubscriptionById(input.subscriptionId);
        if (!localSub || localSub.parentId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
        }
        if (localSub.paymentStatus !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not pending" });
        }

        const course = await db.getCourseById(localSub.courseId);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

        const { getOrCreateStripeCustomer, getStripe } = await import("./stripe");
        const parentUser = await db.getUserById(ctx.user.id);
        const stripeCustomerId = await getOrCreateStripeCustomer({
          userId: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          existingStripeCustomerId: parentUser?.stripeCustomerId,
        });
        const stripe = getStripe();

        const rawPrice = parseFloat(course.price);
        const siblingPct = localSub.siblingDiscountApplied ? SIBLING_DISCOUNT_PERCENT : 0;
        const promoAmt = parseFloat(localSub.promoDiscountAmount ?? "0");
        const discountedTotal = Math.max(0, rawPrice * (1 - siblingPct / 100) - promoAmt);
        const installmentAmountCents = Math.round((discountedTotal / 3) * 100);

        const session = await stripe.checkout.sessions.create({
          mode: "setup",
          customer: stripeCustomerId,
          currency: "usd",
          metadata: {
            type: "installment_setup",
            subscription_id: input.subscriptionId.toString(),
            course_id: course.id.toString(),
            installment_amount_cents: installmentAmountCents.toString(),
          },
          success_url: `${input.origin}/parent/dashboard?setup=success`,
          cancel_url: `${input.origin}/parent/dashboard?setup=cancelled`,
        });

        return { setupUrl: session.url };
      }),

    getSetupUrl: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        origin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getOrCreateStripeCustomer, createSetupCheckoutSession, createUsageEnrollmentCheckout } = await import("./stripe");

        const localSub = await db.getSubscriptionById(input.subscriptionId);
        if (!localSub || localSub.parentId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
        }

        if (!ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Parent account must have an email address" });
        }

        const parentUser = await db.getUserById(ctx.user.id);
        const stripeCustomerId = await getOrCreateStripeCustomer({
          userId: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          existingStripeCustomerId: parentUser?.stripeCustomerId,
        });

        if (stripeCustomerId !== parentUser?.stripeCustomerId) {
          await db.updateUserStripeCustomerId(ctx.user.id, stripeCustomerId);
        }

        const course = await db.getCourseById(localSub.courseId);
        if (!course) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        }

        const isPendingUsageEnrollment = (
          localSub.paymentPlan === "monthly" &&
          localSub.paymentStatus === "pending" &&
          localSub.perSessionRateCents != null &&
          (course.courseType === "tutor" || course.courseType === "homework")
        );

        if (isPendingUsageEnrollment) {
          const perSessionRateCents = localSub.perSessionRateCents;
          if (perSessionRateCents == null) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Subscription is missing per-session rate" });
          }
          const sessionsPerMonth = (course.sessionsPerWeek ?? 1) * 4;
          const checkoutSession = await createUsageEnrollmentCheckout({
            stripeCustomerId,
            amountCents: sessionsPerMonth * perSessionRateCents,
            courseName: course.title,
            courseId: localSub.courseId,
            userId: ctx.user.id,
            subscriptionId: input.subscriptionId,
            origin: input.origin,
          });

          return { setupUrl: checkoutSession.url };
        }

        const setupSession = await createSetupCheckoutSession({
          stripeCustomerId,
          origin: input.origin,
          courseId: localSub.courseId,
          subscriptionId: input.subscriptionId,
        });

        return { setupUrl: setupSession.url };
      }),

  }),

  tutorCoursePreferences: router({
    getMine: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorCoursePreferences(ctx.user.id);
    }),

    availableCourses: tutorProcedure.query(async () => {
      return await db.getAllActiveCourses();
    }),

    saveMine: tutorProcedure
      .input(z.object({
        preferences: z.array(z.object({
          courseId: z.number(),
          hourlyRate: z.number().positive(),
        })).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const seen = new Set<number>();
        for (const pref of input.preferences) {
          if (seen.has(pref.courseId)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Duplicate course in preferences' });
          }
          seen.add(pref.courseId);
        }

        const success = await db.upsertTutorCoursePreferences(ctx.user.id, input.preferences);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save preferences' });
        }
        return { success: true };
      }),
  }),

  // Subscription Management
  subscription: router({
    checkSiblingDiscount: parentProcedure
      .input(z.object({
        studentFirstName: z.string(),
        studentLastName: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!input.studentFirstName || !input.studentLastName) {
          return { eligible: false, discountPercent: 0 };
        }
        const eligible = await checkSiblingDiscount(ctx.user.id, input.studentFirstName, input.studentLastName);
        return { eligible, discountPercent: eligible ? SIBLING_DISCOUNT_PERCENT : 0 };
      }),

    mySubscriptions: parentProcedure.query(async ({ ctx }) => {
      const subs = await db.getSubscriptionsByParentId(ctx.user.id);

      // Enhance each subscription with session statistics and next billing info
      const enhancedSubs = await Promise.all(
        subs.map(async (sub) => {
          const sessionStats = await db.getSessionStatsBySubscription(sub.subscription.id);

          let nextBillingDate: number | null = null;
          let nextBillingAmount: number | null = null;

          // For monthly/installment subs with a linked Stripe subscription, fetch next billing cycle
          if (
            (sub.subscription.paymentPlan === "monthly" || sub.subscription.paymentPlan === "installment") &&
            (sub.subscription.paymentStatus === "paid" || sub.subscription.paymentStatus === "completed") &&
            sub.subscription.stripeSubscriptionId
          ) {
            try {
              const { getStripe } = await import("./stripe");
              const stripe = getStripe();
              const stripeSub = await stripe.subscriptions.retrieve(
                sub.subscription.stripeSubscriptionId
              );
              // current_period_end is the next billing date (Unix timestamp in seconds)
              const nextTs = (stripeSub as any).status === "trialing"
                ? ((stripeSub as any).trial_end ?? (stripeSub as any).current_period_end)
                : (stripeSub as any).current_period_end;
              nextBillingDate = nextTs * 1000; // convert to ms
              // Find the matching item's price amount
              const item = stripeSub.items.data.find(
                (i) => i.id === sub.subscription.stripeItemId
              ) || stripeSub.items.data[0];
              if (item?.price?.unit_amount) {
                nextBillingAmount = item.price.unit_amount / 100; // cents → dollars
              }
            } catch (err) {
              // Non-fatal — just won't show next billing info
            }
          }

          let installmentsPaidCount = 0;
          if (sub.subscription.paymentPlan === "installment") {
            const installmentPayments = await db.getPaymentsBySubscriptionId(sub.subscription.id);
            installmentsPaidCount = installmentPayments.filter((p: any) => p.status === "completed").length;
          }

          return {
            ...sub,
            sessionStats: sessionStats || {
              firstSessionDate: null,
              lastScheduledDate: null,
              completedCount: 0,
              scheduledCount: 0,
              totalSessions: 0
            },
            nextBillingDate,
            nextBillingAmount,
            installmentsPaidCount,
          };
        })
      );

      return enhancedSubs;
    }),

    getAvailability: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        windowDays: z.number().optional().default(42),
      }))
      .query(async ({ input }) => {
        const subscription = await db.getSubscriptionById(input.subscriptionId);
        if (!subscription) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }

        const primaryTutor = await db.getPrimaryTutorForCourse(subscription.courseId);
        const tutorId = subscription.preferredTutorId || primaryTutor?.tutorId;
        if (!tutorId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor not found for this subscription' });
        }

        const availability = await db.getTutorAvailability(tutorId);

        const now = Date.now();
        const windowEnd = now + input.windowDays * 24 * 60 * 60 * 1000;
        // Look back 24 hours to catch sessions that are scheduled but whose start time
        // has just passed (still status='scheduled') — prevents them showing as available
        const windowStart = now - 24 * 60 * 60 * 1000;
        const booked = await db.getTutorSessionsWithin(tutorId, windowStart, windowEnd);

        return {
          tutorId,
          availability,
          booked,
        };
      }),

    mySubscriptionsAsTutor: tutorProcedure.query(async ({ ctx }) => {
      const subs = await db.getSubscriptionsByTutorId(ctx.user.id);

      // Show all active (non-cancelled) subscriptions
      const active = subs.filter(
        (s) => s.subscription.status !== "cancelled"
      );

      // Deduplicate by student+course (keep the latest) to avoid showing
      // duplicate rows when a student re-enrolled after cancellation
      const dedupedMap = new Map<string, typeof active[0]>();
      for (const entry of active) {
        const firstName = (entry.subscription.studentFirstName || "").trim().toLowerCase();
        const lastName = (entry.subscription.studentLastName || "").trim().toLowerCase();
        const key = `${entry.subscription.parentId}-${firstName}-${lastName}-${entry.subscription.courseId}`;
        const existing = dedupedMap.get(key);
        if (!existing || (entry.subscription.createdAt ?? 0) > (existing.subscription.createdAt ?? 0)) {
          dedupedMap.set(key, entry);
        }
      }

      // Enhance each subscription with session statistics
      const enhancedSubs = await Promise.all(
        Array.from(dedupedMap.values()).map(async (sub) => {
          const sessionStats = await db.getSessionStatsBySubscription(sub.subscription.id);
          return {
            ...sub,
            sessionStats: sessionStats || {
              firstSessionDate: null,
              lastScheduledDate: null,
              completedCount: 0,
              scheduledCount: 0,
              totalSessions: 0
            }
          };
        })
      );

      return enhancedSubs;
    }),

    create: parentProcedure
      .input(z.object({
        courseId: z.number(),
        startDate: z.date(),
        endDate: z.date().optional(),
        studentFirstName: z.string().optional(),
        studentLastName: z.string().optional(),
        studentGrade: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createSubscription({
          parentId: ctx.user.id,
          courseId: input.courseId,
          startDate: input.startDate,
          endDate: input.endDate || null,
          studentFirstName: input.studentFirstName || null,
          studentLastName: input.studentLastName || null,
          studentGrade: input.studentGrade || null,
          status: 'active',
        });
        if (!id) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create subscription' });
        }
        return { id };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'paused', 'cancelled', 'completed']),
      }))
      .mutation(async ({ ctx, input }) => {
        const subscription = await db.getSubscriptionById(input.id);
        if (!subscription) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }

        // Verify authorization
        if (subscription.parentId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        const success = await db.updateSubscription(input.id, { status: input.status });
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update subscription' });
        }
        return { success: true };
      }),

    requestCancellation: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const subscription = await db.getSubscriptionById(input.subscriptionId);
        if (!subscription) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }
        if (subscription.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        const [course, sessionStats] = await Promise.all([
          db.getCourseById(subscription.courseId),
          db.getSessionStatsBySubscription(input.subscriptionId),
        ]);
        const studentName = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ') || 'N/A';
        const parentName = ctx.user.name || ctx.user.email;
        const courseName = course?.title || `Course ID ${subscription.courseId}`;
        const enrollmentDate = subscription.startDate
          ? new Date(subscription.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'N/A';
        const totalCourseSessions = course?.totalSessions ?? 0;
        const completedSessions = sessionStats?.completedCount ?? 0;
        const sessionsProgress = totalCourseSessions > 0
          ? `${completedSessions} of ${totalCourseSessions} sessions completed`
          : completedSessions > 0 ? `${completedSessions} sessions completed` : 'No sessions completed yet';

        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#dc2626">Subscription Cancellation Request</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;font-weight:bold;width:160px">Parent</td><td style="padding:8px">${parentName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Parent Email</td><td style="padding:8px">${ctx.user.email}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Course</td><td style="padding:8px">${courseName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Student</td><td style="padding:8px">${studentName}${subscription.studentGrade ? ` (Grade ${subscription.studentGrade})` : ''}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Enrollment Start Date</td><td style="padding:8px">${enrollmentDate}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Sessions Progress</td><td style="padding:8px">${sessionsProgress}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Payment Plan</td><td style="padding:8px">${subscription.paymentPlan || 'N/A'}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Reason</td><td style="padding:8px">${input.reason?.trim() || 'No reason provided'}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Requested At</td><td style="padding:8px">${new Date().toUTCString()}</td></tr>
            </table>
            <p style="margin-top:24px;color:#666;font-size:13px">Please review and process this cancellation request at your earliest convenience.</p>
          </div>`;

        await emailService.sendEmail({
          to: 'support@edkonnect-academy.com',
          subject: `Cancellation Request – ${courseName} – ${parentName}`,
          html,
        });

        return { success: true };
      }),

    updateProgressStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        progressStatus: z.enum(["low", "medium", "high"]).nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const subscription = await db.getSubscriptionById(input.id);
        if (!subscription) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
        }

        const canManageAsAdmin = ctx.user.role === "admin";
        const canManageAsTutor = ctx.user.role === "tutor" && subscription.preferredTutorId === ctx.user.id;
        if (!canManageAsAdmin && !canManageAsTutor) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }

        const success = await db.updateSubscriptionProgressStatus(input.id, input.progressStatus);
        if (!success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update progress status" });
        }

        return { success: true };
      }),
  }),

  // Session Management
  session: router({
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        // Verify authorization
        const isParticipant = session.parentId === ctx.user.id || session.tutorId === ctx.user.id;
        const isAdmin = ctx.user.role === 'admin';

        // Check if user is coordinator for this parent
        let isCoordinator = false;
        if (ctx.user.role === 'coordinator' && session.parentId) {
          const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
          isCoordinator = assignments.some(a => a.parentId === session.parentId);
        }

        if (!isParticipant && !isAdmin && !isCoordinator) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        return session;
    }),

    myUpcoming: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === 'coordinator') {
        // For coordinators, get sessions for all assigned parents
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        const allSessions = await Promise.all(
          assignments.map(async (assignment) => {
            const rows = await db.getUpcomingSessions(assignment.parentId, 'parent');
            return await Promise.all(rows.map(async (row: any) => {
              const session = row.session || row;
              const isHost = false; // Coordinators/parents see join URL
              const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
              return {
                ...session,
                courseTitle: row.courseTitle,
                tutorName: row.tutorName,
                parentName: assignment.parent?.firstName + ' ' + assignment.parent?.lastName,
                studentFirstName: row.studentFirstName,
                studentLastName: row.studentLastName,
                joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
              };
            }));
          })
        );
        return allSessions.flat();
      }

      const role = ctx.user.role === 'tutor' ? 'tutor' : 'parent';
      const rows = await db.getUpcomingSessions(ctx.user.id, role);
      const isHost = ctx.user.role === 'tutor';
      return await Promise.all(rows.map(async (row: any) => {
        const session = row.session || row;
        const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
        return {
          ...session,
          courseTitle: row.courseTitle,
          tutorName: row.tutorName,
          parentName: row.parentName,
          studentFirstName: row.studentFirstName,
          studentLastName: row.studentLastName,
          joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
        };
      }));
    }),

    myHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === 'tutor') {
        const rows = await db.getCompletedSessionsByTutorId(ctx.user.id);
        const isHost = true;
        return await Promise.all(rows.map(async (row: any) => {
          const session = row.session || row;
          const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
          return {
            ...session,
            courseTitle: row.courseTitle,
            courseSubject: row.courseSubject,
            courseQuizEnabled: row.courseQuizEnabled ?? false,
            hasQuiz: !!row.hasQuiz,
            quizStatus: row.quizStatus ?? null,
            quizScore: row.quizScore ?? null,
            quizCorrectCount: row.quizCorrectCount ?? null,
            quizTotalCount: row.quizTotalCount ?? null,
            tutorName: row.tutorName,
            parentName: row.parentName,
            studentFirstName: row.studentFirstName,
            studentLastName: row.studentLastName,
            joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
          };
        }));
      } else {
        const rows = await db.getCompletedSessionsByParentId(ctx.user.id);
        const isHost = false;
        return await Promise.all(rows.map(async (row: any) => {
          const session = row.session || row;
          const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
          return {
            ...session,
            courseTitle: row.courseTitle,
            courseSubject: row.courseSubject,
            tutorName: row.tutorName,
            studentFirstName: row.studentFirstName,
            studentLastName: row.studentLastName,
            joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
          };
        }));
      }
    }),

    // Coordinator-specific: Get upcoming sessions for a specific parent
    getParentUpcomingSessions: coordinatorProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify coordinator has access to this parent
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        const hasAccess = assignments.some(a => a.parentId === input.parentId);

        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to view this parent\'s sessions' });
        }

        const rows = await db.getUpcomingSessions(input.parentId, 'parent');
        const isHost = false; // Coordinators see join URL
        return await Promise.all(rows.map(async (row: any) => {
          const session = row.session || row;
          const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
          return {
            ...session,
            courseTitle: row.courseTitle,
            tutorName: row.tutorName,
            studentFirstName: row.studentFirstName,
            studentLastName: row.studentLastName,
            joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
          };
        }));
      }),

    // Coordinator-specific: Get past sessions for a specific parent
    getParentPastSessions: coordinatorProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify coordinator has access to this parent
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        const hasAccess = assignments.some(a => a.parentId === input.parentId);

        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to view this parent\'s sessions' });
        }

        const rows = await db.getCompletedSessionsByParentId(input.parentId);
        const isHost = false; // Coordinators see join URL
        return await Promise.all(rows.map(async (row: any) => {
          const session = row.session || row;
          const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
          return {
            ...session,
            courseTitle: row.courseTitle,
            courseSubject: row.courseSubject,
            tutorName: row.tutorName,
            studentFirstName: row.studentFirstName,
            studentLastName: row.studentLastName,
            joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
          };
        }));
      }),

    getUpcomingByTutorId: publicProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        const rows = await db.getSessionsByTutorId(input.tutorId, { upcomingOnly: true, limit: 200 });
        return rows.map((row: any) => ({
          id: row.session.id,
          scheduledAt: row.session.scheduledAt,
          duration: row.session.duration,
          status: row.session.status,
        }));
      }),

    myBookings: parentProcedure.query(async ({ ctx }) => {
      // Fetch all sessions for the parent grouped by subscription
      const rows = await db.getSessionsByParentId(ctx.user.id);
      const isHost = false; // Parents see join URL
      const sessions = await Promise.all(rows.map(async (row: any) => {
        const session = row.session || row;
        const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
        return {
          ...session,
          course: row.courseTitle ? { title: row.courseTitle } : null,
          tutor: row.tutorName ? { name: row.tutorName } : null,
          studentFirstName: row.studentFirstName,
          studentLastName: row.studentLastName,
          joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
        };
      }));

      // Group sessions by subscriptionId
      const grouped = sessions.reduce((acc: any, session: any) => {
        const subId = session.subscriptionId;
        if (!acc[subId]) {
          acc[subId] = [];
        }
        acc[subId].push(session);
        return acc;
      }, {});

      return grouped;
    }),

    reschedule: parentProcedure
      .input(z.object({
        sessionId: z.number(),
        newScheduledAt: z.number(), // Unix timestamp
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        if (session.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        // Get session details for notification
        const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
        const course = subscription ? await db.getCourseById(subscription.courseId) : null;
        const parent = await db.getUserById(ctx.user.id);
        const oldDate = new Date(session.scheduledAt);
        const newDate = new Date(input.newScheduledAt);

        await db.updateSession(input.sessionId, {
          scheduledAt: input.newScheduledAt,
        });

        // Create notification for tutor
        if (session.tutorId) {
          const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          await db.createInAppNotification({
            userId: session.tutorId,
            title: 'Session Rescheduled',
            message: `${parent?.name || 'A parent'} rescheduled ${course?.title || 'a session'} from ${formatDate(oldDate)} to ${formatDate(newDate)}`,
            type: 'new_booking',
            relatedId: input.sessionId,
          });
        }

        return { success: true };
      }),

    rescheduleSeries: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        newStartDate: z.number(), // Unix timestamp for first session
        frequency: z.enum(['weekly', 'biweekly']),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get all scheduled sessions for this subscription
        const sessions = await db.getSessionsByParentId(ctx.user.id);
        const seriesSessions = sessions.filter((s: any) =>
          s.session?.subscriptionId === input.subscriptionId && s.session?.status === 'scheduled'
        ).sort((a: any, b: any) => (a.session?.scheduledAt || 0) - (b.session?.scheduledAt || 0));

        if (seriesSessions.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No scheduled sessions found' });
        }

        // Get details for notification
        const subscription = await db.getSubscriptionById(input.subscriptionId);
        const course = subscription ? await db.getCourseById(subscription.courseId) : null;
        const parent = await db.getUserById(ctx.user.id);
        const firstOldDate = seriesSessions[0]?.session?.scheduledAt
          ? new Date(seriesSessions[0].session.scheduledAt)
          : null;
        const firstNewDate = new Date(input.newStartDate);
        let tutorId: number | null = null;

        // Calculate new dates based on frequency
        const intervalDays = input.frequency === 'weekly' ? 7 : 14;
        const startDate = new Date(input.newStartDate);

        for (let i = 0; i < seriesSessions.length; i++) {
          const newDate = new Date(startDate);
          newDate.setDate(newDate.getDate() + (i * intervalDays));

          if (seriesSessions[i].session?.id) {
            await db.updateSession(seriesSessions[i].session.id, {
              scheduledAt: newDate.getTime(),
            });

            // Store tutorId from first session
            if (!tutorId && seriesSessions[i].session.tutorId) {
              tutorId = seriesSessions[i].session.tutorId;
            }
          }
        }

        // Create notification for tutor
        if (tutorId && firstOldDate) {
          const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          await db.createInAppNotification({
            userId: tutorId,
            title: 'Series Rescheduled',
            message: `${parent?.name || 'A parent'} rescheduled ${seriesSessions.length} ${course?.title || 'sessions'}. New start: ${formatDate(firstNewDate)} (was ${formatDate(firstOldDate)})`,
            type: 'new_booking',
            relatedId: seriesSessions[0]?.session?.id || null,
          });
        }

        return { success: true, rescheduledCount: seriesSessions.length };
      }),

    cancel: parentProcedure
      .input(z.object({
        sessionId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        if (session.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        // Get session details for notification
        const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
        const course = subscription ? await db.getCourseById(subscription.courseId) : null;
        const parent = await db.getUserById(ctx.user.id);

        await db.updateSession(input.sessionId, {
          status: 'cancelled',
          notes: input.reason ? `Canceled: ${input.reason}` : 'Canceled by parent',
        });

        // Create notification for tutor
        if (session.tutorId) {
          const sessionDate = new Date(session.scheduledAt);
          const formattedDate = sessionDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });

          await db.createInAppNotification({
            userId: session.tutorId,
            title: 'Session Cancelled',
            message: `${parent?.name || 'A parent'} cancelled ${course?.title || 'a session'} scheduled for ${formattedDate}${input.reason ? `. Reason: ${input.reason}` : ''}`,
            type: 'session_cancelled',
            relatedId: input.sessionId,
          });
        }

        return { success: true };
      }),

    cancelSeries: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sessions = await db.getSessionsByParentId(ctx.user.id);
        const seriesSessions = sessions.filter((s: any) =>
          s.session?.subscriptionId === input.subscriptionId && s.session?.status === 'scheduled'
        );

        if (seriesSessions.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No scheduled sessions found' });
        }

        // Get subscription and course details for notification
        const subscription = await db.getSubscriptionById(input.subscriptionId);
        const course = subscription ? await db.getCourseById(subscription.courseId) : null;
        const parent = await db.getUserById(ctx.user.id);
        let tutorId: number | null = null;

        for (const sessionData of seriesSessions) {
          if (sessionData.session?.id) {
            await db.updateSession(sessionData.session.id, {
              status: 'cancelled',
              notes: input.reason ? `Canceled: ${input.reason}` : 'Canceled by parent',
            });

            // Store tutorId from first session
            if (!tutorId && sessionData.session.tutorId) {
              tutorId = sessionData.session.tutorId;
            }
          }
        }

        // Create notification for tutor
        if (tutorId) {
          await db.createInAppNotification({
            userId: tutorId,
            title: 'Session Series Cancelled',
            message: `${parent?.name || 'A parent'} cancelled a series of ${seriesSessions.length} ${course?.title || 'sessions'}${input.reason ? `. Reason: ${input.reason}` : ''}`,
            type: 'session_cancelled',
            relatedId: seriesSessions[0]?.session?.id || null,
          });
        }

        return { success: true, canceledCount: seriesSessions.length };
      }),

    quickBookRecurring: parentProcedure
      .input(z.object({
        subscriptionId: z.number().optional(), // Use existing subscription if provided
        courseId: z.number(),
        tutorId: z.number(),
        sessions: z.array(z.object({
          scheduledAt: z.number(), // Unix timestamp in milliseconds
        })),
        duration: z.number().min(15).max(480),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!bookingRateLimiter.check(String(ctx.user.id))) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many booking requests. Please wait a few minutes and try again.' });
        }

        console.log('[quickBookRecurring] Starting with input:', JSON.stringify(input, null, 2));

        // Use provided subscriptionId if available, otherwise find/create one
        let subscriptionId = input.subscriptionId;

        if (!subscriptionId) {
          // Get or create subscription for this course (legacy behavior)
          const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
          subscriptionId = existingSubscriptions.find(s => s.subscription.courseId === input.courseId)?.subscription.id;

          if (!subscriptionId) {
            // Create a new subscription without payment (pending)
            const course = await db.getCourseById(input.courseId);
            if (!course) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
            }

            const newSubscriptionId = await db.createSubscription({
              parentId: ctx.user.id,
              courseId: input.courseId,
              status: 'active',
              startDate: new Date(),
              paymentStatus: 'pending',
              preferredTutorId: input.tutorId,
              paymentPlan: 'full',
              firstInstallmentPaid: false,
              secondInstallmentPaid: false,
            });
            console.log('[quickBookRecurring] Subscription created:', newSubscriptionId);

            if (!newSubscriptionId) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create subscription' });
            }
            subscriptionId = newSubscriptionId;
          }
        }
        
        // Pre-validation: check ALL slots for conflicts before writing anything.
        // This prevents partial state where some sessions are created and others aren't.
        const conflictedSlots: number[] = [];
        for (let i = 0; i < input.sessions.length; i++) {
          const hasConflict = await db.checkSessionConflict(
            input.tutorId,
            input.sessions[i].scheduledAt,
            input.duration,
          );
          if (hasConflict) conflictedSlots.push(i + 1);
        }
        if (conflictedSlots.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Scheduling conflicts on session slots: ${conflictedSlots.join(', ')}. No sessions were created. Please choose different times.`,
          });
        }

        // Create all sessions
        const sessionIds: number[] = [];
        const failedSessions: number[] = [];
        const errorDetails: Record<number, string> = {}; // Track error messages

        for (let i = 0; i < input.sessions.length; i++) {
          const sessionData = input.sessions[i];
          console.log(`[quickBookRecurring] Creating session ${i + 1}/${input.sessions.length}:`, {
            subscriptionId,
            tutorId: input.tutorId,
            parentId: ctx.user.id,
            scheduledAt: sessionData.scheduledAt,
            scheduledAtDate: new Date(sessionData.scheduledAt).toISOString(),
            duration: input.duration,
          });
          try {
            const sessionId = await db.createSession({
              subscriptionId,
              tutorId: input.tutorId,
              parentId: ctx.user.id,
              scheduledAt: sessionData.scheduledAt,
              duration: input.duration,
              notes: input.notes,
            });
            
            if (sessionId) {
              sessionIds.push(sessionId);
            } else {
              failedSessions.push(i + 1);
            }
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            console.error(`[Recurring Booking] Failed to create session ${i + 1}:`, errorMsg);
            console.error(`[Recurring Booking] Session details:`, {
              scheduledAt: new Date(sessionData.scheduledAt).toISOString(),
              tutorId: input.tutorId,
              parentId: ctx.user.id,
              subscriptionId,
              duration: input.duration
            });

            // Store error message
            errorDetails[i + 1] = errorMsg;
            failedSessions.push(i + 1);
          }
        }
        
        // Send confirmation email for the first session (single JOIN query instead of 7 sequential calls)
        if (sessionIds.length > 0) {
          const emailData = await db.getSessionEmailData(sessionIds[0]);
          if (emailData) {
            const { session: firstSession, courseTitle, coursePrice, tutorUser: tutor, parentUser: parent, tutorProfile, parentProfile, subscription } = emailData;
            const sessionDate = new Date(firstSession.scheduledAt);
            const studentName = subscription
              ? [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ').trim()
              : undefined;

            if (tutor.name && parent.name && tutor.email && parent.email) {
              // Build additional sessions list (all sessions after the first)
              const additionalSessionsForParent = sessionIds.slice(1).map(id => {
                const ts = input.sessions[sessionIds.indexOf(id)]?.scheduledAt ?? 0;
                const d = new Date(ts);
                return {
                  date: formatEmailDate(d, parentProfile?.timezone || undefined),
                  time: formatEmailTime(d, parentProfile?.timezone || undefined),
                };
              });
              const additionalSessionsForTutor = sessionIds.slice(1).map(id => {
                const ts = input.sessions[sessionIds.indexOf(id)]?.scheduledAt ?? 0;
                const d = new Date(ts);
                return {
                  date: formatEmailDate(d, tutorProfile?.timezone || undefined),
                  time: formatEmailTime(d, tutorProfile?.timezone || undefined),
                };
              });

              // Send email to parent
              sendBookingConfirmation({
                userEmail: parent.email,
                userName: parent.name,
                userRole: 'parent',
                courseName: courseTitle,
                tutorName: tutor.name,
                studentName: studentName,
                sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
                sessionDuration: `${firstSession.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(coursePrice) * 100),
                additionalSessions: additionalSessionsForParent.length > 0 ? additionalSessionsForParent : undefined,
              }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));

              // Send email to tutor
              sendBookingConfirmation({
                userEmail: tutor.email,
                userName: tutor.name,
                userRole: 'tutor',
                courseName: courseTitle,
                studentName: studentName || parent.name,
                sessionDate: formatEmailDate(sessionDate, tutorProfile?.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, tutorProfile?.timezone || undefined),
                sessionDuration: `${firstSession.duration} minutes`,
                additionalSessions: additionalSessionsForTutor.length > 0 ? additionalSessionsForTutor : undefined,
              }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));

              // Create in-app notification for tutor
              const firstDate = new Date(input.sessions[0].scheduledAt);
              const formattedDate = firstDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const formattedTime = firstDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });

              await db.createInAppNotification({
                userId: input.tutorId,
                title: 'New Session Booking',
                message: `${parent.name} booked ${sessionIds.length} ${courseTitle} session${sessionIds.length > 1 ? 's' : ''}. First session: ${formattedDate} at ${formattedTime}`,
                type: 'new_booking',
                relatedId: sessionIds[0],
              });
            }
          }
        }
        
        return { 
          sessionIds, 
          subscriptionId,
          totalBooked: sessionIds.length,
          totalFailed: failedSessions.length,
          failedSessions,
        };
      }),

    quickBook: parentProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
        scheduledAt: z.number(), // Unix timestamp in milliseconds
        duration: z.number().min(15).max(480),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!bookingRateLimiter.check(String(ctx.user.id))) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many booking requests. Please wait a few minutes and try again.' });
        }

        // Get or create subscription for this course
        const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
        let subscriptionId = existingSubscriptions.find(s => s.subscription.courseId === input.courseId)?.subscription.id;
        
        if (!subscriptionId) {
          // Create a new subscription without payment (pending)
          const course = await db.getCourseById(input.courseId);
          if (!course) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
          }
          
          // @ts-expect-error Drizzle type mismatch: schema allows null but Insert expects undefined
          subscriptionId = await db.createSubscription({
            parentId: ctx.user.id,
            courseId: input.courseId,
            status: 'active',
            startDate: new Date(),
            paymentStatus: 'pending',
            preferredTutorId: input.tutorId,
          });
          
          if (!subscriptionId) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create subscription' });
          }
        }
        
        // Create the session
        const sessionId = await db.createSession({
          subscriptionId,
          tutorId: input.tutorId,
          parentId: ctx.user.id,
          scheduledAt: input.scheduledAt,
          duration: input.duration,
          notes: input.notes,
        });
        
        if (!sessionId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session' });
        }
        
        // Get all email data in a single JOIN query
        const emailData = await db.getSessionEmailData(sessionId);
        if (emailData) {
          const { session, courseTitle, coursePrice, tutorUser: tutor, parentUser: parent, tutorProfile, parentProfile, subscription } = emailData;
          const sessionDate = new Date(session.scheduledAt);
          const studentName = subscription
            ? [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ').trim()
            : undefined;

          if (tutor.name && parent.name && tutor.email && parent.email) {
            // Send email to parent
            sendBookingConfirmation({
              userEmail: parent.email,
              userName: parent.name,
              userRole: 'parent',
              courseName: courseTitle,
              tutorName: tutor.name,
              studentName: studentName,
              sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
              sessionDuration: `${session.duration} minutes`,
              sessionPrice: formatEmailPrice(parseInt(coursePrice) * 100),
            }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));

            // Send email to tutor
            sendBookingConfirmation({
              userEmail: tutor.email,
              userName: tutor.name,
              userRole: 'tutor',
              courseName: courseTitle,
              studentName: studentName || parent.name,
              sessionDate: formatEmailDate(sessionDate, tutorProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, tutorProfile?.timezone || undefined),
              sessionDuration: `${session.duration} minutes`,
            }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));

            // Create in-app notification for tutor
            const formattedDate = sessionDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const formattedTime = sessionDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });

            await db.createInAppNotification({
              userId: session.tutorId,
              title: 'New Session Booking',
              message: `${parent.name} booked a ${courseTitle} session for ${formattedDate} at ${formattedTime}`,
              type: 'new_booking',
              relatedId: sessionId,
            });
          }
        }

        return { sessionId, subscriptionId };
      }),

    create: protectedProcedure
      .input(z.object({
        subscriptionId: z.number(),
        tutorId: z.number(),
        parentId: z.number(),
        scheduledAt: z.number(), // Unix timestamp in milliseconds
        duration: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify authorization
        if (input.parentId !== ctx.user.id && input.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        const now = Date.now();
        if (input.scheduledAt <= now) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot schedule a session in the past' });
        }

        try {
          // Check for an existing cancelled session at the same tutor+time slot.
          // The DB has a unique constraint on (tutorId, scheduledAt), so re-booking
          // a previously cancelled slot must update the existing row instead of inserting.
          let id: number;
          const existing = await db.getSessionByTutorAndTime(input.tutorId, input.scheduledAt);
          if (existing) {
            if (existing.status !== 'cancelled') {
              throw new TRPCError({ code: 'CONFLICT', message: 'That time slot is already booked' });
            }
            await db.updateSession(existing.id, {
              subscriptionId: input.subscriptionId,
              parentId: input.parentId,
              duration: input.duration,
              status: 'scheduled',
              notes: input.notes ?? null,
              feedbackFromTutor: null,
              feedbackFromParent: null,
              rating: null,
            });
            id = existing.id;
          } else {
            id = await db.createSession(input) as number;
          }
          if (!id) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session' });
          }
          
          // Get session details for email
          const session = await db.getSessionById(id);
          if (session) {
            const sessionDate = new Date(session.scheduledAt);
            const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
            const course = subscription ? await db.getCourseById(subscription.courseId) : null;
            const tutor = await db.getUserById(session.tutorId);
            const parent = await db.getUserById(session.parentId);

            // Get tutor profile for timezone
            const tutorProfile = await db.getTutorProfileByUserId(session.tutorId);

            // Get parent profile for timezone
            const parentProfile = await db.getParentProfileByUserId(session.parentId);

            // Get student name from subscription
            const studentName = subscription
              ? [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ').trim()
              : undefined;

            if (course && tutor && parent && tutor.name && parent.name && tutor.email && parent.email) {
              // Send email to parent
              sendBookingConfirmation({
                userEmail: parent.email,
                userName: parent.name,
                userRole: 'parent',
                courseName: course.title,
                tutorName: tutor.name,
                studentName: studentName,
                sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
                sessionDuration: `${session.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
              }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));

              // Send email to tutor
              sendBookingConfirmation({
                userEmail: tutor.email,
                userName: tutor.name,
                userRole: 'tutor',
                courseName: course.title,
                studentName: studentName || parent.name,
                sessionDate: formatEmailDate(sessionDate, tutorProfile?.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, tutorProfile?.timezone || undefined),
                sessionDuration: `${session.duration} minutes`,
              }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));

              // Create in-app notification for tutor
              const formattedDate = sessionDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const formattedTime = sessionDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });

              await db.createInAppNotification({
                userId: session.tutorId,
                title: 'New Session Booking',
                message: `${parent.name} booked a ${course.title} session for ${formattedDate} at ${formattedTime}`,
                type: 'new_booking',
                relatedId: id,
              });
            }
          }

          return { id };
        } catch (error: any) {
          if (error?.message === "SESSION_CONFLICT") {
            throw new TRPCError({ code: 'CONFLICT', message: 'Time slot is already booked' });
          }
          throw error;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        scheduledAt: z.number().optional(),
        duration: z.number().optional(),
        status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
        notes: z.string().optional(),
        feedbackFromTutor: z.string().optional(),
        feedbackFromParent: z.string().optional(),
        rating: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;

        const session = await db.getSessionById(id);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        // Verify authorization
        if (session.parentId !== ctx.user.id && session.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        const success = await db.updateSession(id, updates);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update session' });
        }

        // Send session notes email + in-app notification when tutor saves notes on a completed session
        const isFirstTimeNotes = input.feedbackFromTutor && !session.feedbackFromTutor;
        const isNotesUpdate = input.feedbackFromTutor !== undefined &&
          ctx.user.role === 'tutor' &&
          (input.status === 'completed' || (!input.status && session.status === 'completed'));

        if (isNotesUpdate) {
          try {
            const parent = await db.getUserById(session.parentId);
            const tutor = await db.getUserById(session.tutorId);

            if (parent?.email && tutor) {
              const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
              const parentProfile = await db.getParentProfileByUserId(parent.id);
              const sessionDate = new Date(session.scheduledAt);

              const studentName = subscription
                ? [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ').trim() || 'your child'
                : 'your child';

              let courseName = 'the course';
              if (session.courseId) {
                const course = await db.getCourseById(session.courseId);
                if (course?.title) courseName = course.title;
              } else if (subscription) {
                const course = await db.getCourseById(subscription.courseId);
                if (course?.title) courseName = course.title;
              }

              // Send email only on first save
              if (isFirstTimeNotes) {
                const emailHtml = await sendSessionNotesEmail({
                  parentName: parent.name || parent.email,
                  studentName,
                  tutorName: tutor.name || `${(tutor as any).firstName || ''} ${(tutor as any).lastName || ''}`.trim() || 'Your tutor',
                  courseName,
                  sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
                  sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
                  progressSummary: input.feedbackFromTutor || "",
                  notesUrl: `${process.env.VITE_FRONTEND_FORGE_API_URL || ''}/session-notes`,
                });

                await emailService.sendEmail({
                  to: parent.email,
                  subject: `Session Notes for ${studentName} — ${courseName}`,
                  html: emailHtml,
                });

                console.log('[Session Notes Email] Sent to parent:', parent.email);
              }

              // Send in-app notification on every save (first time or update)
              const tutorName = `${(tutor as any).firstName || ''} ${(tutor as any).lastName || ''}`.trim() || tutor.name || 'Your tutor';
              await db.createInAppNotification({
                userId: session.parentId,
                title: 'Session Notes Updated',
                message: `${tutorName} has ${isFirstTimeNotes ? 'added' : 'updated'} session notes for ${studentName} — ${courseName}`,
                type: 'session_reminder',
                relatedId: session.id,
              });
            }
          } catch (emailError) {
            console.error('[Session Notes] Failed to send notification:', emailError);
          }
        }

        // Send email notification to parent if session is marked as no-show
        if (input.status === 'no_show') {
          try {
            // Get detailed session information
            const parent = await db.getUserById(session.parentId);
            const tutor = await db.getUserById(session.tutorId);
            const subscription = session.subscriptionId ? await db.getSubscriptionById(session.subscriptionId) : null;
            const course = subscription ? await db.getCourseById(subscription.courseId) : null;

            if (parent?.email && parent?.name && tutor?.name && course?.title) {
              const studentName = subscription
                ? [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(' ').trim() || 'Student'
                : 'Student';

              const sessionDate = new Date(session.scheduledAt);

              await sendNoShowNotification({
                parentEmail: parent.email,
                parentName: parent.name,
                studentName,
                courseName: course.title,
                tutorName: tutor.name,
                sessionDate: formatEmailDate(sessionDate, tutor.timezone || undefined),
                sessionTime: formatEmailTime(sessionDate, tutor.timezone || undefined),
                tutorNotes: input.feedbackFromTutor,
              });

              console.log('[No-Show Email] Sent no-show notification to parent:', parent.email);
            }
          } catch (emailError) {
            console.error('[No-Show Email] Failed to send notification:', emailError);
            // Don't fail the mutation if email fails
          }
        }

        return { success: true };
      }),

    // Rate a session
    rateSession: parentProcedure
      .input(z.object({
        sessionId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        // Verify parent owns this session
        if (session.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        // Verify session is completed
        if (session.status !== 'completed' && session.status !== 'no_show') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only rate completed sessions' });
        }

        // Verify session has already passed
        if (session.scheduledAt > Date.now()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session has not started yet' });
        }

        // Check if rating already exists
        const existingRating = await db.getSessionRating(input.sessionId);
        if (existingRating) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Session already rated' });
        }

        // Create rating
        const rating = await db.createSessionRating({
          sessionId: input.sessionId,
          parentId: ctx.user.id,
          tutorId: session.tutorId,
          rating: input.rating,
          comment: input.comment || null,
        });

        return { success: true, rating };
      }),

    // Get rating for a session
    getSessionRating: parentProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }

        // Verify parent owns this session
        if (session.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        const rating = await db.getSessionRating(input.sessionId);
        return rating;
      }),
  }),

  // Messaging
  messaging: router({
    myConversations: protectedProcedure.query(async ({ ctx }) => {
      const role = ctx.user.role === 'tutor' ? 'tutor' : 'parent';
      return await db.getConversationsByUserId(ctx.user.id, role);
    }),

    getOrCreateConversation: protectedProcedure
      .input(z.object({
        parentId: z.number(),
        tutorId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify authorization
        if (input.parentId !== ctx.user.id && input.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        let conversation = await db.getConversationByParticipants(input.parentId, input.tutorId);
        
        if (!conversation) {
          conversation = await db.createOrGetTutorInquiryConversation(input.parentId, input.tutorId);
          if (!conversation) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
          }
        }

        return conversation;
      }),

    getMessages: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Verify user is part of conversation or is coordinator for the parent
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        }

        // Check authorization based on conversation type
        let isAuthorized = false;
        const isAdmin = ctx.user.role === 'admin';

        if (conversation.conversationType === 'parent_coordinator') {
          // For parent-coordinator conversations, only parent and coordinator can view
          isAuthorized = conversation.parentId === ctx.user.id || conversation.coordinatorId === ctx.user.id || isAdmin;
        } else {
          // For parent-tutor conversations
          const isParticipant = conversation.parentId === ctx.user.id || conversation.tutorId === ctx.user.id;

          // Check if user is coordinator for this parent (read-only access)
          let isCoordinator = false;
          if (ctx.user.role === 'coordinator') {
            const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
            isCoordinator = assignments.some(a => a.parentId === conversation.parentId);
          }

          isAuthorized = isParticipant || isAdmin || isCoordinator;
        }

        if (!isAuthorized) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to view this conversation' });
        }

        return await db.getMessagesByConversationId(input.conversationId, input.limit);
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileType: z.string().optional(),
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user is part of conversation
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        }

        // Check authorization based on conversation type
        const isParentTutorChat =
          conversation.conversationType === 'parent_tutor' ||
          conversation.conversationType === 'parent_tutor_inquiry';
        const isParentCoordinatorChat = conversation.conversationType === 'parent_coordinator';

        if (isParentTutorChat) {
          // For parent-tutor chats, coordinators have read-only access
          if (ctx.user.role === 'coordinator') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Coordinators have read-only access to parent-tutor conversations' });
          }
          const isParticipant = conversation.parentId === ctx.user.id || conversation.tutorId === ctx.user.id;
          const isAdmin = ctx.user.role === 'admin';
          if (!isParticipant && !isAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to send messages in this conversation' });
          }
        } else if (isParentCoordinatorChat) {
          // For parent-coordinator chats, both can send messages
          const isParticipant = conversation.parentId === ctx.user.id || conversation.coordinatorId === ctx.user.id;
          const isAdmin = ctx.user.role === 'admin';
          if (!isParticipant && !isAdmin) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to send messages in this conversation' });
          }
        } else {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid conversation type' });
        }

        const id = await db.createMessage({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          content: input.content,
          sentAt: Date.now(),
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
        });
        // If insert succeeded but no id returned, continue without throwing to avoid 500
        if (!id) {
          console.warn("[sendMessage] message inserted but no id returned for conversation", input.conversationId);
        }

        // In-app notification to the other participant
        let recipientId: number | null = null;
        if (conversation.conversationType === 'parent_coordinator') {
          // For parent-coordinator chat, recipient is either parent or coordinator
          recipientId = conversation.parentId === ctx.user.id ? conversation.coordinatorId : conversation.parentId;
        } else {
          // For parent-tutor chat
          recipientId = conversation.parentId === ctx.user.id ? conversation.tutorId : conversation.parentId;
        }

        if (recipientId) {
          const senderName = ctx.user.name || (ctx.user.role === 'parent' ? 'Parent' : ctx.user.role === 'coordinator' ? 'Coordinator' : 'Tutor');
          const studentInfo = conversation.studentId
            ? await db.getSubscriptionById(conversation.studentId).catch(() => null)
            : null;
          const studentName = studentInfo
            ? [studentInfo.studentFirstName, studentInfo.studentLastName].filter(Boolean).join(" ").trim()
            : undefined;

          await db.createInAppNotification({
            userId: recipientId,
            title: "New message",
            message: studentName
              ? `${senderName} messaged you about ${studentName}`
              : `${senderName} sent you a message`,
            type: "message",
            relatedId: conversation.id,
          });
        }

        return { id };
      }),

    markAsRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.markMessagesAsRead(input.conversationId, ctx.user.id);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark messages as read' });
        }
        return { success: true };
      }),

    // File Upload
    uploadFile: protectedProcedure
      .input(z.object({
        file: z.string(), // base64 encoded file
        fileName: z.string(),
        fileType: z.enum([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ]),
      }))
      .mutation(async ({ input }) => {
        // Validate file size (10MB limit)
        const buffer = Buffer.from(input.file, 'base64');
        const fileSize = buffer.length;
        if (fileSize > 10 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds 10MB limit' });
        }

        // Upload to S3 (falls back to local disk in dev)
        const { uploadMessageFileToS3 } = await import('./s3Storage');
        const { url } = await uploadMessageFileToS3(buffer, input.fileType, input.fileName);

        return {
          fileUrl: url,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize,
        };
      }),

    // Student-Tutor Messaging
    getStudentsWithTutors: parentProcedure.query(async ({ ctx }) => {
      return await db.getStudentsWithTutors(ctx.user.id);
    }),

    getParentTutorInquiryConversations: parentProcedure.query(async ({ ctx }) => {
      return await db.getParentTutorInquiryConversations(ctx.user.id);
    }),

    getTutorConversations: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorConversationsWithDetails(ctx.user.id);
    }),

    getCoordinatorParents: coordinatorProcedure.query(async ({ ctx }) => {
      // Get all assigned parents for this coordinator
      const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);

      // For each parent, get their students with tutors
      const parentsWithStudents = await Promise.all(
        assignments.map(async (assignment) => {
          const studentData = await db.getStudentsWithTutors(assignment.parentId);
          return {
            parent: assignment.parent,
            parentProfile: assignment.parentProfile,
            students: (studentData as any)?.students || [],
            coordinator: (studentData as any)?.coordinator,
          };
        })
      );

      return parentsWithStudents;
    }),

    getCoordinatorConversations: coordinatorProcedure.query(async ({ ctx }) => {
      // Get flat list of all conversations for assigned families
      return await db.getCoordinatorConversations(ctx.user.id);
    }),

    getUnreadMessageCount: protectedProcedure.query(async ({ ctx }) => {
      const count = await db.getUnreadMessageCount(ctx.user.id);
      return { count };
    }),

    // Parent-Coordinator Messaging
    getOrCreateCoordinatorConversation: protectedProcedure.mutation(async ({ ctx }) => {
      // Only parents can initiate coordinator conversations
      if (ctx.user.role !== 'parent') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only parents can message coordinators' });
      }

      // Get parent's assigned coordinator
      const assignments = await db.getCoordinatorAssignmentsByParent(ctx.user.id);
      if (!assignments || assignments.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No coordinator assigned to you yet' });
      }

      const coordinatorId = assignments[0].coordinatorId;

      const conversation = await db.createOrGetParentCoordinatorConversation(ctx.user.id, coordinatorId);
      if (!conversation) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
      }

      return conversation;
    }),

    getCoordinatorParentConversations: coordinatorProcedure.query(async ({ ctx }) => {
      // Get all parent-coordinator conversations for this coordinator
      return await db.getCoordinatorParentConversations(ctx.user.id);
    }),

    getParentCoordinatorConversation: parentProcedure.query(async ({ ctx }) => {
      // Get parent's coordinator conversation with unread count
      return await db.getParentCoordinatorConversation(ctx.user.id);
    }),

    getOrCreateTutorInquiryConversation: parentProcedure
      .input(z.object({
        tutorId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.tutorId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot message yourself' });
        }

        const tutorProfile = await db.getTutorProfileByUserId(input.tutorId);
        if (!tutorProfile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor not found' });
        }

        const conversation = await db.createOrGetTutorInquiryConversation(ctx.user.id, input.tutorId);
        if (!conversation) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
        }

        return conversation;
      }),

    getOrCreateStudentConversation: protectedProcedure
      .input(z.object({
        parentId: z.number(),
        tutorId: z.number(),
        studentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify authorization - allow parent, tutor, admin, or coordinator
        const isParticipant = input.parentId === ctx.user.id || input.tutorId === ctx.user.id;
        const isAdmin = ctx.user.role === 'admin';

        // Check if user is coordinator for this parent
        let isCoordinator = false;
        if (ctx.user.role === 'coordinator') {
          const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
          isCoordinator = assignments.some(a => a.parentId === input.parentId);
        }

        if (!isParticipant && !isAdmin && !isCoordinator) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        try {
          const conversation = await db.createOrGetStudentConversation(
            input.parentId,
            input.tutorId,
            input.studentId
          );
          
          if (!conversation) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
          }

          return conversation;
        } catch (error) {
          console.error("[getOrCreateStudentConversation] failed:", error);
          // Final fallback: try to fetch if it was created despite error
          const fallback = await db.getConversationByStudentAndTutor(
            input.parentId,
            input.tutorId,
            input.studentId
          );
          if (fallback) return fallback;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
        }
      }),
  }),

  // Payment & Earnings
  payment: router({
    getPaymentHistory: parentProcedure
      .query(async ({ ctx }) => {
        const { listStripeInvoicesForCustomer } = await import("./stripe");

        // Fetch enriched payments from local DB (single query with joins)
        const localPayments = await db.getParentPayments(ctx.user.id);

        // Optionally enrich with Stripe invoice PDF URLs
        const parentUser = await db.getUserById(ctx.user.id);
        const stripeInvoiceMap: Record<string, string> = {};

        if (parentUser?.stripeCustomerId) {
          try {
            const invoices = await listStripeInvoicesForCustomer(parentUser.stripeCustomerId);
            for (const inv of invoices) {
              if (inv.id && inv.invoice_pdf) {
                stripeInvoiceMap[inv.id] = inv.invoice_pdf;
              }
            }
          } catch (err) {
            console.error("[getPaymentHistory] Stripe invoice fetch failed (non-fatal):", err);
          }
        }

        return localPayments.map(p => ({
          ...p,
          invoicePdfUrl: p.stripeInvoiceId ? (stripeInvoiceMap[p.stripeInvoiceId] ?? null) : null,
        }));
      }),

    getStripeInvoices: parentProcedure
      .query(async ({ ctx }) => {
        const parentUser = await db.getUserById(ctx.user.id);
        const results: Array<{
          id: string;
          number: string | null;
          status: string;
          amountPaid: number;
          amountDue: number;
          currency: string;
          periodStart: number;
          periodEnd: number;
          created: number;
          issuedDate: string;
          dueDate: string | null;
          paidAt: string | null;
          hostedInvoiceUrl: string | null;
          invoicePdf: string | null;
          source: "stripe" | "local";
          stripeSubscriptionId: string | null;
          studentName: string | null;
          courseTitle: string | null;
          paymentNumber: number | null;
          totalPayments: number | null;
          lines: Array<{
            id: string;
            description: string | null;
            amount: number;
            currency: string;
            studentName?: string | null;
            courseTitle?: string | null;
            paymentNumber?: number | null;
            totalPayments?: number | null;
            sessionCount?: number | null;
            perSessionRateCents?: number | null;
          }>;
        }> = [];

        const fmtET = (ts: number | null | undefined): string | null => {
          if (!ts) return null;
          return new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone: "UTC" });
        };

        // Track which Stripe subscription IDs have at least one real paid invoice (amount > 0)
        const paidStripeSubIds = new Set<string>();

        // Fetch Stripe invoices if customer exists
        if (parentUser?.stripeCustomerId) {
          try {
            const { listStripeInvoicesForCustomer } = await import("./stripe");
            const invoices = await listStripeInvoicesForCustomer(parentUser.stripeCustomerId);

            // Helper to extract subscription ID from new Invoice parent structure
            const getInvSubId = (inv: any): string | null => {
              const sub = (inv.parent as any)?.subscription_details?.subscription;
              return typeof sub === "string" ? sub : sub?.id ?? null;
            };

            // Group invoice created timestamps per Stripe subscription for payment number.
            // Only count non-$0 invoices so trial confirmation invoices don't inflate the count.
            const subInvoiceMap: Record<string, number[]> = {};
            for (const inv of invoices) {
              if (inv.status === "paid" && inv.amount_paid === 0) continue; // skip $0 trial invoices
              const subId = getInvSubId(inv);
              if (subId) {
                if (!subInvoiceMap[subId]) subInvoiceMap[subId] = [];
                subInvoiceMap[subId].push(inv.created);
              }
            }
            for (const subId of Object.keys(subInvoiceMap)) {
              subInvoiceMap[subId].sort((a, b) => a - b);
            }

            for (const inv of invoices) {
              // Skip $0 trial invoices — they're noise (card setup confirmation)
              if (inv.status === "paid" && inv.amount_paid === 0) continue;

              const stripeSubId = getInvSubId(inv);

              // Track subscriptions that have real paid invoices
              if (stripeSubId && inv.status === "paid" && inv.amount_paid > 0) {
                paidStripeSubIds.add(stripeSubId);
              }

              const lineItems = inv.lines?.data ?? [];

              // Build enriched line items by matching each to a local subscription via stripeItemId
              const enrichedLines: Array<{
                id: string;
                description: string | null;
                amount: number;
                currency: string;
                studentName: string | null;
                courseTitle: string | null;
                paymentNumber: number | null;
                totalPayments: number | null;
              }> = [];

              for (const line of lineItems) {
                const stripeItemId = (line.parent as any)?.subscription_item_details?.subscription_item as string | null;
                let lineStudentName: string | null = null;
                let lineCourseTitle: string | null = null;
                let linePaymentNumber: number | null = null;
                let lineTotalPayments: number | null = null;

                if (stripeItemId) {
                  const localSub = await db.getSubscriptionByStripeItemId(stripeItemId);
                  if (localSub) {
                    lineStudentName = [localSub.studentFirstName, localSub.studentLastName].filter(Boolean).join(" ") || null;
                    const course = await db.getCourseById(localSub.courseId);
                    if (course) {
                      lineCourseTitle = course.title;
                      if (localSub.paymentPlan === "installment") {
                        // Installment: show "Installment X of 3"
                        lineTotalPayments = localSub.numberOfInstallments ?? 3;
                      } else if (localSub.paymentPlan === "monthly") {
                        // Usage-based monthly: billed via standalone invoices, not subscription invoices.
                        // Don't show payment number/total on the subscription invoice line.
                        lineTotalPayments = null;
                        linePaymentNumber = null;
                      } else {
                        // Full pay or legacy monthly: session-based formula
                        const totalSessions = course.totalSessions || 1;
                        const sessionsPerWeek = course.sessionsPerWeek || 1;
                        const sessionsPerMonth = sessionsPerWeek * 4;
                        lineTotalPayments = Math.max(1, Math.ceil(totalSessions / sessionsPerMonth));
                      }
                    }
                  }
                }

                // Fallback for standalone cron invoices — no subscription_item, use line metadata
                if (!lineStudentName && !lineCourseTitle) {
                  const meta = (line as any).metadata ?? {};
                  const localSubId = meta.local_subscription_id ? parseInt(meta.local_subscription_id) : null;
                  if (localSubId) {
                    const cronSub = await db.getSubscriptionById(localSubId);
                    if (cronSub) {
                      lineStudentName = [cronSub.studentFirstName, cronSub.studentLastName].filter(Boolean).join(" ") || null;
                      const cronCourse = await db.getCourseById(cronSub.courseId);
                      if (cronCourse) lineCourseTitle = cronCourse.title;
                    }
                  }
                }

                if (stripeSubId) {
                  const sortedCreated = subInvoiceMap[stripeSubId] ?? [];
                  const idx = sortedCreated.indexOf(inv.created);
                  linePaymentNumber = idx >= 0 ? idx + 1 : null;
                }

                enrichedLines.push({
                  id: line.id,
                  description: line.description ?? null,
                  amount: line.amount,
                  currency: line.currency,
                  studentName: lineStudentName,
                  courseTitle: lineCourseTitle,
                  paymentNumber: linePaymentNumber,
                  totalPayments: lineTotalPayments,
                });
              }

              // For the invoice header, use data from first line item (or aggregate)
              const firstLine = enrichedLines[0] ?? null;
              const multiCourse = enrichedLines.length > 1;

              results.push({
                id: inv.id,
                number: inv.number ?? null,
                status: inv.status ?? "unknown",
                amountPaid: inv.amount_paid,
                amountDue: inv.amount_due,
                currency: inv.currency,
                periodStart: inv.period_start,
                periodEnd: inv.period_end,
                created: inv.created,
                issuedDate: fmtET(inv.created)!,
                dueDate: fmtET(inv.due_date ?? null),
                paidAt: fmtET((inv.status_transitions as any)?.paid_at ?? null),
                hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
                invoicePdf: inv.invoice_pdf ?? null,
                source: "stripe",
                stripeSubscriptionId: stripeSubId ?? null,
                studentName: multiCourse ? null : (firstLine?.studentName ?? null),
                courseTitle: multiCourse ? null : (firstLine?.courseTitle ?? null),
                paymentNumber: multiCourse ? null : (firstLine?.paymentNumber ?? null),
                totalPayments: multiCourse ? null : (firstLine?.totalPayments ?? null),
                lines: enrichedLines,
              });
            }
          } catch (err) {
            console.error("[getStripeInvoices] Failed to fetch Stripe invoices:", err);
          }
        }

        // Add upcoming invoice entries for active monthly subscriptions
        // so parents can see what's coming before real invoices are generated
        if (parentUser?.stripeCustomerId) {
          try {
            const { getStripe } = await import("./stripe");
            const stripe = getStripe();
            const activeSubs = await db.getSubscriptionsByParentId(ctx.user.id);
            const monthlyActive = activeSubs.filter((s: any) =>
              (s.subscription.paymentPlan === "monthly" || s.subscription.paymentPlan === "installment") &&
              s.subscription.paymentStatus === "paid" &&
              s.subscription.stripeSubscriptionId
            );

            const seenStripeSubIds = new Set<string>();
            for (const sub of monthlyActive) {
              const stripeSubId = sub.subscription.stripeSubscriptionId!;
              if (seenStripeSubIds.has(stripeSubId)) continue;
              seenStripeSubIds.add(stripeSubId);

              try {
                const stripeSub = await stripe.subscriptions.retrieve(stripeSubId) as any;
                // current_period_end moved to items in newer Stripe API versions
                const currentPeriodEnd = stripeSub.current_period_end
                  ?? stripeSub.items?.data?.[0]?.current_period_end
                  ?? stripeSub.billing_cycle_anchor;
                // For trialing subs the first charge is at trial_end; for active subs use current_period_end
                const nextBillingTs = stripeSub.status === "trialing"
                  ? (stripeSub.trial_end ?? currentPeriodEnd)
                  : currentPeriodEnd;
                console.log(`[getStripeInvoices] stripeSub ${stripeSubId}: status=${stripeSub.status}, nextBillingTs=${nextBillingTs}, item_period_end=${stripeSub.items?.data?.[0]?.current_period_end}, cancel_at=${stripeSub.cancel_at}`);
                if (!nextBillingTs) continue;

                // Skip if the subscription is cancelled/incomplete
                if (["canceled", "incomplete", "incomplete_expired", "past_due", "unpaid"].includes(stripeSub.status)) continue;

                // Gather all local subscriptions sharing this stripe sub
                const sharedSubs = monthlyActive.filter(
                  (s: any) => s.subscription.stripeSubscriptionId === stripeSubId
                );

                const lines = sharedSubs.map((s: any) => {
                  const item = stripeSub.items.data.find(
                    (i: any) => i.id === s.subscription.stripeItemId
                  ) ?? stripeSub.items.data[0];
                  const amount = item?.price?.unit_amount ?? 0;
                  const studentName = [s.subscription.studentFirstName, s.subscription.studentLastName]
                    .filter(Boolean).join(" ") || null;
                  const isInstallment = s.subscription.paymentPlan === "installment";
                  const totalPayments = isInstallment
                    ? (s.subscription.numberOfInstallments ?? 3)
                    : (() => {
                        const totalSessions = s.course?.totalSessions || 1;
                        const sessionsPerWeek = s.course?.sessionsPerWeek || 1;
                        return Math.max(1, Math.ceil(totalSessions / (sessionsPerWeek * 4)));
                      })();
                  // Count how many invoices already paid for this stripe subscription
                  const paidCount = results.filter((r: any) =>
                    r.source === "stripe" && r.status === "paid" && r.stripeSubscriptionId === stripeSubId
                  ).length;
                  return {
                    id: `upcoming_line_${s.subscription.id}`,
                    description: s.course?.title ?? null,
                    amount,
                    currency: item?.price?.currency ?? "usd",
                    studentName,
                    courseTitle: s.course?.title ?? null,
                    paymentNumber: paidCount + 1,
                    totalPayments,
                  };
                });

                const totalAmountCents = lines.reduce((sum: number, l: any) => sum + l.amount, 0);
                const currency = lines[0]?.currency ?? "usd";
                const multiCourse = lines.length > 1;

                results.push({
                  id: `upcoming_${stripeSubId}`,
                  number: null,
                  status: "upcoming",
                  amountPaid: 0,
                  amountDue: totalAmountCents,
                  currency,
                  periodStart: nextBillingTs,
                  periodEnd: nextBillingTs,
                  created: nextBillingTs,
                  issuedDate: fmtET(nextBillingTs)!,
                  dueDate: fmtET(nextBillingTs),
                  paidAt: null,
                  hostedInvoiceUrl: null,
                  invoicePdf: null,
                  source: "stripe",
                  stripeSubscriptionId: stripeSubId ?? null,
                  studentName: multiCourse ? null : (lines[0]?.studentName ?? null),
                  courseTitle: multiCourse ? null : (lines[0]?.courseTitle ?? null),
                  paymentNumber: multiCourse ? null : (lines[0]?.paymentNumber ?? null),
                  totalPayments: multiCourse ? null : lines[0]?.totalPayments ?? null,
                  lines,
                });
              } catch (err) {
                console.error(`[getStripeInvoices] Failed to build upcoming entry for sub ${stripeSubId}:`, err);
              }
            }
          } catch (err) {
            console.error("[getStripeInvoices] Failed to build upcoming invoices:", err);
          }
        }

        // Usage-based (tutor/homework) upcoming cycle is shown via CurrentCycleCard on the frontend.
        // No duplicate entry needed here.

        // Also include local payment records that have no Stripe invoice
        // (pay-in-full via Stripe Checkout, or legacy payments)
        const localPayments = await db.getParentPayments(ctx.user.id);
        const stripeInvoiceIds = new Set(results.map(r => r.id));

        for (const p of localPayments) {
          // Skip if already covered by a Stripe invoice
          if (p.stripeInvoiceId && stripeInvoiceIds.has(p.stripeInvoiceId)) continue;
          if (p.status !== "completed") continue;
          // Skip $0 records — these are card-setup confirmations, not real payments
          if (!p.amount || parseFloat(p.amount) === 0) continue;

          const createdAtMs = p.createdAt ? new Date(p.createdAt).getTime() : Date.now();
          const createdTs = Math.floor(createdAtMs / 1000);
          const studentName = [p.studentFirstName, p.studentLastName].filter(Boolean).join(" ");
          const description = [studentName, p.courseTitle].filter(Boolean).join(" — ") || "Course payment";

          results.push({
            id: `local_${p.id}`,
            number: null,
            status: "paid",
            amountPaid: Math.round(parseFloat(p.amount) * 100),
            amountDue: 0,
            currency: p.currency || "usd",
            periodStart: createdTs,
            periodEnd: createdTs,
            created: createdTs,
            issuedDate: fmtET(createdTs)!,
            dueDate: null,
            paidAt: fmtET(createdTs),
            hostedInvoiceUrl: null,
            invoicePdf: null,
            source: "local",
            stripeSubscriptionId: null,
            studentName: studentName || null,
            courseTitle: p.courseTitle || null,
            paymentNumber: null,
            totalPayments: null,
            lines: [{
              id: `local_line_${p.id}`,
              description,
              amount: Math.round(parseFloat(p.amount) * 100),
              currency: p.currency || "usd",
            }],
          });
        }

        // Sort by created date descending
        results.sort((a, b) => b.created - a.created);
        return results;
      }),

    getCurrentCycleUsage: parentProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.subscriptionId);
        if (!sub || sub.parentId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
        }
        if (!sub.billingCycleStart || !sub.billingCycleEnd) {
          return null;
        }
        const cycleStart = new Date(sub.billingCycleStart);
        const cycleEnd = new Date(sub.billingCycleEnd);
        const sessionsCount = await db.countCompletedSessionsInWindow(sub.id, cycleStart, cycleEnd);
        const perSessionRateCents = sub.perSessionRateCents ?? 0;
        return {
          sessionsCount,
          amountCents: sessionsCount * perSessionRateCents,
          cycleStart: cycleStart.toISOString(),
          cycleEnd: cycleEnd.toISOString(),
          perSessionRateCents,
        };
      }),

    createCheckout: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        subscriptionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        }

        const { createCheckoutSession } = await import("./stripe");
        const session = await createCheckoutSession({
          priceAmount: parseFloat(course.price),
          courseName: course.title,
          courseId: course.id,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          origin: `${ctx.req.protocol}://${ctx.req.get("host")}`,
          subscriptionId: input.subscriptionId,
        });

        return { checkoutUrl: session.url };
      }),

    myPayments: parentProcedure.query(async ({ ctx }) => {
      return await db.getPaymentsByParentId(ctx.user.id);
    }),

    myEarnings: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorEarnings(ctx.user.id);
    }),

    myEarningsHistory: tutorProcedure.query(async ({ ctx }) => {
      return await db.getPaymentsByTutorId(ctx.user.id);
    }),

    getCompletedEnrollments: tutorProcedure.query(async ({ ctx }) => {
      return await db.getCompletedEnrollmentsForTutor(ctx.user.id);
    }),

    getMyPayoutRequests: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorPayoutRequestsByTutorId(ctx.user.id);
    }),

    requestPayout: tutorProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Fetch subscription + course + tutor profile
        const enrollments = await db.getCompletedEnrollmentsForTutor(ctx.user.id);
        const enrollment = enrollments.find(e => e.subscriptionId === input.subscriptionId);
        if (!enrollment) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enrollment not found or not eligible for payout' });
        }
        const hourlyRate = parseFloat(enrollment.tutorHourlyRate ?? "0");
        const durationHours = (enrollment.courseDuration ?? 60) / 60;
        const ratePerSession = hourlyRate * durationHours;
        const totalAmount = ratePerSession * (enrollment.sessionsCompleted ?? 0);
        const id = await db.createTutorPayoutRequest({
          tutorId: ctx.user.id,
          subscriptionId: input.subscriptionId,
          sessionsCompleted: enrollment.sessionsCompleted ?? 0,
          ratePerSession: ratePerSession.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          status: 'pending',
        });
        return { id };
      }),

    create: protectedProcedure
      .input(z.object({
        parentId: z.number(),
        tutorId: z.number(),
        subscriptionId: z.number().optional(),
        sessionId: z.number().optional(),
        amount: z.string(),
        paymentType: z.enum(['subscription', 'session']),
        stripePaymentIntentId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Prevent subscription payments without a subscription link
        if (input.paymentType === 'subscription' && !input.subscriptionId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'subscriptionId is required for subscription payments' });
        }

        const id = await db.createPayment({
          ...input,
          status: 'pending',
        });
        if (!id) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create payment' });
        }
        return { id };
      }),
  }),

  // Trial Lesson Booking
  trialLesson: router({
    // Check if parent is eligible to book trial lessons
    checkEligibility: parentProcedure
      .input(z.object({
        courseId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        // Count existing trial sessions for this parent
        const trialSessions = await db.getTrialSessionsByParentId(ctx.user.id);
        const trialCount = trialSessions.length;
        const hasReachedLimit = trialCount >= 2;

        return {
          eligible: !hasReachedLimit,
          trialsUsed: trialCount,
          trialsRemaining: Math.max(0, 2 - trialCount),
        };
      }),

    // Create Stripe checkout session for trial lesson ($1 charge)
    createCheckoutSession: parentProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
        scheduledAt: z.number(),
        duration: z.number().min(15).max(480).default(60),
        studentFirstName: z.string().min(1),
        studentLastName: z.string().min(1),
        studentGrade: z.string().optional(),
        origin: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });
        const origin = input.origin ?? `${ctx.req.protocol}://${ctx.req.get('host')}`;

        // Verify eligibility
        const trialSessions = await db.getTrialSessionsByParentId(ctx.user.id);
        if (trialSessions.length >= 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You have already used your 2 trial lessons. Please enroll in the course to continue.',
          });
        }

        // Verify course and tutor exist
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }

        const tutor = await db.getUserById(input.tutorId);
        if (!tutor) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor not found' });
        }

        // Create Stripe checkout session for $1 trial lesson
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Trial Lesson - ${course.title}`,
                  description: `60-minute trial lesson with ${tutor.name} | Student: ${input.studentFirstName} ${input.studentLastName}`,
                },
                unit_amount: 100, // $1.00 in cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${origin}/parent/dashboard?trial=success`,
          cancel_url: `${origin}/course/${input.courseId}?trial=cancelled`,
          metadata: {
            type: 'trial_lesson',
            courseId: input.courseId.toString(),
            tutorId: input.tutorId.toString(),
            parentId: ctx.user.id.toString(),
            scheduledAt: input.scheduledAt.toString(),
            duration: input.duration.toString(),
            studentFirstName: input.studentFirstName,
            studentLastName: input.studentLastName,
            studentGrade: input.studentGrade || '',
          },
        });

        return { checkoutUrl: session.url };
      }),

    // Book a trial lesson (called after successful Stripe payment)
    book: parentProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
        scheduledAt: z.number(), // Unix timestamp in milliseconds
        duration: z.number().min(15).max(480).default(60),
        studentFirstName: z.string().min(1),
        studentLastName: z.string().min(1),
        studentGrade: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify eligibility
        const trialSessions = await db.getTrialSessionsByParentId(ctx.user.id);
        if (trialSessions.length >= 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You have already used your 2 free trial lessons. Please enroll in the course to continue.',
          });
        }

        // Verify course and tutor exist
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }

        const tutor = await db.getUserById(input.tutorId);
        if (!tutor) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor not found' });
        }

        // Verify scheduled time is in the future
        if (input.scheduledAt <= Date.now()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot schedule sessions in the past' });
        }

        // Create trial session (no subscription required)
        const sessionId = await db.createTrialSession({
          subscriptionId: null,
          tutorId: input.tutorId,
          parentId: ctx.user.id,
          scheduledAt: input.scheduledAt,
          duration: input.duration,
          isTrial: true,
          status: 'scheduled',
          studentFirstName: input.studentFirstName,
          studentLastName: input.studentLastName,
          studentGrade: input.studentGrade || null,
          courseId: input.courseId,
          notes: `Trial lesson for ${input.studentFirstName} ${input.studentLastName}${input.studentGrade ? ` (${input.studentGrade})` : ''}`,
        });

        if (!sessionId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create trial session' });
        }

        // Get the created session for email details
        const session = await db.getSessionById(sessionId);
        if (session && ctx.user.email && ctx.user.name && tutor.email && tutor.name) {
          const sessionDate = new Date(session.scheduledAt);
          const studentName = `${input.studentFirstName} ${input.studentLastName}`;

          // Get parent profile for timezone
          const parentProfile = await db.getParentProfileByUserId(ctx.user.id);

          // Get tutor profile for timezone
          const tutorProfile = await db.getTutorProfileByUserId(input.tutorId);

          // Send confirmation emails asynchronously (don't block on email failures)
          try {
            // Email to parent
            await sendBookingConfirmation({
              userEmail: ctx.user.email,
              userName: ctx.user.name,
              userRole: 'parent',
              courseName: course.title,
              tutorName: tutor.name,
              studentName: studentName,
              sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
              sessionDuration: `${session.duration} minutes`,
              sessionPrice: 'FREE - Trial Lesson',
            });

            // Email to tutor
            await sendBookingConfirmation({
              userEmail: tutor.email,
              userName: tutor.name,
              userRole: 'tutor',
              courseName: course.title,
              studentName,
              sessionDate: formatEmailDate(sessionDate, tutorProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, tutorProfile?.timezone || undefined),
              sessionDuration: `${session.duration} minutes`,
            });

            console.log('[Trial Booking] Confirmation emails sent for session', sessionId);
          } catch (err) {
            console.error('[Trial Booking Email] Failed to send confirmation emails:', err);
            // Don't fail the mutation if email fails
          }

          // Create in-app notification for tutor
          try {
            await db.createInAppNotification({
              userId: input.tutorId,
              title: 'New Trial Lesson Booking',
              message: `${ctx.user.name} booked a trial lesson for ${course.title} with ${studentName} on ${formatEmailDate(sessionDate)}`,
              type: 'new_booking',
              relatedId: sessionId,
            });
          } catch (err) {
            console.error('[Trial Booking] Failed to create notification:', err);
            // Don't fail the mutation if notification fails
          }
        }

        return {
          success: true,
          sessionId,
          trialsRemaining: 2 - trialSessions.length - 1,
        };
      }),

    // Get parent's trial history
    myTrials: parentProcedure.query(async ({ ctx }) => {
      const trialSessions = await db.getTrialSessionsByParentId(ctx.user.id);
      const isHost = false; // Parents see join URL

      return await Promise.all(trialSessions.map(async (session: any) => {
        const zoomUrl = await getTutorZoomUrl(session.tutorId, isHost);
        return {
          ...session,
          joinUrl: zoomUrl || generateFallbackJoinUrl(session.id),
        };
      }));
    }),
  }),

  // Home Page Data
  home: router({
    stats: publicProcedure.query(async () => {
      return await db.getPlatformStats();
    }),

    featuredCourses: publicProcedure.query(async () => {
      return await db.getFeaturedCourses();
    }),

    testimonials: publicProcedure.query(async () => {
      return await db.getTestimonials();
    }),

    faqs: publicProcedure.query(async () => {
      return await db.getFaqs();
    }),

    blogPosts: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getBlogPosts(input?.limit);
      }),

    blogPost: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const post = await db.getBlogPostBySlug(input.slug);
        if (!post) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Blog post not found' });
        }
        return post;
      }),
  }),

  // Admin Management
  admin: router({
    getOverviewStats: adminProcedure
      .query(async () => {
        // Get total users count
        const allUsers = await db.getAllUsers();
        const totalUsers = allUsers.length;
        const totalParents = allUsers.filter(u => u.role === 'parent').length;
        const totalTutors = allUsers.filter(u => u.role === 'tutor').length;
        
        // Get total enrollments
        const allSubscriptions = await db.getAllSubscriptions();
        const totalEnrollments = allSubscriptions.length;
        const activeEnrollments = allSubscriptions.filter(s => s.subscription.status === 'active').length;
        
        // Get total payments and revenue
        const allPayments = await db.getAllPayments();
        const completedPayments = allPayments.filter(
          (p) =>
            p.subscriptionId != null &&
            (p.status || '').toLowerCase() === 'completed'
        );
        const totalPayments = completedPayments.length;
        let totalRevenue = completedPayments.reduce((sum, p) => {
          const amt = parseFloat(p.amount);
          return sum + (isFinite(amt) ? amt : 0);
        }, 0);

        // Add Stripe revenue for migrated parents (paid subs with no payment row)
        const paymentSubIds = new Set(completedPayments.map(p => p.subscriptionId));
        const migratedSubs = allSubscriptions.filter(
          ({ subscription }) =>
            !paymentSubIds.has(subscription.id) &&
            (subscription.paymentStatus === 'paid' || subscription.paymentStatus === 'completed')
        );
        const migratedParentIds = [...new Set(migratedSubs.map(({ subscription }) => subscription.parentId))];
        if (migratedParentIds.length > 0) {
          const { listStripeInvoicesForCustomer } = await import("./stripe");
          const allUsers2 = allUsers; // already fetched above
          await Promise.all(migratedParentIds.map(async (parentId) => {
            const parent = allUsers2.find((u: any) => u.id === parentId) as any;
            if (!parent?.stripeCustomerId) return;
            try {
              const invoices = await listStripeInvoicesForCustomer(parent.stripeCustomerId, 100);
              const rev = invoices
                .filter((inv: any) => inv.status === 'paid' && inv.amount_paid > 0)
                .reduce((sum: number, inv: any) => sum + inv.amount_paid / 100, 0);
              totalRevenue += rev;
            } catch {
              // Stripe fetch failed — skip
            }
          }));
        }

        return {
          totalUsers,
          totalParents,
          totalTutors,
          totalEnrollments,
          activeEnrollments,
          totalPayments,
          totalRevenue: totalRevenue.toFixed(2),
        };
      }),

    getAllUsers: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        role: z.enum(["admin", "parent", "tutor", "coordinator"]).optional(),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allUsers = await db.getAllUsers();
        
        // Apply role filter
        if (input.role) {
          allUsers = allUsers.filter(u => u.role === input.role);
        }
        
        // Apply search filter (name or email)
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          allUsers = allUsers.filter(u => 
            u.name?.toLowerCase().includes(searchLower) ||
            u.email?.toLowerCase().includes(searchLower)
          );
        }
        
        // Apply date range filter
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999); // Include the entire end date
          allUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) <= endDate);
        }
        
        // Sort by creation date (most recent first)
        const sortedUsers = allUsers.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        // Apply pagination
        const paginatedUsers = sortedUsers.slice(input.offset, input.offset + input.limit);
        
        return {
          users: paginatedUsers,
          total: allUsers.length,
        };
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account." });
        }
        const target = await db.getUserById(input.userId);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }
        if (target.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin accounts cannot be deleted." });
        }
        await db.deleteUser(input.userId);
        return { success: true };
      }),

    getAllEnrollments: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        status: z.enum(["active", "paused", "cancelled", "completed"]).optional(),
        paymentStatus: z.enum(["paid", "pending", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allSubscriptions = await db.getAllSubscriptions();
        
        // Apply status filter
        if (input.status) {
          allSubscriptions = allSubscriptions.filter(s => s.subscription.status === input.status);
        }
        
        // Apply payment status filter
        if (input.paymentStatus) {
          allSubscriptions = allSubscriptions.filter(s => s.subscription.paymentStatus === input.paymentStatus);
        }
        
        // Apply date range filter
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allSubscriptions = allSubscriptions.filter(s => new Date(s.subscription.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allSubscriptions = allSubscriptions.filter(s => new Date(s.subscription.createdAt) <= endDate);
        }
        
        // Sort by creation date (most recent first)
        const sortedSubs = allSubscriptions.sort((a, b) => {
          const dateA = new Date(a.subscription.createdAt).getTime();
          const dateB = new Date(b.subscription.createdAt).getTime();
          return dateB - dateA;
        });
        
        // Apply pagination
        const paginatedSubs = sortedSubs.slice(input.offset, input.offset + input.limit);
        
        // Enrich with additional details
        const enrichedEnrollments = paginatedSubs.map(({ subscription, course, parent, tutor }) => ({
          id: subscription.id,
          courseName: course?.title || 'Unknown Course',
          parentName: parent?.name || 'Unknown Parent',
          parentEmail: parent?.email || '',
          tutorName: tutor?.name || 'Unknown Tutor',
          studentName: `${subscription.studentFirstName} ${subscription.studentLastName}`,
          status: subscription.status,
          paymentStatus: subscription.paymentStatus,
          paymentPlan: subscription.paymentPlan,
          createdAt: subscription.createdAt,
        }));
        
        return {
          enrollments: enrichedEnrollments,
          total: allSubscriptions.length,
        };
      }),

    getAllPayments: superAdminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        status: z.enum(["completed", "pending", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allPayments = await db.getAllPayments();

        // Surface pending/failed enrollments even if no payment row exists yet
        const allSubs = await db.getAllSubscriptions();
        const unpaidSubs = allSubs.filter(
          ({ subscription }) => subscription.paymentStatus === "pending" || subscription.paymentStatus === "failed"
        );

        const syntheticPayments = unpaidSubs.map(({ subscription, course, tutor }) => ({
          // Negative id space to avoid collision with real payments
          id: -subscription.id,
          parentId: subscription.parentId,
          tutorId: subscription.preferredTutorId ?? tutor?.id ?? 0,
          subscriptionId: subscription.id,
          sessionId: null,
          amount: course?.price ?? "0",
          currency: "usd",
          status: subscription.paymentStatus as "pending" | "completed" | "failed" | "refunded",
          paymentType: "subscription" as const,
          stripePaymentIntentId: null,
          stripeInvoiceId: null,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        }));

        allPayments = [...allPayments, ...syntheticPayments];

        // Only show enrollment-based payments (must have a subscriptionId)
        allPayments = allPayments.filter((p): p is typeof p & { subscriptionId: number } => p.subscriptionId != null);

        // Apply status filter
        if (input.status) {
          allPayments = allPayments.filter(p => p.status === input.status);
        }

        // Apply date range filter
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allPayments = allPayments.filter(p => new Date(p.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allPayments = allPayments.filter(p => new Date(p.createdAt) <= endDate);
        }

        // Sort by creation date (most recent first)
        const sortedPayments = allPayments.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        // Apply pagination
        const paginatedPayments = sortedPayments.slice(input.offset, input.offset + input.limit);

        // Enrich with user and course details
        const enrichedPayments = await Promise.all(
          paginatedPayments.map(async (payment) => {
            const parent = await db.getUserById(payment.parentId);
            const tutor = await db.getUserById(payment.tutorId);

            let courseName = null;
            let studentName = null;
            let paymentPlan: string = 'full';
            let installmentNumber: number | null = null;

            const subscription = await db.getSubscriptionById(payment.subscriptionId!);
            if (subscription) {
              const course = await db.getCourseById(subscription.courseId);
              if (course) courseName = course.title;
              studentName = `${subscription.studentFirstName || ''} ${subscription.studentLastName || ''}`.trim();
              paymentPlan = subscription.paymentPlan;

              // Determine which installment this payment corresponds to
              if (paymentPlan === 'installment') {
                // Match by amount: first installment amount vs second
                const firstAmt = subscription.firstInstallmentAmount
                  ? parseFloat(subscription.firstInstallmentAmount)
                  : null;
                const secondAmt = subscription.secondInstallmentAmount
                  ? parseFloat(subscription.secondInstallmentAmount)
                  : null;
                const paidAmt = parseFloat(payment.amount);
                if (firstAmt !== null && Math.abs(paidAmt - firstAmt) < 0.01) {
                  installmentNumber = 1;
                } else if (secondAmt !== null && Math.abs(paidAmt - secondAmt) < 0.01) {
                  installmentNumber = 2;
                }
              }
            }

            return {
              id: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentPlan,
              installmentNumber,
              parentName: parent?.name || 'Unknown',
              parentEmail: parent?.email || '',
              tutorName: tutor?.name || 'Unknown',
              courseName,
              studentName,
              stripePaymentIntentId: payment.stripePaymentIntentId,
              createdAt: payment.createdAt,
            };
          })
        );

        return {
          payments: enrichedPayments,
          total: allPayments.length,
        };
      }),

    exportUsersCSV: adminProcedure
      .input(z.object({
        role: z.enum(["admin", "parent", "tutor", "coordinator"]).optional(),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // Reuse the same filtering logic as getAllUsers
        let allUsers = await db.getAllUsers();
        
        if (input.role) {
          allUsers = allUsers.filter(u => u.role === input.role);
        }
        
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          allUsers = allUsers.filter(u => 
            u.name?.toLowerCase().includes(searchLower) ||
            u.email?.toLowerCase().includes(searchLower)
          );
        }
        
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) <= endDate);
        }
        
        const sortedUsers = allUsers.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        return sortedUsers;
      }),

    exportEnrollmentsCSV: adminProcedure
      .input(z.object({
        status: z.enum(["active", "paused", "cancelled", "completed"]).optional(),
        paymentStatus: z.enum(["paid", "pending", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allSubscriptions = await db.getAllSubscriptions();
        
        if (input.status) {
          allSubscriptions = allSubscriptions.filter(s => s.subscription.status === input.status);
        }
        
        if (input.paymentStatus) {
          allSubscriptions = allSubscriptions.filter(s => s.subscription.paymentStatus === input.paymentStatus);
        }
        
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allSubscriptions = allSubscriptions.filter(s => new Date(s.subscription.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allSubscriptions = allSubscriptions.filter(s => new Date(s.subscription.createdAt) <= endDate);
        }
        
        const sortedSubs = allSubscriptions.sort((a, b) => {
          const dateA = new Date(a.subscription.createdAt).getTime();
          const dateB = new Date(b.subscription.createdAt).getTime();
          return dateB - dateA;
        });
        
        const enrichedEnrollments = sortedSubs.map(({ subscription, course, parent, tutor }) => ({
          id: subscription.id,
          courseName: course?.title || 'Unknown Course',
          parentName: parent?.name || 'Unknown Parent',
          parentEmail: parent?.email || '',
          tutorName: tutor?.name || 'Unknown Tutor',
          studentName: `${subscription.studentFirstName} ${subscription.studentLastName}`,
          status: subscription.status,
          paymentStatus: subscription.paymentStatus,
          paymentPlan: subscription.paymentPlan,
          createdAt: subscription.createdAt,
        }));
        
        return enrichedEnrollments;
      }),

    exportPaymentsCSV: adminProcedure
      .input(z.object({
        status: z.enum(["completed", "pending", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allPayments = await db.getAllPayments();

        // Surface pending/failed enrollments even if no payment row exists yet
        const allSubs = await db.getAllSubscriptions();
        const unpaidSubs = allSubs.filter(
          ({ subscription }) => subscription.paymentStatus === "pending" || subscription.paymentStatus === "failed"
        );
        const syntheticPayments = unpaidSubs.map(({ subscription, course, tutor }) => ({
          id: -subscription.id,
          parentId: subscription.parentId,
          tutorId: subscription.preferredTutorId ?? tutor?.id ?? 0,
          subscriptionId: subscription.id,
          sessionId: null,
          amount: course?.price ?? "0",
          currency: "usd",
          status: subscription.paymentStatus as "pending" | "completed" | "failed" | "refunded",
          paymentType: "subscription" as const,
          stripePaymentIntentId: null,
          stripeInvoiceId: null,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        }));
        allPayments = [...allPayments, ...syntheticPayments];

        // Only show enrollment-based payments
        allPayments = allPayments.filter((p): p is typeof p & { subscriptionId: number } => p.subscriptionId != null);

        if (input.status) {
          allPayments = allPayments.filter(p => p.status === input.status);
        }
        
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allPayments = allPayments.filter(p => new Date(p.createdAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allPayments = allPayments.filter(p => new Date(p.createdAt) <= endDate);
        }
        
        const sortedPayments = allPayments.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        const enrichedPayments = await Promise.all(
          sortedPayments.map(async (payment) => {
            const parent = await db.getUserById(payment.parentId);
            const tutor = await db.getUserById(payment.tutorId);
            
            let courseName = null;
            let studentName = null;
            
            if (payment.subscriptionId) {
              const subscription = await db.getSubscriptionById(payment.subscriptionId);
              if (subscription) {
                const course = await db.getCourseById(subscription.courseId);
                if (course) {
                  courseName = course.title;
                }
                studentName = `${subscription.studentFirstName} ${subscription.studentLastName}`;
              }
            }
            
            return {
              id: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentType: payment.paymentType,
              parentName: parent?.name || 'Unknown',
              parentEmail: parent?.email || '',
              tutorName: tutor?.name || 'Unknown',
              courseName,
              studentName,
              stripePaymentIntentId: payment.stripePaymentIntentId,
              createdAt: payment.createdAt,
            };
          })
        );
        
        return enrichedPayments;
      }),

    getAnalytics: superAdminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const allUsers = await db.getAllUsers();
        // Deduplicate subscriptions in case joins return multiple tutor rows
        const allSubscriptionsRaw = await db.getAllSubscriptions();
        const subMap = new Map<number, (typeof allSubscriptionsRaw)[number]>();
        allSubscriptionsRaw.forEach((s) => {
          if (!subMap.has(s.subscription.id)) {
            subMap.set(s.subscription.id, s);
          }
        });
        const allSubscriptions = Array.from(subMap.values());
        const allPayments = await db.getAllPayments();
        const completedSubscriptionIds = new Set(
          allPayments
            .filter(
              (p) =>
                p.subscriptionId != null &&
                (p.status || "").toLowerCase() === "completed"
            )
            .map((p) => p.subscriptionId as number)
        );
        
        // Determine date range
        const now = new Date();
        const rangeStart = input?.startDate ? new Date(input.startDate) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const rangeEnd = input?.endDate ? new Date(input.endDate + 'T23:59:59') : now;
        
        // Generate month buckets between start and end dates
        const months: Date[] = [];
        const currentMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
        
        while (currentMonth <= endMonth) {
          months.push(new Date(currentMonth));
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        
        // User growth by month
        const userGrowth: { month: string; count: number }[] = months.map(monthDate => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
          
          const count = allUsers.filter(u => {
            if (!u.createdAt) return false;
            const userDate = new Date(u.createdAt);
            return userDate >= monthStart && userDate <= monthEnd;
          }).length;
          
          return {
            month: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            count,
          };
        });
        
        // Enrollment patterns by month
        const enrollmentPatterns: { month: string; count: number }[] = months.map(monthDate => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
          
          const count = allSubscriptions.filter(s => {
            const subDate = new Date(s.subscription.createdAt);
            return subDate >= monthStart && subDate <= monthEnd;
          }).length;
          
          return {
            month: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            count,
          };
        });
        
        // Revenue by month
        const revenueData: { month: string; revenue: number }[] = months.map(monthDate => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
          
          const revenue = allPayments
            .filter(p => {
              if ((p.status || '').toLowerCase() !== 'completed') return false;
              if (p.subscriptionId == null) return false;
              const paymentDate = new Date(p.createdAt);
              return paymentDate >= monthStart && paymentDate <= monthEnd;
            })
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);
          
          return {
            month: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            revenue: parseFloat(revenue.toFixed(2)),
          };
        });
        
        // User distribution (filtered by date range)
        const filteredUsers = allUsers.filter(u => {
          if (!u.createdAt) return false;
          const userDate = new Date(u.createdAt);
          return userDate >= rangeStart && userDate <= rangeEnd;
        });
        const parentCount = filteredUsers.filter(u => u.role === 'parent').length;
        const tutorCount = filteredUsers.filter(u => u.role === 'tutor').length;
        const adminCount = filteredUsers.filter(u => u.role === 'admin').length;
        
        // Payment status distribution (filtered by date range, based on subscriptions)
        const filteredSubsForPaymentStatus = allSubscriptions.filter(s => {
          const subDate = new Date(s.subscription.createdAt);
          return subDate >= rangeStart && subDate <= rangeEnd;
        });
        const completedPayments = filteredSubsForPaymentStatus.filter(s => (s.subscription.paymentStatus || '').toLowerCase() === 'paid').length;
        const pendingPayments = filteredSubsForPaymentStatus.filter(s => (s.subscription.paymentStatus || '').toLowerCase() === 'pending').length;
        const failedPayments = filteredSubsForPaymentStatus.filter(s => (s.subscription.paymentStatus || '').toLowerCase() === 'failed').length;
        
        return {
          userGrowth,
          enrollmentPatterns,
          revenueData,
          userDistribution: {
            parents: parentCount,
            tutors: tutorCount,
            admins: adminCount,
          },
          paymentStatus: {
            completed: completedPayments,
            pending: pendingPayments,
            failed: failedPayments,
          },
        };
      }),

    getParentRevenueBreakdown: superAdminProcedure.query(async () => {
      const BATCH = 50;
      async function batchFetch<T>(ids: number[], fetcher: (id: number) => Promise<T | undefined>) {
        const results = new Map<number, T>();
        for (let i = 0; i < ids.length; i += BATCH) {
          const slice = ids.slice(i, i + BATCH);
          const rows = await Promise.all(slice.map(id => fetcher(id).then(r => [id, r] as const)));
          for (const [id, row] of rows) {
            if (row !== undefined) results.set(id, row);
          }
        }
        return results;
      }

      type StudentEntry = { studentName: string; courseName: string | null; total: number; count: number; migrated?: boolean };
      type ParentEntry  = { parentId: number; parentName: string; parentEmail: string; total: number; count: number; students: StudentEntry[] };

      // --- Source 1: real completed payment rows ---
      const allPayments = await db.getAllPayments();
      const completedPayments = allPayments.filter(
        p => p.subscriptionId != null && (p.status || '').toLowerCase() === 'completed'
      ) as (typeof allPayments[number] & { subscriptionId: number })[];

      // --- Source 2: paid subscriptions with NO payment row (migrated parents) ---
      const allSubs = await db.getAllSubscriptions();
      const paymentSubIds = new Set(completedPayments.map(p => p.subscriptionId));

      // Migrated paid subs: no reliable USD amount available (course.price may be INR),
      // so we include them for enrollment counts but contribute $0 revenue.
      const migratedPaidSubs = allSubs.filter(
        ({ subscription }) =>
          !paymentSubIds.has(subscription.id) &&
          (subscription.paymentStatus === 'paid' || subscription.paymentStatus === 'completed')
      );

      // Pre-fetch all unique parents + courses needed
      const uniqueParentIds = [...new Set([
        ...completedPayments.map(p => p.parentId),
        ...migratedPaidSubs.map(({ subscription }) => subscription.parentId),
      ])];
      const uniqueSubIds = [...new Set(completedPayments.map(p => p.subscriptionId))];

      const [parentCache, subCache] = await Promise.all([
        batchFetch(uniqueParentIds, id => db.getUserById(id) as Promise<any>),
        batchFetch(uniqueSubIds,    id => db.getSubscriptionById(id) as Promise<any>),
      ]);

      // Course cache: from payment subscriptions + migrated subs
      const uniqueCourseIds = [...new Set([
        ...[...subCache.values()].map((s: any) => s?.courseId),
        ...migratedPaidSubs.map(({ subscription }) => subscription.courseId),
      ].filter(Boolean))];
      const courseCache = await batchFetch(uniqueCourseIds, id => db.getCourseById(id) as Promise<any>);

      // Fetch real Stripe revenue for migrated parents that have a stripeCustomerId
      const migratedParentIds = [...new Set(migratedPaidSubs.map(({ subscription }) => subscription.parentId))];
      const stripeRevenueByParent = new Map<number, number>();
      if (migratedParentIds.length > 0) {
        const { listStripeInvoicesForCustomer } = await import("./stripe");
        await Promise.all(migratedParentIds.map(async (parentId) => {
          const parent = parentCache.get(parentId) as any;
          if (!parent?.stripeCustomerId) return;
          try {
            const invoices = await listStripeInvoicesForCustomer(parent.stripeCustomerId, 100);
            const revenue = invoices
              .filter((inv: any) => inv.status === 'paid' && inv.amount_paid > 0)
              .reduce((sum: number, inv: any) => sum + inv.amount_paid / 100, 0);
            if (revenue > 0) stripeRevenueByParent.set(parentId, revenue);
          } catch {
            // Stripe fetch failed — leave at 0
          }
        }));
      }

      const parentMap = new Map<number, ParentEntry>();

      function ensureParent(parentId: number) {
        if (!parentMap.has(parentId)) {
          const parent = parentCache.get(parentId) as any;
          parentMap.set(parentId, {
            parentId,
            parentName: parent?.name || `${parent?.firstName ?? ''} ${parent?.lastName ?? ''}`.trim() || 'Unknown',
            parentEmail: parent?.email || '',
            total: 0, count: 0, students: [],
          });
        }
        return parentMap.get(parentId)!;
      }

      function addToStudent(entry: ParentEntry, studentName: string, courseName: string | null, amt: number) {
        const isMigrated = amt === -1;
        const safeAmt = isMigrated ? 0 : amt;
        // Only add to parent total for real amounts
        if (!isMigrated) {
          // (already added in caller)
        }
        const key = `${studentName}\t${courseName ?? ''}`;
        const existing = entry.students.find(s => `${s.studentName}\t${s.courseName ?? ''}` === key);
        if (existing) {
          if (!isMigrated) existing.total += safeAmt;
          existing.count += 1;
        } else {
          entry.students.push({ studentName, courseName, total: safeAmt, count: 1, migrated: isMigrated });
        }
      }

      // Process real payment rows
      for (const p of completedPayments) {
        const amt = parseFloat(p.amount);
        const safeAmt = isFinite(amt) ? amt : 0;
        if (safeAmt === 0) continue; // skip $0 payments — no revenue contribution

        const entry = ensureParent(p.parentId);
        entry.total += safeAmt;
        entry.count += 1;

        const sub = subCache.get(p.subscriptionId) as any;
        const studentName = sub
          ? `${sub.studentFirstName || ''} ${sub.studentLastName || ''}`.trim() || 'Unknown Student'
          : 'Unknown Student';
        const course = sub ? courseCache.get(sub.courseId) as any : null;
        addToStudent(entry, studentName, course?.title ?? null, safeAmt);
      }

      // Migrated paid subscriptions: use real Stripe revenue where available.
      // Revenue is attributed at the parent level (can't split invoices per-student),
      // so per-student rows still show migrated badge with $0.
      const migratedParentRevenueCredited = new Set<number>();
      for (const { subscription, course } of migratedPaidSubs) {
        const entry = ensureParent(subscription.parentId);
        entry.count += 1;

        // Credit Stripe revenue once per parent (first migrated sub encountered)
        if (!migratedParentRevenueCredited.has(subscription.parentId)) {
          migratedParentRevenueCredited.add(subscription.parentId);
          const stripeRev = stripeRevenueByParent.get(subscription.parentId) ?? 0;
          entry.total += stripeRev;
        }

        const studentName = `${subscription.studentFirstName || ''} ${subscription.studentLastName || ''}`.trim() || 'Unknown Student';
        const courseName = course?.title ?? null;
        // Per-student still shows migrated badge — amounts can't be split per invoice
        addToStudent(entry, studentName, courseName, -1);
      }

      return Array.from(parentMap.values())
        .sort((a, b) => b.total - a.total)
        .map(r => ({
          ...r,
          total: parseFloat(r.total.toFixed(2)),
          students: r.students
            .sort((a, b) => b.total - a.total)
            .map(s => ({ ...s, total: parseFloat(s.total.toFixed(2)) })),
        }));
    }),

    // Tutor Availability Management
    getTutorAvailability: adminProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTutorAvailability(input.tutorId);
      }),

    getAllTutorsWithAvailability: adminProcedure
      .query(async () => {
        return await db.getAllTutorsWithAvailability();
      }),

    setTutorAvailability: adminProcedure
      .input(z.object({
        tutorId: z.number(),
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      }))
      .mutation(async ({ input }) => {
        // Validate that end time is after start time
        const [startHour, startMin] = input.startTime.split(':').map(Number);
        const [endHour, endMin] = input.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'End time must be after start time' 
          });
        }

        // Check for overlapping slots
        const existing = await db.getTutorAvailability(input.tutorId);
        const overlapping = existing.filter(slot => {
          if (slot.dayOfWeek !== input.dayOfWeek) return false;
          
          const [slotStartHour, slotStartMin] = slot.startTime.split(':').map(Number);
          const [slotEndHour, slotEndMin] = slot.endTime.split(':').map(Number);
          const slotStartMinutes = slotStartHour * 60 + slotStartMin;
          const slotEndMinutes = slotEndHour * 60 + slotEndMin;
          
          // Check if time ranges overlap
          return (
            (startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes) ||
            (endMinutes > slotStartMinutes && endMinutes <= slotEndMinutes) ||
            (startMinutes <= slotStartMinutes && endMinutes >= slotEndMinutes)
          );
        });

        if (overlapping.length > 0) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'This time slot overlaps with an existing availability slot' 
          });
        }

        const availability = await db.createTutorAvailability({
          tutorId: input.tutorId,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
        });

        if (!availability) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to create availability slot' 
          });
        }

        return { success: true, availability };
      }),

    deleteTutorAvailability: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteTutorAvailability(input.id);
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to delete availability slot' 
          });
        }
        return { success: true };
      }),

    // Email Settings Management
    getEmailSettings: adminProcedure
      .query(async () => {
        const settings = await db.getEmailSettings();
        return settings;
      }),

    updateEmailSettings: adminProcedure
      .input(z.object({
        logoUrl: z.string().nullable().optional(),
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        footerText: z.string().optional(),
        companyName: z.string().optional(),
        supportEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const settingsId = await db.updateEmailSettings({
          ...input,
          updatedBy: ctx.user.id,
        });
        if (!settingsId) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to update email settings' 
          });
        }
        return { success: true, id: settingsId };
      }),

    // Tutor Registration Management
    getPendingTutors: adminProcedure
      .query(async () => {
        const allTutors = await db.getAllTutorsWithStatus();
        return { tutors: allTutors };
      }),

    approveTutor: adminProcedure
      .input(z.object({
        profileId: z.number().optional(),
        tutorId: z.number().optional(), // legacy name from UI
      }))
      .mutation(async ({ input }) => {
        const profileId = input.profileId ?? input.tutorId;
        if (!profileId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing profileId' });
        }
        // Get tutor profile details before approval
        const tutorProfile = await db.getTutorProfileById(profileId);
        if (!tutorProfile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor profile not found' });
        }

        const success = await db.approveTutorProfile(profileId);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to approve tutor' });
        }

        // Check if user has already set up their account
        const user = await db.getUserById(tutorProfile.userId);

        if (tutorProfile.email && tutorProfile.name && user) {
          if (!user.accountSetupComplete) {
            // User hasn't set up password yet - send setup link
            try {
              const setupToken = await db.createPasswordSetupToken(tutorProfile.userId);
              if (setupToken) {
                const setupUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
                const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

                const { sendPasswordSetupEmail } = await import('./email-helpers');
                await sendPasswordSetupEmail({
                  tutorEmail: tutorProfile.email,
                  tutorName: tutorProfile.name,
                  setupUrl,
                  expiresAt,
                });
                console.log('[TutorApproval] Password setup email sent to:', tutorProfile.email);
              }
            } catch (error) {
              console.error('[TutorApproval] Failed to send password setup email:', error);
              // Don't fail the approval if email fails
            }
          } else {
            // User already has password - send regular approval email
            try {
              const { sendTutorApprovalEmail } = await import('./email-helpers');
              await sendTutorApprovalEmail({
                tutorEmail: tutorProfile.email,
                tutorName: tutorProfile.name,
              });
              console.log('[TutorApproval] Approval confirmation email sent to:', tutorProfile.email);
            } catch (error) {
              console.error('[TutorApproval] Failed to send confirmation email:', error);
              // Don't fail the approval if email fails
            }
          }
        }

        // Notify admin about approval (as confirmation)
        try {
          await notifyOwner({
            title: 'Tutor Application Approved',
            content: `You have approved the tutor application for:\n\nName: ${tutorProfile.name}\nEmail: ${tutorProfile.email}\n\nThe tutor profile is now visible in search results.`
          });
        } catch (error) {
          console.error('[TutorApproval] Failed to send notification:', error);
        }

        return { success: true };
      }),

    rejectTutor: adminProcedure
      .input(z.object({
        profileId: z.number().optional(),
        tutorId: z.number().optional(), // legacy name from UI
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        const profileId = input.profileId ?? input.tutorId;
        if (!profileId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing profileId' });
        }
        // Get tutor profile details before rejection
        const tutorProfile = await db.getTutorProfileById(profileId);
        if (!tutorProfile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tutor profile not found' });
        }

        const success = await db.rejectTutorProfile(profileId, input.reason);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reject tutor' });
        }

        // Notify admin about rejection (as confirmation)
        try {
          await notifyOwner({
            title: 'Tutor Application Rejected',
            content: `You have rejected the tutor application for:\n\nName: ${tutorProfile.name}\nEmail: ${tutorProfile.email}\nReason: ${input.reason}\n\nThe applicant will not appear in search results.`
          });
        } catch (error) {
          console.error('[TutorRejection] Failed to send notification:', error);
        }

        return { success: true };
      }),

    bulkApproveTutors: adminProcedure
      .input(z.object({ tutorIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const { tutorIds } = input;
        
        if (tutorIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tutors selected' });
        }

        // Approve all selected tutors
        const results = await Promise.all(
          tutorIds.map(async (id) => {
            try {
              return await db.approveTutor(id);
            } catch (error) {
              console.error(`[BulkApproval] Failed to approve tutor ${id}:`, error);
              return false;
            }
          })
        );

        const successCount = results.filter(r => r).length;
        
        // Notify admin about bulk approval
        try {
          await notifyOwner({
            title: 'Bulk Tutor Approval Completed',
            content: `Successfully approved ${successCount} out of ${tutorIds.length} tutors.\n\nThe approved tutors are now visible in search results.`
          });
        } catch (error) {
          console.error('[BulkApproval] Failed to send notification:', error);
        }

        return {
          success: true,
          message: `Successfully approved ${successCount} out of ${tutorIds.length} tutors`,
          approvedCount: successCount,
          totalRequested: tutorIds.length,
        };
      }),

    getTutorsForCourseApproval: adminProcedure
      .query(async () => {
        return await db.getTutorsForPreferenceDropdown();
      }),

    getTutorCoursePreferences: adminProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTutorCoursePreferencesForAdmin(input.tutorId);
      }),

    updateTutorCoursePreferenceStatus: adminProcedure
      .input(z.object({
        preferenceId: z.number(),
        approvalStatus: z.enum(["APPROVED", "REJECTED"]),
      }))
      .mutation(async ({ input }) => {
        const success = await db.updateTutorCoursePreferenceStatus(
          input.preferenceId,
          input.approvalStatus
        );

        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Preference not found" });
        }

        return { success: true };
      }),

    getAllSessions: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        parentName: z.string().optional(),
        studentName: z.string().optional(),
        courseName: z.string().optional(),
        month: z.string().optional(), // format: "YYYY-MM"
      }))
      .query(async ({ input }) => {
        let allSessions = await db.getAllSessionsWithDetails();

        // Apply status filter
        if (input.status) {
          allSessions = allSessions.filter(s => s.status === input.status);
        }

        // Apply date range filter
        if (input.startDate) {
          const startDate = new Date(input.startDate);
          allSessions = allSessions.filter(s => new Date(s.scheduledAt) >= startDate);
        }
        if (input.endDate) {
          const endDate = new Date(input.endDate);
          endDate.setHours(23, 59, 59, 999);
          allSessions = allSessions.filter(s => new Date(s.scheduledAt) <= endDate);
        }

        // Apply month filter (YYYY-MM)
        if (input.month) {
          const [year, month] = input.month.split("-").map(Number);
          allSessions = allSessions.filter(s => {
            const d = new Date(s.scheduledAt);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          });
        }

        // Apply parent name filter
        if (input.parentName) {
          const q = input.parentName.toLowerCase();
          allSessions = allSessions.filter(s => s.parentName?.toLowerCase().includes(q));
        }

        // Apply student name filter
        if (input.studentName) {
          const q = input.studentName.toLowerCase();
          allSessions = allSessions.filter(s => {
            const full = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").toLowerCase();
            return full.includes(q);
          });
        }

        // Apply course name filter
        if (input.courseName) {
          const q = input.courseName.toLowerCase();
          allSessions = allSessions.filter(s => s.courseTitle?.toLowerCase().includes(q));
        }

        // Sort by scheduled date (most recent first)
        const sortedSessions = allSessions.sort((a, b) => {
          const dateA = new Date(a.scheduledAt).getTime();
          const dateB = new Date(b.scheduledAt).getTime();
          return dateB - dateA;
        });

        // Apply pagination
        const paginatedSessions = sortedSessions.slice(input.offset, input.offset + input.limit);

        return {
          sessions: paginatedSessions,
          total: allSessions.length,
        };
      }),

    getSessionFilterOptions: adminProcedure
      .query(async () => {
        const allSessions = await db.getAllSessionsWithDetails();
        const parentNames = Array.from(new Set(allSessions.map(s => s.parentName).filter(Boolean))).sort() as string[];
        const studentNames = Array.from(new Set(
          allSessions.map(s => [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim()).filter(Boolean)
        )).sort();
        const courseNames = Array.from(new Set(allSessions.map(s => s.courseTitle).filter(Boolean))).sort() as string[];
        const months = Array.from(new Set(
          allSessions.map(s => {
            const d = new Date(s.scheduledAt);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          })
        )).sort().reverse();
        return { parentNames, studentNames, courseNames, months };
      }),
  }),

  // Tutor Availability Management
  tutorAvailability: router({
    /**
     * Get tutor's availability schedule (for logged-in tutor)
     */
    getAvailability: tutorProcedure
      .query(async ({ ctx }) => {
        const availability = await db.getTutorAvailability(ctx.user.id);
        return availability;
      }),

    /**
     * Get tutor's availability schedule by tutor ID (public)
     */
    getByTutorId: publicProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        const availability = await db.getTutorAvailability(input.tutorId);
        return availability;
      }),

    /**
     * Create availability slot
     */
    createSlot: tutorProcedure
      .input(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate time range
        if (input.startTime >= input.endTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End time must be after start time',
          });
        }

        // Check for overlapping slots on the same day
        const existingSlots = await db.getTutorAvailability(ctx.user.id);
        const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const newStart = toMinutes(input.startTime);
        const newEnd = toMinutes(input.endTime);
        const hasOverlap = existingSlots
          .filter(s => s.dayOfWeek === input.dayOfWeek && s.isActive)
          .some(s => {
            const sStart = toMinutes(s.startTime);
            const sEnd = toMinutes(s.endTime);
            return newStart < sEnd && newEnd > sStart;
          });
        if (hasOverlap) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This time slot overlaps with an existing availability slot for this day.',
          });
        }

        const slot = await db.createTutorAvailability({
          tutorId: ctx.user.id,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          isActive: true,
        });

        if (!slot) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create availability slot',
          });
        }

        return slot;
      }),

    /**
     * Update availability slot
     */
    updateSlot: tutorProcedure
      .input(z.object({
        id: z.number(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;

        // Validate time range if both times are provided
        if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End time must be after start time',
          });
        }

        const updated = await db.updateTutorAvailability(id, updates);

        if (!updated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update availability slot',
          });
        }

        return updated;
      }),

    /**
     * Delete availability slot
     */
    deleteSlot: tutorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteTutorAvailability(input.id);

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete availability slot',
          });
        }

        return { success: true };
      }),

    /**
     * Get tutor's time blocks (unavailable periods)
     */
    getTimeBlocks: tutorProcedure
      .input(z.object({
        startTime: z.number().optional(),
        endTime: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const blocks = await db.getTutorTimeBlocks(
          ctx.user.id,
          input.startTime,
          input.endTime
        );
        return blocks;
      }),

    /**
     * Get tutor's time blocks by tutor ID (public - for booking calendar)
     */
    getTimeBlocksByTutorId: publicProcedure
      .input(z.object({
        tutorId: z.number(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const blocks = await db.getTutorTimeBlocks(
          input.tutorId,
          input.startTime,
          input.endTime
        );
        return blocks;
      }),

    /**
     * Create time block (mark time as unavailable)
     */
    createTimeBlock: tutorProcedure
      .input(z.object({
        startTime: z.number(),
        endTime: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate time range
        if (input.startTime >= input.endTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End time must be after start time',
          });
        }

        // Check for overlapping blocks
        const existingBlocks = await db.getTutorTimeBlocks(
          ctx.user.id,
          input.startTime,
          input.endTime
        );

        if (existingBlocks.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This time period overlaps with an existing block',
          });
        }

        const block = await db.createTutorTimeBlock({
          tutorId: ctx.user.id,
          startTime: input.startTime,
          endTime: input.endTime,
          reason: input.reason,
        });

        if (!block) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create time block',
          });
        }

        return block;
      }),

    /**
     * Update time block
     */
    updateTimeBlock: tutorProcedure
      .input(z.object({
        id: z.number(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;

        // Validate time range if both times are provided
        if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'End time must be after start time',
          });
        }

        const success = await db.updateTutorTimeBlock(id, updates);

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update time block',
          });
        }

        return { success: true };
      }),

    /**
     * Delete time block
     */
    deleteTimeBlock: tutorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteTutorTimeBlock(input.id);

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete time block',
          });
        }

        return { success: true };
      }),
  }),

  // Booking Management (public access via secure token)
  sessionNotes: router({
    /**
     * Create a new session note (tutor only)
     */
    create: tutorProcedure
      .input(z.object({
        sessionId: z.number(),
        parentId: z.number(),
        progressSummary: z.string().min(1),
        homework: z.string().optional(),
        challenges: z.string().optional(),
        nextSteps: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the session belongs to this tutor
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }
        if (session.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only add notes to your own sessions' });
        }

        // Check if note already exists for this session
        const existing = await db.getSessionNoteBySessionId(input.sessionId);
        if (existing) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Notes already exist for this session' });
        }

        const note = await db.createSessionNote({
          sessionId: input.sessionId,
          tutorId: ctx.user.id,
          parentId: input.parentId,
          progressSummary: input.progressSummary,
          homework: input.homework,
          challenges: input.challenges,
          nextSteps: input.nextSteps,
        });

        if (!note) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session note' });
        }

        // Send email notification to parent
        try {
          const parent = await db.getUserById(input.parentId);
          const tutor = await db.getUserById(ctx.user.id);

          if (parent?.email && tutor) {
            const parentProfile = await db.getParentProfileByUserId(parent.id);
            const sessionDate = new Date(session.scheduledAt);

            // Get student name and course name from subscription
            let studentName = "your child";
            let courseName = "the course";
            if (session.subscriptionId) {
              const subscription = await db.getSubscriptionById(session.subscriptionId);
              if (subscription) {
                const firstName = (subscription as any).studentFirstName || "";
                const lastName = (subscription as any).studentLastName || "";
                if (firstName || lastName) studentName = `${firstName} ${lastName}`.trim();
              }
            }
            if (session.courseId) {
              const course = await db.getCourseById(session.courseId);
              if (course?.title) courseName = course.title;
            }

            const emailHtml = await sendSessionNotesEmail({
              parentName: parent.name || parent.email,
              studentName,
              tutorName: tutor.name || `${(tutor as any).firstName || ""} ${(tutor as any).lastName || ""}`.trim() || "Your tutor",
              courseName,
              sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
              progressSummary: input.progressSummary,
              homework: input.homework || undefined,
              challenges: input.challenges || undefined,
              nextSteps: input.nextSteps || undefined,
              notesUrl: `${process.env.VITE_FRONTEND_FORGE_API_URL || ""}/session-notes`,
            });

            await emailService.sendEmail({
              to: parent.email,
              subject: `Session Notes for ${studentName} — ${courseName}`,
              html: emailHtml,
            });

            await db.markSessionNoteAsNotified(note.id);
          }
        } catch (emailError) {
          console.error("[Session Notes] Failed to send email notification:", emailError);
          // Don't fail the mutation if email fails
        }

        return note;
      }),

    /**
     * Update an existing session note (tutor only)
     */
    update: tutorProcedure
      .input(z.object({
        id: z.number(),
        progressSummary: z.string().min(1).optional(),
        homework: z.string().optional(),
        challenges: z.string().optional(),
        nextSteps: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getSessionNoteById(input.id);
        if (!note) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session note not found' });
        }
        if (note.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only update your own notes' });
        }

        const { id, ...updates } = input;
        const updated = await db.updateSessionNote(id, updates);

        if (!updated) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update session note' });
        }

        return updated;
      }),

    /**
     * Get session note by session ID
     */
    getBySessionId: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const note = await db.getSessionNoteBySessionId(input.sessionId);
        if (!note) {
          return null;
        }

        // Check if user has access to this note
        if (note.tutorId !== ctx.user.id && note.parentId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this note' });
        }

        return note;
      }),

    /**
     * Get all session notes for current tutor
     */
    getMyNotes: tutorProcedure
      .query(async ({ ctx }) => {
        return await db.getSessionNotesByTutorId(ctx.user.id);
      }),

    /**
     * Get all session notes for current parent
     */
    getParentNotes: parentProcedure
      .query(async ({ ctx }) => {
        return await db.getSessionNotesByParentId(ctx.user.id);
      }),

    /**
     * Delete a session note (tutor only)
     */
    delete: tutorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getSessionNoteById(input.id);
        if (!note) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session note not found' });
        }
        if (note.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own notes' });
        }

        const success = await db.deleteSessionNote(input.id);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete session note' });
        }

        return { success: true };
      }),

    /**
     * Upload file attachment for session note
     */
    uploadAttachment: tutorProcedure
      .input(z.object({
        sessionNoteId: z.number(),
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the note belongs to this tutor
        const note = await db.getSessionNoteById(input.sessionNoteId);
        if (!note) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session note not found' });
        }
        if (note.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only add attachments to your own notes' });
        }

        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        const fileSize = fileBuffer.length;

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (fileSize > maxSize) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds 10MB limit' });
        }

        // Generate unique file key
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileKey = `session-notes/${input.sessionNoteId}/${randomSuffix}-${sanitizedFileName}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

        // Save to database
        const attachment = await db.createSessionNoteAttachment({
          sessionNoteId: input.sessionNoteId,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
        });

        if (!attachment) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save attachment' });
        }

        return attachment;
      }),

    /**
     * Get attachments for a session note
     */
    getAttachments: protectedProcedure
      .input(z.object({ sessionNoteId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify user has access to this note
        const note = await db.getSessionNoteById(input.sessionNoteId);
        if (!note) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session note not found' });
        }
        if (note.tutorId !== ctx.user.id && note.parentId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this note' });
        }

        return await db.getSessionNoteAttachments(input.sessionNoteId);
      }),

    /**
     * Delete an attachment
     */
    deleteAttachment: tutorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await db.getSessionNoteAttachmentById(input.id);
        if (!attachment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Attachment not found' });
        }

        // Verify the attachment belongs to this tutor's note
        const note = await db.getSessionNoteById(attachment.sessionNoteId);
        if (!note || note.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own attachments' });
        }

        const success = await db.deleteSessionNoteAttachment(input.id);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete attachment' });
        }

        return { success: true };
      }),

    /**
     * Create session notes from AI-processed transcript
     */
    createFromTranscript: tutorProcedure
      .input(z.object({
        sessionId: z.number(),
        transcript: z.string(),
        processedData: z.object({
          progressSummary: z.string(),
          challenges: z.string().optional(),
          nextSteps: z.string().optional(),
          topicsCovered: z.array(z.string()),
          homework: z.string().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the session belongs to this tutor
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }
        if (session.tutorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only add notes to your own sessions' });
        }

        // Check if note already exists for this session
        const existing = await db.getSessionNoteBySessionId(input.sessionId);

        let note;
        if (existing) {
          // Update existing note
          note = await db.updateSessionNote(existing.id, {
            progressSummary: input.processedData.progressSummary,
            challenges: input.processedData.challenges || null,
            nextSteps: input.processedData.nextSteps || null,
            homework: input.processedData.homework || null,
            transcript: input.transcript,
            topicsCovered: JSON.stringify(input.processedData.topicsCovered),
          });
        } else {
          // Create new session note with AI-generated content
          note = await db.createSessionNote({
            sessionId: input.sessionId,
            tutorId: ctx.user.id,
            parentId: session.parentId,
            progressSummary: input.processedData.progressSummary,
            challenges: input.processedData.challenges || null,
            nextSteps: input.processedData.nextSteps || null,
            homework: input.processedData.homework || null,
            transcript: input.transcript,
            topicsCovered: JSON.stringify(input.processedData.topicsCovered),
          });
        }

        if (!note) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save session note' });
        }

        // Send email notification to parent
        try {
          const parent = await db.getUserById(session.parentId);
          const tutor = await db.getUserById(ctx.user.id);

          if (parent?.email && tutor) {
            const sessionDate = new Date(session.scheduledAt);
            const parentProfile = await db.getParentProfileByUserId(parent.id);

            let studentName = "your child";
            let courseName = "the course";
            if (session.subscriptionId) {
              const subscription = await db.getSubscriptionById(session.subscriptionId);
              if (subscription) {
                const firstName = (subscription as any).studentFirstName || "";
                const lastName = (subscription as any).studentLastName || "";
                if (firstName || lastName) studentName = `${firstName} ${lastName}`.trim();
              }
            }
            if (session.courseId) {
              const course = await db.getCourseById(session.courseId);
              if (course?.title) courseName = course.title;
            }

            const emailHtml = await sendSessionNotesEmail({
              parentName: parent.name || parent.email,
              studentName,
              tutorName: tutor.name || `${(tutor as any).firstName || ""} ${(tutor as any).lastName || ""}`.trim() || "Your tutor",
              courseName,
              sessionDate: formatEmailDate(sessionDate, parentProfile?.timezone || undefined),
              sessionTime: formatEmailTime(sessionDate, parentProfile?.timezone || undefined),
              progressSummary: input.processedData.progressSummary,
              homework: input.processedData.homework || undefined,
              challenges: input.processedData.challenges || undefined,
              nextSteps: input.processedData.nextSteps || undefined,
              notesUrl: `${process.env.VITE_FRONTEND_FORGE_API_URL || ""}/session-notes`,
            });

            await emailService.sendEmail({
              to: parent.email,
              subject: `Session Notes for ${studentName} — ${courseName}`,
              html: emailHtml,
            });

            await db.markSessionNoteAsNotified(note.id);
          }
        } catch (emailError) {
          console.error("[Session Notes] Failed to send email notification:", emailError);
          // Don't fail the mutation if email fails
        }

        return note;
      }),
  }),

  // Super-user password management (admin only, no super-user cookie required)
  adminSuperUser: router({
    getPasswordStatus: adminProcedure.query(async ({ ctx }) => {
      const hash = await db.getSuperUserPasswordHash(ctx.user.id);
      return { isSet: hash !== null };
    }),

    setPassword: adminProcedure
      .input(z.object({
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        currentSuperPassword: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existingHash = await db.getSuperUserPasswordHash(ctx.user.id);
        if (existingHash) {
          if (!input.currentSuperPassword) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current super-user password is required' });
          }
          const valid = await verifyPassword(input.currentSuperPassword, existingHash);
          if (!valid) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Incorrect current super-user password' });
          }
        }
        const newHash = await hashPassword(input.newPassword);
        await db.setSuperUserPasswordHash(ctx.user.id, newHash);
        return { success: true };
      }),
  }),

  // Course Management (Admin)
  adminCourses: router({
    getAllCoursesWithTutors: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        subject: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const courses = await db.getAllCoursesWithTutors(input);
        return courses;
      }),

    createCourse: adminProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        subject: z.string(),
        gradeLevel: z.string().optional(),
        price: z.string(),
        priceInr: z.string().nullable().optional(),
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
        curriculum: z.string().optional(),
        aiPowered: z.boolean().optional(),
        region: z.enum(["global", "us", "india"]).optional().or(z.literal("")).transform(v => v || undefined),
        courseType: z.enum(["tutor", "homework", "test_prep"]).optional().or(z.literal("")).transform(v => v || undefined),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const course = await db.createCourse(input as any);
        return course;
      }),

    updateCourse: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        subject: z.string().optional(),
        gradeLevel: z.string().optional(),
        price: z.string().optional(),
        priceInr: z.string().optional().nullable(),
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
        curriculum: z.string().optional(),
        isActive: z.boolean().optional(),
        aiPowered: z.boolean().optional(),
        region: z.enum(["global", "us", "india"]).optional().or(z.literal("")).transform(v => v || undefined),
        courseType: z.enum(["tutor", "homework", "test_prep"]).optional().or(z.literal("")).transform(v => v || undefined),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCourse(id, data);
        return { success: true };
      }),

    deleteCourse: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.deleteCourse(input.id);
        return { success: true };
      }),

    assignCourseToTutor: adminProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
        isPrimary: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.addTutorToCourse(input.courseId, input.tutorId, input.isPrimary || false);
        return { success: true };
      }),

    unassignCourseFromTutor: adminProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removeTutorFromCourse(input.courseId, input.tutorId);
        return { success: true };
      }),

    getCourseAssignments: adminProcedure
      .input(z.object({
        courseId: z.number(),
      }))
      .query(async ({ input }) => {
        const assignments = await db.getCourseAssignments(input.courseId);
        return assignments;
      }),

    getAllTutorsForAssignment: adminProcedure
      .query(async () => {
        const tutors = await db.getAllTutorsForAssignment();
        return tutors;
      }),

    getPayoutRequests: superAdminProcedure.query(async () => {
      return await db.getAllTutorPayoutRequests();
    }),

    updatePayoutRequest: superAdminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateTutorPayoutRequestStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),

    triggerUsageBilling: superAdminProcedure
      .mutation(async () => {
        const { processUsageBilling } = await import("./cron");
        await processUsageBilling();
        return { success: true };
      }),
  }),

  // Coordinator Management
  coordinators: router({
    /**
     * Create a new coordinator (admin only)
     */
    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        specialization: z.string().optional(),
        phoneNumber: z.string().optional(),
        bio: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if email already exists
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email already in use' });
        }

        const user = await db.createAuthUser({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: 'coordinator',
          userType: 'coordinator',
          passwordHash: null, // Will need to set password via setup token
        });

        if (!user) {
          console.error("[Coordinator Create] Failed to create user account");
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create coordinator' });
        }

        const profileId = await db.createCoordinatorProfile({
          userId: user.id,
          specialization: input.specialization,
          phoneNumber: input.phoneNumber,
          bio: input.bio,
          isActive: true,
        });

        if (!profileId) {
          console.error("[Coordinator Create] Failed to create coordinator profile for user:", user.id);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create coordinator profile' });
        }

        try {
          const setupToken = await db.createPasswordSetupToken(user.id);
          if (setupToken) {
            const setupUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

            const { sendCoordinatorPasswordSetupEmail } = await import('./email-helpers');
            const emailSent = await sendCoordinatorPasswordSetupEmail({
              coordinatorEmail: user.email,
              coordinatorName: `${user.firstName} ${user.lastName}`,
              setupUrl,
              expiresAt,
            });
          }
        } catch (emailError) {
          console.error('[Coordinator Creation] Failed to send password setup email:', emailError);
          console.error('[Coordinator Creation] Email error details:', JSON.stringify(emailError, null, 2));
          // Don't fail the entire operation if email fails
        }

        return {
          success: true,
          coordinatorId: user.id,
          message: 'Coordinator created successfully. Password setup email sent.'
        };
      }),

    /**
     * Resend password setup email for coordinator (admin only)
     */
    resendPasswordSetup: adminProcedure
      .input(z.object({
        coordinatorId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserById(input.coordinatorId);
        if (!user || user.role !== 'coordinator') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Coordinator not found' });
        }

        // Create new password setup token
        const setupToken = await db.createPasswordSetupToken(user.id);
        if (!setupToken) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create password setup token' });
        }

        // Send email
        try {
          const setupUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

          const { sendCoordinatorPasswordSetupEmail } = await import('./email-helpers');
          await sendCoordinatorPasswordSetupEmail({
            coordinatorEmail: user.email,
            coordinatorName: `${user.firstName} ${user.lastName}`,
            setupUrl,
            expiresAt,
          });

          return {
            success: true,
            message: 'Password setup email sent successfully',
            setupLink: setupUrl
          };
        } catch (error) {
          console.error('[Resend Password Setup] Email failed:', error);
          // Return the link anyway so admin can manually share it
          const setupUrlFallback = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
          return {
            success: false,
            message: 'Email failed but here is the setup link',
            setupLink: setupUrlFallback
          };
        }
      }),

    /**
     * Get all coordinators (admin only)
     */
    getAll: adminProcedure
      .query(async () => {
        const coordinators = await db.getAllCoordinators();
        return coordinators;
      }),

    /**
     * Assign coordinator to parent (admin only)
     */
    assignToParent: adminProcedure
      .input(z.object({
        coordinatorId: z.number(),
        parentId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const assignmentId = await db.createCoordinatorAssignment({
          coordinatorId: input.coordinatorId,
          parentId: input.parentId,
          assignedBy: ctx.user.id,
          notes: input.notes,
          isActive: true,
        });

        if (!assignmentId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create assignment' });
        }

        return { success: true, assignmentId };
      }),

    /**
     * Remove coordinator assignment (admin only)
     */
    removeAssignment: adminProcedure
      .input(z.object({
        assignmentId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const success = await db.deactivateCoordinatorAssignment(input.assignmentId);

        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove assignment' });
        }

        return { success: true };
      }),

    /**
     * Get all coordinator assignments (admin only)
     */
    getAllAssignments: adminProcedure
      .query(async () => {
        const assignments = await db.getAllCoordinatorAssignments();
        return assignments;
      }),

    /**
     * Get coordinator's assignments (simple list for dashboard)
     */
    getMyAssignments: coordinatorProcedure
      .query(async ({ ctx }) => {
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        return assignments;
      }),

    /**
     * Get coordinator's assigned parents (coordinator or admin)
     */
    getMyAssignedParents: coordinatorProcedure
      .query(async ({ ctx }) => {
        const assignments = await db.getCoordinatorAssignmentsByCoordinator(ctx.user.id);
        return assignments;
      }),

    /**
     * Get parent's assigned coordinator (accessible by parent/tutor/coordinator/admin)
     */
    getParentCoordinator: protectedProcedure
      .input(z.object({
        parentId: z.number(),
      }))
      .query(async ({ input }) => {
        const assignments = await db.getCoordinatorAssignmentsByParent(input.parentId);
        return assignments.length > 0 ? assignments[0] : null;
      }),
  }),

  tutors: router({
    /**
     * Search and filter tutors by subject, rating, and availability
     */
    search: publicProcedure
      .input(z.object({
        subjects: z.array(z.string()).optional(),
        gradeLevels: z.array(z.string()).optional(),
        minRate: z.number().optional(),
        maxRate: z.number().optional(),
        minRating: z.number().min(0).max(5).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const tutors = await db.searchTutors(input);
        
        // Fetch availability for each tutor
        const tutorsWithAvailability = await Promise.all(
          tutors.map(async (tutor) => {
            const availability = await db.getTutorAvailability(tutor.userId);
            return {
              ...tutor,
              availability: availability || [],
            };
          })
        );
        
        return tutorsWithAvailability;
      }),

    /**
     * Get reviews for a specific tutor
     */
    getReviews: publicProcedure
      .input(z.object({ tutorId: z.number() }))
      .query(async ({ input }) => {
        const reviews = await db.getTutorReviews(input.tutorId);
        return reviews;
      }),

    /**
     * Submit a review for a tutor (parent only)
     */
    submitReview: protectedProcedure
      .input(z.object({
        tutorId: z.number(),
        sessionId: z.number().optional(),
        rating: z.number().min(1).max(5),
        review: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the parent has had a session with this tutor
        const sessions = await db.getSessionsByParentId(ctx.user.id);
        const hasSession = sessions.some(s => s.session.tutorId != null && s.session.tutorId === input.tutorId);

        if (!hasSession) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only review tutors you have had sessions with',
          });
        }

        const reviewId = await db.createTutorReview({
          tutorId: input.tutorId,
          parentId: ctx.user.id,
          sessionId: input.sessionId,
          rating: input.rating,
          review: input.review,
        });

        if (!reviewId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to submit review',
          });
        }

        return { success: true, reviewId };
      }),
  }),

  bookingManagement: router({
    /**
     * Get session details by management token
     */
    getSession: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (!isValidBookingToken(input.token)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Invalid booking token' 
          });
        }

        const session = await db.getSessionByToken(input.token);
        if (!session) {
          throw new TRPCError({ 
            code: 'NOT_FOUND', 
            message: 'Booking not found or token expired' 
          });
        }

        // Get full session details with related data
        const sessionDetails = await db.getSessionWithDetails(session.id);
        if (!sessionDetails) {
          throw new TRPCError({ 
            code: 'NOT_FOUND', 
            message: 'Session details not found' 
          });
        }

        return sessionDetails;
      }),

    /**
     * Cancel a session via management token
     */
    cancelSession: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        if (!isValidBookingToken(input.token)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Invalid booking token' 
          });
        }

        const session = await db.getSessionByToken(input.token);
        if (!session) {
          throw new TRPCError({ 
            code: 'NOT_FOUND', 
            message: 'Booking not found' 
          });
        }

        // Check if session is already cancelled or completed
        if (session.status === 'cancelled') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'This session is already cancelled' 
          });
        }

        if (session.status === 'completed') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Cannot cancel a completed session' 
          });
        }

        // Check if session is in the past
        if (session.scheduledAt < Date.now()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot cancel a session that has already passed'
          });
        }

        const success = await db.cancelSession(session.id);
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to cancel session' 
          });
        }

        // Get session details for email
        const sessionDetails = await db.getSessionWithDetails(session.id);
        if (sessionDetails && sessionDetails.parentUser) {
          // Send cancellation confirmation email
          try {
            await sendCancellationConfirmationEmail({
              parentEmail: sessionDetails.parentUser.email || "",
              parentName: sessionDetails.parentUser.name || "Parent",
              studentName: "Student", // TODO: Get actual student name from subscription
              courseName: sessionDetails.course?.title || "Course",
              tutorName: sessionDetails.tutorUser?.name || "Tutor",
              sessionDate: new Date(sessionDetails.scheduledAt),
              sessionDuration: sessionDetails.duration,
            });
          } catch (error) {
            console.error('[Booking Management] Failed to send cancellation email:', error);
            // Don't fail the cancellation if email fails
          }
        }

        return { success: true, message: 'Session cancelled successfully' };
      }),
  }),

  // Tutor Dashboard
  tutorDashboard: router({
    /**
     * Get dashboard overview data (earnings, upcoming sessions, stats)
     */
    getOverview: tutorProcedure
      .query(async ({ ctx }) => {
        const [earnings, upcomingSessions, profile, reviews] = await Promise.all([
          db.getTutorEarnings(ctx.user.id),
          db.getUpcomingSessionsByTutorId(ctx.user.id),
          db.getTutorProfileByUserId(ctx.user.id),
          db.getTutorReviews(ctx.user.id),
        ]);

        // Calculate monthly earnings (current month)
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const earningsHistory = await db.getPaymentsByTutorId(ctx.user.id);
        const monthlyEarnings = earningsHistory
          .filter(payment => new Date(payment.createdAt) >= firstDayOfMonth)
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

        return {
          totalEarnings: earnings?.total?.toString() || '0',
          monthlyEarnings: monthlyEarnings.toFixed(2),
          upcomingSessions: upcomingSessions.slice(0, 5), // Next 5 sessions
          totalSessions: upcomingSessions.length,
          rating: profile?.rating || 0,
          totalReviews: profile?.totalReviews || 0,
          recentReviews: reviews.slice(0, 3), // Last 3 reviews
        };
      }),

    /**
     * Get all upcoming sessions
     */
    getUpcomingSessions: tutorProcedure
      .query(async ({ ctx }) => {
        return await db.getUpcomingSessionsByTutorId(ctx.user.id);
      }),

    /**
     * Get past sessions
     */
    getPastSessions: tutorProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getPastSessionsByTutorId(ctx.user.id, input.limit, input.offset);
      }),

    /**
     * Get earnings history
     */
    getEarningsHistory: tutorProcedure
      .query(async ({ ctx }) => {
        return await db.getPaymentsByTutorId(ctx.user.id);
      }),
  }),

  /**
   * Notifications router - in-app notifications for users
   */
  /**
   * AI utilities router - AI-powered features
   */
  ai: router({
    /**
     * Summarize text using AI (tutor only)
     */
    summarizeText: tutorProcedure
      .input(z.object({
        text: z.string().min(1, "Text cannot be empty"),
        maxLength: z.number().optional().default(150),
        sessionDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const { GoogleGenerativeAI } = await import("@google/generative-ai");

        if (!ENV.geminiApiKey) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.'
          });
        }

        try {
          const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
          // Using gemini-2.5-flash (latest fast model)
          const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
              temperature: 0,
            },
          });

          const sessionDateStr = input.sessionDate
            ? `Session date: ${input.sessionDate}`
            : `Session date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

          const prompt = `You are an assistant that generates structured, parent-facing session summaries for 1-on-1 tutoring sessions.

${sessionDateStr}

STRICT OUTPUT FORMAT — follow exactly, no deviations:

**Student Progress:**
2–3 sentences describing what the student understood, accomplished, or improved during this session.

**Challenges:**
2–3 sentences describing specific areas where the student struggled or made errors.

**Topics Covered:**
Topic 1, Topic 2, Topic 3 (3–6 comma-separated topics, no bullet points)

**Next Steps:**
2–3 sentences describing what the student should focus on or practice before the next session.

RULES:
- Use the exact bold headers above (**Student Progress:**, **Challenges:**, **Topics Covered:**, **Next Steps:**).
- Do NOT write any introduction, opening line, or closing sentence.
- Do NOT mention the tutor, tutor actions, or tutor decisions in any section.
- Do NOT use bullet points, dashes, or numbered lists.
- Write plain paragraph text under each section except Topics Covered (which is comma-separated).
- This is a 1-on-1 session with a single student — do not reference multiple students.
- Do not refer to the session date unless directly relevant to a topic.

Summarize the following session notes:

${input.text}`;

          const result = await model.generateContent(prompt);
          const response = result.response;
          const summary = response.text();

          if (!summary) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to generate summary'
            });
          }

          return { summary };
        } catch (error: any) {
          console.error('[AI Summarize] Error:', error);

          // Handle invalid API key
          if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file.'
            });
          }

          // Handle quota/rate limit errors
          if (error?.message?.includes('quota') || error?.message?.includes('RATE_LIMIT')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Gemini API quota exceeded. Please check your usage at aistudio.google.com'
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to summarize text'
          });
        }
      }),

    /**
     * Process Zoom transcript and generate structured session notes
     */
    processTranscript: tutorProcedure
      .input(z.object({
        transcript: z.string().min(50, "Transcript too short (minimum 50 characters)"),
        sessionId: z.number(),
        studentName: z.string().optional(),
        courseName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const { GoogleGenerativeAI } = await import("@google/generative-ai");

        if (!ENV.geminiApiKey) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Gemini API key is not configured.'
          });
        }

        try {
          const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

          // Create structured prompt for transcript analysis
          const prompt = `You are an expert educational assistant analyzing a tutoring session transcript.

STUDENT: ${input.studentName || 'Student'}
COURSE: ${input.courseName || 'General'}

TRANSCRIPT:
${input.transcript}

CRITICAL: You must respond with ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Analyze this transcript and provide a structured response in EXACTLY this JSON format:

{
  "progressSummary": "Brief summary of what the student learned and accomplished during this session (2-3 sentences)",
  "challenges": "Areas where the student struggled or needed help (bullet points or brief paragraph)",
  "nextSteps": "Specific recommendations for the next session and areas to focus on",
  "topicsCovered": ["Topic 1", "Topic 2", "Topic 3"],
  "homework": {
    "assignments": [
      {
        "title": "Assignment title",
        "description": "What the student should do",
        "estimatedTime": "15-20 minutes"
      }
    ],
    "summary": "Brief overview of all homework (1-2 sentences)"
  }
}

Focus on:
- Being specific and actionable
- Highlighting key learning moments
- Identifying 3-5 main topics covered
- Creating homework that reinforces session concepts
- Keeping tone professional but encouraging

Return ONLY the JSON object, nothing else.`;

          const result = await model.generateContent(prompt);
          const response = result.response;
          const text = response.text();

          // Log token usage for monitoring
          const usageMetadata = response.usageMetadata;
          if (usageMetadata) {
            console.log('[AI Token Usage]', {
              promptTokens: usageMetadata.promptTokenCount,
              responseTokens: usageMetadata.candidatesTokenCount,
              totalTokens: usageMetadata.totalTokenCount,
              transcriptSize: input.transcript.length,
            });
          }

          // Parse JSON response (handle markdown code blocks)
          let jsonText = text.trim();

          // Remove markdown code blocks
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
          }

          // Remove any leading/trailing non-JSON text
          const jsonStart = jsonText.indexOf('{');
          const jsonEnd = jsonText.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
          }

          let parsed;
          try {
            parsed = JSON.parse(jsonText);
          } catch (parseError) {
            // Log the problematic response for debugging
            console.error('[AI Process Transcript] Failed to parse JSON:', jsonText.substring(0, 500));
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'AI returned invalid format. Please try again or use a shorter transcript.'
            });
          }

          // Validate required fields
          if (!parsed.progressSummary) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'AI response missing required fields. Please try again.'
            });
          }

          // Normalize challenges to string (handle array or string)
          let challengesText = '';
          if (parsed.challenges) {
            if (Array.isArray(parsed.challenges)) {
              challengesText = parsed.challenges.map((c: any, idx: number) => `${idx + 1}. ${c}`).join('\n');
            } else {
              challengesText = String(parsed.challenges);
            }
          }

          // Normalize nextSteps to string (handle array or string)
          let nextStepsText = '';
          if (parsed.nextSteps) {
            if (Array.isArray(parsed.nextSteps)) {
              nextStepsText = parsed.nextSteps.map((s: any, idx: number) => `${idx + 1}. ${s}`).join('\n');
            } else {
              nextStepsText = String(parsed.nextSteps);
            }
          }

          // Format homework for storage
          const homeworkText = parsed.homework?.assignments
            ? parsed.homework.assignments
                .map((hw: any, idx: number) =>
                  `${idx + 1}. ${hw.title}\n   ${hw.description}\n   Estimated time: ${hw.estimatedTime}`
                )
                .join('\n\n')
            : '';

          return {
            progressSummary: String(parsed.progressSummary || ''),
            challenges: challengesText,
            nextSteps: nextStepsText,
            topicsCovered: parsed.topicsCovered || [],
            homework: homeworkText,
            rawResponse: parsed, // Include full response for debugging
          };
        } catch (error: any) {
          console.error('[AI Process Transcript] Error:', error);

          // Handle parsing errors
          if (error instanceof SyntaxError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to parse AI response. Please try again.'
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to process transcript'
          });
        }
      }),

    generateQuiz: tutorProcedure
      .input(z.object({
        transcript: z.string().min(50, "Transcript too short"),
        sessionId: z.number(),
        courseName: z.string().optional(),
        studentName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { ENV } = await import("./_core/env");
        const { GoogleGenerativeAI } = await import("@google/generative-ai");

        if (!ENV.geminiApiKey) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Gemini API key not configured.' });
        }

        const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `You are an expert educational assistant. Based on the following tutoring session transcript, generate 5 to 8 multiple-choice questions to test the student's understanding.

STUDENT: ${input.studentName || 'Student'}
COURSE: ${input.courseName || 'General'}

TRANSCRIPT:
${input.transcript}

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

Generate questions in EXACTLY this JSON format:
{
  "questions": [
    {
      "id": "1",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

Rules:
- Exactly 4 options per question
- correctAnswer is the 0-based index of the correct option
- Only ask about topics actually covered in the transcript
- Keep questions clear and age-appropriate

Return ONLY the JSON object.`;

        try {
          const result = await model.generateContent(prompt);
          let jsonText = result.response.text().trim();

          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
          }
          const start = jsonText.indexOf('{');
          const end = jsonText.lastIndexOf('}');
          if (start !== -1 && end !== -1) jsonText = jsonText.substring(start, end + 1);

          let parsed: { questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number }> };
          try {
            parsed = JSON.parse(jsonText);
          } catch {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI returned invalid format. Please try again.' });
          }

          if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No questions generated. Try again.' });
          }

          return { questions: parsed.questions };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate quiz',
          });
        }
      }),

    /**
     * Grade a session transcript using the EdKonnect 4-criteria rubric (1–4 scale).
     * Returns scores + evidence per criterion, overall score, and transcript quality signal.
     */
    gradeSession: tutorProcedure
      .input(z.object({
        transcript: z.string(),
        sessionId: z.number(),
        studentName: z.string().optional(),
        courseName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Guard: transcript must be long enough to grade meaningfully
        const wordCount = input.transcript.trim().split(/\s+/).length;
        if (wordCount < 300) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Transcript too short to grade accurately (fewer than 300 words). Check Zoom recording quality.',
          });
        }

        // Return cached result if this session has already been graded
        const cached = await db.getSessionRubricGrades(input.sessionId);
        if (cached?.rubricGradedAt && cached.rubricEvidence) {
          const grades = JSON.parse(cached.rubricEvidence as string);
          return {
            grades,
            overallScore: Number(cached.rubricOverallScore ?? 0),
            overallNarrative: '',
            transcriptQuality: cached.rubricTranscriptQuality ?? 'medium',
            transcriptQualityReason: cached.rubricTranscriptQualityReason ?? '',
            engagementData: cached.rubricEngagementData ? JSON.parse(cached.rubricEngagementData as string) : null,
          };
        }

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object' as any,
              required: ['grades', 'overallScore', 'overallNarrative', 'transcriptQuality', 'transcriptQualityReason', 'engagementData'],
              properties: {
                grades: {
                  type: 'array' as any,
                  items: {
                    type: 'object' as any,
                    required: ['criterion', 'score', 'evidence'],
                    properties: {
                      criterion: { type: 'string' as any },
                      score: { type: 'number' as any },
                      evidence: { type: 'string' as any },
                    },
                  },
                },
                overallScore: { type: 'number' as any },
                overallNarrative: { type: 'string' as any },
                transcriptQuality: { type: 'string' as any },
                transcriptQualityReason: { type: 'string' as any },
                engagementData: {
                  type: 'object' as any,
                  properties: {
                    studentParticipationRate: { type: 'string' as any },
                    studentRole: { type: 'string' as any },
                    studentCriticalThinking: { type: 'string' as any },
                    tutorParticipationRate: { type: 'string' as any },
                    tutorRole: { type: 'string' as any },
                    tutorInstructionalStyle: { type: 'string' as any },
                  },
                },
              },
            } as any,
          } as any,
        });

        const prompt = `You are an educational analyst writing reports for parents about their child's learning session. Your job is to describe ONLY the student's experience, behavior, and outcomes — never the tutor.

IMPORTANT RULES (MUST FOLLOW):
- Do NOT evaluate, mention, or judge the tutor in any way.
- Do NOT explain tutor decisions, teaching style, or session structure.
- Focus ONLY on the student's experience, behavior, and outcomes.
- Describe what the student did, understood, struggled with, or completed.
- Avoid phrases like "the tutor did", "the session started with", "teaching style", or any tutor-related explanation.
- Do NOT infer causes related to the tutor. Only describe observable student outcomes.
- Keep language simple, clear, and parent-friendly.
- Each section must reflect what the parent can understand about their child's learning.
- ALWAYS refer to the student as "the student" — never use their name, and never use pronouns like "he", "she", "they", "him", "her". Every reference must be "the student".

COURSE: ${input.courseName || 'General'}

TRANSCRIPT:
${input.transcript}

RUBRIC CRITERIA — score each 1–4 based solely on observable student behavior:

1. Academic Efficiency & Time Management
   4 (Exceeds): Student is actively working within minutes and stays focused almost the entire time.
   3 (Proficient): Student settles in quickly and stays mostly focused throughout.
   2 (Developing): Student loses focus, gets distracted, or spends noticeable time off-task.
   1 (Support): Student is largely off-task or unproductive for much of the time.

2. Learning Engagement & Understanding
   4 (Exceeds): Student explains their thinking clearly and attempts problems independently.
   3 (Proficient): Student practices concepts and shows understanding through their responses.
   2 (Developing): Student mostly follows along without attempting problems independently.
   1 (Support): Student is disengaged, gives minimal responses, or copies without understanding.

3. Strategy & Problem-Solving Skills
   4 (Exceeds): Student applies techniques and approaches problems efficiently on their own.
   3 (Proficient): Student understands the concept and can apply basic steps with some prompting.
   2 (Developing): Student follows steps when guided but cannot apply them independently.
   1 (Support): Student struggles to understand or apply the concept even with guidance.

4. Learning Takeaways
   4 (Exceeds): Student can clearly articulate what they learned and has a concrete next step.
   3 (Proficient): Student shows understanding of the key concept and has some direction for practice.
   2 (Developing): Student leaves without a clear sense of what was covered or what to practice.
   1 (Support): Student shows no clear takeaway or direction from the session.

Assess transcript quality: "high" (clear speaker labels, complete), "medium" (some gaps), or "low" (poor attribution, many gaps).

For engagementData, describe ONLY the student's participation and behavior. The tutor section is for participation rate only — do not describe or judge the tutor.
- studentParticipationRate: estimate the percentage of total dialogue spoken by the student. Must be a percentage string like "~35%" or "~40% of the dialogue". Count approximate speaking turns. Do NOT use words like "High" or "Low" — only a percentage.
- tutorParticipationRate: same format, e.g. "~65% of the dialogue". Must add up to ~100% with the student rate.
- studentRole: 2–3 sentences describing HOW the student engaged — did they ask questions, give short answers, explain their reasoning, initiate topics? Use specific examples from the transcript. No mention of the tutor.
- studentCriticalThinking: Start with "High", "Medium", or "Low", then 1–2 sentences of specific evidence from the student's own words or actions. No mention of the tutor.
- tutorRole: leave this as an empty string "".
- tutorInstructionalStyle: leave this as an empty string "".`;

        try {
          const result = await model.generateContent(prompt);

          const rawText = result.response.text();

          let parsed: any;
          try {
            parsed = JSON.parse(rawText);
          } catch {
            // Log the actual response so we can diagnose (HTML error page, truncated JSON, etc.)
            console.error('[gradeSession] Gemini returned non-JSON response:', rawText.substring(0, 500));
            const isHtml = rawText.trim().startsWith('<');
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: isHtml
                ? 'Grading failed: Gemini API returned an error (possibly rate limited or transcript too long). Please try again in a moment.'
                : 'Grading failed: AI returned unexpected format. Please try again.',
            });
          }

          if (!parsed.grades || parsed.grades.length !== 4) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI grading response was malformed.' });
          }

          const [ae, lq, si, sv] = parsed.grades as { criterion: string; score: number; evidence: string }[];
          const overallScore = parsed.overallScore ?? ((ae.score + lq.score + si.score + sv.score) / 4);

          const sessionRow = await db.getSessionById(input.sessionId);
          const recordingId = (sessionRow as any)?.zoomMeetingId ?? null;

          await db.saveSessionRubricGrades({
            sessionId: input.sessionId,
            recordingId,
            academicEfficiency: ae.score,
            instructionalQuality: lq.score,
            strategyInsight: si.score,
            synthesisBranding: sv.score,
            evidence: parsed.grades,
            overallScore,
            transcriptQuality: parsed.transcriptQuality || 'medium',
            transcriptQualityReason: parsed.transcriptQualityReason || '',
            engagementData: parsed.engagementData || null,
          });

          return {
            grades: parsed.grades,
            overallScore,
            overallNarrative: parsed.overallNarrative || '',
            transcriptQuality: parsed.transcriptQuality || 'medium',
            transcriptQualityReason: parsed.transcriptQualityReason || '',
            engagementData: parsed.engagementData || null,
          };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to grade session',
          });
        }
      }),
  }),

  notifications: router({
    /**
     * Get notifications for current user
     */
    getNotifications: protectedProcedure
      .input(z.object({
        includeRead: z.boolean().optional().default(true),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getInAppNotifications(ctx.user.id, input?.includeRead);
      }),

    /**
     * Get unread notification count
     */
    getUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),

    /**
     * Mark notification as read
     */
    markAsRead: protectedProcedure
      .input(z.object({
        notificationId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify notification belongs to user
        const notifications = await db.getInAppNotifications(ctx.user.id, true);
        const notification = notifications.find(n => n.id === input.notificationId);

        if (!notification) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
        }

        await db.markNotificationAsRead(input.notificationId);
        return { success: true };
      }),

    /**
     * Mark all notifications as read
     */
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsAsRead(ctx.user.id);
        return { success: true };
      }),

    /**
     * Delete all notifications for current user
     */
    deleteAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.deleteAllNotifications(ctx.user.id);
        return { success: true };
      }),
  }),

  /**
   * Zoom integration for fetching transcripts
   */
  zoom: router({
    /**
     * List available Zoom recordings
     */
    listRecordings: protectedProcedure
      .input(z.object({
        from: z.string().optional(), // YYYY-MM-DD
        to: z.string().optional(), // YYYY-MM-DD
        pageSize: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ input }) => {
        const { listZoomRecordings } = await import('./zoom-service');

        try {
          const recordings = await listZoomRecordings({
            from: input.from,
            to: input.to,
            pageSize: input.pageSize,
          });

          return recordings;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch Zoom recordings',
          });
        }
      }),

    /**
     * List all recording instances for a meetingId on a given date.
     * Used to identify the correct recording when a session has multiple instances
     * (e.g., participants left and rejoined, creating a short failed attempt + a longer real class).
     */
    listRecordingInstances: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        // Verify session ownership and derive meetingId from tutor's profile server-side.
        const session = await db.getSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }
        const userId = ctx.user.id;
        const role = ctx.user.role;
        if (role !== 'admin' && session.tutorId !== userId && session.parentId !== userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this session' });
        }

        // Get meetingId from the tutor's profile — not from the client
        const tutorProfile = await db.getTutorProfileByUserId(session.tutorId!);
        if (!tutorProfile?.zoomMeetingId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No Zoom meeting configured for this tutor' });
        }
        const meetingId = tutorProfile.zoomMeetingId;
        const sessionScheduledAt = Number(session.scheduledAt);

        const { getZoomAccessToken } = await import('./zoom-service');
        const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

        const from = new Date(sessionScheduledAt - 86400000).toISOString().slice(0, 10);
        const to   = new Date(sessionScheduledAt + 86400000).toISOString().slice(0, 10);

        // Resolve host email so we can list all instances (not just latest)
        const accessToken = await getZoomAccessToken();
        const infoRes = await fetch(`${ZOOM_API_BASE_URL}/meetings/${meetingId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        let zoomUserId = 'me';
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.host_email) zoomUserId = info.host_email;
        }

        // Paginate through all recordings for that date range
        const allMeetings: any[] = [];
        let nextPageToken: string | undefined;
        do {
          const token = await getZoomAccessToken();
          const params = new URLSearchParams({ page_size: '100', from, to });
          if (nextPageToken) params.append('next_page_token', nextPageToken);
          const res = await fetch(
            `${ZOOM_API_BASE_URL}/users/${encodeURIComponent(zoomUserId)}/recordings?${params}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) {
            const errText = await res.text();
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Zoom API error: ${errText}` });
          }
          const data = await res.json();
          allMeetings.push(...(data.meetings ?? []));
          nextPageToken = data.next_page_token;
        } while (nextPageToken);

        const TOLERANCE_MS = 40 * 60 * 1000; // same window as auto-detection

        return allMeetings
          .filter(m => String(m.id) === String(meetingId))
          .filter(m => Math.abs(new Date(m.start_time).getTime() - sessionScheduledAt) <= TOLERANCE_MS)
          .map(m => ({
            uuid: m.uuid as string,
            startTime: m.start_time as string,
            durationMinutes: m.duration as number,
            hasTranscript: (m.recording_files as any[])?.some((f: any) => f.file_type === 'TRANSCRIPT') ?? false,
          }))
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      }),

    /**
     * Fetch transcript for a specific meeting
     */
    fetchTranscript: protectedProcedure
      .input(z.object({
        meetingId: z.string(),
        sessionId: z.number().optional(),
        sessionScheduledAt: z.number().optional(), // Unix ms — used to find the correct recording instance
        forceUuid: z.string().optional(), // Admin override: bypass cache + auto-detection, use this UUID
      }))
      .mutation(async ({ input, ctx }) => {
        const { fetchZoomTranscript, getZoomRecording, findRecordingUuidBySessionTime } = await import('./zoom-service');
        const { zoomMeetingRecordings } = await import('../drizzle/schema');
        const database = await db.getDb();

        if (!database) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }

        const { eq, and, isNull, sql: drizzleSql } = await import('drizzle-orm');

        try {
          // Ownership check: verify the session belongs to the calling user before any mutation.
          if (input.sessionId) {
            const session = await db.getSessionById(input.sessionId);
            if (!session) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
            }
            const userId = ctx.user.id;
            const role = ctx.user.role;
            if (role !== 'admin' && session.tutorId !== userId && session.parentId !== userId) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this session' });
            }
          }

          // Admin override: delete the existing (wrong) row and re-fetch using the specified UUID,
          // bypassing both the cache check and auto-detection below.
          if (input.forceUuid && input.sessionId) {
            await database.delete(zoomMeetingRecordings).where(
              and(
                eq(zoomMeetingRecordings.sessionId, input.sessionId),
                eq(zoomMeetingRecordings.meetingId, input.meetingId),
              )
            );
            console.log(`[fetchTranscript] forceUuid=${input.forceUuid} — cleared existing rows for sessionId=${input.sessionId}`);
          }

          // If we have a sessionId, check if transcript is already saved — return it directly.
          // Only trust completed rows whose meetingId matches current credentials.
          // Skipped when forceUuid is set (row was just deleted above).
          if (input.sessionId && !input.forceUuid) {
            const existing = await database
              .select()
              .from(zoomMeetingRecordings)
              .where(and(
                eq(zoomMeetingRecordings.sessionId, input.sessionId),
                eq(zoomMeetingRecordings.status, 'completed'),
                eq(zoomMeetingRecordings.meetingId, input.meetingId),
              ))
              .limit(1);

            if (existing.length > 0 && existing[0].transcriptText) {
              return {
                success: true,
                recordingId: existing[0].id,
                transcript: existing[0].transcriptText,
                duration: existing[0].durationMinutes ?? 0,
              };
            }

            // Fix 3: Check for unlinked (sessionId=NULL) completed rows for this meetingId
            // that are close in time to this session. Historical webhook rows have NULL sessionId
            // but contain valid transcripts — link and return them instead of re-fetching from Zoom.
            if (input.sessionScheduledAt) {
              const unlinked = await database
                .select()
                .from(zoomMeetingRecordings)
                .where(and(
                  eq(zoomMeetingRecordings.meetingId, input.meetingId),
                  isNull(zoomMeetingRecordings.sessionId),
                  eq(zoomMeetingRecordings.status, 'completed'),
                  drizzleSql`${zoomMeetingRecordings.transcriptText} IS NOT NULL`,
                  drizzleSql`ABS(UNIX_TIMESTAMP(${zoomMeetingRecordings.recordedAt}) * 1000 - ${input.sessionScheduledAt}) < 2700000`,
                ))
                .orderBy(drizzleSql`ABS(UNIX_TIMESTAMP(${zoomMeetingRecordings.recordedAt}) * 1000 - ${input.sessionScheduledAt}) ASC`)
                .limit(1);

              if (unlinked.length > 0 && unlinked[0].transcriptText) {
                // Link the historical row to this session and return it
                await database.update(zoomMeetingRecordings)
                  .set({ sessionId: input.sessionId })
                  .where(eq(zoomMeetingRecordings.id, unlinked[0].id));
                console.log(`[fetchTranscript] Linked historical NULL row id=${unlinked[0].id} to sessionId=${input.sessionId}`);
                return {
                  success: true,
                  recordingId: unlinked[0].id,
                  transcript: unlinked[0].transcriptText,
                  duration: unlinked[0].durationMinutes ?? 0,
                };
              }
            }

            // Auto-delete stale rows (processing/failed or from old credentials) so they
            // don't interfere with a fresh fetch after Zoom credentials are changed.
            await database.delete(zoomMeetingRecordings).where(
              and(
                eq(zoomMeetingRecordings.sessionId, input.sessionId),
                drizzleSql`NOT (status = 'completed' AND transcriptText IS NOT NULL AND meetingId = ${input.meetingId})`
              )
            );
          }

          // Determine the correct recording UUID to fetch.
          // forceUuid takes top priority; otherwise:
          // 1. UUID already saved in DB for this session (webhook already matched it, same meetingId)
          // 2. Find UUID by session time — list all recordings and pick longest within tolerance
          let meetingIdToFetch = input.forceUuid || input.meetingId;

          if (!input.forceUuid && input.sessionId) {
            const savedRecording = await database
              .select({ id: zoomMeetingRecordings.id, meetingId: zoomMeetingRecordings.meetingId })
              .from(zoomMeetingRecordings)
              .where(eq(zoomMeetingRecordings.sessionId, input.sessionId))
              .limit(1);

            if (savedRecording.length > 0 && savedRecording[0].meetingId === input.meetingId && savedRecording[0].id !== input.meetingId) {
              // Webhook already matched this session to a UUID with current credentials — use it
              meetingIdToFetch = savedRecording[0].id;
              console.log(`[fetchTranscript] Using webhook-matched UUID=${meetingIdToFetch} for sessionId=${input.sessionId}`);
            } else if (input.sessionScheduledAt) {
              // No webhook match yet — find the recording longest within the tolerance window
              const uuid = await findRecordingUuidBySessionTime(input.meetingId, input.sessionScheduledAt);
              if (uuid) {
                meetingIdToFetch = uuid;
                console.log(`[fetchTranscript] Time-matched UUID=${uuid} for sessionId=${input.sessionId} scheduledAt=${new Date(input.sessionScheduledAt).toISOString()}`);
              } else {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: 'No recording found for this session. Please check that cloud recording was enabled and the session was recorded in Zoom.',
                });
              }
            } else {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'No recording found for this session. Please check that cloud recording was enabled and the session was recorded in Zoom.',
              });
            }
          }

          // Fix 1: Mark as processing — include sessionId so duplicate rows get linked
          await database.insert(zoomMeetingRecordings).values({
            id: meetingIdToFetch,
            meetingId: input.meetingId,
            sessionId: input.sessionId,
            status: 'processing',
          } as typeof zoomMeetingRecordings.$inferInsert).onDuplicateKeyUpdate({
            set: { status: 'processing', sessionId: input.sessionId }
          });

          // Fetch transcript from Zoom using the resolved UUID
          const transcriptData = await fetchZoomTranscript(meetingIdToFetch);
          const recording = await getZoomRecording(meetingIdToFetch);

          // Fix 1: Save to database — include sessionId in onDuplicateKeyUpdate so existing
          // NULL rows (saved by webhook) get linked when tutor manually fetches
          await database.insert(zoomMeetingRecordings).values({
            id: recording.uuid,
            meetingId: input.meetingId,
            sessionId: input.sessionId,
            topic: recording.topic,
            hostId: recording.host_id,
            transcriptText: transcriptData.transcript,
            rawTranscript: transcriptData.rawTranscript,
            durationMinutes: Math.round(recording.duration),
            recordedAt: new Date(recording.start_time),
            processedAt: new Date(),
            status: 'completed',
            shareUrl: recording.share_url,
          } as typeof zoomMeetingRecordings.$inferInsert).onDuplicateKeyUpdate({
            set: {
              sessionId: input.sessionId,
              transcriptText: transcriptData.transcript,
              rawTranscript: transcriptData.rawTranscript,
              durationMinutes: Math.round(recording.duration),
              processedAt: new Date(),
              status: 'completed',
            }
          });

          // Fix 2: Backfill — link any other NULL-sessionId rows for the same meetingId
          // that are close in time to this session (handles historical webhook-saved rows)
          if (input.sessionId && input.sessionScheduledAt) {
            await database.update(zoomMeetingRecordings)
              .set({ sessionId: input.sessionId })
              .where(and(
                eq(zoomMeetingRecordings.meetingId, input.meetingId),
                isNull(zoomMeetingRecordings.sessionId),
                drizzleSql`ABS(UNIX_TIMESTAMP(${zoomMeetingRecordings.recordedAt}) * 1000 - ${input.sessionScheduledAt}) < 2700000`,
              ));
          }

          return {
            success: true,
            recordingId: recording.uuid,
            transcript: transcriptData.transcript,
            duration: recording.duration,
          };
        } catch (error) {
          // Update status to failed
          await database.insert(zoomMeetingRecordings).values({
            id: input.meetingId,
            meetingId: input.meetingId,
            sessionId: input.sessionId,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          } as typeof zoomMeetingRecordings.$inferInsert).onDuplicateKeyUpdate({
            set: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            }
          });

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch transcript',
          });
        }
      }),

    /**
     * Get transcript for a specific recording
     */
    getTranscript: protectedProcedure
      .input(z.object({
        recordingId: z.string(),
      }))
      .query(async ({ input }) => {
        const { zoomMeetingRecordings } = await import('../drizzle/schema');
        const database = await db.getDb();

        if (!database) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }

        const recording = await database.select().from(zoomMeetingRecordings)
          .where(eq(zoomMeetingRecordings.id, input.recordingId))
          .limit(1);

        if (!recording || recording.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recording not found' });
        }

        return recording[0];
      }),

    /**
     * Get all recordings for a session
     */
    getSessionRecordings: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .query(async ({ input }) => {
        const { zoomMeetingRecordings } = await import('../drizzle/schema');
        const database = await db.getDb();

        if (!database) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        }

        const recordings = await database.select().from(zoomMeetingRecordings)
          .where(eq(zoomMeetingRecordings.sessionId, input.sessionId));

        return recordings;
      }),
  }),

  quiz: router({
    /**
     * Save an approved quiz (tutor action)
     */
    create: tutorProcedure
      .input(z.object({
        sessionId: z.number(),
        courseId: z.number().optional(),
        parentId: z.number(),
        questions: z.array(z.object({
          id: z.string(),
          question: z.string().min(1),
          options: z.array(z.string().min(1)).length(4),
          correctAnswer: z.number().min(0).max(3),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const quizId = await db.upsertSessionQuiz({
          sessionId: input.sessionId,
          courseId: input.courseId,
          tutorId: ctx.user.id,
          parentId: input.parentId,
          questions: JSON.stringify(input.questions),
          status: "draft",
        });

        if (!quizId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save quiz' });
        }

        await db.approveAndAssignQuiz(quizId, JSON.stringify(input.questions));

        await db.createInAppNotification({
          userId: input.parentId,
          title: "New Quiz Available",
          message: "Your tutor has assigned a quiz for your recent session. Go to Notes to take it!",
          type: "quiz_assigned",
          relatedId: quizId,
        });

        return { success: true, quizId };
      }),

    /**
     * Get quiz for a specific session
     */
    getBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const quiz = await db.getQuizBySessionId(input.sessionId);
        if (!quiz) return null;
        return {
          ...quiz,
          questions: JSON.parse(quiz.questions) as Array<{
            id: string; question: string; options: string[]; correctAnswer: number;
          }>,
        };
      }),

    /**
     * Get all quizzes assigned to the current parent
     */
    getByParent: parentProcedure
      .query(async ({ ctx }) => {
        const quizzes = await db.getQuizzesByParentId(ctx.user.id);
        return quizzes
          .filter(q => q.status === "approved" || q.status === "completed")
          .map(q => ({
            ...q,
            questions: JSON.parse(q.questions) as Array<{
              id: string; question: string; options: string[]; correctAnswer: number;
            }>,
          }));
      }),

    /**
     * Submit quiz answers and mark as completed
     */
    complete: parentProcedure
      .input(z.object({
        quizId: z.number(),
        answers: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const quiz = await db.getQuizById(input.quizId);

        if (!quiz) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz not found' });
        }
        if (quiz.parentId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to complete this quiz' });
        }
        if (quiz.status === "completed") {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quiz already completed' });
        }

        const questions = JSON.parse(quiz.questions) as Array<{
          id: string; question: string; options: string[]; correctAnswer: number;
        }>;

        let correct = 0;
        questions.forEach((q, idx) => {
          if (input.answers[idx] === q.correctAnswer) correct++;
        });
        const score = Math.round((correct / questions.length) * 100);

        await db.completeQuiz(input.quizId, score, correct, questions.length, JSON.stringify(input.answers));

        return { success: true, score, correct, total: questions.length };
      }),

    /**
     * Enable/disable quiz generation for a course (tutor who teaches that course)
     */
    toggleCourseQuiz: tutorProcedure
      .input(z.object({
        courseId: z.number(),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const success = await db.updateCourseQuizEnabled(input.courseId, input.enabled);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update course' });
        }
        return { success: true };
      }),
  }),

  /**
   * Session rubric grades — parent-facing queries
   */
  grades: router({
    /**
     * Get all rubric grades for sessions belonging to this parent
     */
    getByParent: parentProcedure
      .query(async ({ ctx }) => {
        const rows = await db.getRubricGradesByParentId(ctx.user.id);
        return rows.map(r => ({
          ...r,
          rubricEvidence: r.rubricEvidence ? JSON.parse(r.rubricEvidence) : [],
          rubricOverallScore: r.rubricOverallScore ? parseFloat(r.rubricOverallScore as string) : null,
          rubricEngagementData: r.rubricEngagementData ? JSON.parse(r.rubricEngagementData) : null,
        }));
      }),

    /**
     * Get rubric grade for a single session
     */
    getBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const row = await db.getSessionRubricGrades(input.sessionId);
        if (!row) return null;
        return {
          ...row,
          rubricEvidence: row.rubricEvidence ? JSON.parse(row.rubricEvidence) : [],
          rubricOverallScore: row.rubricOverallScore ? parseFloat(row.rubricOverallScore as string) : null,
          rubricEngagementData: row.rubricEngagementData ? JSON.parse(row.rubricEngagementData) : null,
        };
      }),

    /**
     * Get all rubric grades for sessions this tutor taught
     */
    getByTutor: tutorProcedure
      .query(async ({ ctx }) => {
        const rows = await db.getRubricGradesByTutorId(ctx.user.id);
        return rows.map(r => ({
          ...r,
          rubricEvidence: r.rubricEvidence ? JSON.parse(r.rubricEvidence) : [],
          rubricOverallScore: r.rubricOverallScore ? parseFloat(r.rubricOverallScore as string) : null,
          rubricEngagementData: r.rubricEngagementData ? JSON.parse(r.rubricEngagementData) : null,
        }));
      }),
  }),

  // Chatbot FAQ
  chatbot: router({
    ask: publicProcedure
      .input(
        z.object({
          // Trim whitespace, enforce length bounds, reject blank-after-trim
          question: z
            .string()
            .min(1, "Question cannot be empty")
            .max(500, "Question is too long (max 500 characters)")
            .transform((s) => s.trim())
            .refine((s) => s.length > 0, "Question cannot be blank")
            // Strip null bytes and control characters (except common whitespace)
            .transform((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")),
          // Only accept relative paths or short absolute URLs — reject arbitrary data
          pageUrl: z
            .string()
            .max(200)
            .optional()
            .transform((s) => s?.slice(0, 200)),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limiting — 20 requests per IP per 60 seconds
        const ip =
          (ctx.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
          ctx.req.socket?.remoteAddress ??
          "unknown";

        if (!checkChatbotRateLimit(ip)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please wait a moment before asking again.",
          });
        }

        const result = searchFaq(input.question);
        const { answer, matched, category, intent, suggestions } = result;

        // Log every query with structured data (matched FAQ id, score, intent)
        logQuery(input.question, result, input.pageUrl);

        // Also log to unanswered file when no match — for quick review
        if (!matched) {
          logUnansweredQuestion(input.question, input.pageUrl);
        }

        return { answer, matched, category, intent, suggestions: suggestions ?? [] };
      }),
  }),

  // ============ Referral Router ============
  referral: router({

    /** Get the current user's referral code and link */
    getMyCode: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const BASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL || "http://localhost:3000";
      const referralLink = user.referralCode
        ? `${BASE_URL}/signup?ref=${user.referralCode}`
        : null;
      return { referralCode: user.referralCode ?? null, referralLink };
    }),

    /** Check if an email is already registered (used before sending invite) */
    checkEmail: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ ctx, input }) => {
        // Can't invite yourself
        if (input.email.toLowerCase() === ctx.user.email.toLowerCase()) {
          return { available: false, reason: "You cannot invite yourself." };
        }
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          return { available: false, reason: "This user is already registered on EdKonnect." };
        }
        return { available: true, reason: null };
      }),

    /** Send a referral invite email to a friend */
    sendInvite: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        const invitedEmail = input.email.toLowerCase().trim();

        // Can't invite yourself
        if (invitedEmail === ctx.user.email.toLowerCase()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot invite yourself." });
        }

        // Check if already registered
        const existing = await db.getUserByEmail(invitedEmail);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "This user is already registered on EdKonnect." });
        }

        // Get referrer's code (generate if missing)
        let referrerUser = await db.getUserById(ctx.user.id);
        if (!referrerUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        if (!referrerUser.referralCode) {
          const newCode = await db.generateUniqueReferralCode();
          await db.setUserReferralCode(ctx.user.id, newCode);
          referrerUser = await db.getUserById(ctx.user.id);
        }

        const referralCode = referrerUser!.referralCode!;

        // Prevent duplicate invite to same email from same referrer
        const referrals = await db.getReferralsByReferrer(ctx.user.id);
        const alreadyInvited = referrals.some((r: any) => r.referral.invitedEmail === invitedEmail);
        if (alreadyInvited) {
          throw new TRPCError({ code: "CONFLICT", message: "You have already sent an invite to this email." });
        }

        // Create referral record
        const referral = await db.createReferral({ referrerId: ctx.user.id, invitedEmail });
        if (!referral) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create referral record." });
        }

        // Send invite email
        const BASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL || "http://localhost:3000";
        const signupUrl = `${BASE_URL}/signup?ref=${referralCode}`;
        const referrerName = `${referrerUser!.firstName} ${referrerUser!.lastName}`.trim();

        await sendReferralInviteEmail({ invitedEmail, referrerName, signupUrl });

        return { success: true, message: `Invite sent to ${invitedEmail}` };
      }),

    /** Get referral history for the current user */
    getMyReferrals: protectedProcedure.query(async ({ ctx }) => {
      const referrals = await db.getReferralsByReferrer(ctx.user.id);
      return referrals.map((r: any) => ({
        id: r.referral.id,
        invitedEmail: r.referral.invitedEmail,
        status: r.referral.status,
        referredUserName: r.referredUser
          ? `${r.referredUser.firstName} ${r.referredUser.lastName}`.trim()
          : null,
        createdAt: r.referral.createdAt,
      }));
    }),

    /** Get all coupons belonging to the current user */
    getMyCoupons: protectedProcedure.query(async ({ ctx }) => {
      const coupons = await db.getCouponsByUserId(ctx.user.id);
      // Determine if each coupon was issued because this user was referred (vs being a referrer reward)
      const referredReferral = await db.getReferralByReferredUserId(ctx.user.id);
      return coupons.map(c => ({
        ...c,
        isReferredCoupon: !!(referredReferral && c.sourceReferralId === referredReferral.id),
      }));
    }),

    /** Validate a coupon code (used in enrollment UI) */
    validateCoupon: protectedProcedure
      .input(z.object({ code: z.string(), coursePriceUsd: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        // EDK- codes are validated client-side against the referral app directly (needs parent email)
        // Return a sentinel so the frontend knows it's an external code and handles it separately
        if (input.code.toUpperCase().startsWith("EDK-")) {
          return { valid: true, discountAmountUsd: 0, discountAmountInr: 0, couponId: null, isExternalPromo: true, discountPercent: 10 };
        }
        const coupon = await db.getCouponByCode(input.code);
        if (!coupon) {
          return { valid: false, reason: "Invalid coupon code." };
        }
        if (coupon.userId !== ctx.user.id) {
          return { valid: false, reason: "This coupon does not belong to your account." };
        }
        if (coupon.isUsed) {
          return { valid: false, reason: "This coupon has already been used." };
        }
        // Resolve tier-based discount if course price is provided
        let discountAmountUsd = parseFloat(coupon.discountAmountUsd ?? "0");
        let discountAmountInr = parseFloat(coupon.discountAmountInr ?? "0");
        if (input.coursePriceUsd != null && input.coursePriceUsd > 0) {
          const resolved = await db.getReferralDiscountForPrice(input.coursePriceUsd);
          discountAmountUsd = resolved.usd;
          discountAmountInr = resolved.inr;
        }
        return {
          valid: true,
          discountAmountUsd,
          discountAmountInr,
          couponId: coupon.id,
        };
      }),

    /** Admin: get referral discount tier settings */
    getReferralSettings: adminProcedure.query(async () => {
      const tiers = await db.getReferralSettings();
      return tiers.map(t => ({
        id: t.id,
        maxPriceUsd: t.maxPriceUsd != null ? parseFloat(t.maxPriceUsd) : null,
        discountAmountUsd: parseFloat(t.discountAmountUsd),
        discountAmountInr: parseFloat(t.discountAmountInr),
        label: t.label,
        sortOrder: t.sortOrder,
      }));
    }),

    /** Admin: save referral discount tier settings */
    saveReferralSettings: adminProcedure
      .input(z.array(z.object({
        id: z.number().optional(),
        maxPriceUsd: z.number().nullable(),
        discountAmountUsd: z.number(),
        discountAmountInr: z.number(),
        label: z.string(),
        sortOrder: z.number(),
      })))
      .mutation(async ({ input }) => {
        await db.upsertReferralSettings(input);
        return { success: true };
      }),

    /** Admin: get all referral history */
    getAllReferrals: adminProcedure.query(async () => {
      return db.getAllReferrals();
    }),
  }),

  adminTestimonials: router({
    getAll: adminProcedure.query(async () => {
      return db.getAllTestimonials();
    }),

    create: adminProcedure
      .input(z.object({
        parentName: z.string().min(1),
        parentInitials: z.string().min(1).max(5),
        parentRole: z.string().optional(),
        parentImage: z.string().optional(),
        content: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        displayOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        await db.createTestimonial(input);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        parentName: z.string().min(1).optional(),
        parentInitials: z.string().min(1).max(5).optional(),
        parentRole: z.string().nullable().optional(),
        parentImage: z.string().nullable().optional(),
        content: z.string().min(1).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        displayOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateTestimonial(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTestimonial(input.id);
        return { success: true };
      }),

    uploadImage: adminProcedure
      .input(z.object({
        fileName: z.string().max(255),
        fileType: z.string(),
        fileSize: z.number(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(input.fileType)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only JPEG, PNG, and WebP images are allowed.' });
        }
        const maxBytes = 500 * 1024;
        if (input.fileSize > maxBytes) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image size exceeds the 500 KB limit.' });
        }
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        const stripped = input.base64Data.replace(/\s/g, '');
        if (!base64Regex.test(stripped)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid image data.' });
        }
        const byteLength = Math.floor((stripped.length * 3) / 4);
        if (byteLength > maxBytes) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image size exceeds the 500 KB limit.' });
        }
        const ext = input.fileType === 'image/png' ? 'png' : 'jpg';
        const uuid = crypto.randomUUID();
        const key = `testimonial-images/${uuid}.${ext}`;
        const imageBuffer = Buffer.from(stripped, 'base64');
        const { uploadProfileImageToS3 } = await import('./s3Storage');
        // Re-use uploadProfileImageToS3 with a pseudo userId of 0 for the key prefix override
        // Instead, build the upload manually using the same helpers
        const { ENV } = await import('./_core/env');
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const fs = await import('fs');
        const path = await import('path');
        let imageUrl: string;
        const hasS3 = !!(ENV.awsAccessKeyId && ENV.awsSecretAccessKey && ENV.awsS3Bucket);
        if (hasS3) {
          const s3 = new S3Client({
            region: ENV.awsS3Region,
            credentials: { accessKeyId: ENV.awsAccessKeyId, secretAccessKey: ENV.awsSecretAccessKey },
          });
          await s3.send(new PutObjectCommand({
            Bucket: ENV.awsS3Bucket,
            Key: key,
            Body: imageBuffer,
            ContentType: input.fileType,
          }));
          imageUrl = `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region}.amazonaws.com/${key}`;
        } else {
          const uploadsDir = path.resolve(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          const safeFileName = key.replace(/\//g, '_');
          fs.writeFileSync(path.join(uploadsDir, safeFileName), imageBuffer);
          const baseUrl = ENV.forgeApiUrl || 'http://localhost:3000';
          imageUrl = `${baseUrl}/uploads/${encodeURIComponent(safeFileName)}`;
        }
        return { imageUrl };
      }),
  }),

  // ── File Management ──────────────────────────────────────────────────────────

  fileManagement: router({

    // ── Admin procedures ──────────────────────────────────────────────────────

    uploadFile: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        courseId: z.number().int().optional(),
        fileName: z.string().max(255),
        fileType: z.string(),
        fileSize: z.number().int().max(20 * 1024 * 1024),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
        const fileExt = input.fileName.toLowerCase().slice(input.fileName.lastIndexOf("."));
        if (!allowedExtensions.includes(fileExt)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only PDF, Word, and Excel files are allowed." });
        }

        const stripped = input.base64Data.replace(/\s/g, "");
        const byteLength = Math.floor((stripped.length * 3) / 4);
        if (byteLength > 20 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds 20 MB limit." });
        }
        const buffer = Buffer.from(stripped, "base64");

        // Duplicate check — same fileName + same course (or both null)
        const existing = await db.getCourseFileByNameAndCourse(
          input.fileName,
          input.courseId ?? null
        );
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A file named "${input.fileName}" already exists${input.courseId ? " for this course" : ""}. Delete the existing file first or rename this one.`,
          });
        }

        const { url, key } = await uploadCourseFileToS3(buffer, input.fileType, input.fileName);
        const fileId = await db.createCourseFile({
          title: input.title,
          description: input.description ?? null,
          courseId: input.courseId ?? null,
          fileUrl: url,
          fileKey: key,
          fileType: input.fileType,
          fileSize: byteLength,
          fileName: input.fileName,
          uploadedBy: ctx.user.id,
        });
        if (!fileId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save file." });
        return { fileId, fileUrl: url };
      }),

    // Returns a presigned S3 PUT URL so the browser uploads directly to S3.
    // Falls back to null in local dev (use uploadFile instead).
    getUploadUrl: adminProcedure
      .input(z.object({
        fileName: z.string().max(255),
        fileType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
        const fileExt = input.fileName.toLowerCase().slice(input.fileName.lastIndexOf("."));
        if (!allowedExtensions.includes(fileExt)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only PDF, Word, Excel, and PowerPoint files are allowed." });
        }
        const { getCourseFileUploadPresignedUrl } = await import("./s3Storage");
        const result = await getCourseFileUploadPresignedUrl(input.fileName, input.fileType);
        return result; // null in local dev
      }),

    // Called after browser finishes uploading directly to S3 via presigned URL.
    registerFile: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        courseId: z.number().int().optional(),
        fileName: z.string().max(255),
        fileType: z.string(),
        fileSize: z.number().int().max(20 * 1024 * 1024),
        fileKey: z.string(),
        fileUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getCourseFileByNameAndCourse(input.fileName, input.courseId ?? null);
        if (existing) {
          // File is already in S3 but duplicate — clean up the orphaned S3 object
          deleteCourseFileFromS3(input.fileKey).catch((e) =>
            console.error("[registerFile] Failed to clean up duplicate S3 object:", input.fileKey, e)
          );
          throw new TRPCError({
            code: "CONFLICT",
            message: `A file named "${input.fileName}" already exists${input.courseId ? " for this course" : ""}. Delete the existing file first or rename this one.`,
          });
        }
        let fileId: number | null = null;
        try {
          fileId = await db.createCourseFile({
            title: input.title,
            description: input.description ?? null,
            courseId: input.courseId ?? null,
            fileUrl: input.fileUrl,
            fileKey: input.fileKey,
            fileType: input.fileType,
            fileSize: input.fileSize,
            fileName: input.fileName,
            uploadedBy: ctx.user.id,
          });
        } catch (dbErr) {
          // DB write failed — clean up the S3 object to avoid orphan
          console.error("[registerFile] DB write failed, cleaning up S3 key:", input.fileKey, dbErr);
          deleteCourseFileFromS3(input.fileKey).catch((e) =>
            console.error("[registerFile] S3 cleanup also failed:", input.fileKey, e)
          );
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save file. The uploaded file has been removed." });
        }
        if (!fileId) {
          deleteCourseFileFromS3(input.fileKey).catch(() => {});
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save file." });
        }
        return { fileId, fileUrl: input.fileUrl };
      }),

    getFiles: adminProcedure
      .query(async () => {
        return await db.getAllCourseFiles();
      }),

    deleteFile: adminProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input }) => {
        const file = await db.getCourseFileById(input.fileId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found." });
        await deleteCourseFileFromS3(file.fileKey).catch(() => {});
        await db.deleteCourseFile(input.fileId);
        return { success: true };
      }),

    assignFileToTutors: adminProcedure
      .input(z.object({
        fileId: z.number(),
        tutorIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const file = await db.getCourseFileById(input.fileId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found." });
        await db.assignCourseFileToTutors(input.fileId, input.tutorIds, ctx.user.id);
        return { success: true };
      }),

    getFileAssignments: adminProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCourseFileAssignments(input.fileId);
      }),

    getTutorsForAssignment: adminProcedure
      .query(async () => {
        const database = await db.getDb();
        if (!database) return [];
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq: eqOp, asc: ascOp } = await import("drizzle-orm");
        return await database
          .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
          .from(usersTable)
          .where(eqOp(usersTable.role, "tutor"))
          .orderBy(ascOp(usersTable.firstName));
      }),

    getCoursesList: adminProcedure
      .query(async () => {
        const database = await db.getDb();
        if (!database) return [];
        const { courses: coursesTable } = await import("../drizzle/schema");
        const { asc: ascOp } = await import("drizzle-orm");
        return await database
          .select({ id: coursesTable.id, name: coursesTable.title, subject: coursesTable.subject })
          .from(coursesTable)
          .orderBy(ascOp(coursesTable.title));
      }),

    // ── Tutor procedures ──────────────────────────────────────────────────────

    getMyFiles: tutorProcedure
      .query(async ({ ctx }) => {
        return await db.getCourseFilesForTutor(ctx.user.id);
      }),

    assignFileToParents: tutorProcedure
      .input(z.object({
        fileId: z.number(),
        subscriptions: z.array(z.object({ subscriptionId: z.number(), parentId: z.number() })),
      }))
      .mutation(async ({ ctx, input }) => {
        const myFiles = await db.getCourseFilesForTutor(ctx.user.id);
        const hasFile = myFiles.some((f) => f.file.id === input.fileId);
        if (!hasFile) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this file." });
        }
        if (input.subscriptions.length > 0) {
          const myStudents = await db.getStudentsByTutorId(ctx.user.id);
          const validSubIds = new Set(myStudents.map((s) => s.subscriptionId));
          const allValid = input.subscriptions.every((s) => validSubIds.has(s.subscriptionId));
          if (!allValid) {
            throw new TRPCError({ code: "FORBIDDEN", message: "One or more subscriptions are not your students." });
          }
        }
        await db.assignCourseFileToParents(input.fileId, ctx.user.id, input.subscriptions);
        return { success: true };
      }),

    getMyStudents: tutorProcedure
      .query(async ({ ctx }) => {
        return await db.getStudentsByTutorId(ctx.user.id);
      }),

    getFileParentAssignments: tutorProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getFileParentAssignments(input.fileId, ctx.user.id);
      }),

    // ── Shared: pre-signed URL for preview ────────────────────────────────────

    getPresignedUrl: protectedProcedure
      .input(z.object({ fileKey: z.string(), fileUrl: z.string() }))
      .query(async ({ input }) => {
        const url = await getCourseFilePresignedUrl(input.fileKey, input.fileUrl);
        return { url };
      }),

    // ── Parent procedures ─────────────────────────────────────────────────────

    getFilesForParent: parentProcedure
      .query(async ({ ctx }) => {
        return await db.getCourseFilesForParent(ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
