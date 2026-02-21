import { eq, and, or, like, desc, asc, sql, gte, lte, lt, gt, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import crypto from "crypto";
import {
  InsertUser, users, tutorProfiles, parentProfiles, courses,
  subscriptions, sessions, conversations, messages, payments,
  InsertTutorProfile, InsertParentProfile, InsertCourse,
  InsertSubscription, InsertSession, InsertConversation,
  InsertMessage, InsertPayment, courseTutors, InsertCourseTutor,
  platformStats, featuredCourses, testimonials, faqs, blogPosts,
  tutorAvailability, InsertTutorAvailability,
  tutorTimeBlocks, InsertTutorTimeBlock,
  acuityMappingTemplates, InsertAcuityMappingTemplate,
  emailSettings, InsertEmailSettings,
  emailVerifications, EmailVerification,
  passwordSetupTokens, PasswordSetupToken,
  sessionNotes, InsertSessionNote,
  sessionNoteAttachments, InsertSessionNoteAttachment,
  tutorReviews, InsertTutorReview,
  notificationPreferences, InsertNotificationPreference,
  notificationLogs, InsertNotificationLog,
  inAppNotifications, InsertInAppNotification,
  refreshTokens,
  tutorCoursePreferences, InsertTutorCoursePreference,
  tutorPayoutRequests, InsertTutorPayoutRequest
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Management ============

function generateOpenId() {
  return crypto.randomUUID();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAuthUser(input: {
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  role: "parent" | "tutor" | "admin";
  userType?: "parent" | "tutor" | "admin";
}) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const openId = generateOpenId();

  const inserted = await db.insert(users).values({
    openId,
    email: input.email,
    passwordHash: input.passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`.trim(),
    role: input.role,
    userType: input.userType ?? input.role,
    emailVerified: false,
    lastSignedIn: now,
    createdAt: now,
    updatedAt: now,
  } as InsertUser);

  // With mysql2 driver drizzle doesn't reliably expose insertId; fetch by email instead
  const created = await getUserByEmail(input.email);
  return created ?? null;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Refresh Token Management ============

export async function storeRefreshToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  const tokenHash = hashToken(token);
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
}

export async function revokeRefreshToken(token: string) {
  const db = await getDb();
  if (!db) return;
  const tokenHash = hashToken(token);
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function findValidRefreshToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const results = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        sql`( ${refreshTokens.expiresAt} > ${now} )`,
        sql`( ${refreshTokens.revokedAt} IS NULL )`
      )
    )
    .limit(1);
  return results[0] ?? null;
}

// ============ Email Verification ============

export async function createEmailVerificationToken(userId: number, ttlMs = 1000 * 60 * 60 * 24) {
  const db = await getDb();
  if (!db) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  // invalidate previous tokens
  await db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailVerifications.userId, userId), sql`${emailVerifications.consumedAt} IS NULL`));

  await db.insert(emailVerifications).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function validateEmailVerificationToken(token: string): Promise<EmailVerification | null> {
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const results = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.tokenHash, tokenHash),
        sql`${emailVerifications.expiresAt} > ${now}`,
        sql`${emailVerifications.consumedAt} IS NULL`
      )
    )
    .limit(1);
  return results[0] ?? null;
}

export async function consumeEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const verification = await validateEmailVerificationToken(token);
  if (!verification) return null;

  await db.transaction(async tx => {
    await tx
      .update(emailVerifications)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerifications.id, verification.id));

    await tx
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date() })
      .where(eq(users.id, verification.userId));
  });

  return await getUserById(verification.userId);
}

// ============ Password Setup Tokens ============

export async function createPasswordSetupToken(userId: number, ttlMs = 48 * 60 * 60 * 1000) {
  const db = await getDb();
  if (!db) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  // Invalidate previous tokens for this user
  await db
    .update(passwordSetupTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(passwordSetupTokens.userId, userId), sql`${passwordSetupTokens.consumedAt} IS NULL`));

  await db.insert(passwordSetupTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function validatePasswordSetupToken(token: string): Promise<PasswordSetupToken | null> {
  const db = await getDb();
  if (!db) return null;

  const tokenHash = hashToken(token);
  const result = await db
    .select()
    .from(passwordSetupTokens)
    .where(
      and(
        eq(passwordSetupTokens.tokenHash, tokenHash),
        gt(passwordSetupTokens.expiresAt, new Date()),
        sql`${passwordSetupTokens.consumedAt} IS NULL`
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function consumePasswordSetupToken(token: string, newPasswordHash: string) {
  const db = await getDb();
  if (!db) return null;

  const setupToken = await validatePasswordSetupToken(token);
  if (!setupToken) return null;

  await db.transaction(async tx => {
    await tx
      .update(passwordSetupTokens)
      .set({ consumedAt: new Date() })
      .where(eq(passwordSetupTokens.id, setupToken.id));

    await tx
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        accountSetupComplete: true
      })
      .where(eq(users.id, setupToken.userId));
  });

  return await getUserById(setupToken.userId);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "parent" | "tutor" | "admin") {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(users).set({ role }).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update user role:", error);
    return false;
  }
}

// ============ User Creation ============

export async function createUser(user: { name: string; email: string; role: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(users).values({
      openId: crypto.randomUUID(),
      name: user.name,
      email: user.email,
      firstName: user.name.split(" ")[0] || user.name,
      lastName: user.name.split(" ").slice(1).join(" ") || user.name,
      passwordHash: "$2a$12$C8WlA9kZZgwyU0YzUKGwEuKXXSb9VjA36TObgGJE0E7E5Wdl66iRS", // 'password' placeholder
      role: user.role as 'admin' | 'tutor' | 'parent',
      userType: user.role as 'admin' | 'tutor' | 'parent',
      lastSignedIn: new Date(),
    }) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    return null;
  }
}

// ============ Tutor Profile Management ============

export async function getAllTutorsWithStatus() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      userName: users.name,
      email: users.email,
      bio: tutorProfiles.bio,
      qualifications: tutorProfiles.qualifications,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      hourlyRate: tutorProfiles.hourlyRate,
      yearsOfExperience: tutorProfiles.yearsOfExperience,
      profileImageUrl: tutorProfiles.profileImageUrl,
      approvalStatus: tutorProfiles.approvalStatus,
      rejectionReason: tutorProfiles.rejectionReason,
      createdAt: tutorProfiles.createdAt,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(tutorProfiles.userId, users.id));

  return result;
}

export async function approveTutorProfile(tutorId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    // First, get the tutor profile to find the userId
    const profile = await db
      .select()
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, tutorId))
      .limit(1);
    
    if (!profile || profile.length === 0) {
      console.error("[Database] Tutor profile not found:", tutorId);
      return false;
    }

    const userId = profile[0].userId;

    // Update tutor profile approval status
    await db
      .update(tutorProfiles)
      .set({
        approvalStatus: 'approved',
        isActive: true,
      })
      .where(eq(tutorProfiles.id, tutorId));

    // Change user role from 'parent' to 'tutor'
    await db
      .update(users)
      .set({ role: 'tutor' })
      .where(eq(users.id, userId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to approve tutor:", error);
    return false;
  }
}

export async function rejectTutorProfile(tutorId: number, reason: string) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(tutorProfiles)
      .set({
        approvalStatus: 'rejected',
        rejectionReason: reason,
        isActive: false,
      })
      .where(eq(tutorProfiles.id, tutorId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to reject tutor:", error);
    return false;
  }
}

// ============ Tutor Profile Management ============

export async function createTutorProfile(profile: InsertTutorProfile) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(tutorProfiles).values(profile) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create tutor profile:", error);
    return null;
  }
}

export async function getTutorProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      bio: tutorProfiles.bio,
      qualifications: tutorProfiles.qualifications,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      hourlyRate: tutorProfiles.hourlyRate,
      yearsOfExperience: tutorProfiles.yearsOfExperience,
      availability: tutorProfiles.availability,
      profileImageUrl: tutorProfiles.profileImageUrl,
      isActive: tutorProfiles.isActive,
      rating: tutorProfiles.rating,
      totalReviews: tutorProfiles.totalReviews,
      approvalStatus: tutorProfiles.approvalStatus,
      createdAt: tutorProfiles.createdAt,
      updatedAt: tutorProfiles.updatedAt,
      name: users.name,
      email: users.email,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(tutorProfiles.userId, users.id))
    .where(eq(tutorProfiles.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTutorProfileById(profileId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      bio: tutorProfiles.bio,
      qualifications: tutorProfiles.qualifications,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      hourlyRate: tutorProfiles.hourlyRate,
      yearsOfExperience: tutorProfiles.yearsOfExperience,
      availability: tutorProfiles.availability,
      profileImageUrl: tutorProfiles.profileImageUrl,
      isActive: tutorProfiles.isActive,
      rating: tutorProfiles.rating,
      totalReviews: tutorProfiles.totalReviews,
      approvalStatus: tutorProfiles.approvalStatus,
      createdAt: tutorProfiles.createdAt,
      updatedAt: tutorProfiles.updatedAt,
      name: users.name,
      email: users.email,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(tutorProfiles.userId, users.id))
    .where(eq(tutorProfiles.id, profileId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateTutorProfile(userId: number, updates: Partial<InsertTutorProfile>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(tutorProfiles).set(updates).where(eq(tutorProfiles.userId, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update tutor profile:", error);
    return false;
  }
}

export async function getAllActiveTutors() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      bio: tutorProfiles.bio,
      qualifications: tutorProfiles.qualifications,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      hourlyRate: tutorProfiles.hourlyRate,
      yearsOfExperience: tutorProfiles.yearsOfExperience,
      profileImageUrl: tutorProfiles.profileImageUrl,
      rating: tutorProfiles.rating,
      totalReviews: tutorProfiles.totalReviews,
      userName: users.name,
      userEmail: users.email,
    })
    .from(tutorProfiles)
    .innerJoin(users, eq(tutorProfiles.userId, users.id))
    .where(
      and(
        eq(tutorProfiles.isActive, true),
        eq(tutorProfiles.approvalStatus, 'approved')
      )
    );

  return result;
}

// ============ Parent Profile Management ============

export async function createParentProfile(profile: InsertParentProfile) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(parentProfiles).values(profile) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create parent profile:", error);
    return null;
  }
}

export async function getParentProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateParentProfile(userId: number, updates: Partial<InsertParentProfile>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(parentProfiles).set(updates).where(eq(parentProfiles.userId, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update parent profile:", error);
    return false;
  }
}

// ============ Course Management ============

export async function createCourse(course: InsertCourse) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(courses).values(course) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create course:", error);
    return null;
  }
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ Course-Tutor Junction Table Management ============

export async function addTutorToCourse(courseId: number, tutorId: number, isPrimary: boolean = false) {
  const db = await getDb();
  if (!db) return false;

  try {
    const now = new Date();

    // Link tutor to course
    await db.insert(courseTutors).values({
      courseId,
      tutorId,
      isPrimary,
      createdAt: now,
    } as InsertCourseTutor);

    // Ensure an approved preference exists for this pairing
    const course = await db.select({ price: courses.price }).from(courses).where(eq(courses.id, courseId)).limit(1);
    const hourlyRate = course?.[0]?.price?.toString?.() ?? "0.00";

    await db.insert(tutorCoursePreferences)
      .values({
        tutorId,
        courseId,
        hourlyRate,
        approvalStatus: "APPROVED",
        createdAt: now,
        updatedAt: now,
      } as InsertTutorCoursePreference)
      .onDuplicateKeyUpdate({
        set: {
          hourlyRate,
          approvalStatus: "APPROVED",
          updatedAt: now,
        },
      });

    return true;
  } catch (error) {
    console.error("Failed to add tutor to course:", error);
    return false;
  }
}

export async function removeTutorFromCourse(courseId: number, tutorId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(courseTutors)
      .where(and(
        eq(courseTutors.courseId, courseId),
        eq(courseTutors.tutorId, tutorId)
      ));

    // Mark related preference as rejected so it no longer counts as approved
    await db
      .update(tutorCoursePreferences)
      .set({ approvalStatus: "REJECTED", updatedAt: new Date() })
      .where(and(
        eq(tutorCoursePreferences.courseId, courseId),
        eq(tutorCoursePreferences.tutorId, tutorId)
      ));

    return true;
  } catch (error) {
    console.error("Failed to remove tutor from course:", error);
    return false;
  }
}

export async function isTutorOfCourse(courseId: number, tutorId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select()
    .from(courseTutors)
    .where(and(
      eq(courseTutors.courseId, courseId),
      eq(courseTutors.tutorId, tutorId)
    ))
    .limit(1);
  
  return result.length > 0;
}

export async function getTutorsForCourse(courseId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db.select({
      tutorId: courseTutors.tutorId,
      isPrimary: courseTutors.isPrimary,
      user: users,
      profile: tutorProfiles,
    })
      .from(courseTutors)
      .innerJoin(
        tutorCoursePreferences,
        and(
          eq(tutorCoursePreferences.courseId, courseTutors.courseId),
          eq(tutorCoursePreferences.tutorId, courseTutors.tutorId),
          eq(tutorCoursePreferences.approvalStatus, "APPROVED")
        )
      )
      .innerJoin(users, eq(courseTutors.tutorId, users.id))
      .leftJoin(tutorProfiles, eq(users.id, tutorProfiles.userId))
      .where(eq(courseTutors.courseId, courseId));

    // Deduplicate by tutorId (in case multiple primary flags or duplicate links exist)
    const byTutor = new Map<number, typeof rows[number]>();
    for (const row of rows) {
      const existing = byTutor.get(row.tutorId);
      if (!existing) {
        byTutor.set(row.tutorId, row);
        continue;
      }
      // Prefer primary version if present
      if (row.isPrimary && !existing.isPrimary) {
        byTutor.set(row.tutorId, row);
      }
    }
    return Array.from(byTutor.values());
  } catch (error) {
    console.error("[Database] getTutorsForCourse failed:", error);
    return [];
  }
}

export async function getCoursesByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get course IDs for this tutor from approved preferences
  const tutorCourses = await db.select({ courseId: tutorCoursePreferences.courseId })
    .from(tutorCoursePreferences)
    .where(
      and(
        eq(tutorCoursePreferences.tutorId, tutorId),
        eq(tutorCoursePreferences.approvalStatus, "APPROVED")
      )
    );
  
  if (tutorCourses.length === 0) return [];
  
  const courseIds = tutorCourses.map(tc => tc.courseId);
  return await db.select().from(courses)
    .where(inArray(courses.id, courseIds))
    .orderBy(desc(courses.createdAt));
}

export async function getAllActiveCourses() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
}

export async function updateCourse(id: number, updates: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(courses).set(updates).where(eq(courses.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update course:", error);
    return false;
  }
}

export async function searchCourses(filters: {
  subject?: string;
  gradeLevel?: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(courses.isActive, true)];

  if (filters.subject) {
    conditions.push(eq(courses.subject, filters.subject));
  }

  if (filters.gradeLevel) {
    conditions.push(eq(courses.gradeLevel, filters.gradeLevel));
  }

  if (filters.minPrice !== undefined) {
    conditions.push(gte(courses.price, filters.minPrice.toString()));
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(lte(courses.price, filters.maxPrice.toString()));
  }

  if (filters.searchTerm) {
    conditions.push(
      or(
        like(courses.title, `%${filters.searchTerm}%`),
        like(courses.description, `%${filters.searchTerm}%`)
      )!
    );
  }

  return await db.select().from(courses).where(and(...conditions)).orderBy(desc(courses.createdAt));
}

// ============ Tutor Course Preferences ============

export type TutorCoursePreferenceInput = {
  courseId: number;
  hourlyRate: number;
};

export async function getTutorCoursePreferences(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: tutorCoursePreferences.id,
        tutorId: tutorCoursePreferences.tutorId,
        courseId: tutorCoursePreferences.courseId,
        hourlyRate: tutorCoursePreferences.hourlyRate,
        approvalStatus: tutorCoursePreferences.approvalStatus,
        courseTitle: courses.title,
        courseSubject: courses.subject,
        courseGradeLevel: courses.gradeLevel,
      })
      .from(tutorCoursePreferences)
      .innerJoin(courses, eq(tutorCoursePreferences.courseId, courses.id))
      .where(eq(tutorCoursePreferences.tutorId, tutorId));
  } catch (error) {
    console.error("[Database] Failed to get tutor course preferences:", error);
    return [];
  }
}

export async function upsertTutorCoursePreferences(
  tutorId: number,
  preferences: TutorCoursePreferenceInput[]
) {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(tutorCoursePreferences)
        .where(eq(tutorCoursePreferences.tutorId, tutorId));

      const existingByCourse = new Map(existing.map((pref) => [pref.courseId, pref]));
      const incomingCourseIds = preferences.map((p) => p.courseId);

      // Delete preferences (and course tutor links) that are no longer selected
      const toDelete = existing
        .filter((pref) => !incomingCourseIds.includes(pref.courseId))
        .map((pref) => pref.courseId);

      if (toDelete.length > 0) {
        await tx
          .delete(tutorCoursePreferences)
          .where(
            and(
              eq(tutorCoursePreferences.tutorId, tutorId),
              inArray(tutorCoursePreferences.courseId, toDelete)
            )
          );

        await tx
          .delete(courseTutors)
          .where(
            and(
              eq(courseTutors.tutorId, tutorId),
              inArray(courseTutors.courseId, toDelete)
            )
          );
      }

      for (const pref of preferences) {
        const rate = Number(pref.hourlyRate || 0).toFixed(2);
        const existingPref = existingByCourse.get(pref.courseId);

        if (!existingPref) {
          await tx.insert(tutorCoursePreferences).values({
            tutorId,
            courseId: pref.courseId,
            hourlyRate: rate,
            approvalStatus: "PENDING",
            createdAt: now,
            updatedAt: now,
          } as InsertTutorCoursePreference);
          continue;
        }

        const rateChanged = existingPref.hourlyRate !== rate;
        const shouldResetStatus =
          rateChanged || existingPref.approvalStatus === "REJECTED"
            ? "PENDING"
            : existingPref.approvalStatus;

        await tx
          .update(tutorCoursePreferences)
          .set({
            hourlyRate: rate,
            approvalStatus: shouldResetStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(tutorCoursePreferences.tutorId, tutorId),
              eq(tutorCoursePreferences.courseId, pref.courseId)
            )
          );

        if (shouldResetStatus === "PENDING" && existingPref.approvalStatus === "APPROVED") {
          await tx
            .delete(courseTutors)
            .where(
              and(
                eq(courseTutors.tutorId, tutorId),
                eq(courseTutors.courseId, pref.courseId)
              )
            );
        }
      }
    });

    return true;
  } catch (error) {
    console.error("[Database] Failed to upsert tutor course preferences:", error);
    return false;
  }
}

export async function getTutorsForPreferenceDropdown() {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "tutor"))
      .orderBy(asc(users.name));
  } catch (error) {
    console.error("[Database] Failed to fetch tutors for dropdown:", error);
    return [];
  }
}

export async function getTutorCoursePreferencesForAdmin(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: tutorCoursePreferences.id,
        tutorId: tutorCoursePreferences.tutorId,
        courseId: tutorCoursePreferences.courseId,
        hourlyRate: tutorCoursePreferences.hourlyRate,
        approvalStatus: tutorCoursePreferences.approvalStatus,
        courseTitle: courses.title,
      })
      .from(tutorCoursePreferences)
      .innerJoin(courses, eq(tutorCoursePreferences.courseId, courses.id))
      .where(eq(tutorCoursePreferences.tutorId, tutorId));
  } catch (error) {
    console.error("[Database] Failed to fetch tutor preferences for admin:", error);
    return [];
  }
}

export async function updateTutorCoursePreferenceStatus(
  preferenceId: number,
  approvalStatus: "APPROVED" | "REJECTED"
) {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(tutorCoursePreferences)
        .where(eq(tutorCoursePreferences.id, preferenceId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("PREFERENCE_NOT_FOUND");
      }

      const pref = existing[0];

      await tx
        .update(tutorCoursePreferences)
        .set({ approvalStatus, updatedAt: now })
        .where(eq(tutorCoursePreferences.id, preferenceId));

      if (approvalStatus === "APPROVED") {
        const courseLink = await tx
          .select()
          .from(courseTutors)
          .where(
            and(
              eq(courseTutors.courseId, pref.courseId),
              eq(courseTutors.tutorId, pref.tutorId)
            )
          )
          .limit(1);

        if (courseLink.length === 0) {
          await tx.insert(courseTutors).values({
            courseId: pref.courseId,
            tutorId: pref.tutorId,
            isPrimary: false,
            createdAt: now,
          });
        }
      } else {
        await tx
          .delete(courseTutors)
          .where(
            and(
              eq(courseTutors.courseId, pref.courseId),
              eq(courseTutors.tutorId, pref.tutorId)
            )
          );
      }

      return true;
    });
  } catch (error) {
    if ((error as any)?.message === "PREFERENCE_NOT_FOUND") {
      return false;
    }
    console.error("[Database] Failed to update tutor course preference status:", error);
    return false;
  }
}

// ============ Subscription Management ============

export async function createSubscription(subscription: InsertSubscription) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(subscriptions).values(subscription) as any;
    const newId = result?.[0]?.insertId ?? (result as any)?.insertId;
    if (!newId) {
      // Fallback: fetch the latest subscription for this parent+course
      const rows = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.parentId, subscription.parentId), eq(subscriptions.courseId, subscription.courseId)))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      return rows[0]?.id ?? null;
    }
    return Number(newId);
  } catch (error) {
    console.error("[Database] Failed to create subscription:", error);
    return null;
  }
}

export async function getSubscriptionById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSubscriptionsByParentId(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  // Fetch with all tutor links (primary and secondary) so we can gracefully
  // fall back when no primary tutor is flagged for a course.
  const rows = await db
    .select({
      subscription: subscriptions,
      course: courses,
      tutor: users,
      isPrimary: courseTutors.isPrimary,
    })
    .from(subscriptions)
    .innerJoin(courses, eq(subscriptions.courseId, courses.id))
    // Tutor link may be missing; use left joins so subscriptions still return.
    .leftJoin(courseTutors, eq(courses.id, courseTutors.courseId))
    .leftJoin(users, eq(courseTutors.tutorId, users.id))
    .where(eq(subscriptions.parentId, parentId))
    .orderBy(desc(subscriptions.createdAt));

  // Deduplicate per subscription:
  // 1. If the parent explicitly chose a tutor (preferredTutorId), use that tutor.
  // 2. Otherwise fall back to the primary tutor, then any tutor.
  const bySubscription = new Map<number, typeof rows[number]>();
  for (const row of rows) {
    const existing = bySubscription.get(row.subscription.id);
    if (!existing) {
      bySubscription.set(row.subscription.id, row);
      continue;
    }
    const preferredId = row.subscription.preferredTutorId;
    const rowMatchesPreferred = preferredId !== null && preferredId !== undefined && row.tutor?.id === preferredId;
    const existingMatchesPreferred = preferredId !== null && preferredId !== undefined && existing.tutor?.id === preferredId;

    if (rowMatchesPreferred && !existingMatchesPreferred) {
      // This row is the parent's explicit choice — always prefer it
      bySubscription.set(row.subscription.id, row);
    } else if (!existingMatchesPreferred && row.isPrimary && !existing.isPrimary) {
      // No preferred tutor set — fall back to primary
      bySubscription.set(row.subscription.id, row);
    }
  }

  // Preserve createdAt ordering after deduplication.
  return Array.from(bySubscription.values()).sort(
    (a, b) => (b.subscription.createdAt?.getTime?.() ?? 0) - (a.subscription.createdAt?.getTime?.() ?? 0)
  );
}

export async function getSubscriptionsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      subscription: subscriptions,
      course: courses,
      parent: users,
    })
    .from(subscriptions)
    .innerJoin(courses, eq(subscriptions.courseId, courses.id))
    .innerJoin(users, eq(subscriptions.parentId, users.id))
    .where(eq(subscriptions.preferredTutorId, tutorId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      subscription: subscriptions,
      course: courses,
      parent: users,
      tutor: { id: users.id, name: users.name, email: users.email },
    })
    .from(subscriptions)
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(users, eq(subscriptions.parentId, users.id))
    .orderBy(desc(subscriptions.createdAt));
}

export async function updateSubscription(id: number, updates: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(subscriptions).set(updates).where(eq(subscriptions.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update subscription:", error);
    return false;
  }
}

// ============ Session Management ============

export async function createSession(session: InsertSession) {
  const db = await getDb();
  if (!db) return null;

  try {
    const durationMs = (session.duration || 0) * 60000;
    const startMs = session.scheduledAt;
    const endMs = startMs + durationMs;

    const insertId = await db.transaction(async (trx) => {
      // Lock and check overlapping sessions for this tutor
      const conflicts = await trx.execute(sql`
        SELECT id FROM sessions
        WHERE tutorId = ${session.tutorId}
          AND status = 'scheduled'
          AND ${startMs} < (sessions.scheduledAt + sessions.duration * 60000)
          AND ${endMs} > sessions.scheduledAt
        FOR UPDATE
      `);

      const rows = Array.isArray(conflicts?.[0]) ? conflicts[0] : [];
      if (rows.length > 0) {
        throw new Error("SESSION_CONFLICT");
      }

      const result = await trx.insert(sessions).values(session) as any;
      const newId = result?.[0]?.insertId ?? (result as any)?.insertId;
      if (!newId) {
        throw new Error("SESSION_INSERT_FAILED");
      }
      return Number(newId);
    });

    return insertId;
  } catch (error: any) {
    if (error?.message === "SESSION_CONFLICT" || error?.code === "ER_DUP_ENTRY") {
      throw new Error("SESSION_CONFLICT");
    }
    console.error("[Database] Failed to create session:", error);
    throw error;
  }
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSessionByTutorAndTime(tutorId: number, scheduledAt: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tutorId, tutorId), eq(sessions.scheduledAt, scheduledAt)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSessionsByParentId(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      session: sessions,
      courseTitle: courses.title,
      courseSubject: courses.subject,
      tutorName: users.name,
      studentFirstName: subscriptions.studentFirstName,
      studentLastName: subscriptions.studentLastName,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(users, eq(sessions.tutorId, users.id))
    .where(eq(sessions.parentId, parentId))
    .orderBy(desc(sessions.scheduledAt));
}

export async function getSessionsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      session: sessions,
      courseTitle: courses.title,
      courseSubject: courses.subject,
      tutorName: users.name,
      studentFirstName: subscriptions.studentFirstName,
      studentLastName: subscriptions.studentLastName,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(users, eq(sessions.tutorId, users.id))
    .where(eq(sessions.tutorId, tutorId))
    .orderBy(desc(sessions.scheduledAt));
}

// Completed sessions (for history views)
export async function getCompletedSessionsByParentId(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      session: sessions,
      courseTitle: courses.title,
      courseSubject: courses.subject,
      tutorName: users.name,
      studentFirstName: subscriptions.studentFirstName,
      studentLastName: subscriptions.studentLastName,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(users, eq(sessions.tutorId, users.id))
    .where(and(eq(sessions.parentId, parentId), eq(sessions.status, 'completed' as any)))
    .orderBy(desc(sessions.scheduledAt));
}

export async function getCompletedSessionsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  const tutorUsers = alias(users, "tutorUser");
  const parentUsers = alias(users, "parentUser");

  return await db
    .select({
      session: sessions,
      courseTitle: courses.title,
      courseSubject: courses.subject,
      tutorName: tutorUsers.name,
      parentName: parentUsers.name,
      studentFirstName: subscriptions.studentFirstName,
      studentLastName: subscriptions.studentLastName,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(tutorUsers, eq(sessions.tutorId, tutorUsers.id))
    .leftJoin(parentUsers, eq(sessions.parentId, parentUsers.id))
    .where(and(
      eq(sessions.tutorId, tutorId),
      or(
        eq(sessions.status, 'completed' as any),
        eq(sessions.status, 'no_show' as any),
        eq(sessions.status, 'cancelled' as any),
        and(
          eq(sessions.status, 'scheduled' as any),
          lt(sessions.scheduledAt, Date.now())
        )
      )
    ))
    .orderBy(desc(sessions.scheduledAt));
}

export async function getUpcomingSessions(userId: number, role: "parent" | "tutor") {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  const condition = role === "parent"
    ? eq(sessions.parentId, userId)
    : eq(sessions.tutorId, userId);

  const tutorUsers = alias(users, "tutorUser");
  const parentUsers = alias(users, "parentUser");

  return await db
    .select({
      session: sessions,
      courseTitle: courses.title,
      courseSubject: courses.subject,
      tutorName: tutorUsers.name,
      parentName: parentUsers.name,
      studentFirstName: subscriptions.studentFirstName,
      studentLastName: subscriptions.studentLastName,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(tutorUsers, eq(sessions.tutorId, tutorUsers.id))
    .leftJoin(parentUsers, eq(sessions.parentId, parentUsers.id))
    .where(and(condition, gte(sessions.scheduledAt, now), eq(sessions.status, "scheduled")))
    .orderBy(asc(sessions.scheduledAt));
}

export async function updateSession(id: number, updates: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(sessions).set(updates).where(eq(sessions.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session:", error);
    return false;
  }
}

// ============ Messaging ============

export async function createConversation(conversation: InsertConversation) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(conversations).values(conversation) as any;
  const rawId = result?.[0]?.insertId ?? (result as any)?.insertId;
  const insertId = rawId ? Number(rawId) : null;

  if (!insertId) {
    // Driver didn't return insertId — fetch the row we just inserted
    const fetched = await getConversationByStudentAndTutor(
      conversation.parentId,
      conversation.tutorId,
      conversation.studentId!
    );
    return fetched ? fetched.id : null;
  }

  return insertId;
}

export async function getConversationByParticipants(parentId: number, tutorId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.parentId, parentId), eq(conversations.tutorId, tutorId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getConversationsByUserId(userId: number, role: "parent" | "tutor") {
  const db = await getDb();
  if (!db) return [];

  const condition = role === "parent" 
    ? eq(conversations.parentId, userId)
    : eq(conversations.tutorId, userId);

  return await db
    .select()
    .from(conversations)
    .where(condition)
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getTutorConversationsWithDetails(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  const [rows, unreadMap] = await Promise.all([
    db
      .select({
        conversation: conversations,
        parent: users,
        subscription: subscriptions,
        course: courses,
      })
      .from(conversations)
      .innerJoin(users, eq(conversations.parentId, users.id))
      .innerJoin(subscriptions, and(
        eq(conversations.studentId, subscriptions.id),
        eq(subscriptions.preferredTutorId, tutorId)
      ))
      .leftJoin(courses, eq(subscriptions.courseId, courses.id))
      .where(eq(conversations.tutorId, tutorId))
      .orderBy(desc(conversations.lastMessageAt)),
    getUnreadCountsByConversation(tutorId),
  ]);

  return rows.map(row => ({
    ...row,
    unreadCount: unreadMap.get(Number(row.conversation.id)) ?? 0,
  }));
}

export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(messages).values(message) as any;

    // Drizzle/MySQL drivers sometimes return insertId on the result object or inside the first array element.
    const rawInsertId =
      (result as any)?.insertId ??
      (Array.isArray(result) ? (result as any)[0]?.insertId : undefined);

    const insertId = rawInsertId !== undefined ? Number(rawInsertId) : null;

    // Update conversation's lastMessageAt (non-blocking)
    try {
      await db.update(conversations)
        .set({ lastMessageAt: message.sentAt })
        .where(eq(conversations.id, message.conversationId));
    } catch (err) {
      console.error("[Database] Failed to update lastMessageAt for conversation", message.conversationId, err);
    }

    if (insertId === null) {
      console.warn("[Database] Message inserted but insertId missing from driver response", { result });
    }

    return insertId;
  } catch (error) {
    console.error("[Database] Failed to create message:", error);
    return null;
  }
}

export async function getMessagesByConversationId(conversationId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sentAt))
    .limit(limit);
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function markMessagesAsRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`,
          eq(messages.isRead, false)
        )
      );
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark messages as read:", error);
    return false;
  }
}

export async function getUnreadMessageCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.isRead, false),
          sql`${messages.senderId} != ${userId}`,
          or(
            eq(conversations.parentId, userId),
            eq(conversations.tutorId, userId)
          )
        )
      );
    return Number(result[0]?.count ?? 0);
  } catch (error) {
    console.error("[Database] Failed to get unread message count:", error);
    return 0;
  }
}

