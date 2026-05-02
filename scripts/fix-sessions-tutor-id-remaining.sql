-- ============================================================
-- Fix remaining session tutorIds (with duplicate conflict protection)
-- Uses LEFT JOIN to skip sessions where the correct tutor already
-- has a session at the same timestamp (unique constraint conflict)
-- ============================================================

-- krithikar06@gmail.com | Darshika | Math Olympiad HS (courseId=274) | Arunn(3) → Maya(47)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'krithikar06@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 47 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 47
WHERE s.courseId = 274 AND LOWER(s.studentFirstName) = 'darshika'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- mail.rd.in@gmail.com | Arko | HS Math CBSE (courseId=150) | Arunn(3) → Gopi(72)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 72 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 72
WHERE s.courseId = 150 AND LOWER(s.studentFirstName) = 'arko'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- mail.rd.in@gmail.com | Ujjaini | HS Chemistry (courseId=154) | Sriilalit(52) → Sivasankare(57)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 57 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 57
WHERE s.courseId = 154 AND LOWER(s.studentFirstName) = 'ujjaini'
  AND s.tutorId = 52 AND conflict.id IS NULL;

-- mail.rd.in@gmail.com | Ujjaini | MS Chemistry (courseId=220) | Arunn(3) → Sriilalit(52)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 52 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 52
WHERE s.courseId = 220 AND LOWER(s.studentFirstName) = 'ujjaini'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- munidinesh@gmail.com | Anvika | SAT English (courseId=25) | Shriti(23) → Mercy(30)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'munidinesh@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 30 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 30
WHERE s.courseId = 25 AND LOWER(s.studentFirstName) = 'anvika'
  AND s.tutorId = 23 AND conflict.id IS NULL;

-- pgayathiri@gmail.com | Lakshana | HS Physics (courseId=157) | Arunn(3) → Prasenjit(66)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 66 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 66
WHERE s.courseId = 157 AND LOWER(s.studentFirstName) = 'lakshana'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- pgayathiri@gmail.com | Samyutha | Elementary English (courseId=115) | Arunn(3) → Aishwarya(69)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 69 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 69
WHERE s.courseId = 115 AND LOWER(s.studentFirstName) = 'samyutha'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- rkumarbin@gmail.com | Sanchay | HS Chemistry (courseId=154) | Arunn(3) → Kalyan(53)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'rkumarbin@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 53 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 53
WHERE s.courseId = 154 AND LOWER(s.studentFirstName) = 'sanchay'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- sw2881984@yahoo.co.in | Lakshmi | MS Math (courseId=4) | Arunn(3) → Naushad(76)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 76 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 76
WHERE s.courseId = 4 AND LOWER(s.studentFirstName) = 'lakshmi'
  AND s.tutorId = 3 AND conflict.id IS NULL;

-- sw2881984@yahoo.co.in | Nachammai | HS Math CBSE (courseId=150) | Sriilalit(52) → Prasenjit(66)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 66 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 66
WHERE s.courseId = 150 AND LOWER(s.studentFirstName) = 'nachammai'
  AND s.tutorId = 52 AND conflict.id IS NULL;

-- tejarajivreddy@gmail.com | Aryan | MS English CBSE (courseId=139) | Arunn(3) → Aishwarya(69)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'tejarajivreddy@gmail.com'
LEFT JOIN tutor_marketplace.sessions conflict
  ON conflict.tutorId = 69 AND conflict.scheduledAt = s.scheduledAt
SET s.tutorId = 69
WHERE s.courseId = 139 AND LOWER(s.studentFirstName) = 'aryan'
  AND s.tutorId = 3 AND conflict.id IS NULL;
