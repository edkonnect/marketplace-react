-- ============================================================
-- Fix subscriptions.preferredTutorId + course_tutors for migrated parents
-- Generated from subscriptions_.csv ground truth
-- Tutors with no platform ID → tutorId=3 (Arunn Sivaan)
-- Run on EC2: mysql -h tutor-marketplace-mysql.c1gyyeezlnjc.us-east-2.rds.amazonaws.com -u admin -p
-- ============================================================

-- Step 1: Fix preferredTutorId on all subscriptions for migrated parents

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 51
WHERE LOWER(u.email) = 'abishan.ganeshbabu@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'abishan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'abishan.ganeshbabu@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'abishan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'jahnavi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'chinmayi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 12
  AND LOWER(sub.studentFirstName) LIKE 'chinmayi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 12
  AND LOWER(sub.studentFirstName) LIKE 'jahnavi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 22
  AND LOWER(sub.studentFirstName) LIKE 'jahnavi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'amazedsaint@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'jahnavi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'apakapawan007@yahoo.co.in'
  AND sub.courseId = 166
  AND LOWER(sub.studentFirstName) LIKE 'kapish%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'ash.latha1@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'sankeerth%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'ash.latha1@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'sankeerth%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'b.jean9109@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'cooper%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'bhavika.ramprakash@gmail.com'
  AND sub.courseId = 33
  AND LOWER(sub.studentFirstName) LIKE 'bhavika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'bhavika.ramprakash@gmail.com'
  AND sub.courseId = 82
  AND LOWER(sub.studentFirstName) LIKE 'bhavika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'deepa.pondicherry@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'ishika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'deepa.pondicherry@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'aaria%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'deepa.pondicherry@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'ishika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'sravya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'sravya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'deepsforever@gmail.com'
  AND sub.courseId = 33
  AND LOWER(sub.studentFirstName) LIKE 'sravya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 54
WHERE LOWER(u.email) = 'dencygr8@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'ethan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'dencygr8@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'ethan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'dhruval2@yahoo.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'shaival%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'dhruval2@yahoo.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'shaival%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'durgadevi.ramesh@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'tarun%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'durgadevi.ramesh@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'tarun%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'gswathi858@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'vishnu%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'gswathi858@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'vishnu%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'indrarajchatterjee77@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'ethan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'indrarajchatterjee77@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'ethan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'itsme.swethu@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'vedya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'hasini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'srihitha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'srihitha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 22
  AND LOWER(sub.studentFirstName) LIKE 'hasini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 22
  AND LOWER(sub.studentFirstName) LIKE 'srihitha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'jagapathirajup@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'hasini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'jaideep.pinglikar@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'vivaan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 70
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'jaskeerat%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 70
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'rajveer%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'jaskeerat%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'jsingh247365@gmail.com'
  AND sub.courseId = 68
  AND LOWER(sub.studentFirstName) LIKE 'jaskeerat%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 76
WHERE LOWER(u.email) = 'jyothi.rani@live.in'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'aarohi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'kalyani.kankanampati@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'aneesh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'kavitharajiv94@gmail.com'
  AND sub.courseId = 150
  AND LOWER(sub.studentFirstName) LIKE 'diya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'kavitharajiv94@gmail.com'
  AND sub.courseId = 163
  AND LOWER(sub.studentFirstName) LIKE 'diya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'kavitharajiv94@gmail.com'
  AND sub.courseId = 222
  AND LOWER(sub.studentFirstName) LIKE 'diya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'krithika1412@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'sana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'krithikar06@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'varsha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'krithikar06@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'varsha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 54
WHERE LOWER(u.email) = 'krithikar06@gmail.com'
  AND sub.courseId = 33
  AND LOWER(sub.studentFirstName) LIKE 'varsha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 51