/**
 * Get unread message counts per conversation for a given user (as a map: conversationId → count)
 */
async function getUnreadCountsByConversation(userId: number): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) return new Map();

  try {
    const rows = await db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.isRead, false),
          sql`${messages.senderId} != ${userId}`,
          or(
            eq(conversations.parentId, userId),
            eq(conversations.tutorId, userId)
          )
        )
      )
      .groupBy(messages.conversationId);

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.conversationId), Number(row.count) || 0);
    }
    return map;
  } catch (error) {
    console.error("[Database] Failed to get unread counts by conversation:", error);
    return new Map();
  }
}

// ============ Payment Management ============

export async function createPayment(payment: InsertPayment) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(payments).values(payment) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create payment:", error);
    return null;
  }
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPaymentsByParentId(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(payments).where(eq(payments.parentId, parentId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(payments).where(eq(payments.tutorId, tutorId)).orderBy(desc(payments.createdAt));
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(payments).orderBy(desc(payments.createdAt));
}

export async function getTutorEarnings(tutorId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, pending: 0 };

  const result = await db
    .select({
      status: payments.status,
      total: sql<number>`SUM(${payments.amount})`,
    })
    .from(payments)
    .where(eq(payments.tutorId, tutorId))
    .groupBy(payments.status);

  let total = 0;
  let completed = 0;
  let pending = 0;

  result.forEach(row => {
    const amount = Number(row.total) || 0;
    total += amount;
    if (row.status === "completed") completed += amount;
    if (row.status === "pending") pending += amount;
  });

  return { total, completed, pending };
}

export async function updatePayment(id: number, updates: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(payments).set(updates).where(eq(payments.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update payment:", error);
    return false;
  }
}


// ============ Home Page Data ============

export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(platformStats)
      .where(eq(platformStats.isActive, true))
      .orderBy(asc(platformStats.displayOrder));
  } catch (error) {
    console.error("[Database] Error fetching platform stats:", error);
    return [];
  }
}

