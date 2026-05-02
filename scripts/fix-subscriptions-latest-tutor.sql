-- ============================================================
-- Fix preferredTutorId on subscriptions for 63 migrated parents
-- based on the LATEST tutor assignment from legacy_staging
-- (rows where status IS NULL AND start_date IS NULL = tutor change records)
--
-- Legacy tutor ID → Platform user ID mapping:
--   91  → 23  (Shriti Sharma)
--   99  → 3   (Sheela Makhadhevan — no platform account)
--   113 → 47  (Maya Balan)
--   190 → 3   (Avani Poddar — no platform account)
--   420 → 53  (Kalyan Gupta)
--   428 → 24  (Apoorva Sisodia)
--   459 → 52  (CVR Sriilalit)
--   478 → 66  (Prasenjit Kumar Mudi)
--   502 → 72  (P. Gopi)
--   607 → 3   (Karthika — no platform account)
--   620 → 76  (Naushad Avadia)
--   729 → 50  (Dolon Mukherjee)
--   752 → 61  (Mustaq)
--   768 → 57  (Sivasankare)
--   774 → 3   (Aditi Sharma — no platform account)
--   777 → 30  (Mercy Rani)
--   843 → 69  (Aishwarya)
--   878 → 71  (Vinayabal Sisodia)
--   900 → 3   (Roshni Athwani — no platform account)
--   100045 → 59 (Nalini Sharma)
--   100046 → 51 (Anita Dominic)
-- ============================================================

-- abishan.ganeshbabu@gmail.com | Abishan | legacy 79 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'abishan.ganeshbabu@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'abishan';

