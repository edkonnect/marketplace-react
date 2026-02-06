import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, bigint, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extended with role field for parent/tutor/admin access control.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["parent", "tutor", "admin"]).default("parent").notNull(),
  userType: mysqlEnum("userType", ["parent", "tutor", "admin"]).default("parent").notNull(),
  name: text("name"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  openIdIdx: index("users_openId_idx").on(table.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const refreshTokens = mysqlTable("refresh_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("refresh_tokens_userId_idx").on(table.userId),
}));

export type RefreshToken = typeof refreshTokens.$inferSelect;

/**
 * Tutor profiles with professional information
 */
export const tutorProfiles = mysqlTable("tutor_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  qualifications: text("qualifications"),
  subjects: text("subjects"), // JSON array of subjects
  gradeLevels: text("gradeLevels"), // JSON array of grade levels
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  yearsOfExperience: int("yearsOfExperience"),
  availability: text("availability"), // JSON object for weekly availability
  profileImageUrl: text("profileImageUrl"),
  introVideoUrl: text("introVideoUrl"), // URL to intro video in S3
  introVideoKey: varchar("introVideoKey", { length: 512 }), // S3 key for video file
  acuityLink: text("acuityLink"), // Acuity scheduling link for this tutor
  isActive: boolean("isActive").default(true).notNull(),
  approvalStatus: varchar("approvalStatus", { length: 20 }).default("pending").notNull(), // pending, approved, rejected
  rejectionReason: text("rejectionReason"), // Optional reason for rejection
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalReviews: int("totalReviews").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("tutor_profiles_userId_idx").on(table.userId),
}));

export type TutorProfile = typeof tutorProfiles.$inferSelect;
export type InsertTutorProfile = typeof tutorProfiles.$inferInsert;

/**
 * Parent profiles with children information
 */
export const parentProfiles = mysqlTable("parent_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  childrenInfo: text("childrenInfo"), // JSON array of children (name, age, grade)
  preferences: text("preferences"), // JSON object for learning preferences
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("parent_profiles_userId_idx").on(table.userId),
}));

export type ParentProfile = typeof parentProfiles.$inferSelect;
export type InsertParentProfile = typeof parentProfiles.$inferInsert;

/**
 * Courses/tutoring packages created by tutors
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 100 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: int("duration"), // Duration in minutes per session
  sessionsPerWeek: int("sessionsPerWeek").default(1),
  totalSessions: int("totalSessions"), // Total sessions in package
  isActive: boolean("isActive").default(true).notNull(),
  imageUrl: text("imageUrl"),
  curriculum: text("curriculum"),
  acuityAppointmentTypeId: int("acuityAppointmentTypeId"), // Link to Acuity appointment type
  acuityCalendarId: int("acuityCalendarId"), // Link to Acuity calendar
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  subjectIdx: index("courses_subject_idx").on(table.subject),
}));

/**
 * Junction table for many-to-many relationship between courses and tutors
 */
export const courseTutors = mysqlTable("course_tutors", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  isPrimary: boolean("isPrimary").default(false).notNull(), // Designate primary tutor
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  courseIdIdx: index("course_tutors_courseId_idx").on(table.courseId),
  tutorIdIdx: index("course_tutors_tutorId_idx").on(table.tutorId),
  uniqueCombination: index("course_tutors_unique").on(table.courseId, table.tutorId),
}));

