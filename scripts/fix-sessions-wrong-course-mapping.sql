-- ============================================================
-- Fix sessions where LEGACY_COURSE_MAP had wrong mappings:
-- Legacy 6 (Math-HS) → was courseId=177 (CBSE Hindi) → fix to correct Math sub
-- Legacy 25 (English Elementary) → was courseId=113 (Soft Skills) → fix to correct English sub
-- Legacy 33 (English HS) → was courseId=276 (Spoken English) → fix to correct English sub
-- After fixing courseId, re-link subscriptionId by parentId+courseId+studentFirstName
-- ============================================================

-- ============================================================
-- STEP 1: Fix courseId on sessions
-- ============================================================

-- Legacy 6 (Math - High School Level) → courseId=274 (Math Olympiad-High School)
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND LOWER(s.studentFirstName) = 'jahnavi'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND LOWER(s.studentFirstName) = 'sravya'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND LOWER(s.studentFirstName) = 'hasini'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND LOWER(s.studentFirstName) = 'jaskeerat'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'krithika1412@gmail.com'
  AND LOWER(s.studentFirstName) = 'sana'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'krithikar06@gmail.com'
  AND LOWER(s.studentFirstName) = 'darshika'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 274
WHERE LOWER(u.email) = 'srilakshmi.chennu@gmail.com'
  AND LOWER(s.studentFirstName) = 'dyuthi'
  AND s.courseId = 177
  AND s.parentId BETWEEN 81 AND 143;

-- Legacy 25 (English - Reading and Writing Elementary) → correct English courseId
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 115
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND LOWER(s.studentFirstName) = 'ananya'
  AND s.courseId = 113
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 114
WHERE LOWER(u.email) = 'raviraju.kalidindi@gmail.com'
  AND LOWER(s.studentFirstName) = 'hitesh'
  AND s.courseId = 113
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 115
WHERE LOWER(u.email) = 'surapureddy.raj@gmail.com'
  AND LOWER(s.studentFirstName) = 'krithi'
  AND s.courseId = 113
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 115
WHERE LOWER(u.email) = 'thangam.reach@gmail.com'
  AND LOWER(s.studentFirstName) = 'smita'
  AND s.courseId = 113
  AND s.parentId BETWEEN 81 AND 143;

-- Legacy 33 (English - Reading and Writing High School) → correct English courseId
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 116
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND LOWER(s.studentFirstName) = 'jahnavi'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 114
WHERE LOWER(u.email) = 'ashok.sree@gmail.com'
  AND LOWER(s.studentFirstName) = 'amudhan'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 116
WHERE LOWER(u.email) = 'k99.ram@gmail.com'
  AND LOWER(s.studentFirstName) = 'nikhil'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 116
WHERE LOWER(u.email) = 'krithika1412@gmail.com'
  AND LOWER(s.studentFirstName) = 'sana'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 116
WHERE LOWER(u.email) = 'raviraju.kalidindi@gmail.com'
  AND LOWER(s.studentFirstName) = 'saketh'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
SET s.courseId = 116
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND LOWER(s.studentFirstName) = 'vishal'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;

-- ============================================================
-- STEP 2: Re-link subscriptionId by matching parentId + courseId + studentFirstName
-- Only for the affected parents
-- ============================================================

-- amazedsaint@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- ashok.sree@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'ashok.sree@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- deepsforever@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- jagapathirajup@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- jsingh247365@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- k99.ram@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'k99.ram@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- krithika1412@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'krithika1412@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- krithikar06@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'krithikar06@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- raviraju.kalidindi@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'raviraju.kalidindi@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- srilakshmi.chennu@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'srilakshmi.chennu@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- surapureddy.raj@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'surapureddy.raj@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- thangam.reach@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'thangam.reach@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- umamagashwari@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId
         AND sub.courseId = s.courseId
         AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND s.parentId BETWEEN 81 AND 143;

-- ============================================================
-- STEP 3: Nullify subscriptionId for sessions that still have no matching subscription
-- (sessions from legacy courses with no equivalent subscription on new platform)
-- ============================================================

UPDATE tutor_marketplace.sessions s
  LEFT JOIN tutor_marketplace.subscriptions sub
         ON sub.parentId = s.parentId
        AND sub.courseId = s.courseId
        AND LOWER(sub.studentFirstName) = LOWER(s.studentFirstName)
SET s.subscriptionId = NULL
WHERE s.parentId BETWEEN 81 AND 143
  AND sub.id IS NULL
  AND s.subscriptionId IS NOT NULL;

-- ============================================================
-- STEP 4: Verify — should return 0 rows for correct mappings
-- ============================================================

SELECT u.email, s.courseId, sc.title AS sessionCourse,
       sub.courseId AS subCourseId, subc.title AS subCourse, COUNT(*) AS cnt
FROM tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId
LEFT JOIN tutor_marketplace.courses sc ON sc.id = s.courseId
LEFT JOIN tutor_marketplace.subscriptions sub ON sub.id = s.subscriptionId
LEFT JOIN tutor_marketplace.courses subc ON subc.id = sub.courseId
WHERE s.parentId BETWEEN 81 AND 143
  AND s.subscriptionId IS NOT NULL
  AND s.courseId != sub.courseId
GROUP BY u.email, s.courseId, s.subscriptionId
ORDER BY u.email;