export async function getFeaturedCourses() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(featuredCourses)
      .where(eq(featuredCourses.isActive, true))
      .orderBy(asc(featuredCourses.displayOrder));
  } catch (error) {
    console.error("[Database] Error fetching featured courses:", error);
    return [];
  }
}

export async function getTestimonials() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.isActive, true))
      .orderBy(asc(testimonials.displayOrder));
  } catch (error) {
    console.error("[Database] Error fetching testimonials:", error);
    return [];
  }
}

export async function getFaqs() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(faqs)
      .where(eq(faqs.isActive, true))
      .orderBy(asc(faqs.displayOrder));
  } catch (error) {
    console.error("[Database] Error fetching FAQs:", error);
    return [];
  }
}

export async function getBlogPosts(limit?: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    let query = db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true))
      .orderBy(desc(blogPosts.publishedAt), asc(blogPosts.displayOrder));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return await query;
  } catch (error) {
    console.error("[Database] Error fetching blog posts:", error);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error fetching blog post by slug:", error);
    return null;
  }
}


// ============ Student-Tutor Messaging ============

/**
 * Get all students (from subscriptions) with their assigned tutors.
 * A tutor is shown for a student ONLY if they are the preferredTutorId
 * on that student's subscription. No course-tutor fallback.
 */