export type CourseTutor = typeof courseTutors.$inferSelect;
export type InsertCourseTutor = typeof courseTutors.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Subscriptions linking parents to courses
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  preferredTutorId: int("preferredTutorId").references(() => users.id, { onDelete: "set null" }),
  studentFirstName: varchar("studentFirstName", { length: 100 }),
  studentLastName: varchar("studentLastName", { length: 100 }),
  studentGrade: varchar("studentGrade", { length: 50 }),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "completed"]).default("active").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  sessionsCompleted: int("sessionsCompleted").default(0),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  paymentStatus: mysqlEnum("paymentStatus", ["paid", "pending", "failed"]).default("pending").notNull(),
  paymentPlan: mysqlEnum("paymentPlan", ["full", "installment"]).default("full").notNull(),
  firstInstallmentPaid: boolean("firstInstallmentPaid").default(false).notNull(),
  secondInstallmentPaid: boolean("secondInstallmentPaid").default(false).notNull(),
  firstInstallmentAmount: decimal("firstInstallmentAmount", { precision: 10, scale: 2 }),
  secondInstallmentAmount: decimal("secondInstallmentAmount", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentIdIdx: index("subscriptions_parentId_idx").on(table.parentId),
  courseIdIdx: index("subscriptions_courseId_idx").on(table.courseId),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Tutoring sessions/bookings
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(), // Unix timestamp in milliseconds
  duration: int("duration").notNull(), // Duration in minutes
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  notes: text("notes"),
  feedbackFromTutor: text("feedbackFromTutor"),
  feedbackFromParent: text("feedbackFromParent"),
  rating: int("rating"), // 1-5 rating from parent
  acuityAppointmentId: int("acuityAppointmentId"), // Link to Acuity appointment
  managementToken: varchar("managementToken", { length: 64 }), // Secure token for email-based booking management
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  subscriptionIdIdx: index("sessions_subscriptionId_idx").on(table.subscriptionId),
  tutorIdIdx: index("sessions_tutorId_idx").on(table.tutorId),
  parentIdIdx: index("sessions_parentId_idx").on(table.parentId),
  scheduledAtIdx: index("sessions_scheduledAt_idx").on(table.scheduledAt),
  tutorStartUnique: uniqueIndex("sessions_tutor_start_unique").on(table.tutorId, table.scheduledAt),
}));

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Conversations between parents and tutors
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: int("studentId"), // Reference to which student this conversation is about
  lastMessageAt: bigint("lastMessageAt", { mode: "number" }), // Unix timestamp in milliseconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentIdIdx: index("conversations_parentId_idx").on(table.parentId),
  tutorIdIdx: index("conversations_tutorId_idx").on(table.tutorId),
}));

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages within conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: int("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  sentAt: bigint("sentAt", { mode: "number" }).notNull(), // Unix timestamp in milliseconds
  fileUrl: varchar("fileUrl", { length: 500 }),
  fileName: varchar("fileName", { length: 255 }),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("messages_conversationId_idx").on(table.conversationId),
  senderIdIdx: index("messages_senderId_idx").on(table.senderId),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Payment transactions
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id, { onDelete: "set null" }),
  sessionId: int("sessionId").references(() => sessions.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("usd").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  paymentType: mysqlEnum("paymentType", ["subscription", "session"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentIdIdx: index("payments_parentId_idx").on(table.parentId),
  tutorIdIdx: index("payments_tutorId_idx").on(table.tutorId),
}));

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Platform statistics displayed on home page
 */
export const platformStats = mysqlTable("platform_stats", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 100 }).notNull(), // e.g., "Hours Learned", "Highest SAT Score"
  value: varchar("value", { length: 50 }).notNull(), // e.g., "100K+", "1600"
  description: varchar("description", { length: 255 }), // e.g., "Hours Learned", "Highest SAT Score"
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformStat = typeof platformStats.$inferSelect;
export type InsertPlatformStat = typeof platformStats.$inferInsert;

/**
 * Featured courses displayed on home page
 */
export const featuredCourses = mysqlTable("featured_courses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // Icon name from lucide-react
  priceFrom: decimal("priceFrom", { precision: 10, scale: 2 }).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeaturedCourse = typeof featuredCourses.$inferSelect;
export type InsertFeaturedCourse = typeof featuredCourses.$inferInsert;

/**
 * Testimonials from parents
 */
export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  parentName: varchar("parentName", { length: 255 }).notNull(),
  parentInitials: varchar("parentInitials", { length: 5 }).notNull(),
  parentRole: varchar("parentRole", { length: 100 }), // e.g., "Parent of 8th grader"
  content: text("content").notNull(),
  rating: int("rating").default(5).notNull(), // 1-5 stars
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

/**
 * FAQ items
 */
export const faqs = mysqlTable("faqs", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = typeof faqs.$inferInsert;

/**
 * Blog posts for landing page
 */
export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImageUrl: text("coverImageUrl"),
  authorId: int("authorId").references(() => users.id, { onDelete: "set null" }),
  category: varchar("category", { length: 100 }),
  tags: text("tags"), // JSON array of tags
  readTime: int("readTime"), // estimated read time in minutes
  isPublished: boolean("isPublished").default(true).notNull(),
  publishedAt: timestamp("publishedAt"),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("blog_posts_slug_idx").on(table.slug),
  categoryIdx: index("blog_posts_category_idx").on(table.category),
}));

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

