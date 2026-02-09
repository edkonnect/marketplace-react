import { clearAuthCookies } from "./_core/services/authService";
import { systemRouter } from "./_core/systemRouter";
import { notifyOwner } from "./_core/notification";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { sendWelcomeEmail, sendBookingConfirmation, sendEnrollmentConfirmation, formatEmailDate, formatEmailTime, formatEmailPrice } from "./email-helpers";
import { generateBookingToken, isValidBookingToken } from "./booking-management";
import { cancelAppointment } from "./acuity";
import { sendCancellationConfirmationEmail } from "./cancellation-email";
import { generateCurriculumPDF } from "./pdf-generator";
import { sendSessionNotesEmail } from "./session-notes-email";
import { storagePut } from "./storage";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { subscriptions as subscriptionsTable } from "../drizzle/schema";

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

function generateJoinUrl(sessionId: number) {
  // Deterministic pseudo Zoom link so parent/tutor see the same URL without storing in DB
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
    updateRole: protectedProcedure
      .input(z.object({ role: z.enum(['parent', 'tutor']) }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.updateUserRole(ctx.user.id, input.role);
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update role' });
        }
        
        // Send welcome email (async, don't wait)
        if (ctx.user.email && ctx.user.name) {
          sendWelcomeEmail({
            userEmail: ctx.user.email,
            userName: ctx.user.name,
            userRole: input.role,
          }).catch(err => console.error('[Email] Failed to send welcome email:', err));
        }
        
        return { success: true };
      }),
  }),

  // Tutor Profile Management
  tutorProfile: router({
    get: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTutorProfileByUserId(input.userId);
      }),
    
    getMy: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorProfileByUserId(ctx.user.id);
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

    register: protectedProcedure
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
        acuityLink: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Use the logged-in user's ID instead of creating a new user
        const userId = ctx.user.id;

        // Check if user already has a tutor profile
        const existingProfile = await db.getTutorProfileByUserId(userId);
        if (existingProfile) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'You already have a tutor profile' });
        }

        // Create tutor profile with pending approval status
        const profileId = await db.createTutorProfile({
          userId,
          bio: input.bio,
          qualifications: input.qualifications,
          yearsOfExperience: input.yearsOfExperience,
          hourlyRate: input.hourlyRate.toString(),
          subjects: JSON.stringify(input.subjects),
          gradeLevels: JSON.stringify(input.gradeLevels),
          acuityLink: input.acuityLink,
          approvalStatus: 'pending',
        });

        if (!profileId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create tutor profile' });
        }

        // Notify admin about new tutor registration
        try {
          await notifyOwner({
            title: 'New Tutor Registration',
            content: `A new tutor has registered and is pending approval:\n\nName: ${input.name}\nEmail: ${input.email}\nSubjects: ${input.subjects.join(', ')}\nExperience: ${input.yearsOfExperience} years\nHourly Rate: $${input.hourlyRate}\n\nPlease review and approve/reject this application in the admin dashboard.`
          });
        } catch (error) {
          console.error('[TutorRegistration] Failed to send notification:', error);
          // Don't fail the registration if notification fails
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
        acuityLink: z.string().optional(),
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

    getSimilar: publicProcedure
      .input(z.object({ 
        tutorId: z.number(),
        limit: z.number().optional().default(2),
      }))
      .query(async ({ input }) => {
        return await db.getSimilarTutors(input.tutorId, input.limit);
      }),
  }),

  // Parent Profile Management
  parentProfile: router({
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

    // Notification preferences
    getNotificationPreferences: parentProcedure.query(async ({ ctx }) => {
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

    updateNotificationPreferences: parentProcedure
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

    list: publicProcedure.query(async () => {
      const courses = await db.getAllActiveCourses();
      
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

    createCheckoutSession: parentProcedure
      .input(z.object({
        courseId: z.number(),
        preferredTutorId: z.number().optional(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        let subscriptionId: number | null = null;

        try {
          // Get course details
          const course = await db.getCourseById(input.courseId);
          if (!course) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
          }

          // Prevent duplicate enrollment for the same student + subject
          // Prevent duplicate enrollment for the same student + same course (not just subject)
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

          // Fast-path: mark as fully paid without external checkout
          const now = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3); // retain original 3-month window

          // Always create a new subscription so multiple students can enroll in the same course
          // without overwriting an existing subscription.
          subscriptionId = await db.createSubscription({
            parentId: ctx.user.id,
            courseId: input.courseId,
            preferredTutorId: input.preferredTutorId,
            studentFirstName: input.studentFirstName,
            studentLastName: input.studentLastName,
            studentGrade: input.studentGrade,
            status: "active",
            startDate: now,
            endDate,
            paymentStatus: "paid",
            paymentPlan: "full",
            firstInstallmentPaid: true,
            secondInstallmentPaid: true,
          });

          if (!subscriptionId) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create enrollment" });
          }

          // Record payment as completed (errors are logged but won't block enrollment)
          await db.createPayment({
            parentId: ctx.user.id,
            tutorId: primaryTutor.tutorId,
            subscriptionId,
            sessionId: null,
            amount: course.price,
            currency: "usd",
            status: "completed",
            stripePaymentIntentId: null,
            paymentType: "subscription",
          });

          // Send confirmation email (non-blocking)
          if (ctx.user.email && ctx.user.name) {
            const tutorNames = tutors.map(t => t.user.name).filter(Boolean) as string[];
            sendEnrollmentConfirmation({
              userEmail: ctx.user.email,
              userName: ctx.user.name,
              courseName: course.title,
              tutorNames: tutorNames.length > 0 ? tutorNames : ['Your tutor'],
              coursePrice: formatEmailPrice(Math.round(parseFloat(course.price) * 100)),
              courseId: course.id,
            }).catch(err => console.error('[Email] Failed to send enrollment confirmation:', err));
          }

          return { success: true, subscriptionId };
        } catch (err) {
          console.error('[createCheckoutSession] Enrollment flow failed:', err);
          // If subscription was created, still return success so the UI doesn't show a hard error.
          if (subscriptionId) {
            return { success: true, subscriptionId, warning: 'post-create step failed' };
          }
          // Avoid throwing to prevent 500 in UI; instead return a soft failure the client can handle.
          return { success: false, message: 'Failed to process enrollment' };
        }
      }),

    enrollWithoutPayment: parentProcedure
      .input(z.object({
        courseId: z.number(),
        preferredTutorId: z.number().optional(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
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

        // Create subscription with pending payment status
        const subscription = await db.createSubscription({
          parentId: ctx.user.id,
          courseId: input.courseId,
          preferredTutorId: input.preferredTutorId,
          studentFirstName: input.studentFirstName,
          studentLastName: input.studentLastName,
          studentGrade: input.studentGrade,
          status: 'active',
          startDate: new Date(),
          paymentStatus: 'pending',
        });

        if (!subscription) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create enrollment' });
        }

        return { success: true, subscriptionId: subscription };
      }),

    enrollWithInstallment: parentProcedure
      .input(z.object({
        courseId: z.number(),
        studentFirstName: z.string(),
        studentLastName: z.string(),
        studentGrade: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

        // Get course details
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }

        // Prevent duplicate enrollment for the same student + subject
        const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
        const targetFirst = normalize(input.studentFirstName);
        const targetLast = normalize(input.studentLastName);
        const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
        const duplicate = existingSubscriptions.some((s: any) => {
          const sub = s.subscription;
          const c = s.course;
          if (!sub || !c) return false;
          if (sub.status === "cancelled") return false;
          return (
            normalize(sub.studentFirstName) === targetFirst &&
            normalize(sub.studentLastName) === targetLast &&
            normalize(c.subject) === normalize(course.subject)
          );
        });
        if (duplicate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This student is already enrolled in this subject.",
          });
        }

        // Verify course price is over $500
        const coursePrice = parseFloat(course.price);
        if (coursePrice <= 500) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Installment payment is only available for courses over $500' });
        }

        // Calculate installment amounts (50% each)
        const firstInstallment = coursePrice / 2;
        const secondInstallment = coursePrice / 2;

        // Get primary tutor for the course
        const tutors = await db.getTutorsForCourse(input.courseId);
        const primaryTutor = tutors.find(t => t.isPrimary) || tutors[0];
        if (!primaryTutor) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No tutor found for this course' });
        }

        // Create subscription with installment payment plan
        const subscription = await db.createSubscription({
          parentId: ctx.user.id,
          courseId: input.courseId,
          studentFirstName: input.studentFirstName,
          studentLastName: input.studentLastName,
          studentGrade: input.studentGrade,
          status: 'active',
          startDate: new Date(),
          paymentStatus: 'pending',
          paymentPlan: 'installment',
          firstInstallmentPaid: false,
          secondInstallmentPaid: false,
          firstInstallmentAmount: firstInstallment.toFixed(2),
          secondInstallmentAmount: secondInstallment.toFixed(2),
        });

        if (!subscription) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create enrollment' });
        }

        // Create Stripe checkout session for first installment
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${course.title} - First Installment (1 of 2)`,
                  description: `Student: ${input.studentFirstName} ${input.studentLastName} | Tutor: ${primaryTutor.user.name || 'TBD'}`,
                },
                unit_amount: Math.round(firstInstallment * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${ctx.req.protocol}://${ctx.req.get('host')}/dashboard?payment=success`,
          cancel_url: `${ctx.req.protocol}://${ctx.req.get('host')}/course/${input.courseId}?payment=cancelled`,
          metadata: {
            subscriptionId: subscription.toString(),
            courseId: input.courseId.toString(),
            parentId: ctx.user.id.toString(),
            installmentNumber: '1',
            paymentType: 'installment',
          },
        });

        return { checkoutUrl: session.url, subscriptionId: subscription };
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
    mySubscriptions: parentProcedure.query(async ({ ctx }) => {
      return await db.getSubscriptionsByParentId(ctx.user.id);
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
        const booked = await db.getTutorSessionsWithin(tutorId, now, windowEnd);

        return {
          tutorId,
          availability,
          booked,
        };
      }),

    mySubscriptionsAsTutor: tutorProcedure.query(async ({ ctx }) => {
      const subs = await db.getSubscriptionsByTutorId(ctx.user.id);

      // Show only pay-later enrollments to avoid duplicates from failed/other payment attempts
      const payLater = subs.filter(
        (s) =>
          s.subscription.paymentStatus === "pending" &&
          (s.subscription.paymentPlan ?? "full") === "full"
      );

      // Deduplicate by parent+course (keep the latest)
      const dedupedMap = new Map<string, typeof payLater[0]>();
      for (const entry of payLater) {
        const key = `${entry.subscription.parentId}-${entry.subscription.courseId}`;
        const existing = dedupedMap.get(key);
        if (!existing || (entry.subscription.createdAt ?? 0) > (existing.subscription.createdAt ?? 0)) {
          dedupedMap.set(key, entry);
        }
      }

      return Array.from(dedupedMap.values());
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
        if (session.parentId !== ctx.user.id && session.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
        }

        return session;
    }),

    myUpcoming: protectedProcedure.query(async ({ ctx }) => {
      const role = ctx.user.role === 'tutor' ? 'tutor' : 'parent';
      const rows = await db.getUpcomingSessions(ctx.user.id, role);
      return rows.map((row: any) => ({
        ...(row.session || row),
        courseTitle: row.courseTitle,
        tutorName: row.tutorName,
        joinUrl: generateJoinUrl((row.session || row).id),
      }));
    }),

    myHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === 'tutor') {
        const rows = await db.getSessionsByTutorId(ctx.user.id);
        return rows.map((row: any) => ({
          ...(row.session || row),
          courseTitle: row.courseTitle,
          courseSubject: row.courseSubject,
          tutorName: row.tutorName,
          studentFirstName: row.studentFirstName,
          studentLastName: row.studentLastName,
          joinUrl: generateJoinUrl((row.session || row).id),
        }));
      } else {
        const rows = await db.getSessionsByParentId(ctx.user.id);
        return rows.map((row: any) => ({
          ...(row.session || row),
          courseTitle: row.courseTitle,
          courseSubject: row.courseSubject,
          tutorName: row.tutorName,
          studentFirstName: row.studentFirstName,
          studentLastName: row.studentLastName,
          joinUrl: generateJoinUrl((row.session || row).id),
        }));
      }
    }),

    myBookings: parentProcedure.query(async ({ ctx }) => {
      // Fetch all sessions for the parent grouped by subscription
      const rows = await db.getSessionsByParentId(ctx.user.id);
      const sessions = rows.map((row: any) => ({
        ...(row.session || row),
        course: row.courseTitle ? { title: row.courseTitle } : null,
        tutor: row.tutorName ? { name: row.tutorName } : null,
        joinUrl: generateJoinUrl((row.session || row).id),
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
        
        await db.updateSession(input.sessionId, {
          scheduledAt: input.newScheduledAt,
        });
        
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
          s.subscriptionId === input.subscriptionId && s.status === 'scheduled'
        ).sort((a: any, b: any) => a.scheduledAt - b.scheduledAt);
        
        if (seriesSessions.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No scheduled sessions found' });
        }
        
        // Calculate new dates based on frequency
        const intervalDays = input.frequency === 'weekly' ? 7 : 14;
        const startDate = new Date(input.newStartDate);
        
        for (let i = 0; i < seriesSessions.length; i++) {
          const newDate = new Date(startDate);
          newDate.setDate(newDate.getDate() + (i * intervalDays));
          
          await db.updateSession(seriesSessions[i].id, {
            scheduledAt: newDate.getTime(),
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
        
        await db.updateSession(input.sessionId, {
          status: 'cancelled',
          notes: input.reason ? `Canceled: ${input.reason}` : 'Canceled by parent',
        });
        
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
          s.subscriptionId === input.subscriptionId && s.status === 'scheduled'
        );
        
        if (seriesSessions.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No scheduled sessions found' });
        }
        
        for (const session of seriesSessions) {
          await db.updateSession(session.id, {
            status: 'cancelled',
            notes: input.reason ? `Canceled: ${input.reason}` : 'Canceled by parent',
          });
        }
        
        return { success: true, canceledCount: seriesSessions.length };
      }),

    quickBookRecurring: parentProcedure
      .input(z.object({
        courseId: z.number(),
        tutorId: z.number(),
        sessions: z.array(z.object({
          scheduledAt: z.number(), // Unix timestamp in milliseconds
        })),
        duration: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log('[quickBookRecurring] Starting with input:', JSON.stringify(input, null, 2));
        // Get or create subscription for this course
        const existingSubscriptions = await db.getSubscriptionsByParentId(ctx.user.id);
        let subscriptionId = existingSubscriptions.find(s => s.subscription.courseId === input.courseId)?.subscription.id;
        
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
        
        // Create all sessions
        const sessionIds: number[] = [];
        const failedSessions: number[] = [];
        
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
          } catch (error) {
            console.error(`[Recurring Booking] Failed to create session ${i + 1}:`, error);
            failedSessions.push(i + 1);
          }
        }
        
        // Send confirmation email for the first session
        if (sessionIds.length > 0) {
          const firstSession = await db.getSessionById(sessionIds[0]);
          if (firstSession) {
            const sessionDate = new Date(firstSession.scheduledAt);
            const course = await db.getCourseById(input.courseId);
            const tutor = await db.getUserById(input.tutorId);
            const parent = await db.getUserById(ctx.user.id);
            
            if (course && tutor && parent && tutor.name && parent.name && tutor.email && parent.email) {
              // Send email to parent
              sendBookingConfirmation({
                userEmail: parent.email,
                userName: parent.name,
                userRole: 'parent',
                courseName: course.title,
                tutorName: tutor.name,
                sessionDate: formatEmailDate(sessionDate),
                sessionTime: formatEmailTime(sessionDate),
                sessionDuration: `${firstSession.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
              }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));
              
              // Send email to tutor
              sendBookingConfirmation({
                userEmail: tutor.email,
                userName: tutor.name,
                userRole: 'tutor',
                courseName: course.title,
                studentName: parent.name,
                sessionDate: formatEmailDate(sessionDate),
                sessionTime: formatEmailTime(sessionDate),
                sessionDuration: `${firstSession.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
              }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));
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
        duration: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
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
        
        // Get session details for email
        const session = await db.getSessionById(sessionId);
        if (session) {
          const sessionDate = new Date(session.scheduledAt);
          const course = await db.getCourseById(input.courseId);
          const tutor = await db.getUserById(session.tutorId);
          const parent = await db.getUserById(ctx.user.id);
          
          if (course && tutor && parent && tutor.name && parent.name && tutor.email && parent.email) {
            // Send email to parent
            sendBookingConfirmation({
              userEmail: parent.email,
              userName: parent.name,
              userRole: 'parent',
              courseName: course.title,
              tutorName: tutor.name,
              sessionDate: formatEmailDate(sessionDate),
              sessionTime: formatEmailTime(sessionDate),
              sessionDuration: `${session.duration} minutes`,
              sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
            }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));
            
            // Send email to tutor
            sendBookingConfirmation({
              userEmail: tutor.email,
              userName: tutor.name,
              userRole: 'tutor',
              courseName: course.title,
              studentName: parent.name,
              sessionDate: formatEmailDate(sessionDate),
              sessionTime: formatEmailTime(sessionDate),
              sessionDuration: `${session.duration} minutes`,
              sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
            }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));
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
          const id = await db.createSession(input);
          if (!id) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session' });
          }
          
          // Get session details for email
          const session = await db.getSessionById(id);
          if (session) {
            const sessionDate = new Date(session.scheduledAt);
            const course = await db.getCourseById(session.subscriptionId); // Assuming subscription has courseId
            const tutor = await db.getUserById(session.tutorId);
            const parent = await db.getUserById(session.parentId);
            
            if (course && tutor && parent && tutor.name && parent.name && tutor.email && parent.email) {
              // Send email to parent
              sendBookingConfirmation({
                userEmail: parent.email,
                userName: parent.name,
                userRole: 'parent',
                courseName: course.title,
                tutorName: tutor.name,
                sessionDate: formatEmailDate(sessionDate),
                sessionTime: formatEmailTime(sessionDate),
                sessionDuration: `${session.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
              }).catch(err => console.error('[Email] Failed to send booking confirmation to parent:', err));
              
              // Send email to tutor
              sendBookingConfirmation({
                userEmail: tutor.email,
                userName: tutor.name,
                userRole: 'tutor',
                courseName: course.title,
                studentName: parent.name,
                sessionDate: formatEmailDate(sessionDate),
                sessionTime: formatEmailTime(sessionDate),
                sessionDuration: `${session.duration} minutes`,
                sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
              }).catch(err => console.error('[Email] Failed to send booking confirmation to tutor:', err));
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
        return { success: true };
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
          const id = await db.createConversation({
            parentId: input.parentId,
            tutorId: input.tutorId,
          });
          if (!id) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create conversation' });
          }
          conversation = await db.getConversationByParticipants(input.parentId, input.tutorId);
        }

        return conversation;
      }),

    getMessages: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // TODO: Verify user is part of conversation
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
        if (conversation.parentId !== ctx.user.id && conversation.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not part of this conversation' });
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
        const recipientId = conversation.parentId === ctx.user.id ? conversation.tutorId : conversation.parentId;
        if (recipientId) {
          const senderName = ctx.user.name || (ctx.user.role === 'parent' ? 'Parent' : 'Tutor');
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
        fileType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        
        // Validate file size (10MB limit)
        const buffer = Buffer.from(input.file, 'base64');
        const fileSize = buffer.length;
        if (fileSize > 10 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds 10MB limit' });
        }

        // Generate unique file key
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileExtension = input.fileName.split('.').pop();
        const fileKey = `messages/${ctx.user.id}/${timestamp}-${randomSuffix}.${fileExtension}`;

        // Upload to S3
        const result = await storagePut(fileKey, buffer, input.fileType);
        
        if (!result || !result.url) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload file' });
        }

        return {
          fileUrl: result.url,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize,
        };
      }),

    // Student-Tutor Messaging
    getStudentsWithTutors: parentProcedure.query(async ({ ctx }) => {
      return await db.getStudentsWithTutors(ctx.user.id);
    }),

    getTutorConversations: tutorProcedure.query(async ({ ctx }) => {
      return await db.getTutorConversationsWithDetails(ctx.user.id);
    }),

    getOrCreateStudentConversation: protectedProcedure
      .input(z.object({
        parentId: z.number(),
        tutorId: z.number(),
        studentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify authorization
        if (input.parentId !== ctx.user.id && input.tutorId !== ctx.user.id && ctx.user.role !== 'admin') {
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
        // Get all payments for this parent
        const payments = await db.getPaymentsByParentId(ctx.user.id);
        
        // Enrich payment data with course, tutor, and student information
        const enrichedPayments = await Promise.all(
          payments.map(async (payment) => {
            let courseName = null;
            let tutorName = null;
            let studentName = null;
            let installmentInfo = null;
            
            // Get subscription details if available
            if (payment.subscriptionId) {
              const subscription = await db.getSubscriptionById(payment.subscriptionId);
              if (subscription) {
                // Get course name
                const course = await db.getCourseById(subscription.courseId);
                if (course) {
                  courseName = course.title;
                }
                
                // Get student name
                if (subscription.studentFirstName && subscription.studentLastName) {
                  studentName = `${subscription.studentFirstName} ${subscription.studentLastName}`;
                }
                
                // Get installment info if applicable
                if (subscription.paymentPlan === 'installment') {
                  const firstAmount = parseFloat(subscription.firstInstallmentAmount || '0');
                  const secondAmount = parseFloat(subscription.secondInstallmentAmount || '0');
                  const paidAmount = parseFloat(payment.amount);
                  
                  // Determine which installment this is
                  let installmentNumber = 1;
                  if (subscription.firstInstallmentPaid && Math.abs(paidAmount - secondAmount) < 0.01) {
                    installmentNumber = 2;
                  }
                  
                  installmentInfo = {
                    installmentNumber,
                    totalInstallments: 2,
                  };
                }
              }
            }
            
            // Get tutor name
            const tutor = await db.getUserById(payment.tutorId);
            if (tutor) {
              tutorName = tutor.name;
            }
            
            return {
              id: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentType: payment.paymentType,
              stripePaymentIntentId: payment.stripePaymentIntentId,
              createdAt: payment.createdAt,
              courseName,
              tutorName,
              studentName,
              installmentInfo,
            };
          })
        );
        
        return enrichedPayments;
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

    processSecondInstallment: parentProcedure
      .input(z.object({
        subscriptionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

        // Get subscription details
        const subscriptionData = await db.getSubscriptionsByParentId(ctx.user.id);
        const subscriptionRecord = subscriptionData.find(s => s.subscription.id === input.subscriptionId);
        
        if (!subscriptionRecord) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }

        const subscription = subscriptionRecord.subscription;
        const course = subscriptionRecord.course;
        const tutor = subscriptionRecord.tutor;

        // Verify it's an installment plan
        if (subscription.paymentPlan !== 'installment') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This subscription is not on an installment plan' });
        }

        // Verify first installment is paid
        if (!subscription.firstInstallmentPaid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'First installment must be paid before processing second installment' });
        }

        // Verify second installment is not already paid
        if (subscription.secondInstallmentPaid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Second installment has already been paid' });
        }

        // Create Stripe checkout session for second installment
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${course.title} - Second Installment (2 of 2)`,
                  description: `Student: ${subscription.studentFirstName} ${subscription.studentLastName} | Tutor: ${tutor.name || 'TBD'}`,
                },
                unit_amount: Math.round(parseFloat(subscription.secondInstallmentAmount || '0') * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${ctx.req.protocol}://${ctx.req.get('host')}/dashboard?payment=success`,
          cancel_url: `${ctx.req.protocol}://${ctx.req.get('host')}/dashboard?payment=cancelled`,
          metadata: {
            subscriptionId: subscription.id.toString(),
            courseId: subscription.courseId.toString(),
            parentId: ctx.user.id.toString(),
            installmentNumber: '2',
            paymentType: 'installment',
          },
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
        const totalPayments = allPayments.length;
        const totalRevenue = allPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
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
        role: z.enum(["admin", "parent", "tutor"]).optional(),
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

    getAllPayments: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        status: z.enum(["completed", "pending", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let allPayments = await db.getAllPayments();
        
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
        
        return {
          payments: enrichedPayments,
          total: allPayments.length,
        };
      }),

    exportUsersCSV: adminProcedure
      .input(z.object({
        role: z.enum(["admin", "parent", "tutor"]).optional(),
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

    getAnalytics: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const allUsers = await db.getAllUsers();
        const allSubscriptions = await db.getAllSubscriptions();
        const allPayments = await db.getAllPayments();
        
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
              if (p.status !== 'completed') return false;
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
        
        // Payment status distribution (filtered by date range)
        const filteredPayments = allPayments.filter(p => {
          const paymentDate = new Date(p.createdAt);
          return paymentDate >= rangeStart && paymentDate <= rangeEnd;
        });
        const completedPayments = filteredPayments.filter(p => p.status === 'completed').length;
        const pendingPayments = filteredPayments.filter(p => p.status === 'pending').length;
        const failedPayments = filteredPayments.filter(p => p.status === 'failed').length;
        
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

    // Acuity Mapping Endpoints
    getAcuityAppointmentTypes: adminProcedure
      .query(async () => {
        const { getAppointmentTypes } = await import("./acuity");
        const appointmentTypes = await getAppointmentTypes();
        return appointmentTypes;
      }),

    getAcuityCalendars: adminProcedure
      .query(async () => {
        const { getCalendars } = await import("./acuity");
        const calendars = await getCalendars();
        return calendars;
      }),

    updateCourseAcuityMapping: adminProcedure
      .input(z.object({
        courseId: z.number(),
        acuityAppointmentTypeId: z.number().nullable(),
        acuityCalendarId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const success = await db.updateCourseAcuityMapping(
          input.courseId,
          input.acuityAppointmentTypeId,
          input.acuityCalendarId
        );
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to update course Acuity mapping' 
          });
        }
        return { success: true };
      }),

    // Acuity Mapping Templates
    getAllMappingTemplates: adminProcedure
      .query(async () => {
        const templates = await db.getAllAcuityMappingTemplates();
        return templates;
      }),

    getMappingTemplateById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await db.getAcuityMappingTemplateById(input.id);
        if (!template) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }
        return template;
      }),

    createMappingTemplate: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        acuityAppointmentTypeId: z.number(),
        acuityCalendarId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const templateId = await db.createAcuityMappingTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
        if (!templateId) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to create template' 
          });
        }
        return { success: true, templateId };
      }),

    updateMappingTemplate: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        acuityAppointmentTypeId: z.number().optional(),
        acuityCalendarId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const success = await db.updateAcuityMappingTemplate(id, updates);
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to update template' 
          });
        }
        return { success: true };
      }),

    deleteMappingTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteAcuityMappingTemplate(input.id);
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to delete template' 
          });
        }
        return { success: true };
      }),

    bulkApplyMapping: adminProcedure
      .input(z.object({
        courseIds: z.array(z.number()),
        acuityAppointmentTypeId: z.number(),
        acuityCalendarId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const success = await db.bulkApplyAcuityMapping(
          input.courseIds,
          input.acuityAppointmentTypeId,
          input.acuityCalendarId
        );
        if (!success) {
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Failed to apply bulk mapping' 
          });
        }
        return { success: true, count: input.courseIds.length };
      }),

    // Export templates
    exportTemplates: adminProcedure
      .input(z.object({
        templateIds: z.array(z.number()).optional(), // If not provided, export all
      }))
      .query(async ({ input }) => {
        const templates = input.templateIds && input.templateIds.length > 0
          ? await Promise.all(input.templateIds.map(id => db.getAcuityMappingTemplateById(id)))
          : await db.getAllAcuityMappingTemplates();

        const validTemplates = templates.filter((t): t is NonNullable<typeof t> => t !== null);
        
        return {
          version: "1.0",
          exportDate: new Date().toISOString(),
          templates: validTemplates.map((t) => ({
            name: t!.name,
            description: t!.description,
            acuityAppointmentTypeId: t!.acuityAppointmentTypeId,
            acuityCalendarId: t!.acuityCalendarId,
          })),
        };
      }),

    // Import templates
    importTemplates: adminProcedure
      .input(z.object({
        templates: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          acuityAppointmentTypeId: z.number(),
          acuityCalendarId: z.number(),
        })),
        conflictResolution: z.enum(['skip', 'rename', 'overwrite']).default('rename'),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = {
          imported: 0,
          skipped: 0,
          errors: [] as string[],
        };

        for (const template of input.templates) {
          try {
            // Check for existing template with same name
            const existing = await db.getMappingTemplateByName(template.name);

            if (existing) {
              if (input.conflictResolution === 'skip') {
                results.skipped++;
                continue;
              } else if (input.conflictResolution === 'rename') {
                // Find unique name
                let newName = `${template.name} (Imported)`;
                let counter = 1;
                while (await db.getMappingTemplateByName(newName)) {
                  newName = `${template.name} (Imported ${counter})`;
                  counter++;
                }
                template.name = newName;
              } else if (input.conflictResolution === 'overwrite') {
                // Delete existing template
                await db.deleteAcuityMappingTemplate(existing.id);
              }
            }

            // Create new template
            await db.createAcuityMappingTemplate({
              name: template.name,
              description: template.description || '',
              acuityAppointmentTypeId: template.acuityAppointmentTypeId,
              acuityCalendarId: template.acuityCalendarId,
              createdBy: ctx.user.id,
            });
            results.imported++;
          } catch (error) {
            results.errors.push(`Failed to import "${template.name}": ${error}`);
          }
        }

        return results;
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
      .input(z.object({
        limit: z.number().optional().default(10),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const allTutors = await db.getAllTutorsWithStatus();
        const paginatedTutors = allTutors.slice(input.offset, input.offset + input.limit);
        return {
          tutors: paginatedTutors,
          total: allTutors.length,
        };
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

        // Send approval confirmation email to tutor
        if (tutorProfile.email && tutorProfile.name) {
          try {
            const { sendTutorApprovalEmail } = await import('./email-helpers');
            await sendTutorApprovalEmail({
              tutorEmail: tutorProfile.email,
              tutorName: tutorProfile.name,
            });
            console.log('[TutorApproval] Confirmation email sent to:', tutorProfile.email);
          } catch (error) {
            console.error('[TutorApproval] Failed to send confirmation email:', error);
            // Don't fail the approval if email fails
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
          const session = await db.getSessionById(input.sessionId);
          if (session) {
            const parent = await db.getUserById(input.parentId);
            const tutor = await db.getUserById(ctx.user.id);

            if (parent && tutor && parent.name && tutor.name) {
              // Get attachments for this note
              const attachments = await db.getSessionNoteAttachments(note.id);

              const sessionDate = new Date(session.scheduledAt);
              const emailHtml = await sendSessionNotesEmail({
                parentName: parent.name,
                tutorName: tutor.name,
                sessionDate: sessionDate.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }),
                sessionTime: sessionDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                }),
                progressSummary: input.progressSummary,
                homework: input.homework || undefined,
                challenges: input.challenges || undefined,
                nextSteps: input.nextSteps || undefined,
                notesUrl: `https://your-domain.com/session-notes`,
                attachments: attachments.map(att => ({
                  fileName: att.fileName,
                  fileUrl: att.fileUrl,
                  fileSize: att.fileSize,
                })),
              });

              console.log('[Email Service] Session notes email generated:', emailHtml.substring(0, 200));
            }
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
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
        curriculum: z.string().optional(),
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
        duration: z.number().optional(),
        sessionsPerWeek: z.number().optional(),
        totalSessions: z.number().optional(),
        imageUrl: z.string().optional(),
        curriculum: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCourse(id, data as any);
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
        const hasSession = sessions.some(s => s.tutorId === input.tutorId);

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

        // Cancel in Acuity Scheduling if appointment exists
        if (session.acuityAppointmentId) {
          try {
            await cancelAppointment(session.acuityAppointmentId);
          } catch (error) {
            console.error('[Booking Management] Failed to cancel in Acuity:', error);
            // Continue with local cancellation even if Acuity fails
          }
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

    /**
     * Request reschedule for a session (returns Acuity reschedule URL)
     */
    getRescheduleUrl: publicProcedure
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
            message: 'Booking not found' 
          });
        }

        // Check if session can be rescheduled
        if (session.status === 'cancelled') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Cannot reschedule a cancelled session' 
          });
        }

        if (session.status === 'completed') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Cannot reschedule a completed session' 
          });
        }

        if (!session.acuityAppointmentId) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'This session is not linked to Acuity Scheduling' 
          });
        }

        // Generate Acuity reschedule URL
        const rescheduleUrl = `https://app.acuityscheduling.com/schedule.php?action=reschedule&id=${session.acuityAppointmentId}`;

        return { rescheduleUrl };
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
});

export type AppRouter = typeof appRouter;
