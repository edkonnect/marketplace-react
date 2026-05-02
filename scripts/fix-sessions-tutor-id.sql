-- ============================================================
-- Fix tutorId on sessions to match the latest preferredTutorId
-- from subscriptions for each parent+student+course combination
-- ============================================================

-- amazedsaint@gmail.com | Jahnavi | SAT Math (courseId=1) | Maya(47) → Anitta(51)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET s.tutorId = 51
WHERE s.courseId = 1 AND LOWER(s.studentFirstName) = 'jahnavi' AND s.tutorId = 47;

-- bhavika.ramprakash@gmail.com | Bhavika | AP Chemistry (courseId=82) | Arunn(3) → Kalyan(53)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'bhavika.ramprakash@gmail.com'
SET s.tutorId = 53
WHERE s.courseId = 82 AND LOWER(s.studentFirstName) = 'bhavika' AND s.tutorId = 3;

-- deepa.pondicherry@gmail.com | Aaria | MS Math (courseId=4) | Dolon(50) → Anitta(51)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'deepa.pondicherry@gmail.com'
SET s.tutorId = 51
WHERE s.courseId = 4 AND LOWER(s.studentFirstName) = 'aaria' AND s.tutorId = 50;

-- deepa.pondicherry@gmail.com | Aaria | MS English (courseId=114) | Shriti(23) → Nalini(59)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'deepa.pondicherry@gmail.com'
SET s.tutorId = 59
WHERE s.courseId = 114 AND LOWER(s.studentFirstName) = 'aaria' AND s.tutorId = 23;

-- deepsforever@gmail.com | Sravya | SAT English (courseId=25) | Shriti(23) → Mercy(30)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'deepsforever@gmail.com'
SET s.tutorId = 30
WHERE s.courseId = 25 AND LOWER(s.studentFirstName) = 'sravya' AND s.tutorId = 23;

-- jsingh247365@gmail.com | Rajveer | MS English (courseId=114) | Apoorva(24) → Mercy(30)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'jsingh247365@gmail.com'
SET s.tutorId = 30
WHERE s.courseId = 114 AND LOWER(s.studentFirstName) = 'rajveer' AND s.tutorId = 24;

-- kalyani.kankanampati@gmail.com | Aneesh | MS Math (courseId=4) | Arunn(3) → Anitta(51)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'kalyani.kankanampati@gmail.com'
SET s.tutorId = 51
WHERE s.courseId = 4 AND LOWER(s.studentFirstName) = 'aneesh' AND s.tutorId = 3;

-- krithikar06@gmail.com | Darshika | Math Olympiad HS (courseId=274) | Arunn(3) → Maya(47)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'krithikar06@gmail.com'
SET s.tutorId = 47
WHERE s.courseId = 274 AND LOWER(s.studentFirstName) = 'darshika' AND s.tutorId = 3;

-- mail.rd.in@gmail.com | Arko | HS Math CBSE (courseId=150) | Arunn(3) → Gopi(72)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET s.tutorId = 72
WHERE s.courseId = 150 AND LOWER(s.studentFirstName) = 'arko' AND s.tutorId = 3;

-- mail.rd.in@gmail.com | Ujjaini | HS Chemistry (courseId=154) | Sriilalit(52) → Sivasankare(57)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET s.tutorId = 57
WHERE s.courseId = 154 AND LOWER(s.studentFirstName) = 'ujjaini' AND s.tutorId = 52;

-- mail.rd.in@gmail.com | Ujjaini | MS Chemistry (courseId=220) | Arunn(3) → Sriilalit(52)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET s.tutorId = 52
WHERE s.courseId = 220 AND LOWER(s.studentFirstName) = 'ujjaini' AND s.tutorId = 3;

-- munidinesh@gmail.com | Anvika | SAT English (courseId=25) | Shriti(23) → Mercy(30)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'munidinesh@gmail.com'
SET s.tutorId = 30
WHERE s.courseId = 25 AND LOWER(s.studentFirstName) = 'anvika' AND s.tutorId = 23;

-- pgayathiri@gmail.com | Lakshana | HS Physics (courseId=157) | Arunn(3) → Prasenjit(66)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET s.tutorId = 66
WHERE s.courseId = 157 AND LOWER(s.studentFirstName) = 'lakshana' AND s.tutorId = 3;

-- pgayathiri@gmail.com | Samyutha | Elementary English (courseId=115) | Arunn(3) → Aishwarya(69)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET s.tutorId = 69
WHERE s.courseId = 115 AND LOWER(s.studentFirstName) = 'samyutha' AND s.tutorId = 3;

-- rkumarbin@gmail.com | Sanchay | HS Chemistry (courseId=154) | Arunn(3) → Kalyan(53)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'rkumarbin@gmail.com'
SET s.tutorId = 53
WHERE s.courseId = 154 AND LOWER(s.studentFirstName) = 'sanchay' AND s.tutorId = 3;

-- sw2881984@yahoo.co.in | Lakshmi | MS Math (courseId=4) | Arunn(3) → Naushad(76)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET s.tutorId = 76
WHERE s.courseId = 4 AND LOWER(s.studentFirstName) = 'lakshmi' AND s.tutorId = 3;

-- sw2881984@yahoo.co.in | Nachammai | HS Math CBSE (courseId=150) | Sriilalit(52) → Prasenjit(66)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET s.tutorId = 66
WHERE s.courseId = 150 AND LOWER(s.studentFirstName) = 'nachammai' AND s.tutorId = 52;

-- tejarajivreddy@gmail.com | Aryan | MS English CBSE (courseId=139) | Arunn(3) → Aishwarya(69)
UPDATE tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId AND LOWER(u.email) = 'tejarajivreddy@gmail.com'
SET s.tutorId = 69
WHERE s.courseId = 139 AND LOWER(s.studentFirstName) = 'aryan' AND s.tutorId = 3;

-- ============================================================
-- VERIFICATION — should return empty set
-- ============================================================
-- SELECT u.email, s.studentFirstName, s.courseId, s.tutorId, sub.preferredTutorId
-- FROM tutor_marketplace.sessions s
-- JOIN tutor_marketplace.users u ON u.id = s.parentId AND u.id BETWEEN 81 AND 143
-- JOIN tutor_marketplace.subscriptions sub
--   ON sub.parentId = s.parentId AND sub.courseId = s.courseId
--   AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
-- WHERE s.tutorId != sub.preferredTutorId
-- LIMIT 20;