/**
 * Tutor availability slots for scheduling
 * Managed by admins to set when tutors are available
 */
export const tutorAvailability = mysqlTable("tutor_availability", {
  id: int("id").autoincrement().primaryKey(),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: int("dayOfWeek").notNull(), // 0 = Sunday, 6 = Saturday
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:MM format (24-hour)
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:MM format (24-hour)
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tutorIdIdx: index("tutor_availability_tutorId_idx").on(table.tutorId),
  dayOfWeekIdx: index("tutor_availability_dayOfWeek_idx").on(table.dayOfWeek),
}));

export type TutorAvailability = typeof tutorAvailability.$inferSelect;
export type InsertTutorAvailability = typeof tutorAvailability.$inferInsert;

/**
 * Tutor time blocks for one-time unavailability (vacations, appointments, etc.)
 */
export const tutorTimeBlocks = mysqlTable("tutor_time_blocks", {
  id: int("id").autoincrement().primaryKey(),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: bigint("startTime", { mode: "number" }).notNull(), // Unix timestamp in milliseconds
  endTime: bigint("endTime", { mode: "number" }).notNull(), // Unix timestamp in milliseconds
  reason: varchar("reason", { length: 255 }), // Optional reason (vacation, appointment, etc.)
  acuityBlockId: int("acuityBlockId"), // Link to Acuity block if synced
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tutorIdIdx: index("tutor_time_blocks_tutorId_idx").on(table.tutorId),
  startTimeIdx: index("tutor_time_blocks_startTime_idx").on(table.startTime),
}));

export type TutorTimeBlock = typeof tutorTimeBlocks.$inferSelect;
export type InsertTutorTimeBlock = typeof tutorTimeBlocks.$inferInsert;

/**
 * Acuity mapping templates for bulk course configuration
 */
export const acuityMappingTemplates = mysqlTable("acuity_mapping_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  acuityAppointmentTypeId: int("acuityAppointmentTypeId").notNull(),
  acuityCalendarId: int("acuityCalendarId").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AcuityMappingTemplate = typeof acuityMappingTemplates.$inferSelect;
export type InsertAcuityMappingTemplate = typeof acuityMappingTemplates.$inferInsert;

/**
 * Email template settings for customizing booking confirmation emails
 */
export const emailSettings = mysqlTable("email_settings", {
  id: int("id").autoincrement().primaryKey(),
  logoUrl: text("logoUrl"), // URL to custom logo image
  primaryColor: varchar("primaryColor", { length: 7 }).default("#667eea").notNull(), // Hex color code
  accentColor: varchar("accentColor", { length: 7 }).default("#764ba2").notNull(), // Hex color code
  footerText: text("footerText").notNull(),
  companyName: varchar("companyName", { length: 255 }).default("EdKonnect Academy").notNull(),
  supportEmail: varchar("supportEmail", { length: 320 }).default("support@edkonnect.com"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = typeof emailSettings.$inferInsert;

/**
 * Session notes for tutors to record progress and share feedback with parents
 */
export const sessionNotes = mysqlTable("session_notes", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  progressSummary: text("progressSummary").notNull(), // What the student accomplished
  homework: text("homework"), // Assigned homework or practice tasks
  challenges: text("challenges"), // Areas where student struggled
  nextSteps: text("nextSteps"), // Recommendations for next session
  parentNotified: boolean("parentNotified").default(false).notNull(), // Whether parent was emailed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("session_notes_sessionId_idx").on(table.sessionId),
  tutorIdIdx: index("session_notes_tutorId_idx").on(table.tutorId),
  parentIdIdx: index("session_notes_parentId_idx").on(table.parentId),
}));

export type SessionNote = typeof sessionNotes.$inferSelect;
export type InsertSessionNote = typeof sessionNotes.$inferInsert;

/**
 * File attachments for session notes (worksheets, student work, etc.)
 */
export const sessionNoteAttachments = mysqlTable("session_note_attachments", {
  id: int("id").autoincrement().primaryKey(),
  sessionNoteId: int("sessionNoteId").notNull().references(() => sessionNotes.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileUrl: text("fileUrl").notNull(), // Public URL
  fileSize: int("fileSize").notNull(), // Size in bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionNoteIdIdx: index("session_note_attachments_sessionNoteId_idx").on(table.sessionNoteId),
}));

export type SessionNoteAttachment = typeof sessionNoteAttachments.$inferSelect;
export type InsertSessionNoteAttachment = typeof sessionNoteAttachments.$inferInsert;

/**
 * Tutor reviews and ratings from parents
 */
export const tutorReviews = mysqlTable("tutor_reviews", {
  id: int("id").autoincrement().primaryKey(),
  tutorId: int("tutorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: int("parentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: int("sessionId").references(() => sessions.id, { onDelete: "set null" }),
  rating: int("rating").notNull(), // 1-5 stars
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tutorIdIdx: index("tutor_reviews_tutorId_idx").on(table.tutorId),
  parentIdIdx: index("tutor_reviews_parentId_idx").on(table.parentId),
}));

export type TutorReview = typeof tutorReviews.$inferSelect;
export type InsertTutorReview = typeof tutorReviews.$inferInsert;

/**
 * Notification preferences for users
 */
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("emailEnabled").default(true).notNull(),
  inAppEnabled: boolean("inAppEnabled").default(true).notNull(),
  smsEnabled: boolean("smsEnabled").default(false).notNull(),
  timing24h: boolean("timing24h").default(true).notNull(),
  timing1h: boolean("timing1h").default(false).notNull(),
  timing15min: boolean("timing15min").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("notification_preferences_userId_idx").on(table.userId),
}));

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * Log of sent notifications
 */