-- amazedsaint@gmail.com | Chinmayi | legacy 26 → tutor 428 (Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 114 AND LOWER(sub.studentFirstName) = 'chinmayi';

-- amazedsaint@gmail.com | Jahnavi | legacy 79 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'jahnavi';

-- amazedsaint@gmail.com | Jahnavi | legacy 80 → tutor 91 (Shriti Sharma) → platform 23
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 23
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'jahnavi';

-- amazedsaint@gmail.com | Chinmayi | legacy 108 → tutor 729 (Dolon Mukherjee) → platform 50
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 50
WHERE sub.courseId = 12 AND LOWER(sub.studentFirstName) = 'chinmayi';

-- amazedsaint@gmail.com | Jahnavi | legacy 108 → tutor 729 (Dolon Mukherjee) → platform 50
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 50
WHERE sub.courseId = 12 AND LOWER(sub.studentFirstName) = 'jahnavi';

-- amazedsaint@gmail.com | Jahnavi | legacy 117 → tutor 729 (Dolon Mukherjee) → platform 50
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'amazedsaint@gmail.com'
SET sub.preferredTutorId = 50
WHERE sub.courseId = 22 AND LOWER(sub.studentFirstName) = 'jahnavi';

-- b.jean9109@gmail.com | Cooper | legacy 5 → tutor 418 → platform 3 (418 not in platform)
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'b.jean9109@gmail.com'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'cooper';

-- b.jean9109@gmail.com | Cooper | legacy 26 → tutor 428 (Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'b.jean9109@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 114 AND LOWER(sub.studentFirstName) = 'cooper';

-- bhavika.ramprakash@gmail.com | Bhavika | legacy 123 → tutor 420 (Kalyan Gupta) → platform 53
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'bhavika.ramprakash@gmail.com'
SET sub.preferredTutorId = 53
WHERE sub.courseId = 82 AND LOWER(sub.studentFirstName) = 'bhavika';

-- deepa.pondicherry@gmail.com | Aaria | legacy 5 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'deepa.pondicherry@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'aaria';

-- deepa.pondicherry@gmail.com | Aaria | legacy 26 → tutor 100045 (Nalini Sharma) → platform 59
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'deepa.pondicherry@gmail.com'
SET sub.preferredTutorId = 59
WHERE sub.courseId = 114 AND LOWER(sub.studentFirstName) = 'aaria';

-- deepsforever@gmail.com | Ananya | legacy 1 → tutor 99 (Sheela) → platform 3
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'deepsforever@gmail.com'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'ananya';

-- deepsforever@gmail.com | Sravya | legacy 80 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'deepsforever@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'sravya';

-- deepsforever@gmail.com | Sravya | legacy 116 → tutor 459 (CVR Sriilalit) → platform 52
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'deepsforever@gmail.com'
SET sub.preferredTutorId = 52
WHERE sub.courseId = 116 AND LOWER(sub.studentFirstName) = 'sravya';

-- itsme.swethu@gmail.com | Vedya | legacy 26 → tutor 428 (Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'itsme.swethu@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 114 AND LOWER(sub.studentFirstName) = 'vedya';

-- jagapathirajup@gmail.com | Srihitha | legacy 79 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'jagapathirajup@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'srihitha';

-- jagapathirajup@gmail.com | Hasini | legacy 79 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'jagapathirajup@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'hasini';

-- jsingh247365@gmail.com | Rajveer | legacy 26 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'jsingh247365@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 114 AND LOWER(sub.studentFirstName) = 'rajveer';

-- jsingh247365@gmail.com | Jaskeerat | legacy 80 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'jsingh247365@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'jaskeerat';

-- kalyani.kankanampati@gmail.com | Aneesh | legacy 5 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'kalyani.kankanampati@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'aneesh';

-- kavitharajiv94@gmail.com | Diya | legacy 61 → tutor 620 (Naushad Avadia) → platform 76
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'kavitharajiv94@gmail.com'
SET sub.preferredTutorId = 76
WHERE sub.courseId = 157 AND LOWER(sub.studentFirstName) = 'diya';

-- krithika1412@gmail.com | Sana | legacy 6 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'krithika1412@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 274 AND LOWER(sub.studentFirstName) = 'sana';

-- krithika1412@gmail.com | Sana | legacy 80 → tutor 91 (Shriti Sharma) → platform 23
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'krithika1412@gmail.com'
SET sub.preferredTutorId = 23
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'sana';

-- lnsgeetha@gmail.com | Naumikaa | legacy 79 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'lnsgeetha@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'naumikaa';

-- mail.rd.in@gmail.com | Ujjaini | legacy 14 → tutor 607 (Karthika) → platform 3
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- mail.rd.in@gmail.com | Arko | legacy 15 → tutor 502 (P. Gopi) → platform 72
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 72
WHERE sub.courseId = 150 AND LOWER(sub.studentFirstName) = 'arko';

-- mail.rd.in@gmail.com | Ujjaini | legacy 15 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 150 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- mail.rd.in@gmail.com | Arko | legacy 17 → tutor 843 (Aishwarya) → platform 69
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 69
WHERE sub.courseId = 139 AND LOWER(sub.studentFirstName) = 'arko';

-- mail.rd.in@gmail.com | Ujjaini | legacy 35 → tutor 459 (CVR Sriilalit) → platform 52
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 52
WHERE sub.courseId = 220 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- mail.rd.in@gmail.com | Arko | legacy 36 → tutor 768 (Sivasankare) → platform 57
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 57
WHERE sub.courseId = 124 AND LOWER(sub.studentFirstName) = 'arko';

-- mail.rd.in@gmail.com | Ujjaini | legacy 37 → tutor 768 (Sivasankare) → platform 57
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 57
WHERE sub.courseId = 154 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- mail.rd.in@gmail.com | Ujjaini | legacy 61 → tutor 459 (CVR Sriilalit) → platform 52
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 52
WHERE sub.courseId = 157 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- mail.rd.in@gmail.com | Ujjaini | legacy 92 → tutor 729 (Dolon Mukherjee) → platform 50
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'mail.rd.in@gmail.com'
SET sub.preferredTutorId = 50
WHERE sub.courseId = 51 AND LOWER(sub.studentFirstName) = 'ujjaini';

-- maruthi.sundaramoorthy@gmail.com | Dhanyasree | legacy 79 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'maruthi.sundaramoorthy@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'dhanyasree';

-- munidinesh@gmail.com | Anvika | legacy 80 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'munidinesh@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'anvika';

-- pgayathiri@gmail.com | Lakshana | legacy 15 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 150 AND LOWER(sub.studentFirstName) = 'lakshana';

-- pgayathiri@gmail.com | Samyutha | legacy 16 → tutor 843 (Aishwarya) → platform 69
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 69
WHERE sub.courseId = 115 AND LOWER(sub.studentFirstName) = 'samyutha';

-- pgayathiri@gmail.com | Samyutha | legacy 17 → tutor 843 (Aishwarya) → platform 69
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 69
WHERE sub.courseId = 139 AND LOWER(sub.studentFirstName) = 'samyutha';

-- pgayathiri@gmail.com | Lakshana | legacy 37 → tutor 768 (Sivasankare) → platform 57
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 57
WHERE sub.courseId = 154 AND LOWER(sub.studentFirstName) = 'lakshana';

-- pgayathiri@gmail.com | Lakshana | legacy 61 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 157 AND LOWER(sub.studentFirstName) = 'lakshana';

-- pgayathiri@gmail.com | Lakshana | legacy 92 → tutor 729 (Dolon Mukherjee) → platform 50
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 50
WHERE sub.courseId = 51 AND LOWER(sub.studentFirstName) = 'lakshana';

-- pgayathiri@gmail.com | Samyutha | legacy 94 → tutor 753 → platform 3 (753 not in our list)
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'pgayathiri@gmail.com'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 276 AND LOWER(sub.studentFirstName) = 'samyutha';

-- raviraju.kalidindi@gmail.com | Saketh | legacy 33 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'raviraju.kalidindi@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 116 AND LOWER(sub.studentFirstName) = 'saketh';

-- rkumarbin@gmail.com | Sanchay | legacy 15 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'rkumarbin@gmail.com'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 150 AND LOWER(sub.studentFirstName) = 'sanchay';

-- rkumarbin@gmail.com | Sanchay | legacy 37 → tutor 420 (Kalyan Gupta) → platform 53
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'rkumarbin@gmail.com'
SET sub.preferredTutorId = 53
WHERE sub.courseId = 154 AND LOWER(sub.studentFirstName) = 'sanchay';

-- rkumarbin@gmail.com | Sanchay | legacy 61 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'rkumarbin@gmail.com'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 157 AND LOWER(sub.studentFirstName) = 'sanchay';

-- sasanakotiusha@gmail.com | Karthikeya | legacy 100 → tutor 752 (Mustaq) → platform 61
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sasanakotiusha@gmail.com'
SET sub.preferredTutorId = 61
WHERE sub.courseId = 92 AND LOWER(sub.studentFirstName) = 'karthikeya';

-- sathishkumarprannesh@gmail.com | Prannesh | legacy 116 → tutor 752 (Mustaq) → platform 61
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sathishkumarprannesh@gmail.com'
SET sub.preferredTutorId = 61
WHERE sub.courseId = 33 AND LOWER(sub.studentFirstName) = 'prannesh';

-- senthil.keel@gmail.com | Samyukthaa | legacy 79 → tutor 100046 (Anita Dominic) → platform 51
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'senthil.keel@gmail.com'
SET sub.preferredTutorId = 51
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'samyukthaa';

-- sw2881984@yahoo.co.in | Lakshmi | legacy 14 → tutor 620 (Naushad Avadia) → platform 76
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 76
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'lakshmi';

-- sw2881984@yahoo.co.in | Nachammai | legacy 15 → tutor 478 (Prasenjit) → platform 66
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 66
WHERE sub.courseId = 150 AND LOWER(sub.studentFirstName) = 'nachammai';

-- sw2881984@yahoo.co.in | Lakshmi | legacy 17 → tutor 843 (Aishwarya) → platform 69
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 69
WHERE sub.courseId = 139 AND LOWER(sub.studentFirstName) = 'lakshmi';

-- sw2881984@yahoo.co.in | Lakshmi | legacy 35 → tutor 774 (Aditi Sharma) → platform 3
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 220 AND LOWER(sub.studentFirstName) = 'lakshmi';

-- sw2881984@yahoo.co.in | Nachammai | legacy 37 → tutor 768 (Sivasankare) → platform 57
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 57
WHERE sub.courseId = 154 AND LOWER(sub.studentFirstName) = 'nachammai';

-- sw2881984@yahoo.co.in | Nachammai | legacy 45 → tutor 774 (Aditi Sharma) → platform 3
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'sw2881984@yahoo.co.in'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 162 AND LOWER(sub.studentFirstName) = 'nachammai';

-- tejarajivreddy@gmail.com | Aryan | legacy 17 → tutor 843 (Aishwarya) → platform 69
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'tejarajivreddy@gmail.com'
SET sub.preferredTutorId = 69
WHERE sub.courseId = 139 AND LOWER(sub.studentFirstName) = 'aryan';

-- thangam.reach@gmail.com | Smita | legacy 25 → tutor 428 (Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'thangam.reach@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 115 AND LOWER(sub.studentFirstName) = 'smita';

-- thangam.reach@gmail.com | Smita | legacy 80 → tutor 777→428 (Mercy→Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'thangam.reach@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 25 AND LOWER(sub.studentFirstName) = 'smita';

-- umamagashwari@gmail.com | Kiruthik | legacy 4 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'umamagashwari@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 1 AND LOWER(sub.studentFirstName) = 'kiruthik';

-- umamagashwari@gmail.com | Vishal | legacy 5 → tutor 900 (Roshni Athwani) → platform 3
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'umamagashwari@gmail.com'
SET sub.preferredTutorId = 3
WHERE sub.courseId = 4 AND LOWER(sub.studentFirstName) = 'vishal';

-- umamagashwari@gmail.com | Vishal | legacy 33 → tutor 428 (Apoorva) → platform 24
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'umamagashwari@gmail.com'
SET sub.preferredTutorId = 24
WHERE sub.courseId = 116 AND LOWER(sub.studentFirstName) = 'vishal';

-- vidyakar5@gmail.com | Aparna | legacy 100 → tutor 113 (Maya Balan) → platform 47
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'vidyakar5@gmail.com'
SET sub.preferredTutorId = 47
WHERE sub.courseId = 92 AND LOWER(sub.studentFirstName) = 'aparna';

-- vidyakar5@gmail.com | Aparna | legacy 101 → tutor 777 (Mercy Rani) → platform 30
UPDATE tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND LOWER(u.email) = 'vidyakar5@gmail.com'
SET sub.preferredTutorId = 30
WHERE sub.courseId = 75 AND LOWER(sub.studentFirstName) = 'aparna';

-- ============================================================
-- DELETE ghost rows (status IS NULL AND startDate IS NULL)
-- these are tutor-change records, not real subscriptions
-- ============================================================
DELETE sub FROM tutor_marketplace.subscriptions sub
JOIN tutor_marketplace.users u ON u.id = sub.parentId AND u.id BETWEEN 81 AND 143
WHERE sub.status IS NULL
AND sub.startDate IS NULL;

-- ============================================================
-- VERIFICATION — should return 0
-- ============================================================
-- SELECT COUNT(*) as null_rows_remaining
-- FROM tutor_marketplace.subscriptions
-- WHERE parentId BETWEEN 81 AND 143
-- AND status IS NULL AND startDate IS NULL;