export async function getStudentsWithTutors(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Single query: subscriptions → course → preferredTutor → existing conversation
    // Only rows with a preferredTutorId will have tutor data (LEFT JOIN handles nulls)
    const [rows, unreadMap] = await Promise.all([
      db
        .select({
          subId: subscriptions.id,
          studentFirstName: subscriptions.studentFirstName,
          studentLastName: subscriptions.studentLastName,
          studentGrade: subscriptions.studentGrade,
          courseTitle: courses.title,
          preferredTutorId: subscriptions.preferredTutorId,
          tutorName: users.name,
          tutorEmail: users.email,
          conversationId: conversations.id,
          lastMessageAt: conversations.lastMessageAt,
        })
        .from(subscriptions)
        .leftJoin(courses, eq(subscriptions.courseId, courses.id))
        .leftJoin(users, eq(subscriptions.preferredTutorId, users.id))
        .leftJoin(
          conversations,
          and(
            eq(conversations.parentId, parentId),
            eq(conversations.studentId, subscriptions.id),
            eq(conversations.tutorId, subscriptions.preferredTutorId as any),
          )
        )
        .where(and(eq(subscriptions.parentId, parentId), eq(subscriptions.status, 'active' as any)))
        .orderBy(subscriptions.studentFirstName, subscriptions.id),
      getUnreadCountsByConversation(parentId),
    ]);

    // Group rows by student name
    const studentMap = new Map<string, any>();

    for (const row of rows) {
      if (!row.studentFirstName || !row.studentLastName) continue;

      const studentKey = `${row.studentFirstName.trim().toLowerCase()}_${row.studentLastName.trim().toLowerCase()}`;
      if (!studentMap.has(studentKey)) {
        studentMap.set(studentKey, {
          id: row.subId,
          firstName: row.studentFirstName,
          lastName: row.studentLastName,
          grade: row.studentGrade,
          courseTitles: new Set<string>(),
          tutors: [],
        });
      }

      const student = studentMap.get(studentKey);
      if (row.courseTitle) student.courseTitles.add(row.courseTitle);

      // Only add tutor if this subscription has a preferredTutorId
      if (!row.preferredTutorId || !row.tutorName) continue;

      // Each subscription gets its own tutor entry (even if same tutor teaches multiple courses)
      // This ensures each course/subscription has its own conversation
      const existingTutor = student.tutors.find((t: any) =>
        t.id === row.preferredTutorId && t.studentId === row.subId
      );

      if (existingTutor) {
        // Same tutor AND same subscription - just update conversation if needed
        if (!existingTutor.conversationId && row.conversationId) {
          existingTutor.conversationId = row.conversationId;
          existingTutor.lastMessageAt = row.lastMessageAt;
          existingTutor.unreadCount = unreadMap.get(Number(row.conversationId)) ?? 0;
        }
      } else {
        // New tutor entry for this subscription
        student.tutors.push({
          id: row.preferredTutorId,
          name: row.tutorName,
          email: row.tutorEmail,
          courseTitles: row.courseTitle ? [row.courseTitle] : [],
          courseTitle: row.courseTitle,
          conversationId: row.conversationId ?? null,
          lastMessageAt: row.lastMessageAt ?? null,
          studentId: row.subId,
          unreadCount: row.conversationId ? (unreadMap.get(Number(row.conversationId)) ?? 0) : 0,
        });
      }
    }

    return Array.from(studentMap.values()).map((s: any) => ({
      ...s,
      courseTitles: Array.from(s.courseTitles),
    }));
  } catch (error) {
    console.error("[Database] Error getting students with tutors:", error);
    return [];
  }
}

/**
 * Get conversation between parent and tutor for a specific student
 */
export async function getConversationByStudentAndTutor(
  parentId: number,
  tutorId: number,
  studentId: number
) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.parentId, parentId),
          eq(conversations.tutorId, tutorId),
          eq(conversations.studentId, studentId)
        )
      )
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting conversation by student and tutor:", error);
    return null;
  }
}

/**
 * Create or get conversation for a specific student
 */
export async function createOrGetStudentConversation(
  parentId: number,
  tutorId: number,
  studentId: number
) {
  const existing = await getConversationByStudentAndTutor(parentId, tutorId, studentId);
  if (existing) return existing;

  const newConv: InsertConversation = {
    parentId,
    tutorId,
    studentId,
    lastMessageAt: Date.now(),
  };

  try {
    const createdId = await createConversation(newConv);
    if (!createdId) {
      console.error("[Database] createConversation returned null/0 for", { parentId, tutorId, studentId });
      // May have been created by a race condition — try fetching again
      return await getConversationByStudentAndTutor(parentId, tutorId, studentId);
    }
    return await getConversationById(createdId);
  } catch (error) {
    console.error("[Database] Failed to create conversation, retrying fetch:", error);
    // If creation failed due to a race/constraint, attempt to fetch again
    return await getConversationByStudentAndTutor(parentId, tutorId, studentId);
  }
}


// ============ Tutor Availability ============

/**
 * Get all availability slots for a tutor
 */
export async function getTutorAvailability(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(tutorAvailability)
      .where(eq(tutorAvailability.tutorId, tutorId))
      .orderBy(asc(tutorAvailability.dayOfWeek), asc(tutorAvailability.startTime));
  } catch (error) {
    console.error("[Database] Error fetching tutor availability:", error);
    return [];
  }
}

/**
 * Get the primary tutor link for a course
 */
export async function getPrimaryTutorForCourse(courseId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(courseTutors)
    .where(and(eq(courseTutors.courseId, courseId), eq(courseTutors.isPrimary, true)))
    .limit(1);

  return result.length ? result[0] : null;
}

