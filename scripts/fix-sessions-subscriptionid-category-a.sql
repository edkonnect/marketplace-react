-- ============================================================
-- Category A Fix: UPDATE sessions.subscriptionId where session courseId
-- matches an existing subscription for that parent
-- Safe: only fixes subscriptionId, no session data is changed
-- ============================================================

-- jagapathirajup@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 25
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND s.courseId = 25
  AND s.parentId BETWEEN 81 AND 143;


-- mail.rd.in@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 4
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND s.courseId = 4
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 150
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND s.courseId = 150
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 219
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND s.courseId = 219
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 220
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND s.courseId = 220
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 221
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND s.courseId = 221
  AND s.parentId BETWEEN 81 AND 143;


-- pgayathiri@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 115
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND s.courseId = 115
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 157
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND s.courseId = 157
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 276
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND s.courseId = 276
  AND s.parentId BETWEEN 81 AND 143;


-- raviraju.kalidindi@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 114
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'raviraju.kalidindi@gmail.com'
  AND s.courseId = 114
  AND s.parentId BETWEEN 81 AND 143;


-- rkumarbin@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 154
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'rkumarbin@gmail.com'
  AND s.courseId = 154
  AND s.parentId BETWEEN 81 AND 143;


-- sw2881984@yahoo.co.in
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 4
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND s.courseId = 4
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 150
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND s.courseId = 150
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 219
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND s.courseId = 219
  AND s.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 220
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND s.courseId = 220
  AND s.parentId BETWEEN 81 AND 143;


-- umamagashwari@gmail.com
UPDATE tutor_marketplace.sessions s
  INNER JOIN tutor_marketplace.users u ON u.id = s.parentId
  INNER JOIN tutor_marketplace.subscriptions sub
          ON sub.parentId = s.parentId AND sub.courseId = 4
SET s.subscriptionId = sub.id
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND s.courseId = 4
  AND s.parentId BETWEEN 81 AND 143;


-- ============================================================
-- Verify: should return 0 rows for these parents after fix
-- ============================================================

SELECT u.email, s.courseId, sc.title AS sessionCourse,
       sub.courseId AS subCourseId, subc.title AS subCourse, COUNT(*) AS cnt
FROM tutor_marketplace.sessions s
JOIN tutor_marketplace.users u ON u.id = s.parentId
LEFT JOIN tutor_marketplace.courses sc ON sc.id = s.courseId
LEFT JOIN tutor_marketplace.subscriptions sub ON sub.id = s.subscriptionId
LEFT JOIN tutor_marketplace.courses subc ON subc.id = sub.courseId
WHERE LOWER(u.email) IN ('jagapathirajup@gmail.com', 'mail.rd.in@gmail.com', 'pgayathiri@gmail.com', 'raviraju.kalidindi@gmail.com', 'rkumarbin@gmail.com', 'sw2881984@yahoo.co.in', 'umamagashwari@gmail.com')
  AND s.courseId != sub.courseId
GROUP BY u.email, s.courseId, s.subscriptionId
ORDER BY u.email;