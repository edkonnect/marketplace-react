-- ============================================================
-- INSERT MISSING SESSIONS FOR ALL 63 MIGRATED PARENTS
-- Generated: 2026-04-10
--
-- Root cause: TypeScript migration script had session_time bug
-- (came back as seconds number, not string → timezone conversion failed)
-- This SQL uses CONVERT_TZ directly which handles it correctly.
--
-- Uses INSERT IGNORE to safely skip any duplicates.
-- Notes mapping (corrected from original script swap):
--   sessions.notes           = legacy feedback_from_tutor
--   sessions.feedbackFromTutor = legacy notes (session summary)
--
-- Skipped legacy course IDs (no platform mapping):
--   1 (Math Elementary), 9 (Summer Course MS),
--   103 (AS Pure Math), 104 (AS Prob/Stats), 107 (MS Computer Science)
-- ============================================================

-- Legacy 2 → courseId 25 (SAT English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  25,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 2;

-- Legacy 3 → courseId 276 (Spoken English / Advanced English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  276,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 276
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 3;

-- Legacy 4 → courseId 1 (SAT Math)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  1,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 4;

-- Legacy 5 → courseId 4 (Middle School Math)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  4,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 5;

-- Legacy 6 → courseId 274 (Math Olympiad - High School) [FIXED from 177]
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  274,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 274
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 6;

-- Legacy 14 → courseId 4 (Middle School Math CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  4,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 14;

-- Legacy 15 → courseId 150 (HS Math CBSE Grade 11)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  150,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 150
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 15;

-- Legacy 16 → courseId 115 (Elementary English CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  115,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 115
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 16;

-- Legacy 17 → courseId 139 (MS English CBSE Grade 6)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  139,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 139
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 17;

-- Legacy 22 → courseId 219 (MS Physics CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  219,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 219
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 22;

-- Legacy 25 → courseId 115 (Elementary English CBSE) [FIXED from 113]
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  115,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 115
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 25;

-- Legacy 26 → courseId 114 (Middle School English CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  114,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 114
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 26;

-- Legacy 33 → courseId 116 (HS English CBSE) [FIXED from 276]
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  116,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 116
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 33;

-- Legacy 35 → courseId 220 (MS Chemistry CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  220,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 220
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 35;

-- Legacy 36 → courseId 124 (MS Science CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  124,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 124
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 36;

-- Legacy 37 → courseId 154 (HS Chemistry CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  154,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 154
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 37;

-- Legacy 45 → courseId 162 (HS Biology CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  162,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 162
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 45;

-- Legacy 61 → courseId 157 (HS Physics CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  157,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 157
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 61;

-- Legacy 79 → courseId 1 (Digital SAT Math)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  1,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 79;

-- Legacy 80 → courseId 25 (Digital SAT English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  25,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 80;

-- Legacy 83 → courseId 221 (MS Biology CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  221,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 221
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 83;

-- Legacy 92 → courseId 51 (HS Computer Science CBSE)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  51,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 51
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 92;

-- Legacy 94 → courseId 276 (Spoken English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  276,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 276
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 94;

-- Legacy 99 → courseId 25 (SAT Foundation English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  25,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 99;

-- Legacy 100 → courseId 92 (ACT Math)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  92,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 92
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 100;

-- Legacy 101 → courseId 75 (ACT English)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  75,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 75
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 101;

-- Legacy 108 → courseId 12 (Python Programming)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  12,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 12
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 108;

-- Legacy 116 → courseId 33 (AP Calculus)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  33,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 33
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 116;

-- Legacy 117 → courseId 22 (Java Programming)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  22,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 22
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 117;

-- Legacy 118 → courseId 88 (AP Computer Science)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  88,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 88
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 118;

-- Legacy 119 → courseId 84 (AP Physics)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  84,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 84
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 119;

-- Legacy 123 → courseId 82 (AP Chemistry)
INSERT IGNORE INTO tutor_marketplace.sessions
  (parentId, tutorId, courseId, scheduledAt, duration, status,
   studentFirstName, studentLastName, studentGrade,
   notes, feedbackFromTutor, meetingPlatform, isTrial, subscriptionId)
SELECT
  u.id,
  COALESCE(sub.preferredTutorId, 3),
  82,
  UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000,
  COALESCE(ls.duration_min, 60),
  CASE LOWER(ls.status) WHEN 'active' THEN 'completed' WHEN 'completed' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'canceled' THEN 'cancelled' ELSE 'scheduled' END,
  ls.student_first_name, ls.student_last_name, ls.student_grade,
  ls.feedback_from_tutor, ls.notes,
  COALESCE(ls.meeting_platform, 'Zoom'), 0,
  sub.id
FROM legacy_staging.sessions ls
JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
LEFT JOIN tutor_marketplace.subscriptions sub
  ON sub.parentId = u.id AND sub.courseId = 82
  AND LOWER(sub.studentFirstName) = LOWER(ls.student_first_name)
WHERE ls.course_id = 123;

-- ============================================================
-- VERIFICATION QUERY (run after all inserts above)
-- ============================================================
-- SELECT ls.course_id, COUNT(*) as still_missing
-- FROM legacy_staging.sessions ls
-- JOIN tutor_marketplace.users u ON LOWER(u.email) = LOWER(ls.parent_email) AND u.id BETWEEN 81 AND 143
-- LEFT JOIN tutor_marketplace.sessions s
--   ON s.parentId = u.id
--   AND s.scheduledAt = UNIX_TIMESTAMP(CONVERT_TZ(CONCAT(ls.session_date, ' ', ls.session_time), ls.timezone, 'UTC')) * 1000
-- WHERE s.id IS NULL
--   AND ls.course_id NOT IN (1, 9, 103, 104, 107)
-- GROUP BY ls.course_id
-- ORDER BY ls.course_id;