/**
 * Get tutor sessions in a time window (ms)
 */
export async function getTutorSessionsWithin(tutorId: number, from: number, to: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: sessions.id,
      scheduledAt: sessions.scheduledAt,
      duration: sessions.duration,
      status: sessions.status,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        gte(sessions.scheduledAt, from),
        lte(sessions.scheduledAt, to),
        eq(sessions.status, 'scheduled' as any)
      )
    );
}

/**
 * Create a new availability slot for a tutor
 */
export async function createTutorAvailability(availability: InsertTutorAvailability) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(tutorAvailability).values(availability);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(tutorAvailability)
      .where(eq(tutorAvailability.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating tutor availability:", error);
    return null;
  }
}

/**
 * Update an existing availability slot
 */
export async function updateTutorAvailability(
  id: number,
  updates: Partial<InsertTutorAvailability>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    await db
      .update(tutorAvailability)
      .set(updates)
      .where(eq(tutorAvailability.id, id));
    
    const updated = await db
      .select()
      .from(tutorAvailability)
      .where(eq(tutorAvailability.id, id))
      .limit(1);
    
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Error updating tutor availability:", error);
    return null;
  }
}

/**
 * Delete an availability slot
 */
export async function deleteTutorAvailability(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error deleting tutor availability:", error);
    return false;
  }
}

/**
 * Get all tutors with their availability
 */
export async function getAllTutorsWithAvailability() {
  const db = await getDb();
  if (!db) return [];

  try {
    const tutors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "tutor"));

    const tutorsWithAvailability = await Promise.all(
      tutors.map(async (tutor) => {
        const availability = await getTutorAvailability(tutor.id);
        return {
          ...tutor,
          availability,
        };
      })
    );

    return tutorsWithAvailability;
  } catch (error) {
    console.error("[Database] Error fetching tutors with availability:", error);
    return [];
  }
}

/**
 * Update course Acuity mapping
 */
export async function updateCourseAcuityMapping(
  courseId: number,
  acuityAppointmentTypeId: number | null,
  acuityCalendarId: number | null
) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(courses)
      .set({
        acuityAppointmentTypeId,
        acuityCalendarId,
      })
      .where(eq(courses.id, courseId));
    return true;
  } catch (error) {
    console.error("[Database] Error updating course Acuity mapping:", error);
    return false;
  }
}

/**
 * Get all Acuity mapping templates
 */
export async function getAllAcuityMappingTemplates() {
  const db = await getDb();
  if (!db) return [];

  try {
    const templates = await db
      .select()
      .from(acuityMappingTemplates)
      .orderBy(desc(acuityMappingTemplates.createdAt));
    return templates;
  } catch (error) {
    console.error("[Database] Error fetching Acuity mapping templates:", error);
    return [];
  }
}

/**
 * Get Acuity mapping template by ID
 */
export async function getAcuityMappingTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [template] = await db
      .select()
      .from(acuityMappingTemplates)
      .where(eq(acuityMappingTemplates.id, id))
      .limit(1);
    return template || null;
  } catch (error) {
    console.error("[Database] Error fetching Acuity mapping template:", error);
    return null;
  }
}

/**
 * Create new Acuity mapping template
 */
export async function createAcuityMappingTemplate(template: InsertAcuityMappingTemplate) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [result] = await db
      .insert(acuityMappingTemplates)
      .values(template);
    return result.insertId;
  } catch (error) {
    console.error("[Database] Error creating Acuity mapping template:", error);
    return null;
  }
}

/**
 * Update Acuity mapping template
 */
export async function updateAcuityMappingTemplate(
  id: number,
  updates: Partial<InsertAcuityMappingTemplate>
) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(acuityMappingTemplates)
      .set(updates)
      .where(eq(acuityMappingTemplates.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error updating Acuity mapping template:", error);
    return false;
  }
}

/**
 * Delete Acuity mapping template
 */
export async function deleteAcuityMappingTemplate(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .delete(acuityMappingTemplates)
      .where(eq(acuityMappingTemplates.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error deleting Acuity mapping template:", error);
    return false;
  }
}

/**
 * Bulk apply Acuity mapping to multiple courses
 */
export async function bulkApplyAcuityMapping(
  courseIds: number[],
  acuityAppointmentTypeId: number,
  acuityCalendarId: number
) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(courses)
      .set({
        acuityAppointmentTypeId,
        acuityCalendarId,
      })
      .where(inArray(courses.id, courseIds));
    return true;
  } catch (error) {
    console.error("[Database] Error bulk applying Acuity mapping:", error);
    return false;
  }
}

/**
 * Get Acuity mapping template by name
 */
export async function getMappingTemplateByName(name: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(acuityMappingTemplates)
      .where(eq(acuityMappingTemplates.name, name))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting mapping template by name:", error);
    return null;
  }
}

// ============ Email Settings ============

/**
 * Get current email settings (returns first row or default values)
 */
export async function getEmailSettings() {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(emailSettings).limit(1);
  
  if (settings.length === 0) {
    // Return default settings if none exist
    return {
      id: 0,
      logoUrl: null,
      primaryColor: "#667eea",
      accentColor: "#764ba2",
      footerText: "EdKonnect Academy - Connecting Students with Expert Tutors",
      companyName: "EdKonnect Academy",
      supportEmail: "support@edkonnect.com",
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  return settings[0];
}

/**
 * Update or create email settings
 */
export async function updateEmailSettings(data: {
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  footerText?: string;
  companyName?: string;
  supportEmail?: string;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db.select().from(emailSettings).limit(1);
  
  if (existing.length === 0) {
    // Create new settings
    const result = await db.insert(emailSettings).values(data as InsertEmailSettings);
    return result[0].insertId;
  } else {
    // Update existing settings
    await db.update(emailSettings)
      .set(data)
      .where(eq(emailSettings.id, existing[0].id));
    return existing[0].id;
  }
}

// ============ Booking Management ============

/**
 * Get session by management token
 */
export async function getSessionByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.managementToken, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Update session management token
 */
export async function updateSessionToken(sessionId: number, token: string) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .update(sessions)
      .set({ managementToken: token })
      .where(eq(sessions.id, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session token:", error);
    return false;
  }
}

/**
 * Cancel session by ID
 */
export async function cancelSession(sessionId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .update(sessions)
      .set({ 
        status: "cancelled",
        updatedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to cancel session:", error);
    return false;
  }
}

/**
 * Update session scheduled time (for rescheduling)
 */
export async function rescheduleSession(sessionId: number, newScheduledAt: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .update(sessions)
      .set({ 
        scheduledAt: newScheduledAt,
        updatedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to reschedule session:", error);
    return false;
  }
}

/**
 * Get session with related data (subscription, course, tutor, parent)
 */
export async function getSessionWithDetails(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select({
      session: sessions,
      subscription: subscriptions,
      course: courses,
      tutor: tutorProfiles,
      tutorUser: users,
      parent: users,
    })
    .from(sessions)
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .leftJoin(tutorProfiles, eq(sessions.tutorId, tutorProfiles.userId))
    .leftJoin(users, eq(tutorProfiles.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const row = result[0];
  
  // Get parent user separately
  const parentResult = await db
    .select()
    .from(users)
    .where(eq(users.id, row.session.parentId))
    .limit(1);
  
  return {
    ...row.session,
    subscription: row.subscription,
    course: row.course,
    tutor: row.tutor,
    tutorUser: row.tutorUser,
    parentUser: parentResult[0] || null,
  };
}



// ============ Tutor Time Blocks ============

/**
 * Get all time blocks for a tutor
 */
export async function getTutorTimeBlocks(tutorId: number, startTime?: number, endTime?: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Build conditions
    const conditions = [eq(tutorTimeBlocks.tutorId, tutorId)];
    
    // Add time range filter if provided
    if (startTime !== undefined && endTime !== undefined) {
      conditions.push(
        gte(tutorTimeBlocks.endTime, startTime),
        lte(tutorTimeBlocks.startTime, endTime)
      );
    }
    
    return await db
      .select()
      .from(tutorTimeBlocks)
      .where(and(...conditions))
      .orderBy(asc(tutorTimeBlocks.startTime));
  } catch (error) {
    console.error("[Database] Failed to get tutor time blocks:", error);
    return [];
  }
}

/**
 * Create time block for a tutor
 */
export async function createTutorTimeBlock(data: InsertTutorTimeBlock) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(tutorTimeBlocks).values(data);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(tutorTimeBlocks)
      .where(eq(tutorTimeBlocks.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create tutor time block:", error);
    return null;
  }
}

/**
 * Update time block
 */
export async function updateTutorTimeBlock(id: number, data: Partial<InsertTutorTimeBlock>) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db
      .update(tutorTimeBlocks)
      .set(data)
      .where(eq(tutorTimeBlocks.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update tutor time block:", error);
    return false;
  }
}

/**
 * Delete time block
 */
export async function deleteTutorTimeBlock(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db
      .delete(tutorTimeBlocks)
      .where(eq(tutorTimeBlocks.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete tutor time block:", error);
    return false;
  }
}

/**
 * Check if a tutor is available at a specific time
 */
export async function isTutorAvailable(tutorId: number, startTime: number, endTime: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Check if there are any time blocks that overlap with the requested time
  const blocks = await db
    .select()
    .from(tutorTimeBlocks)
    .where(
      and(
        eq(tutorTimeBlocks.tutorId, tutorId),
        // Check for overlap: block.start < requested.end AND block.end > requested.start
        lt(tutorTimeBlocks.startTime, endTime),
        gt(tutorTimeBlocks.endTime, startTime)
      )
    )
    .limit(1);
  
  // If there are overlapping blocks, tutor is not available
  if (blocks.length > 0) {
    return false;
  }
  
  // Check if the requested time falls within tutor's regular availability
  const requestedDate = new Date(startTime);
  const dayOfWeek = requestedDate.getDay();
  const requestedStartTime = `${requestedDate.getHours().toString().padStart(2, '0')}:${requestedDate.getMinutes().toString().padStart(2, '0')}`;
  const requestedEndDate = new Date(endTime);
  const requestedEndTime = `${requestedEndDate.getHours().toString().padStart(2, '0')}:${requestedEndDate.getMinutes().toString().padStart(2, '0')}`;
  
  const availabilitySlots = await db
    .select()
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutorId),
        eq(tutorAvailability.dayOfWeek, dayOfWeek),
        eq(tutorAvailability.isActive, true),
        lte(tutorAvailability.startTime, requestedStartTime),
        gte(tutorAvailability.endTime, requestedEndTime)
      )
    )
    .limit(1);
  
  // Tutor is available if there's at least one matching availability slot
  return availabilitySlots.length > 0;
}


// ============ Session Notes ============

/**
 * Create a new session note
 */
export async function createSessionNote(note: InsertSessionNote) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(sessionNotes).values(note);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(sessionNotes)
      .where(eq(sessionNotes.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating session note:", error);
    return null;
  }
}

/**
 * Get session note by ID
 */
export async function getSessionNoteById(id: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(sessionNotes)
      .where(eq(sessionNotes.id, id))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting session note:", error);
    return null;
  }
}

/**
 * Get session note by session ID
 */
export async function getSessionNoteBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(sessionNotes)
      .where(eq(sessionNotes.sessionId, sessionId))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting session note by session ID:", error);
    return null;
  }
}

/**
 * Get all session notes for a tutor
 */
export async function getSessionNotesByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const parentUsers = alias(users, "parentUser");
    return await db
      .select({
        id: sessionNotes.id,
        sessionId: sessionNotes.sessionId,
        tutorId: sessionNotes.tutorId,
        tutorName: users.name,
        progressSummary: sessionNotes.progressSummary,
        homework: sessionNotes.homework,
        challenges: sessionNotes.challenges,
        nextSteps: sessionNotes.nextSteps,
        createdAt: sessionNotes.createdAt,
        scheduledAt: sessions.scheduledAt,
        courseTitle: courses.title,
        courseSubject: courses.subject,
        studentFirstName: subscriptions.studentFirstName,
        studentLastName: subscriptions.studentLastName,
        parentName: parentUsers.name,
      })
      .from(sessionNotes)
      .innerJoin(sessions, eq(sessionNotes.sessionId, sessions.id))
      .innerJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
      .leftJoin(courses, eq(subscriptions.courseId, courses.id))
      .leftJoin(users, eq(sessionNotes.tutorId, users.id))
      .leftJoin(parentUsers, eq(sessions.parentId, parentUsers.id))
      .where(eq(sessionNotes.tutorId, tutorId))
      .orderBy(desc(sessionNotes.createdAt));
  } catch (error) {
    console.error("[Database] Error getting tutor session notes:", error);
    return [];
  }
}