WHERE LOWER(u.email) = 'lnsgeetha@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'naumikaa%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'lnsgeetha@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'naumikaa%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 51
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 120
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 57
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 124
  AND LOWER(sub.studentFirstName) LIKE 'arko%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 69
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 139
  AND LOWER(sub.studentFirstName) LIKE 'arko%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 153
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 154
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 71
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 174
  AND LOWER(sub.studentFirstName) LIKE 'arko%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 71
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 177
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 219
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 220
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'mail.rd.in@gmail.com'
  AND sub.courseId = 221
  AND LOWER(sub.studentFirstName) LIKE 'ujjaini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'maruthi.sundaramoorthy@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'dhanyasree%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'maruthi.sundaramoorthy@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'dhanyasree%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'minfantprabu@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'jophiel%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'minfantprabu@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'jophiel%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'mrinalini.sureshkumar@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'mrinalini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'mrinalini.sureshkumar@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'mrinalini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'munidinesh@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'anvika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'munidinesh@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'anvika%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 51
WHERE LOWER(u.email) = 'nami.patel@icloud.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'nami%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'nami.patel@icloud.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'nami%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'nanditkoul2023@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'nandit%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'narayanan.vijay@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'tanushri%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'narayanan.vijay@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'tanushri%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'nate.srinivasan@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'madhubala%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'nate.srinivasan@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'santhosh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'nate.srinivasan@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'madhubala%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'nate.srinivasan@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'santhosh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'nirmal.adlin.usa@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'neola%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'nirmal.adlin.usa@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'nichelle%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'nirmal.adlin.usa@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'neola%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'nirmal.adlin.usa@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'nichelle%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'nithdeepsai@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'nithilan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'nithdeepsai@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'nithilan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'param_palani@yahoo.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'dhruv%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'param_palani@yahoo.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'dhruv%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 50
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 51
  AND LOWER(sub.studentFirstName) LIKE 'lakshana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 115
  AND LOWER(sub.studentFirstName) LIKE 'samyutha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 122
  AND LOWER(sub.studentFirstName) LIKE 'lakshana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 69
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 136
  AND LOWER(sub.studentFirstName) LIKE 'samyutha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 157
  AND LOWER(sub.studentFirstName) LIKE 'lakshana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 159
  AND LOWER(sub.studentFirstName) LIKE 'lakshana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 162
  AND LOWER(sub.studentFirstName) LIKE 'lakshana%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'pgayathiri@gmail.com'
  AND sub.courseId = 276
  AND LOWER(sub.studentFirstName) LIKE 'samyutha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'rejincm@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'anjita%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'rjkumr@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'akhil%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'rjkumr@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'akhil%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 66
WHERE LOWER(u.email) = 'rkumarbin@gmail.com'
  AND sub.courseId = 120
  AND LOWER(sub.studentFirstName) LIKE 'sanchay%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 66
WHERE LOWER(u.email) = 'rkumarbin@gmail.com'
  AND sub.courseId = 153
  AND LOWER(sub.studentFirstName) LIKE 'sanchay%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'rkumarbin@gmail.com'
  AND sub.courseId = 154
  AND LOWER(sub.studentFirstName) LIKE 'sanchay%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 71
WHERE LOWER(u.email) = 'rkumarbin@gmail.com'
  AND sub.courseId = 177
  AND LOWER(sub.studentFirstName) LIKE 'sanchay%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'sasanakotiusha@gmail.com'
  AND sub.courseId = 75
  AND LOWER(sub.studentFirstName) LIKE 'karthikeya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'sasanakotiusha@gmail.com'
  AND sub.courseId = 92
  AND LOWER(sub.studentFirstName) LIKE 'karthikeya%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'sathishkumarprannesh@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'prannesh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'sathishkumarprannesh@gmail.com'
  AND sub.courseId = 33
  AND LOWER(sub.studentFirstName) LIKE 'prannesh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 51