export const notificationLogs = mysqlTable("notification_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: int("sessionId").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(), // 'email', 'in_app', 'sms'
  timing: varchar("timing", { length: 20 }).notNull(), // '24h', '1h', '15min'
  status: varchar("status", { length: 20 }).notNull(), // 'sent', 'failed', 'pending'
  message: text("message"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
}, (table) => ({
  userIdIdx: index("notification_logs_userId_idx").on(table.userId),
  sessionIdIdx: index("notification_logs_sessionId_idx").on(table.sessionId),
}));

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

/**
 * In-app notifications for users
 */
export const inAppNotifications = mysqlTable("in_app_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'session_reminder', 'session_cancelled', etc.
  relatedId: int("relatedId"), // sessionId or other related entity
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
}, (table) => ({
  userIdIdx: index("in_app_notifications_userId_idx").on(table.userId),
  isReadIdx: index("in_app_notifications_isRead_idx").on(table.isRead),
}));

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = typeof inAppNotifications.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tutorProfile: one(tutorProfiles, {
    fields: [users.id],
    references: [tutorProfiles.userId],
  }),
  parentProfile: one(parentProfiles, {
    fields: [users.id],
    references: [parentProfiles.userId],
  }),
  courses: many(courses),
  subscriptions: many(subscriptions),
  sessionsAsTutor: many(sessions, { relationName: "tutorSessions" }),
  sessionsAsParent: many(sessions, { relationName: "parentSessions" }),
  conversationsAsParent: many(conversations, { relationName: "parentConversations" }),
  conversationsAsTutor: many(conversations, { relationName: "tutorConversations" }),
  messages: many(messages),
}));

export const tutorProfilesRelations = relations(tutorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [tutorProfiles.userId],
    references: [users.id],
  }),
}));

export const parentProfilesRelations = relations(parentProfiles, ({ one }) => ({
  user: one(users, {
    fields: [parentProfiles.userId],
    references: [users.id],
  }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  subscriptions: many(subscriptions),
  courseTutors: many(courseTutors),
}));

export const courseTutorsRelations = relations(courseTutors, ({ one }) => ({
  course: one(courses, {
    fields: [courseTutors.courseId],
    references: [courses.id],
  }),
  tutor: one(users, {
    fields: [courseTutors.tutorId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  parent: one(users, {
    fields: [subscriptions.parentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [subscriptions.courseId],
    references: [courses.id],
  }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [sessions.subscriptionId],
    references: [subscriptions.id],
  }),
  tutor: one(users, {
    fields: [sessions.tutorId],
    references: [users.id],
  }),
  parent: one(users, {
    fields: [sessions.parentId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  parent: one(users, {
    fields: [conversations.parentId],
    references: [users.id],
  }),
  tutor: one(users, {
    fields: [conversations.tutorId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  parent: one(users, {
    fields: [payments.parentId],
    references: [users.id],
  }),
  tutor: one(users, {
    fields: [payments.tutorId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
  session: one(sessions, {
    fields: [payments.sessionId],
    references: [sessions.id],
  }),
}));