/**
 * Get all session notes for a parent
 */
export async function getSessionNotesByParentId(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(sessionNotes)
      .where(eq(sessionNotes.parentId, parentId))
      .orderBy(desc(sessionNotes.createdAt));
    
    return result;
  } catch (error) {
    console.error("[Database] Error getting parent session notes:", error);
    return [];
  }
}

/**
 * Update a session note
 */
export async function updateSessionNote(id: number, updates: Partial<InsertSessionNote>) {
  const db = await getDb();
  if (!db) return null;

  try {
    await db
      .update(sessionNotes)
      .set(updates)
      .where(eq(sessionNotes.id, id));
    
    return await getSessionNoteById(id);
  } catch (error) {
    console.error("[Database] Error updating session note:", error);
    return null;
  }
}

/**
 * Delete a session note
 */
export async function deleteSessionNote(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .delete(sessionNotes)
      .where(eq(sessionNotes.id, id));
    
    return true;
  } catch (error) {
    console.error("[Database] Error deleting session note:", error);
    return false;
  }
}

/**
 * Mark session note as parent notified
 */
export async function markSessionNoteAsNotified(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(sessionNotes)
      .set({ parentNotified: true })
      .where(eq(sessionNotes.id, id));
    
    return true;
  } catch (error) {
    console.error("[Database] Error marking session note as notified:", error);
    return false;
  }
}


// ============ Session Note Attachments ============

/**
 * Create a new session note attachment
 */
export async function createSessionNoteAttachment(attachment: InsertSessionNoteAttachment) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(sessionNoteAttachments).values(attachment);
    const insertedId = result[0].insertId;
    
    const inserted = await db
      .select()
      .from(sessionNoteAttachments)
      .where(eq(sessionNoteAttachments.id, insertedId))
      .limit(1);
    
    return inserted[0] || null;
  } catch (error) {
    console.error("[Database] Error creating session note attachment:", error);
    return null;
  }
}

/**
 * Get all attachments for a session note
 */
export async function getSessionNoteAttachments(sessionNoteId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(sessionNoteAttachments)
      .where(eq(sessionNoteAttachments.sessionNoteId, sessionNoteId))
      .orderBy(asc(sessionNoteAttachments.createdAt));
    
    return result;
  } catch (error) {
    console.error("[Database] Error getting session note attachments:", error);
    return [];
  }
}

/**
 * Get attachment by ID
 */
export async function getSessionNoteAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(sessionNoteAttachments)
      .where(eq(sessionNoteAttachments.id, id))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting session note attachment:", error);
    return null;
  }
}

/**
 * Delete a session note attachment
 */
export async function deleteSessionNoteAttachment(id: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .delete(sessionNoteAttachments)
      .where(eq(sessionNoteAttachments.id, id));
    
    return true;
  } catch (error) {
    console.error("[Database] Error deleting session note attachment:", error);
    return false;
  }
}

// ============ Tutor Reviews Management ============

export async function createTutorReview(review: InsertTutorReview) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(tutorReviews).values(review) as any;
    const reviewId = Number(result[0].insertId);

    // Update tutor profile rating and review count
    await updateTutorRatingStats(review.tutorId);

    return reviewId;
  } catch (error) {
    console.error("[Database] Failed to create tutor review:", error);
    return null;
  }
}

export async function getTutorReviews(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: tutorReviews.id,
      rating: tutorReviews.rating,
      review: tutorReviews.review,
      createdAt: tutorReviews.createdAt,
      parentName: users.name,
    })
    .from(tutorReviews)
    .innerJoin(users, eq(tutorReviews.parentId, users.id))
    .where(eq(tutorReviews.tutorId, tutorId))
    .orderBy(desc(tutorReviews.createdAt));
}

export async function getTutorAverageRating(tutorId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      avgRating: sql<number>`AVG(${tutorReviews.rating})`,
    })
    .from(tutorReviews)
    .where(eq(tutorReviews.tutorId, tutorId));

  return result[0]?.avgRating ? Number(result[0].avgRating.toFixed(2)) : 0;
}

export async function updateTutorRatingStats(tutorId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    const reviews = await db
      .select()
      .from(tutorReviews)
      .where(eq(tutorReviews.tutorId, tutorId));

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    await db
      .update(tutorProfiles)
      .set({
        rating: avgRating.toFixed(2),
        totalReviews,
      })
      .where(eq(tutorProfiles.userId, tutorId));

    return true;
  } catch (error) {
    console.error("[Database] Failed to update tutor rating stats:", error);
    return false;
  }
}

// ============ Tutor Filtering & Search ============

export interface TutorFilterOptions {
  subjects?: string[];
  gradeLevels?: string[];
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export async function searchTutors(filters: TutorFilterOptions) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Start with base query for active tutors
    let query = db
      .select({
        id: tutorProfiles.id,
        userId: tutorProfiles.userId,
        bio: tutorProfiles.bio,
        qualifications: tutorProfiles.qualifications,
        subjects: tutorProfiles.subjects,
        gradeLevels: tutorProfiles.gradeLevels,
        hourlyRate: tutorProfiles.hourlyRate,
        yearsOfExperience: tutorProfiles.yearsOfExperience,
        profileImageUrl: tutorProfiles.profileImageUrl,
        acuityLink: tutorProfiles.acuityLink,
        rating: tutorProfiles.rating,
        totalReviews: tutorProfiles.totalReviews,
        userName: users.name,
        userEmail: users.email,
      })
      .from(tutorProfiles)
      .innerJoin(users, eq(tutorProfiles.userId, users.id))
      .where(
        and(
          eq(tutorProfiles.isActive, true),
          eq(tutorProfiles.approvalStatus, 'approved')
        )
      );

    let results = await query;

    // Apply subject filter (subjects are stored as JSON array in text field)
    if (filters.subjects && filters.subjects.length > 0) {
      results = results.filter(tutor => {
        if (!tutor.subjects) return false;
        try {
          const tutorSubjects = JSON.parse(tutor.subjects as string);
          return filters.subjects!.some(subject =>
            tutorSubjects.includes(subject)
          );
        } catch {
          return false;
        }
      });
    }

    // Apply grade level filter (gradeLevels are stored as JSON array in text field)
    if (filters.gradeLevels && filters.gradeLevels.length > 0) {
      results = results.filter(tutor => {
        if (!tutor.gradeLevels) return false;
        try {
          const tutorGradeLevels = JSON.parse(tutor.gradeLevels as string);
          return filters.gradeLevels!.some(gradeLevel =>
            tutorGradeLevels.includes(gradeLevel)
          );
        } catch {
          return false;
        }
      });
    }

    // Apply hourly rate filter
    if (filters.minRate !== undefined) {
      results = results.filter(tutor => {
        const rate = tutor.hourlyRate ? parseFloat(tutor.hourlyRate as string) : 0;
        return rate >= filters.minRate!;
      });
    }

    if (filters.maxRate !== undefined) {
      results = results.filter(tutor => {
        const rate = tutor.hourlyRate ? parseFloat(tutor.hourlyRate as string) : 0;
        return rate <= filters.maxRate!;
      });
    }

    // Apply rating filter
    if (filters.minRating) {
      results = results.filter(tutor => {
        const rating = tutor.rating ? parseFloat(tutor.rating as string) : 0;
        return rating >= filters.minRating!;
      });
    }

    // Apply availability filter
    if (filters.dayOfWeek !== undefined && filters.startTime && filters.endTime) {
      const availableTutorIds = await getTutorsAvailableAt(
        filters.dayOfWeek,
        filters.startTime,
        filters.endTime
      );

      results = results.filter(tutor =>
        availableTutorIds.includes(tutor.userId)
      );
    }

    return results;
  } catch (error) {
    console.error("[Database] Failed to search tutors:", error);
    return [];
  }
}