WHERE LOWER(u.email) = 'sejunet23@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'netra%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 51
WHERE LOWER(u.email) = 'senthil.keel@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'samyukthaa%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'senthil.keel@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'samyukthaa%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'seyyonvn@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'seyyon%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'soumyakini@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'yash%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'soumyakini@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'yash%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'suri.rajup@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'riyansh%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'lakshmi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 76
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 119
  AND LOWER(sub.studentFirstName) LIKE 'lakshmi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 141
  AND LOWER(sub.studentFirstName) LIKE 'lakshmi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 150
  AND LOWER(sub.studentFirstName) LIKE 'nachammai%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 163
  AND LOWER(sub.studentFirstName) LIKE 'nachammai%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 52
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 164
  AND LOWER(sub.studentFirstName) LIKE 'nachammai%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 165
  AND LOWER(sub.studentFirstName) LIKE 'nachammai%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 219
  AND LOWER(sub.studentFirstName) LIKE 'lakshmi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'sw2881984@yahoo.co.in'
  AND sub.courseId = 220
  AND LOWER(sub.studentFirstName) LIKE 'lakshmi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'swathibhat224@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'payaswini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'swathibhat224@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'payaswini%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'tejarajivreddy@gmail.com'
  AND sub.courseId = 139
  AND LOWER(sub.studentFirstName) LIKE 'aryan%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 70
WHERE LOWER(u.email) = 'thangam.reach@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'prathikha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'thangam.reach@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'prathikha%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'thangam.reach@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'smita%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'kiruthik%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 3
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND sub.courseId = 4
  AND LOWER(sub.studentFirstName) LIKE 'vishal%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'kiruthik%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 23
WHERE LOWER(u.email) = 'umamagashwari@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'pranav%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 61
WHERE LOWER(u.email) = 'veena.uskids@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'sravani%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'veena.uskids@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'sruthi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'veena.uskids@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'sravani%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 24
WHERE LOWER(u.email) = 'veena.uskids@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'sruthi%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'vidyakar5@gmail.com'
  AND sub.courseId = 1
  AND LOWER(sub.studentFirstName) LIKE 'aparna%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'vidyakar5@gmail.com'
  AND sub.courseId = 25
  AND LOWER(sub.studentFirstName) LIKE 'aparna%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 30
WHERE LOWER(u.email) = 'vidyakar5@gmail.com'
  AND sub.courseId = 75
  AND LOWER(sub.studentFirstName) LIKE 'aparna%'
  AND sub.parentId BETWEEN 81 AND 143;

UPDATE tutor_marketplace.subscriptions sub
  INNER JOIN tutor_marketplace.users u ON u.id = sub.parentId
SET sub.preferredTutorId = 47
WHERE LOWER(u.email) = 'vidyakar5@gmail.com'
  AND sub.courseId = 92
  AND LOWER(sub.studentFirstName) LIKE 'aparna%'
  AND sub.parentId BETWEEN 81 AND 143;

-- ============================================================
-- Step 2: Insert any missing course_tutors entries
-- ============================================================

INSERT IGNORE INTO tutor_marketplace.course_tutors (courseId, tutorId, isPrimary)
SELECT DISTINCT sub.courseId, sub.preferredTutorId, 0
FROM tutor_marketplace.subscriptions sub
LEFT JOIN tutor_marketplace.course_tutors ct
       ON ct.courseId = sub.courseId AND ct.tutorId = sub.preferredTutorId
WHERE sub.parentId BETWEEN 81 AND 143
  AND ct.tutorId IS NULL
  AND sub.preferredTutorId IS NOT NULL;

-- ============================================================
-- Step 3: Verify — should return 0 rows if all fixed
-- ============================================================

SELECT u.email, sub.id AS subscriptionId, sub.courseId, sub.preferredTutorId,
       tu.firstName, tu.lastName
FROM tutor_marketplace.subscriptions sub
INNER JOIN tutor_marketplace.users u  ON u.id  = sub.parentId
INNER JOIN tutor_marketplace.users tu ON tu.id = sub.preferredTutorId
LEFT JOIN  tutor_marketplace.course_tutors ct
        ON ct.courseId = sub.courseId AND ct.tutorId = sub.preferredTutorId
WHERE sub.parentId BETWEEN 81 AND 143
  AND ct.tutorId IS NULL
ORDER BY u.email;