async function getTutorsAvailableAt(
  dayOfWeek: number,
  startTime: string,
  endTime: string
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const availableSlots = await db
      .select({ tutorId: tutorAvailability.tutorId })
      .from(tutorAvailability)
      .where(
        and(
          eq(tutorAvailability.dayOfWeek, dayOfWeek),
          lte(tutorAvailability.startTime, startTime),
          gte(tutorAvailability.endTime, endTime)
        )
      );

    return availableSlots.map(slot => slot.tutorId);
  } catch (error) {
    console.error("[Database] Failed to get available tutors:", error);
    return [];
  }
}


// ============ Tutor Recommendations ============

// Get similar tutors based on subject overlap and ratings
export async function getSimilarTutors(tutorId: number, limit: number = 2) {
  const db = await getDb();
  if (!db) return [];

  try {
    const tutor = await db
      .select()
      .from(tutorProfiles)
      .where(eq(tutorProfiles.userId, tutorId))
      .limit(1);

    if (tutor.length === 0) return [];

    const currentTutor = tutor[0];
    const currentSubjects = currentTutor.subjects ? JSON.parse(currentTutor.subjects) : [];

    // Get all other active tutors with video introductions
    const allTutors = await db
      .select({
        id: tutorProfiles.id,
        userId: tutorProfiles.userId,
        userName: users.name,
        bio: tutorProfiles.bio,
        subjects: tutorProfiles.subjects,
        gradeLevels: tutorProfiles.gradeLevels,
        hourlyRate: tutorProfiles.hourlyRate,
        rating: tutorProfiles.rating,
        totalReviews: tutorProfiles.totalReviews,
        introVideoUrl: tutorProfiles.introVideoUrl,
      })
      .from(tutorProfiles)
      .innerJoin(users, eq(tutorProfiles.userId, users.id))
      .where(and(
        eq(tutorProfiles.isActive, true),
        sql`${tutorProfiles.userId} != ${tutorId}`
      ));

    // Calculate similarity score for each tutor
    const tutorsWithScore = allTutors.map(t => {
      const tutorSubjects = t.subjects ? JSON.parse(t.subjects) : [];
      const subjectOverlap = currentSubjects.filter((s: string) => tutorSubjects.includes(s)).length;
      const rating = t.rating ? parseFloat(t.rating) : 0;
      
      // Score: subject overlap is weighted higher, then rating
      // Boost score if tutor has video
      const videoBoost = t.introVideoUrl ? 2 : 0;
      const score = (subjectOverlap * 10) + rating + videoBoost;
      
      return { ...t, score, subjectOverlap };
    });

    // Sort by score descending and return top N
    return tutorsWithScore
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("[Database] Failed to get similar tutors:", error);
    return [];
  }
}


// ============ Parent Dashboard ============

// Get parent's upcoming sessions
export async function getParentUpcomingSessions(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const now = Date.now();
    
    return await db
      .select({
        id: sessions.id,
        tutorId: sessions.tutorId,
        tutorName: users.name,
        parentId: sessions.parentId,
        scheduledAt: sessions.scheduledAt,
        duration: sessions.duration,
        status: sessions.status,
        acuityAppointmentId: sessions.acuityAppointmentId,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.tutorId, users.id))
      .where(and(
        eq(sessions.parentId, parentId),
        gte(sessions.scheduledAt, now)
      ))
      .orderBy(asc(sessions.scheduledAt));
  } catch (error) {
    console.error("[Database] Failed to get parent upcoming sessions:", error);
    return [];
  }
}

// Get parent's past sessions
export async function getParentPastSessions(parentId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  try {
    const now = Date.now();
    
    return await db
      .select({
        id: sessions.id,
        tutorId: sessions.tutorId,
        tutorName: users.name,
        parentId: sessions.parentId,
        scheduledAt: sessions.scheduledAt,
        duration: sessions.duration,
        status: sessions.status,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.tutorId, users.id))
      .where(and(
        eq(sessions.parentId, parentId),
        lt(sessions.scheduledAt, now)
      ))
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get parent past sessions:", error);
    return [];
  }
}

// Get parent's session notes
export async function getParentSessionNotes(parentId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select({
        id: sessions.id,
        sessionId: sessions.id,
        subscriptionId: sessions.subscriptionId,
        tutorId: sessions.tutorId,
        tutorName: users.name,
        progressSummary: sessions.feedbackFromTutor,
        homework: sql<string | null>`NULL`,
        challenges: sql<string | null>`NULL`,
        nextSteps: sql<string | null>`NULL`,
        createdAt: sessions.updatedAt,
        scheduledAt: sessions.scheduledAt,
        studentFirstName: subscriptions.studentFirstName,
        studentLastName: subscriptions.studentLastName,
        courseSubject: courses.subject,
        courseTitle: courses.title,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.tutorId, users.id))
      .innerJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
      .leftJoin(courses, eq(subscriptions.courseId, courses.id))
      .where(and(eq(sessions.parentId, parentId), isNotNull(sessions.feedbackFromTutor)))
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get parent session notes:", error);
    return [];
  }
}

// Get parent's payment history
export async function getParentPayments(parentId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const sessionSubscriptions = alias(subscriptions, "sessionSubscriptions");
    const paymentSubscriptions = alias(subscriptions, "paymentSubscriptions");
    const sessionCourses = alias(courses, "sessionCourses");
    const paymentCourses = alias(courses, "paymentCourses");

    return await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        stripePaymentIntentId: payments.stripePaymentIntentId,
        createdAt: payments.createdAt,
        sessionId: payments.sessionId,
        tutorName: users.name,
        scheduledAt: sessions.scheduledAt,
        courseTitle: sql<string | null>`COALESCE(${paymentCourses.title}, ${sessionCourses.title})`,
        studentFirstName: sql<string | null>`COALESCE(${paymentSubscriptions.studentFirstName}, ${sessionSubscriptions.studentFirstName})`,
        studentLastName: sql<string | null>`COALESCE(${paymentSubscriptions.studentLastName}, ${sessionSubscriptions.studentLastName})`,
        paymentMethodType: sql<"card" | "ach">`'card'`,
        paymentMethodLast4: sql<string | null>`NULL`,
      })
      .from(payments)
      .leftJoin(sessions, eq(payments.sessionId, sessions.id))
      .leftJoin(paymentSubscriptions, eq(payments.subscriptionId, paymentSubscriptions.id))
      .leftJoin(paymentCourses, eq(paymentSubscriptions.courseId, paymentCourses.id))
      .leftJoin(sessionSubscriptions, eq(sessions.subscriptionId, sessionSubscriptions.id))
      .leftJoin(sessionCourses, eq(sessionSubscriptions.courseId, sessionCourses.id))
      .leftJoin(users, eq(sessions.tutorId, users.id))
      .where(eq(payments.parentId, parentId))
      .orderBy(desc(payments.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get parent payments:", error);
    return [];
  }
}

// Get parent dashboard statistics
export async function getParentDashboardStats(parentId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get total sessions
    const totalSessionsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(eq(sessions.parentId, parentId));
    
    const totalSessions = totalSessionsResult[0]?.count || 0;

    // Get total spending
    const totalSpendingResult = await db
      .select({ total: sql<string>`sum(${payments.amount})` })
      .from(payments)
      .where(and(
        eq(payments.parentId, parentId),
        sql`${payments.status} = 'succeeded'`
      ));
    
    const totalSpending = totalSpendingResult[0]?.total || '0';

    // Get active tutors count (tutors with sessions)
    const activeTutorsResult = await db
      .select({ count: sql<number>`count(distinct ${sessions.tutorId})` })
      .from(sessions)
      .where(eq(sessions.parentId, parentId));
    
    const activeTutors = activeTutorsResult[0]?.count || 0;

    // Get upcoming sessions count
    const now = Date.now();
    const upcomingSessionsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(and(
        eq(sessions.parentId, parentId),
        gte(sessions.scheduledAt, now)
      ));
    
    const upcomingSessions = upcomingSessionsResult[0]?.count || 0;

    return {
      totalSessions,
      totalSpending: parseFloat(totalSpending),
      activeTutors,
      upcomingSessions,
    };
  } catch (error) {
    console.error("[Database] Failed to get parent dashboard stats:", error);
    return null;
  }
}

// ============ Notification Management ============

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function upsertNotificationPreferences(userId: number, prefs: Partial<InsertNotificationPreference>) {
  const db = await getDb();
  if (!db) return false;

  try {
    const existing = await getNotificationPreferences(userId);
    
    if (existing) {
      await db
        .update(notificationPreferences)
        .set(prefs)
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({
        userId,
        ...prefs,
      } as InsertNotificationPreference);
    }
    
    return true;
  } catch (error) {
    console.error("[Database] Failed to upsert notification preferences:", error);
    return false;
  }
}

export async function createNotificationLog(log: InsertNotificationLog) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(notificationLogs).values(log) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create notification log:", error);
    return null;
  }
}

export async function getNotificationLogs(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.userId, userId))
    .orderBy(desc(notificationLogs.sentAt))
    .limit(limit);
}

export async function createInAppNotification(notification: InsertInAppNotification) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(inAppNotifications).values(notification) as any;
    return Number(result.insertId);
  } catch (error) {
    console.error("[Database] Failed to create in-app notification:", error);
    return null;
  }
}

export async function getInAppNotifications(userId: number, includeRead: boolean = false) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(inAppNotifications.userId, userId)];
  
  if (!includeRead) {
    conditions.push(eq(inAppNotifications.isRead, false));
  }

  return await db
    .select()
    .from(inAppNotifications)
    .where(and(...conditions))
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(50);
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(inAppNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(inAppNotifications.id, notificationId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark notification as read:", error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(inAppNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.isRead, false)
      ));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark all notifications as read:", error);
    return false;
  }
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(inAppNotifications)
    .where(and(
      eq(inAppNotifications.userId, userId),
      eq(inAppNotifications.isRead, false)
    ));

  return result[0]?.count || 0;
}

export async function getUpcomingSessionsForNotifications(timingMinutes: number) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  const targetTime = now + (timingMinutes * 60 * 1000);
  const windowStart = targetTime - (5 * 60 * 1000); // 5 minute window
  const windowEnd = targetTime + (5 * 60 * 1000);

  return await db
    .select({
      session: sessions,
      parent: users,
      tutor: { id: users.id, name: users.name, email: users.email },
      course: courses,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.parentId, users.id))
    .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
    .leftJoin(courses, eq(subscriptions.courseId, courses.id))
    .where(and(
      eq(sessions.status, "scheduled"),
      gte(sessions.scheduledAt, windowStart),
      lte(sessions.scheduledAt, windowEnd)
    ));
}


// ============ Additional Course Management Functions ============

export async function deleteCourse(courseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(courses).where(eq(courses.id, courseId));
  return true;
}

export async function getAllCoursesWithTutors(filters?: {
  search?: string;
  subject?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allCourses = await db.select().from(courses);
  let filteredCourses = allCourses;

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    filteredCourses = filteredCourses.filter(
      (c: any) =>
        c.title.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
    );
  }

  if (filters?.subject) {
    filteredCourses = filteredCourses.filter((c: any) => c.subject === filters.subject);
  }

  if (filters?.isActive !== undefined) {
    filteredCourses = filteredCourses.filter((c: any) => c.isActive === filters.isActive);
  }

  // Get assigned tutors for each course
  const coursesWithTutors = await Promise.all(
    filteredCourses.map(async (course: any) => {
      const assignments = await db
        .select({
          tutorId: courseTutors.tutorId,
          tutorName: users.name,
          tutorEmail: users.email,
          isPrimary: courseTutors.isPrimary,
        })
        .from(courseTutors)
        .leftJoin(users, eq(courseTutors.tutorId, users.id))
        .where(eq(courseTutors.courseId, course.id));

      return {
        ...course,
        assignedTutors: assignments,
      };
    })
  );

  return coursesWithTutors;
}

export async function getCourseAssignments(courseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const assignments = await db
    .select({
      tutorId: courseTutors.tutorId,
      tutorName: users.name,
      tutorEmail: users.email,
      isPrimary: courseTutors.isPrimary,
      createdAt: courseTutors.createdAt,
    })
    .from(courseTutors)
    .leftJoin(users, eq(courseTutors.tutorId, users.id))
    .where(eq(courseTutors.courseId, courseId));

  return assignments;
}

export async function getAllTutorsForAssignment() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tutors = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.role, "tutor"));

  return tutors;
}

// Tutor Registration & Approval Functions
export async function getPendingTutors() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pendingTutors = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      name: users.name,
      email: users.email,
      bio: tutorProfiles.bio,
      qualifications: tutorProfiles.qualifications,
      yearsOfExperience: tutorProfiles.yearsOfExperience,
      hourlyRate: tutorProfiles.hourlyRate,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      createdAt: tutorProfiles.createdAt,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(tutorProfiles.userId, users.id))
    .where(eq(tutorProfiles.approvalStatus, "pending"));

  return pendingTutors;
}

export async function getApprovedTutors() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const approvedTutors = await db
    .select({
      id: tutorProfiles.id,
      userId: tutorProfiles.userId,
      name: users.name,
      email: users.email,
      bio: tutorProfiles.bio,
      hourlyRate: tutorProfiles.hourlyRate,
      subjects: tutorProfiles.subjects,
      gradeLevels: tutorProfiles.gradeLevels,
      approvedAt: tutorProfiles.updatedAt,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(tutorProfiles.userId, users.id))
    .where(eq(tutorProfiles.approvalStatus, "approved"));

  return approvedTutors;
}

export async function approveTutor(profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(tutorProfiles)
    .set({
      approvalStatus: "approved",
      updatedAt: new Date(),
    })
    .where(eq(tutorProfiles.id, profileId));

  return { success: true };
}

export async function rejectTutor(profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(tutorProfiles)
    .set({
      approvalStatus: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(tutorProfiles.id, profileId));

  return { success: true };
}

// ============ Tutor Dashboard Functions ============

export async function getUpcomingSessionsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now(); // Current timestamp in milliseconds
  
  try {
    const results = await db
      .select({
        id: sessions.id,
        parentId: sessions.parentId,
        tutorId: sessions.tutorId,
        subscriptionId: sessions.subscriptionId,
        scheduledAt: sessions.scheduledAt,
        duration: sessions.duration,
        status: sessions.status,
        notes: sessions.notes,
        parentName: users.name,
        parentEmail: users.email,
        courseTitle: courses.title,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.parentId, users.id))
      .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
      .leftJoin(courses, eq(subscriptions.courseId, courses.id))
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          gte(sessions.scheduledAt, now),
          eq(sessions.status, 'scheduled')
        )
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(50);

    return results;
  } catch (error) {
    console.error("[Database] Failed to fetch upcoming sessions:", error);
    return [];
  }
}

export async function getPastSessionsByTutorId(tutorId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now(); // Current timestamp in milliseconds
  
  try {
    const results = await db
      .select({
        id: sessions.id,
        parentId: sessions.parentId,
        tutorId: sessions.tutorId,
        subscriptionId: sessions.subscriptionId,
        scheduledAt: sessions.scheduledAt,
        duration: sessions.duration,
        status: sessions.status,
        notes: sessions.notes,
        feedbackFromTutor: sessions.feedbackFromTutor,
        feedbackFromParent: sessions.feedbackFromParent,
        rating: sessions.rating,
        parentName: users.name,
        parentEmail: users.email,
        courseTitle: courses.title,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.parentId, users.id))
      .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))
      .leftJoin(courses, eq(subscriptions.courseId, courses.id))
      .where(
        and(
          eq(sessions.tutorId, tutorId),
          or(
            lt(sessions.scheduledAt, now),
            eq(sessions.status, 'completed'),
            eq(sessions.status, 'cancelled'),
            eq(sessions.status, 'no_show')
          )
        )
      )
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    console.error("[Database] Failed to fetch past sessions:", error);
    return [];
  }
}

// ============ Tutor Payout Requests ============

export async function getCompletedEnrollmentsForTutor(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Find subscriptions where this tutor is assigned, sessions are all completed, and no payout request exists yet
    const existingRequests = db
      .select({ subscriptionId: tutorPayoutRequests.subscriptionId })
      .from(tutorPayoutRequests)
      .where(eq(tutorPayoutRequests.tutorId, tutorId));

    const results = await db
      .select({
        subscriptionId: subscriptions.id,
        parentId: subscriptions.parentId,
        sessionsCompleted: subscriptions.sessionsCompleted,
        studentFirstName: subscriptions.studentFirstName,
        studentLastName: subscriptions.studentLastName,
        courseId: courses.id,
        courseTitle: courses.title,
        courseDuration: courses.duration,
        totalSessions: courses.totalSessions,
        parentName: users.name,
        parentEmail: users.email,
        tutorHourlyRate: tutorProfiles.hourlyRate,
      })
      .from(subscriptions)
      .innerJoin(courses, eq(subscriptions.courseId, courses.id))
      .innerJoin(users, eq(subscriptions.parentId, users.id))
      .leftJoin(tutorProfiles, eq(tutorProfiles.userId, tutorId))
      .where(
        and(
          eq(subscriptions.preferredTutorId, tutorId),
          sql`${subscriptions.sessionsCompleted} >= ${courses.totalSessions}`,
          sql`${subscriptions.id} NOT IN (${existingRequests})`
        )
      );

    return results;
  } catch (error) {
    console.error("[Database] Failed to fetch completed enrollments:", error);
    return [];
  }
}

export async function createTutorPayoutRequest(data: InsertTutorPayoutRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tutorPayoutRequests).values(data);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  return insertId as number;
}

export async function getTutorPayoutRequestsByTutorId(tutorId: number) {
  const db = await getDb();
  if (!db) return [];

  const parentUsers = alias(users, "parentUser");

  try {
    const results = await db
      .select({
        id: tutorPayoutRequests.id,
        subscriptionId: tutorPayoutRequests.subscriptionId,
        sessionsCompleted: tutorPayoutRequests.sessionsCompleted,
        ratePerSession: tutorPayoutRequests.ratePerSession,
        totalAmount: tutorPayoutRequests.totalAmount,
        status: tutorPayoutRequests.status,
        adminNotes: tutorPayoutRequests.adminNotes,
        createdAt: tutorPayoutRequests.createdAt,
        courseTitle: courses.title,
        studentFirstName: subscriptions.studentFirstName,
        studentLastName: subscriptions.studentLastName,
        parentName: parentUsers.name,
      })
      .from(tutorPayoutRequests)
      .innerJoin(subscriptions, eq(tutorPayoutRequests.subscriptionId, subscriptions.id))
      .innerJoin(courses, eq(subscriptions.courseId, courses.id))
      .innerJoin(parentUsers, eq(subscriptions.parentId, parentUsers.id))
      .where(eq(tutorPayoutRequests.tutorId, tutorId))
      .orderBy(desc(tutorPayoutRequests.createdAt));

    return results;
  } catch (error) {
    console.error("[Database] Failed to fetch tutor payout requests:", error);
    return [];
  }
}

export async function getAllTutorPayoutRequests() {
  const db = await getDb();
  if (!db) return [];

  const tutorUsers = alias(users, "tutorUser");
  const parentUsers = alias(users, "parentUser");

  try {
    const results = await db
      .select({
        id: tutorPayoutRequests.id,
        tutorId: tutorPayoutRequests.tutorId,
        subscriptionId: tutorPayoutRequests.subscriptionId,
        sessionsCompleted: tutorPayoutRequests.sessionsCompleted,
        ratePerSession: tutorPayoutRequests.ratePerSession,
        totalAmount: tutorPayoutRequests.totalAmount,
        status: tutorPayoutRequests.status,
        adminNotes: tutorPayoutRequests.adminNotes,
        createdAt: tutorPayoutRequests.createdAt,
        tutorName: tutorUsers.name,
        tutorEmail: tutorUsers.email,
        courseTitle: courses.title,
        studentFirstName: subscriptions.studentFirstName,
        studentLastName: subscriptions.studentLastName,
        parentName: parentUsers.name,
      })
      .from(tutorPayoutRequests)
      .innerJoin(tutorUsers, eq(tutorPayoutRequests.tutorId, tutorUsers.id))
      .innerJoin(subscriptions, eq(tutorPayoutRequests.subscriptionId, subscriptions.id))
      .innerJoin(courses, eq(subscriptions.courseId, courses.id))
      .innerJoin(parentUsers, eq(subscriptions.parentId, parentUsers.id))
      .orderBy(desc(tutorPayoutRequests.createdAt));

    return results;
  } catch (error) {
    console.error("[Database] Failed to fetch all payout requests:", error);
    return [];
  }
}

export async function updateTutorPayoutRequestStatus(
  id: number,
  status: "approved" | "rejected",
  adminNotes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(tutorPayoutRequests)
    .set({ status, adminNotes: adminNotes ?? null, updatedAt: new Date() })
    .where(eq(tutorPayoutRequests.id, id));
}
