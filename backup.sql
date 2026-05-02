-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: tutor-marketplace-db.cluster-c1gyyeezlnjc.us-east-2.rds.amazonaws.com    Database: tutor_marketplace
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `__drizzle_migrations`
--

DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__drizzle_migrations`
--

LOCK TABLES `__drizzle_migrations` WRITE;
/*!40000 ALTER TABLE `__drizzle_migrations` DISABLE KEYS */;
INSERT INTO `__drizzle_migrations` VALUES (1,'79336d91fe066ff5155cc003b67965e9d913cae8264e3bacf14a884295262d13',1770862103720),(2,'684da3938ccf2247d74d7eeee1c12242d3da6800fe3b581cc01a38620f5282cf',1771038457102);
/*!40000 ALTER TABLE `__drizzle_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `acuity_mapping_templates`
--

DROP TABLE IF EXISTS `acuity_mapping_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `acuity_mapping_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `acuityAppointmentTypeId` int NOT NULL,
  `acuityCalendarId` int NOT NULL,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `acuity_mapping_templates_createdBy_users_id_fk` (`createdBy`),
  CONSTRAINT `acuity_mapping_templates_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `acuity_mapping_templates`
--

LOCK TABLES `acuity_mapping_templates` WRITE;
/*!40000 ALTER TABLE `acuity_mapping_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `acuity_mapping_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blog_posts`
--

DROP TABLE IF EXISTS `blog_posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `excerpt` text NOT NULL,
  `content` text NOT NULL,
  `coverImageUrl` text,
  `authorId` int DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `tags` text,
  `readTime` int DEFAULT NULL,
  `isPublished` tinyint(1) NOT NULL DEFAULT '1',
  `publishedAt` timestamp NULL DEFAULT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blog_posts_slug_unique` (`slug`),
  KEY `blog_posts_authorId_users_id_fk` (`authorId`),
  KEY `blog_posts_slug_idx` (`slug`),
  KEY `blog_posts_category_idx` (`category`),
  CONSTRAINT `blog_posts_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog_posts`
--

LOCK TABLES `blog_posts` WRITE;
/*!40000 ALTER TABLE `blog_posts` DISABLE KEYS */;
INSERT INTO `blog_posts` VALUES (1,'How Personalized Tutoring Accelerates Student Success','personalized-tutoring-student-success','Discover how one-on-one tutoring helps students learn faster and build confidence.','Personalized tutoring focuses on a student’s unique learning style, pace, and strengths. Unlike traditional classrooms, tutors adapt lessons in real time, identify gaps early, and reinforce concepts until mastery is achieved. This approach leads to measurable academic improvement and long-term confidence.','https://plus.unsplash.com/premium_photo-1663126612019-97a5146fddb4?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85',NULL,'Education','tutoring,education,students,learning',5,1,'2026-02-15 20:32:58',1,'2026-02-15 20:32:58','2026-02-15 20:35:03'),(2,'Top Study Tips for Middle and High School Students','top-study-tips-middle-high-school','Simple, effective study strategies that actually work for busy students.','Effective studying is not about studying longer, but smarter. Techniques such as active recall, spaced repetition, and focused study sessions help students retain information and reduce stress before exams.','https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1600&q=80',NULL,'Study Tips','study tips,students,school,productivity',4,1,'2026-02-15 20:32:58',2,'2026-02-15 20:32:58','2026-02-15 20:32:58'),(3,'Why Math Confidence Matters More Than Scores','why-math-confidence-matters','Confidence in math directly impacts performance, persistence, and long-term success.','Many students struggle in math not because of lack of ability, but due to fear and self-doubt. Building confidence through guided problem-solving and positive reinforcement leads to better engagement and stronger results over time.','https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1600&q=80',NULL,'Mathematics','math,confidence,education,students',4,1,'2026-02-15 20:32:58',3,'2026-02-15 20:32:58','2026-02-15 20:32:58'),(4,'Online Tutoring vs In-Person Tutoring: What Works Best?','online-vs-inperson-tutoring','A clear comparison of online and in-person tutoring to help parents decide.','Online tutoring offers flexibility, wider tutor access, and convenience, while in-person tutoring provides physical presence and structure. The best choice depends on the student’s learning style, schedule, and academic goals.','https://images.unsplash.com/photo-1584697964403-3c0f0fbdc43a?auto=format&fit=crop&w=1600&q=80',NULL,'Tutoring','online tutoring,in-person tutoring,education',6,1,'2026-02-15 20:32:58',4,'2026-02-15 20:32:58','2026-02-15 20:32:58'),(5,'How Parents Can Support Learning at Home','how-parents-support-learning-at-home','Practical ways parents can help children succeed academically without pressure.','Parents play a crucial role in a child’s education. Creating a supportive environment, encouraging curiosity, and maintaining consistent routines can significantly improve learning outcomes without overwhelming students.','https://images.unsplash.com/photo-1604881988758-f76ad2f7aac1?auto=format&fit=crop&w=1600&q=80',NULL,'Parenting','parents,learning,education,home study',5,1,'2026-02-15 20:32:58',5,'2026-02-15 20:32:58','2026-02-15 20:32:58');
/*!40000 ALTER TABLE `blog_posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parentId` int NOT NULL,
  `tutorId` int NOT NULL,
  `studentId` int DEFAULT NULL,
  `lastMessageAt` bigint DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `conversations_parentId_idx` (`parentId`),
  KEY `conversations_tutorId_idx` (`tutorId`),
  CONSTRAINT `conversations_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
INSERT INTO `conversations` VALUES (1,3,2,1,1771006159495,'2026-02-13 17:45:38','2026-02-13 18:09:19'),(2,5,3,3,1771009844141,'2026-02-13 19:10:35','2026-02-13 19:10:44'),(3,5,2,3,1771083723914,'2026-02-13 19:11:16','2026-02-14 15:42:03'),(4,5,2,4,1771009880945,'2026-02-13 19:11:20','2026-02-13 19:11:20'),(5,5,3,4,1771196193646,'2026-02-13 19:11:22','2026-02-15 22:56:33'),(6,5,3,9,1771016033448,'2026-02-13 20:53:03','2026-02-13 20:53:53'),(7,4,3,2,1771038587481,'2026-02-14 03:09:47','2026-02-14 03:09:47'),(8,4,2,2,1771191873472,'2026-02-14 03:09:48','2026-02-15 21:44:33'),(9,4,3,7,1771038594993,'2026-02-14 03:09:54','2026-02-14 03:09:54');
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_tutors`
--

DROP TABLE IF EXISTS `course_tutors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_tutors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `courseId` int NOT NULL,
  `tutorId` int NOT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `course_tutors_courseId_idx` (`courseId`),
  KEY `course_tutors_tutorId_idx` (`tutorId`),
  KEY `course_tutors_unique` (`courseId`,`tutorId`),
  CONSTRAINT `course_tutors_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `course_tutors_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_tutors`
--

LOCK TABLES `course_tutors` WRITE;
/*!40000 ALTER TABLE `course_tutors` DISABLE KEYS */;
INSERT INTO `course_tutors` VALUES (1,1,2,0,'2026-02-13 17:33:48'),(2,1,3,0,'2026-02-13 18:02:20'),(5,3,3,0,'2026-02-13 21:11:40'),(6,2,3,0,'2026-02-13 21:11:42'),(7,4,3,0,'2026-02-15 23:09:55');
/*!40000 ALTER TABLE `course_tutors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `subject` varchar(100) NOT NULL,
  `gradeLevel` varchar(50) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration` int DEFAULT NULL,
  `sessionsPerWeek` int DEFAULT '1',
  `totalSessions` int DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `imageUrl` text,
  `curriculum` text,
  `acuityAppointmentTypeId` int DEFAULT NULL,
  `acuityCalendarId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `courses_subject_idx` (`subject`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` VALUES (1,'SAT Math Prep','','Mathematics','',1800.00,NULL,1,NULL,1,'','Algebra, Advanced Math , Problem-Solving and Data Analysis and Geometry and Trigonometry Key topics include linear/nonlinear equations, functions, ratios, percentages, statistics, probability, and right triangle trigonometry. ',NULL,NULL,'2026-02-12 19:36:40','2026-02-13 21:01:13'),(2,'Chemistry Fundamentals','Explore atomic structure, chemical reactions, stoichiometry, and more. Perfect preparation for standardized tests.','Other','',349.99,60,2,15,1,'','Explore atomic structure, chemical reactions, stoichiometry, and more. Perfect preparation for standardized tests.',NULL,NULL,'2026-02-13 17:32:48','2026-02-13 17:32:48'),(3,'SAT English Prep','SAT Reading and Writing','English','High School (9-12)',900.00,60,1,20,1,'','Craft and Structure, Information and Ideas, Standard English Conventions, and Expression of Ideas—using short 25–150 word passages.',NULL,NULL,'2026-02-13 20:49:54','2026-02-13 21:01:36'),(4,'Middle School Math - Level I','This course will focus on transitioning students from arithmetic to algebraic thinking, covering ratios, proportional relationships, rational numbers, expressions, equations, and geometry','Mathematics','Middle School (6-8)',240.00,60,1,20,1,'','Ratios, proportional relationships, early algebraic expressions/equations, and number system fluency',NULL,NULL,'2026-02-15 23:07:38','2026-02-15 23:07:38'),(5,'Test Recurring Course','Course for testing recurring bookings','Mathematics',NULL,50.00,60,1,8,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(6,'Calculus 101','No description available','Mathematics',NULL,175.00,60,1,10,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(7,'Advanced Calculus','Comprehensive calculus course','Mathematics','College',299.99,60,2,12,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(8,'Advanced Calculus Mastery','Comprehensive calculus course covering limits, derivatives, integrals, and applications.','Mathematics','High School',399.99,60,2,16,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(9,'Algebra Foundations','Build a solid foundation in algebra with clear explanations and plenty of practice.','Mathematics','Middle School',299.99,45,2,12,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(10,'Reading Comprehension Boost','Develop critical reading skills and analytical thinking.','English','Middle School',279.99,45,2,10,1,NULL,'Module 1: Reading Comprehension (Weeks 1-3)',NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(11,'Essay Writing Excellence','Master the art of persuasive and analytical writing.','English','High School',329.99,60,1,12,1,NULL,'Module 1: Reading Comprehension (Weeks 1-3)',NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(12,'Python Programming for Beginners','Learn Python from scratch with hands-on projects.','Computer Science','High School',499.99,90,2,16,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(13,'Web Development Bootcamp','Master HTML, CSS, JavaScript, and React.','Computer Science','College',599.99,90,2,20,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(14,'Conversational Spanish','Develop fluency through real conversations and cultural immersion.','Spanish','High School',349.99,60,2,16,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(15,'Spanish for Beginners','Start your Spanish journey with grammar, vocabulary, and pronunciation.','Spanish','Middle School',289.99,45,2,12,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19'),(16,'Physics for High Achievers','Master mechanics, electricity, magnetism, and waves.','Physics','High School',449.99,60,2,20,1,NULL,NULL,NULL,NULL,'2026-02-16 00:03:19','2026-02-16 00:03:19');
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_settings`
--

DROP TABLE IF EXISTS `email_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `logoUrl` text,
  `primaryColor` varchar(7) NOT NULL DEFAULT '#667eea',
  `accentColor` varchar(7) NOT NULL DEFAULT '#764ba2',
  `footerText` text NOT NULL,
  `companyName` varchar(255) NOT NULL DEFAULT 'EdKonnect Academy',
  `supportEmail` varchar(320) DEFAULT 'support@edkonnect.com',
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_settings`
--

LOCK TABLES `email_settings` WRITE;
/*!40000 ALTER TABLE `email_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `email_verifications_token_idx` (`tokenHash`),
  KEY `email_verifications_userId_idx` (`userId`),
  CONSTRAINT `email_verifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verifications`
--

LOCK TABLES `email_verifications` WRITE;
/*!40000 ALTER TABLE `email_verifications` DISABLE KEYS */;
INSERT INTO `email_verifications` VALUES (1,2,'775cf88ec7061c6b497075f57e9f8fae3f188be7ed9a445c7846d873fe30adc6','2026-02-13 19:37:42','2026-02-12 19:37:54','2026-02-12 19:37:41'),(2,3,'c4dac037f8709c47eaefbf408895cf3bc935a1697c74856851e51c38a1beafd0','2026-02-13 19:58:56','2026-02-12 19:59:16','2026-02-12 19:58:55'),(3,4,'4669990a89e925e2aaafbe3004d9ce4e171f78c7b2368f8a37e03ff658662ecc','2026-02-14 17:35:18','2026-02-13 17:35:48','2026-02-13 17:35:17'),(4,5,'ece6a25b6c59bb15fad7e420054e4af6b294058dc1a9e3c07251e30d2516d13a','2026-02-14 17:55:40','2026-02-13 17:55:59','2026-02-13 17:55:40');
/*!40000 ALTER TABLE `email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faqs`
--

DROP TABLE IF EXISTS `faqs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faqs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faqs`
--

LOCK TABLES `faqs` WRITE;
/*!40000 ALTER TABLE `faqs` DISABLE KEYS */;
INSERT INTO `faqs` VALUES (1,'How do I get started with a tutor?','Getting started is simple. Create an account, browse available tutors based on subject and grade level, and book a session that fits your schedule.',1,1,'2026-02-15 20:31:09','2026-02-15 20:31:09'),(2,'Are the tutors qualified and verified?','Yes. All tutors go through a verification process that includes academic background checks, subject expertise validation, and interview-based screening.',2,1,'2026-02-15 20:31:09','2026-02-15 20:31:09'),(3,'What grade levels do you support?','We support students from elementary school through high school, covering core subjects like math, science, and coding.',3,1,'2026-02-15 20:31:09','2026-02-15 20:31:09'),(4,'Is online tutoring as effective as in-person tutoring?','Yes. Online tutoring offers flexibility, personalized attention, and access to high-quality tutors regardless of location, making it equally effective for most students.',4,1,'2026-02-15 20:31:09','2026-02-15 20:31:09'),(5,'Can I reschedule or cancel a session?','Sessions can be rescheduled or canceled based on the tutor’s cancellation policy. Details are shown clearly before booking.',5,1,'2026-02-15 20:31:09','2026-02-15 20:31:09');
/*!40000 ALTER TABLE `faqs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `featured_courses`
--

DROP TABLE IF EXISTS `featured_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `featured_courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `icon` varchar(50) DEFAULT NULL,
  `priceFrom` decimal(10,2) NOT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `featured_courses`
--

LOCK TABLES `featured_courses` WRITE;
/*!40000 ALTER TABLE `featured_courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `featured_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `in_app_notifications`
--

DROP TABLE IF EXISTS `in_app_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `in_app_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL,
  `relatedId` int DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `readAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `in_app_notifications_userId_idx` (`userId`),
  KEY `in_app_notifications_isRead_idx` (`isRead`),
  CONSTRAINT `in_app_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `in_app_notifications`
--

LOCK TABLES `in_app_notifications` WRITE;
/*!40000 ALTER TABLE `in_app_notifications` DISABLE KEYS */;
INSERT INTO `in_app_notifications` VALUES (1,2,'New message','Arunn Sivaan messaged you about Ashwin Sivaan','message',1,0,'2026-02-13 17:45:50',NULL),(2,3,'New message','Gitesh Sagvekar messaged you about Ashwin Sivaan','message',1,0,'2026-02-13 18:09:19',NULL),(3,5,'New message','Arunn Sivaan messaged you about John  Matt','message',2,1,'2026-02-13 19:10:44','2026-02-13 19:13:44'),(4,3,'New message','Prem Kumar messaged you about John  Matt','message',6,0,'2026-02-13 20:53:53',NULL),(5,5,'New message','Gitesh Sagvekar messaged you about John  Matt','message',3,1,'2026-02-14 03:06:54','2026-02-14 13:03:11'),(6,2,'New message','Gitesh Sagvekar messaged you about Akshay S','message',8,0,'2026-02-14 03:37:37',NULL),(7,2,'New message','Prem Kumar messaged you about John  Matt','message',3,0,'2026-02-14 12:59:25',NULL),(8,5,'New message','Gitesh Sagvekar messaged you about John  Matt','message',3,0,'2026-02-14 15:42:03',NULL),(9,4,'New message','Gitesh Sagvekar messaged you about Akshay S','message',8,1,'2026-02-14 15:43:51','2026-02-14 16:01:59'),(10,4,'New message','Gitesh Sagvekar messaged you about Akshay S','message',8,1,'2026-02-14 16:01:26','2026-02-14 16:01:58'),(11,4,'New message','Gitesh Sagvekar messaged you about Akshay S','message',8,1,'2026-02-15 21:43:57','2026-02-15 21:45:31'),(12,2,'New message','Gitesh Sagvekar messaged you about Akshay S','message',8,0,'2026-02-15 21:44:33',NULL),(13,5,'New message','Arunn Sivaan messaged you about Anjali Sivaaa','message',5,0,'2026-02-15 22:56:33',NULL);
/*!40000 ALTER TABLE `in_app_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversationId` int NOT NULL,
  `senderId` int NOT NULL,
  `content` text NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `sentAt` bigint NOT NULL,
  `fileUrl` mediumtext,
  `fileName` varchar(255) DEFAULT NULL,
  `fileType` varchar(100) DEFAULT NULL,
  `fileSize` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `messages_conversationId_idx` (`conversationId`),
  KEY `messages_senderId_idx` (`senderId`),
  CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,1,3,'Hello this is a text message',1,1771004750364,NULL,NULL,NULL,NULL,'2026-02-13 17:45:50'),(2,1,2,'Hey how\'s it going',0,1771006159495,NULL,NULL,NULL,NULL,'2026-02-13 18:09:19'),(3,2,3,'Hello',1,1771009844141,NULL,NULL,NULL,NULL,'2026-02-13 19:10:44'),(4,6,5,'Hi John, I  here am attaching some curriculum details',1,1771016033448,NULL,NULL,NULL,NULL,'2026-02-13 20:53:53'),(5,3,2,'Sent a file',1,1771038414200,'data:application/pdf;base64,JVBERi0xLjMKJf////8KNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDU5NS4yOCA4NDEuODldCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDYgMCBSCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjIgOCAwIFIKL0YxIDkgMCBSCj4+Ci9Db2xvclNwYWNlIDw8Cj4+Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNTg4Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nJ1VXYvbMBB896/QHzidtKtdSRDycPQD+tY2b6UPF58DhaZQDtq/31krTnJxKIkJdsxG0cyOZsfR','SAT_Math_Prep_Curriculum.pdf','application/pdf',1885,'2026-02-14 03:06:54'),(6,8,4,'hey',1,1771040257845,NULL,NULL,NULL,NULL,'2026-02-14 03:37:37'),(7,3,5,'Thank you for sharing the curriculum. I\'ve a few questions on this work.',1,1771073965435,'data:application/pdf;base64,JVBERi0xLjMKJf////8KNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDU5NS4yOCA4NDEuODldCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDYgMCBSCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjIgOCAwIFIKL0YxIDkgMCBSCj4+Ci9Db2xvclNwYWNlIDw8Cj4+Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNzAzCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nJ1Wy27jRhC88yvmBzzbz+oZQOBhkU2A3JLoFuSwpkkgQBxgsUDy+0GTkkVbQmDrokOTmqqu7qohFypUHrhQaca19TI9D98GvlX+fDzVuXDrlRVEKBFW4a0cn4dPP0oRK8dl+P1giiU8ZCzs5RAKFzLNSgg6NBxTOJ7GQn+U48/Dl+PwyzuARaKiywqsqCzYgJPSBuxqPBYWKgc3IXPMCEzooWhCTiHwoCvcfwenwm61ozwPDKri3ruea38Nv72LoVNBa9XYzpKw/I8kHTMwlqSLJQRP4DB0LJg/KE0Co1XTF0XorEg4BF/h0DD9Ouarh7fS3IHmqC3eolmsHWY/DFt7nOBjUSqHyE69HOCYdjwaOmIdjkLRsGDBJCRNuzwpq0i/g515Vb5i1zGHhiXHh3UMqygp/VgekuOFl6c+j5ixnCYWd81EtYZfzYReGKQb4BdYMe1KSjLn7x2AIpX79RLAQ0O31RIyO63iOqjzyl1YKJSE8ISeTedb4WF5xh2MmCpurOWeUWh6c0OHhwiNxdLDsa0OHI7HHT/+OA/vvdLVwrqd4gJLGDg37y21HazcGMkaHZI5aBkdjorOvdu59oHocLQaeiM6rpMzZwhfKXdM98zFrd1YTdOdgREmBMYMS1mujJO00t1ZkemSZ3rKs7E8rIbfxdrlPOsZEODkfj4gMbbn4BDcSPCM0dxJeR0o8/n8/WkvSB4ttuTfeQALsGfRI3x9OiPkDue5xg3nxRppqxS50CmoinqHsnqaLOIk97I1HJRkQsGIzXBrO6+z59MP8z9/TvOvP30u0/eBqhN3UDRT1hD38r7S9+nv99y66lUaEVlx0trt5dZt59DPCeB1ong2AzlNqq+TNHvcfJ0TyH/kEgkZQ7frIr8I1vX6aORL9NqsFetW0dsbgiqyKKvKkg5WUbw6/j+Y798FCmVuZHN0cmVhbQplbmRvYmoKMTEgMCBvYmoKKFBERktpdCkKZW5kb2JqCjEyIDAgb2JqCihQREZLaXQpCmVuZG9iagoxMyAwIG9iagooRDoyMDI2MDIxMzIxMDgyM1opCmVuZG9iagoxMCAwIG9iago8PAovUHJvZHVjZXIgMTEgMCBSCi9DcmVhdG9yIDEyIDAgUgovQ3JlYXRpb25EYXRlIDEzIDAgUgo+PgplbmRvYmoKOSAwIG9iago8PAovVHlwZSAvRm9udAovQmFzZUZvbnQgL0hlbHZldGljYQovU3VidHlwZSAvVHlwZTEKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKPj4KZW5kb2JqCjggMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZAovU3VidHlwZSAvVHlwZTEKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKPj4KZW5kb2JqCjQgMCBvYmoKPDwKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCi9OYW1lcyAyIDAgUgo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzcgMCBSXQo+PgplbmRvYmoKMiAwIG9iago8PAovRGVzdHMgPDwKICAvTmFtZXMgWwpdCj4+Cj4+CmVuZG9iagp4cmVmCjAgMTQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAxNDYxIDAwMDAwIG4gCjAwMDAwMDE1MTggMDAwMDAgbiAKMDAwMDAwMTM5OSAwMDAwMCBuIAowMDAwMDAxMzc4IDAwMDAwIG4gCjAwMDAwMDAyNDIgMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDEyNzYgMDAwMDAgbiAKMDAwMDAwMTE3OSAwMDAwMCBuIAowMDAwMDAxMTAzIDAwMDAwIG4gCjAwMDAwMDEwMTcgMDAwMDAgbiAKMDAwMDAwMTA0MiAwMDAwMCBuIAowMDAwMDAxMDY3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgMTQKL1Jvb3QgMyAwIFIKL0luZm8gMTAgMCBSCi9JRCBbPDYxZmRkNDA1OGI5N2NjOTU3OWU3NDk2ZTcwOTFkZmY5PiA8NjFmZGQ0MDU4Yjk3Y2M5NTc5ZTc0OTZlNzA5MWRmZjk+XQo+PgpzdGFydHhyZWYKMTU2NQolJUVPRgo=','SAT_English_Prep_Curriculum.pdf','application/pdf',2000,'2026-02-14 12:59:25'),(8,3,2,'Hi',1,1771083723914,NULL,NULL,NULL,NULL,'2026-02-14 15:42:03'),(9,8,2,'Hi',1,1771083831883,NULL,NULL,NULL,NULL,'2026-02-14 15:43:51'),(10,8,2,'Hi',1,1771084886705,NULL,NULL,NULL,NULL,'2026-02-14 16:01:26'),(11,8,2,'Hey How is it going?',1,1771191837388,NULL,NULL,NULL,NULL,'2026-02-15 21:43:57'),(12,8,4,'not bad',1,1771191873472,NULL,NULL,NULL,NULL,'2026-02-15 21:44:33'),(13,5,3,'Hi Anjali, as discussed here is your additional homework you requsted,if you have any questions, you can message me',1,1771196193646,'data:application/pdf;base64,JVBERi0xLjMKJf////8KNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDU5NS4yOCA4NDEuODldCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDYgMCBSCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjIgOCAwIFIKL0YxIDkgMCBSCj4+Ci9Db2xvclNwYWNlIDw8Cj4+Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNTg4Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nJ1VXYvbMBB896/QHzidtKtdSRDycPQD+tY2b6UPF58DhaZQDtq/31krTnJxKIkJdsxG0cyOZsfR','SAT_Math_Prep_Curriculum.pdf','application/pdf',354,'2026-02-15 22:56:33');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_logs`
--

DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `sessionId` int NOT NULL,
  `channel` varchar(20) NOT NULL,
  `timing` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `message` text,
  `sentAt` timestamp NOT NULL DEFAULT (now()),
  `readAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notification_logs_userId_idx` (`userId`),
  KEY `notification_logs_sessionId_idx` (`sessionId`),
  CONSTRAINT `notification_logs_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_logs`
--

LOCK TABLES `notification_logs` WRITE;
/*!40000 ALTER TABLE `notification_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `emailEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `inAppEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `smsEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `timing24h` tinyint(1) NOT NULL DEFAULT '1',
  `timing1h` tinyint(1) NOT NULL DEFAULT '0',
  `timing15min` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_preferences_userId_unique` (`userId`),
  KEY `notification_preferences_userId_idx` (`userId`),
  CONSTRAINT `notification_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_preferences`
--

LOCK TABLES `notification_preferences` WRITE;
/*!40000 ALTER TABLE `notification_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parent_profiles`
--

DROP TABLE IF EXISTS `parent_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parent_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `childrenInfo` text,
  `preferences` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `parent_profiles_userId_idx` (`userId`),
  CONSTRAINT `parent_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parent_profiles`
--

LOCK TABLES `parent_profiles` WRITE;
/*!40000 ALTER TABLE `parent_profiles` DISABLE KEYS */;
INSERT INTO `parent_profiles` VALUES (1,2,NULL,NULL,'2026-02-12 19:37:43','2026-02-12 19:37:43'),(2,3,NULL,NULL,'2026-02-12 19:58:57','2026-02-12 19:58:57'),(3,4,NULL,NULL,'2026-02-13 17:35:19','2026-02-13 17:35:19'),(4,5,NULL,NULL,'2026-02-13 17:55:41','2026-02-13 17:55:41');
/*!40000 ALTER TABLE `parent_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parentId` int NOT NULL,
  `tutorId` int NOT NULL,
  `subscriptionId` int DEFAULT NULL,
  `sessionId` int DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'usd',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `paymentType` enum('subscription','session') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payments_subscriptionId_subscriptions_id_fk` (`subscriptionId`),
  KEY `payments_sessionId_sessions_id_fk` (`sessionId`),
  KEY `payments_parentId_idx` (`parentId`),
  KEY `payments_tutorId_idx` (`tutorId`),
  CONSTRAINT `payments_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,4,2,2,NULL,1800.00,'usd','completed',NULL,'subscription','2026-02-13 17:37:02','2026-02-13 17:37:02'),(2,4,2,7,NULL,1800.00,'usd','completed',NULL,'subscription','2026-02-13 19:00:08','2026-02-13 19:00:08'),(3,4,2,8,NULL,1800.00,'usd','completed',NULL,'subscription','2026-02-13 19:02:05','2026-02-13 19:02:05');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_stats`
--

DROP TABLE IF EXISTS `platform_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(100) NOT NULL,
  `value` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_stats`
--

LOCK TABLES `platform_stats` WRITE;
/*!40000 ALTER TABLE `platform_stats` DISABLE KEYS */;
INSERT INTO `platform_stats` VALUES (1,'Hours Learned','100K+','100K+',1,1,'2026-02-15 20:22:18','2026-02-15 20:22:18'),(2,'Highest SAT Score','1600','1600',2,1,'2026-02-15 20:22:18','2026-02-15 20:22:18'),(3,'Yearly Savings','$2,000','$2,000',3,1,'2026-02-15 20:22:18','2026-02-15 20:22:18'),(4,'Expert Tutors','250+','250+',4,1,'2026-02-15 20:22:18','2026-02-15 20:22:18');
/*!40000 ALTER TABLE `platform_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `refresh_tokens_userId_idx` (`userId`),
  CONSTRAINT `refresh_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=239 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (1,1,'f650df4e29d67f34cdb552e5c003b5320111a1f1380b8b580e0b5cb61ef83a9f','2026-02-19 19:12:46','2026-02-12 19:35:19','2026-02-12 19:12:46'),(2,1,'de886d34cd338c867b95b3716c97b523e63796b8bb554e505ab275074b3fb222','2026-02-19 19:35:19',NULL,'2026-02-12 19:35:18'),(3,1,'0c33f41fe780f54b214473607d44ae65685512958d117e02fb5f2f8c91c8dc0c','2026-02-19 19:36:12',NULL,'2026-02-12 19:36:11'),(4,2,'fbb3ec352e7778bab741f875b87aa130f62688cecc51c29169f7d9cdcce2f6e9','2026-02-19 19:38:05','2026-02-13 15:07:17','2026-02-12 19:38:05'),(5,2,'4180c9bc2fbcb113b36dc2e2d0d4c46eb2ddcdaa96381ab67978b087b359dace','2026-02-19 19:41:11',NULL,'2026-02-12 19:41:10'),(6,1,'99f24d701ee96983d216fdaf4e4216f0cce151ab152e3cac4ef2577ef6c4b9d1','2026-02-19 19:41:48',NULL,'2026-02-12 19:41:47'),(7,1,'168f9d3043d36db1fdc5d157e8535036803f34d1751b9ee5caa367d1af805631','2026-02-19 19:53:50','2026-02-13 16:18:20','2026-02-12 19:53:49'),(8,1,'9fa083cbccc1d9964f9bc62a5c8f999e41217fba304562e93764dc9474b4600a','2026-02-19 19:56:16',NULL,'2026-02-12 19:56:16'),(9,3,'fd59abc718698151c9cafb1314e81d192f3a1758905364baacf4904921756e8e','2026-02-19 19:59:26','2026-02-12 20:20:52','2026-02-12 19:59:26'),(10,2,'499349edd0f81264c5f41255209172aa4fa1fc9c52226893531e1f39d6903e42','2026-02-19 20:05:46',NULL,'2026-02-12 20:05:45'),(11,2,'5fa747002461161da79b2483f93932cef3351175e8f24593b7f59b33148f4bac','2026-02-19 20:06:21',NULL,'2026-02-12 20:06:21'),(12,1,'3fda6ffa69f59816a0654bcfc70ddf1b7860f33bdfced2b5b3b3b028f189da32','2026-02-19 20:08:22','2026-02-12 20:26:57','2026-02-12 20:08:22'),(13,3,'ed60e2264ad39d1517b01542273d18f9be2daf12cf0094f7f3c2aaf8d5de0c01','2026-02-19 20:20:52',NULL,'2026-02-12 20:20:52'),(14,3,'b6e4c7fcc426cb06c719076041975dea41acec818de703559e2eebc4570ea419','2026-02-19 20:21:15','2026-02-12 21:08:10','2026-02-12 20:21:15'),(15,1,'b8333e73bbf39be599b7ef3476b71265dd68697ce1d2130ad5cef4c715c34256','2026-02-19 20:26:57','2026-02-12 21:13:19','2026-02-12 20:26:57'),(16,3,'a64cd88c252c73120af269d4edf39276659bedb54e47ae03b645484548eefa3f','2026-02-19 21:08:10',NULL,'2026-02-12 21:08:10'),(17,1,'e4a018d8111c41a2327ccb014fc8df8c740c2d91f529795839d5863cca1c5394','2026-02-19 21:13:19','2026-02-13 17:38:58','2026-02-12 21:13:19'),(18,2,'8721071779661f022dc8c3059af1cdf11fb33500a2187ab389a8144ef2a02ae6','2026-02-19 21:16:27',NULL,'2026-02-12 21:16:26'),(19,3,'0a4c31c7ff6900b95d2457845e25d5723e16c69abe4885734037b0fcc57cc7c2','2026-02-19 22:10:47','2026-02-13 02:31:45','2026-02-12 22:10:47'),(20,3,'b1a47c74fe8fcc66f23a5c6015c2a77f932496ca5469c6cc9e4b40c8c2ffda84','2026-02-20 02:31:45','2026-02-13 11:32:41','2026-02-13 02:31:45'),(21,3,'dfa0357e695cafeb4e803a7e73d7b358eba32b609425846abfe1a5759c595838','2026-02-20 03:35:55','2026-02-13 03:55:32','2026-02-13 03:35:55'),(22,3,'8c6b8f654b89bfa2d6601c78e54315bab7b5f44a8db0b382e7f0ab49f4e13afd','2026-02-20 03:55:32','2026-02-15 22:55:17','2026-02-13 03:55:31'),(23,3,'28e72ca2078896d47102d625f236e8ac81dffc5a3519e0fe1c62bbd3f37f7e35','2026-02-20 11:32:41',NULL,'2026-02-13 11:32:40'),(24,2,'8b533543f1de53880f376255ffbb3ae79b0fe31c5bb34b990082f0cd129658f8','2026-02-20 15:07:17','2026-02-13 16:44:06','2026-02-13 15:07:17'),(25,1,'1e40ba6a06254510baccf10ea0c53383fcddf68962f09fc4d09213c1283c9198','2026-02-20 16:18:20',NULL,'2026-02-13 16:18:19'),(26,2,'a7c58891eb67c4dbed21515ac8f7750d80afb95884154c4a29ee9aa2e2963072','2026-02-20 16:44:06','2026-02-13 17:07:43','2026-02-13 16:44:06'),(27,2,'145b275c4cbda9fef8a0ea5378e697cddf28090912661a94909f9192460a53ca','2026-02-20 17:07:43',NULL,'2026-02-13 17:07:42'),(28,1,'beae1eb8b00fc93d7c3d0f6e5ae48712094a96b4afc8d9adcc232ab099d48459','2026-02-20 17:08:45',NULL,'2026-02-13 17:08:45'),(29,2,'ddeb94526af4cad20f0f638c95b89ad311569eb692fde9cd7e7051b915f10337','2026-02-20 17:10:50',NULL,'2026-02-13 17:10:50'),(30,1,'c35079be20204187276798e70bd870b9f8b9f9c5c72643ba625ae354199acacd','2026-02-20 17:11:21','2026-02-13 17:23:50','2026-02-13 17:11:20'),(31,1,'1ebf6b1ac9b882f8525b24fe5bafb8f4f8a0522c4fee0842db720640ffeb18b4','2026-02-20 17:23:50',NULL,'2026-02-13 17:23:49'),(32,2,'f8a2e86156edb6263c02fc8998f7272457049381a3a10c9b360eff13886e9257','2026-02-20 17:29:20',NULL,'2026-02-13 17:29:20'),(33,1,'812dc5780ad3f51cc7b6e95231a0d3058dd7c2592f99d3f8409343ff078eba29','2026-02-20 17:29:41','2026-02-13 17:46:59','2026-02-13 17:29:40'),(34,2,'018e6116f36312e3271350592124e41048fa25ad08ca6778816df806ae9fee33','2026-02-20 17:33:12','2026-02-13 17:48:20','2026-02-13 17:33:12'),(35,4,'16086c28ea40f862c02c49dc1ee705154a4c5a10a99a0ce65745416b4af0b42d','2026-02-20 17:36:08','2026-02-13 17:56:29','2026-02-13 17:36:08'),(36,1,'938a6cf55d34633b111808690cb99bd8bceaf6173bd3f05c3946da1f684abc8e','2026-02-20 17:38:58',NULL,'2026-02-13 17:38:57'),(37,2,'ec4f3975eb7073f0b3348d5844744352d4f1b9739e2636ae2b35294a30eafde0','2026-02-20 17:39:08','2026-02-15 02:12:11','2026-02-13 17:39:07'),(38,3,'cf32ae1a0931dcd8131c485dc6bc1a65f5064cf92a1d47192aaabba4abbdc087','2026-02-20 17:43:29',NULL,'2026-02-13 17:43:29'),(39,1,'e6fe6395d3a546f51cf8ec040e8dcfc0d7caf994c6d5aac0b23ba1af8ee7453b','2026-02-20 17:46:59','2026-02-13 18:07:04','2026-02-13 17:46:58'),(40,2,'3f160cb9d473ab7e94939b765f58325565d206aec6ba6642fa0ec2b6a03b550e','2026-02-20 17:48:20','2026-02-13 18:03:33','2026-02-13 17:48:19'),(41,3,'7a36edd1d8de78fffec5a0ae0da12dbc58bdf19a6db2aea57a2c9ab49ba0418e','2026-02-20 17:49:51',NULL,'2026-02-13 17:49:50'),(42,1,'509937a884f62df3ff076f463c3b1412d976cb7b8327d5c65ae877e60ccbf703','2026-02-20 17:52:12',NULL,'2026-02-13 17:52:12'),(43,3,'1551a8860d7905544ca32ed3246d8e23c499f32f58041667cc023313b85425d1','2026-02-20 17:53:57',NULL,'2026-02-13 17:53:57'),(44,3,'40a7725c343212a04327330e2ceab2a41f3b8655e035996565305ffecc71d481','2026-02-20 17:54:21',NULL,'2026-02-13 17:54:21'),(45,5,'7d4cafb9685445d5be41a5cc6e2d8e9a774e5f1a80887a4974bfcd2b193f43b1','2026-02-20 17:56:04',NULL,'2026-02-13 17:56:04'),(46,4,'66b2e713fb988b1fd9633364a0ed83efa3c7e9260b533323028f534ff4eb8bc3','2026-02-20 17:56:29',NULL,'2026-02-13 17:56:28'),(47,4,'27aab9f482484beb5f13baf0af4f1689fb4fcaa25f828d594ff4b5eb5c4d83b9','2026-02-20 17:56:35','2026-02-13 18:12:01','2026-02-13 17:56:34'),(48,3,'9ce39356df6ed1911ce515b38bdc1780a815d0330cf1e4b72a9c491a09a38e5e','2026-02-20 18:00:21',NULL,'2026-02-13 18:00:20'),(49,5,'2066f70236e383bdd4679b919452c39c52a0167c7a287bf0e4e491fca3ac05ca','2026-02-20 18:00:54',NULL,'2026-02-13 18:00:54'),(50,1,'56a91e60c980e8b811bd704c3d8a36d97fb485cac4c5d1902a708da603911e22','2026-02-20 18:01:56',NULL,'2026-02-13 18:01:55'),(51,5,'8c3fb69df438057ad48d7f728815b69639dc40305489e9e62d83276f4805634a','2026-02-20 18:03:10','2026-02-13 19:08:53','2026-02-13 18:03:09'),(52,2,'ef03c89eee7751b423e492d81b73fa513ad8dc4b208bfa2e6eabc13d1a46090f','2026-02-20 18:03:33','2026-02-13 18:18:40','2026-02-13 18:03:32'),(53,1,'53bcb2ef143494e43027d5ce7f3bb55f4bcaa2a7d877b6b81bbc33a9b1ce8f43','2026-02-20 18:07:04',NULL,'2026-02-13 18:07:04'),(54,1,'ea710a829124d5eaf933f291c45bf30613c42a52a0d926f10935af5bd54fb1db','2026-02-20 18:10:49','2026-02-13 18:51:33','2026-02-13 18:10:48'),(55,4,'0a7cbb541d901f6fc4d8ef4c81f33270a6d6c2737c3774ece4466ed5897b214c','2026-02-20 18:12:01',NULL,'2026-02-13 18:12:01'),(56,4,'cba62302f5e36fbeaa5ba70da1dda42d8a298eda8439c079e279a43d8db4d82b','2026-02-20 18:12:06','2026-02-13 18:48:48','2026-02-13 18:12:06'),(57,2,'f8a355dbe0cc72cb1ab8ca7d647cd352e72f65e3df7c27df9fa30280740c63b4','2026-02-20 18:18:40','2026-02-13 18:33:53','2026-02-13 18:18:39'),(58,2,'34374e4dec0765e880c4d3adbd5c9492ab26dc7afafe1d10b81f58af42c82273','2026-02-20 18:33:53','2026-02-13 18:49:07','2026-02-13 18:33:52'),(59,4,'39c32ca8559bae2c7ab11b2e6a2990ee9d2c3fa2f14449d8b06da5dcfbcc02e7','2026-02-20 18:48:48',NULL,'2026-02-13 18:48:48'),(60,4,'9ecd5c307d4a12979ed8387f485276455d643ad34c957175e6c35a4360fa799f','2026-02-20 18:48:56','2026-02-13 19:59:24','2026-02-13 18:48:56'),(61,2,'2b85a2da5480e083e6e2deba893de296f25a0f85d1624e46611ea48e3f2052c5','2026-02-20 18:49:07',NULL,'2026-02-13 18:49:06'),(62,2,'e50a0dfb2cc16cbefb9ba8f7d65e76c810a285c351fd2e7c3fa92f2480c404ce','2026-02-20 18:49:39','2026-02-13 19:04:46','2026-02-13 18:49:39'),(63,1,'a9f2133f1c3a7dedd6f5982abfb492ae0eba4c4f2e6d914a9c37618948a715a6','2026-02-20 18:51:33',NULL,'2026-02-13 18:51:33'),(64,1,'07f793b7f076124db04ac4f6edb0ee8991b01678276bd9b77bac5965522d09ae','2026-02-20 18:51:45','2026-02-13 19:12:51','2026-02-13 18:51:45'),(65,2,'f8fc24e4bae89e130b91815036db6cd727a76f7016040af4442b725f07666bef','2026-02-20 19:04:46',NULL,'2026-02-13 19:04:46'),(66,5,'f7285f529f6a63e86b0c08f5098e84bd85809b668bdbe8a11cfa667380d1e5a4','2026-02-20 19:08:53',NULL,'2026-02-13 19:08:52'),(67,3,'95278ca539c6a68c5c0542585f0f275d625cbad34c4604eba96a70d2e570dc74','2026-02-20 19:09:00',NULL,'2026-02-13 19:09:00'),(68,4,'800df0118cab0377e397e9996356138e1638a30a305878c121061d8f3b9ea235','2026-02-20 19:09:11','2026-02-13 19:24:25','2026-02-13 19:09:11'),(69,5,'e9bb542b4c04ffd6d99c95494feb8ade5461a3731906896829076d458fc0859a','2026-02-20 19:11:07',NULL,'2026-02-13 19:11:07'),(70,1,'fc1c7fd54d09187cbe25878017228832a8736f9767a042816ce8926c98f00b4b','2026-02-20 19:12:51',NULL,'2026-02-13 19:12:50'),(71,4,'aae6e5405e7009ad76a5f2c4ef89a37b9c9a432afbae2f1250d1166806693cbf','2026-02-20 19:24:25','2026-02-13 19:39:38','2026-02-13 19:24:24'),(72,4,'1205d99eb20213a81ab0c684345aa6d9191ef0d4b98357e409a2ed60da418c15','2026-02-20 19:39:38','2026-02-13 19:54:51','2026-02-13 19:39:37'),(73,4,'f45473a1b13be8eb5d9e328f3240c24220fc8a4929f737a22912062c60372bba','2026-02-20 19:54:51','2026-02-13 21:06:26','2026-02-13 19:54:51'),(74,4,'d91ad5e305f863b3df63fb585818ccf2ad019f985493e399cc70b24c31e3f05d','2026-02-20 19:59:24',NULL,'2026-02-13 19:59:23'),(75,4,'e5ec1e2a108b737206a2c7399c135806361cd65cdd68d3462d5147cd95d6f1d9','2026-02-20 19:59:29','2026-02-13 20:58:51','2026-02-13 19:59:28'),(76,3,'9a3385f319508b68ee9ee566f438df386a44fccf42a8716f4d044bca3244025b','2026-02-20 20:26:32',NULL,'2026-02-13 20:26:32'),(77,5,'ba128a14170902b46c0ada6a9ba5921d4dfd3c6fb7e79f966da24aaa50e31551','2026-02-20 20:41:17',NULL,'2026-02-13 20:41:17'),(78,3,'da78170d563db858c33402f5908a110df12c2d3e23291981504c20c46c0b3613','2026-02-20 20:42:08',NULL,'2026-02-13 20:42:07'),(79,3,'56017e920f630b713c15f86832f2340a699906e39e3b5f1230841b3986c703b7','2026-02-20 20:43:08',NULL,'2026-02-13 20:43:08'),(80,5,'fd7f138ccfa5c87eaecffbc8b1d1f205572412d59788c90c9709e086d998f3e6','2026-02-20 20:43:26',NULL,'2026-02-13 20:43:25'),(81,1,'7425051209f62d1ad3dba3156c33e20dfc1f908591e7b72441f661120917239c','2026-02-20 20:48:40',NULL,'2026-02-13 20:48:40'),(82,5,'1f196ff8959090554ed40e585716a46ba5b864ba1325b158525b803162e0e32a','2026-02-20 20:50:38',NULL,'2026-02-13 20:50:37'),(83,3,'38b94a4bf13c0c7e0f24c98254aedd05a1f9a161231305a5c09a0387e3de1591','2026-02-20 20:54:27',NULL,'2026-02-13 20:54:26'),(84,4,'ac1d331af798a5ff8799f02b22a04c20d414dd852d7da35500069658d2ed299b','2026-02-20 20:58:51',NULL,'2026-02-13 20:58:50'),(85,1,'27a5de042ede4212c725d6dd5f139ad9e0813bbab01ff8f0338b639eb3f783e0','2026-02-20 20:59:26',NULL,'2026-02-13 20:59:26'),(86,3,'50a00a7e483e2ddd94ca93b844de40ae4c5b2ec72054d724e9ac96e324616de6','2026-02-20 21:02:16',NULL,'2026-02-13 21:02:16'),(87,5,'7ffc038351c22be70e57ea255059400f3a710f2ce9031d955060d3c60193675e','2026-02-20 21:03:53',NULL,'2026-02-13 21:03:52'),(88,4,'e7ded7fcd955c36e6cd0fd6680a48604e33dcab82deb32842c76eca3c4ae5393','2026-02-20 21:06:26',NULL,'2026-02-13 21:06:25'),(89,1,'dae8187e8fd5c35d4952181a5bc4af8792f7da019aa807fa24af31a36babe4f0','2026-02-20 21:06:39','2026-02-14 01:33:56','2026-02-13 21:06:39'),(90,1,'0a0dea7eeeb796e51b9e35e0a838df5e59e56badd8c0c34022ccb8421a0f9f7b','2026-02-20 21:09:18',NULL,'2026-02-13 21:09:17'),(91,5,'9d2bd3f46843b0d682bcdd154ac766033f9a9236a6644daaff6f879c7e14a471','2026-02-20 21:11:58','2026-02-14 02:16:45','2026-02-13 21:11:58'),(92,5,'0b73521ec48032b497021329653f1ab7145fd65ac64a9eb54dc00a9593116bed','2026-02-20 23:18:34','2026-02-14 00:18:50','2026-02-13 23:18:34'),(93,5,'5a66065067f2de43749e224d37bf23ed526a6d51d425635bbfe2e84e71eb9fdb','2026-02-21 00:18:50',NULL,'2026-02-14 00:18:50'),(94,2,'ded3b5283226fff9c279e8a2b81f43ace822bf888dc611a8bfdd3af10b553fc0','2026-02-21 01:29:01','2026-02-14 01:44:08','2026-02-14 01:29:00'),(95,1,'12b4dd5f88256ec6868bcbbef06b11254df150bcef3665c7bfca3373d74544ea','2026-02-21 01:33:56',NULL,'2026-02-14 01:33:56'),(96,1,'592c29d886b831ff2bedc7d569e0ff7e0fb7c01526a89dee3fb640c459601faa','2026-02-21 01:35:08','2026-02-14 03:37:51','2026-02-14 01:35:08'),(97,2,'9e42fb5a130c8f9888c612b73fa39aa20f2ca10a174877da21b42011e7fcce4e','2026-02-21 01:44:08','2026-02-14 01:59:21','2026-02-14 01:44:07'),(98,2,'96004e9be8a0b8d2aeb46f090b9b005e5d43ade91dc7e3ceba2dd9a751d29f9e','2026-02-21 01:59:21','2026-02-14 02:14:35','2026-02-14 01:59:21'),(99,2,'c18b3c57dab2ac84c2b1916ab9b9876e5b420f975a453d99512fa9941d7a2fc0','2026-02-21 02:14:35','2026-02-14 02:29:48','2026-02-14 02:14:34'),(100,5,'f227188b5c80cdcbdbb182add24c04ba4866528d86fffac24dae3789d26791ac','2026-02-21 02:16:45','2026-02-14 05:04:16','2026-02-14 02:16:44'),(101,2,'dc8537c3ed1b9ce479195f79145e5877c345e88337fb4cd9865ebd7d5d5937d6','2026-02-21 02:29:48','2026-02-14 02:45:02','2026-02-14 02:29:47'),(102,2,'e2d054de0e358294d2cb410d579f403ae5f99816a3bf715e3e3584e1a2e2cfcd','2026-02-21 02:45:02','2026-02-14 03:00:15','2026-02-14 02:45:01'),(103,2,'b3b3462461ece08ef2deff228a76710229d6a0e3f1b32df121975f33ab8f21e7','2026-02-21 03:00:15','2026-02-14 03:15:29','2026-02-14 03:00:14'),(104,2,'8425804f833a35257cc626fd311d78fb525faaf7723605c40939e5caae70f64b','2026-02-21 03:06:34',NULL,'2026-02-14 03:06:34'),(105,4,'7acdb65da1dca891b4ff03894b92910f33a352af14a0f3c4855cfe097276f71e','2026-02-21 03:08:51','2026-02-14 03:36:12','2026-02-14 03:08:50'),(106,2,'786372f0f172a47906a6cbcf8171c5fd60200d1ec48b2613038491710de2fec0','2026-02-21 03:15:29','2026-02-14 03:30:42','2026-02-14 03:15:28'),(107,2,'01a613f74ab28b28b66b42fe89ccb5aab3c6c2de2d157619901cb10b745813bd','2026-02-21 03:30:42','2026-02-14 03:45:56','2026-02-14 03:30:42'),(108,4,'8a20677627a27d3111b379d010209e8f0c307d5f9ae364d6fedd03d0c7210bb9','2026-02-21 03:36:12','2026-02-15 14:22:53','2026-02-14 03:36:12'),(109,1,'40081c846db8cccc3f74d71755c09230df92b4bcfb71bb0c4ad1818b95345dc8','2026-02-21 03:37:51','2026-02-14 15:42:10','2026-02-14 03:37:50'),(110,2,'49806c4b734ce03e91fd3bbf6bc35bbbe8e1b5fbfd9759f6b93dbef53bbf9608','2026-02-21 03:45:56','2026-02-14 04:01:10','2026-02-14 03:45:56'),(111,2,'abc757996a99198cccbc712659c34fc5ac3944c6ccf80519742a4cafc351958d','2026-02-21 04:01:10','2026-02-14 04:16:23','2026-02-14 04:01:10'),(112,2,'00fd286282824b7d8ccf118633706c526fb94a4abbcd65763f55991462b945e3','2026-02-21 04:16:23','2026-02-14 04:31:37','2026-02-14 04:16:23'),(113,2,'4e0d5c899314de008c619dc31b4f3d220181c880ca714cf0d48d963ba7b1d13a','2026-02-21 04:31:37','2026-02-14 04:46:50','2026-02-14 04:31:36'),(114,2,'b28a99bec06c4b10b2de4ed5c1af4d350216d7b0d59fc22c71f01b3912d0d47f','2026-02-21 04:46:50','2026-02-14 05:02:03','2026-02-14 04:46:50'),(115,2,'8977747762d6dfb9edcec4faa84811c29d1378c037ab9508e3563786ded6bdd9','2026-02-21 05:02:03','2026-02-14 05:17:17','2026-02-14 05:02:03'),(116,5,'426f4dd95167b89213c78f250ed2266cf858c51902626caeae10e0d6ba1b4cf2','2026-02-21 05:04:16','2026-02-14 12:57:29','2026-02-14 05:04:16'),(117,2,'53d61d4b18c4282b406071fb2991b74aa0dc8798ea0f9ae3757250f9ca96a436','2026-02-21 05:17:17','2026-02-14 05:32:30','2026-02-14 05:17:16'),(118,2,'a2aae66ff946b0dcb2da99986a972250bfd55c9f9f8373770bec1c5ca1fa7c1b','2026-02-21 05:32:30','2026-02-14 05:47:44','2026-02-14 05:32:30'),(119,2,'c15b1e211ef1040f26f7eacee67cf04bc8675a3e39fdc7789f43d08077fa688a','2026-02-21 05:47:44','2026-02-14 06:02:57','2026-02-14 05:47:43'),(120,2,'78945b2cf9e67af71e2635c646fe4c03c07f4304ef783d0fead80e06576db8a6','2026-02-21 06:02:57','2026-02-14 06:18:11','2026-02-14 06:02:56'),(121,2,'a29bc5a616d6082bb7641525425897100a43321183e48af493d93b8aef94c578','2026-02-21 06:18:11','2026-02-14 06:33:24','2026-02-14 06:18:10'),(122,2,'50b4378d40ea7134d7ed31ca9ba9c1538a90bcd8cb44b825c5f993dcf24aa79f','2026-02-21 06:33:24','2026-02-14 06:48:37','2026-02-14 06:33:23'),(123,2,'e0a524c8be73f6c388be18e168730cb811e125390083dbbce6e4742f6d8308ec','2026-02-21 06:48:37','2026-02-14 07:03:51','2026-02-14 06:48:37'),(124,2,'18a36c93a5d34df19c7b1d8fa96e3b5ef6bef38da52da3fc83f47234840062a1','2026-02-21 07:03:51','2026-02-14 07:19:04','2026-02-14 07:03:50'),(125,2,'9632f6ab6886488166ff8c85dc9eed7090d06ac2725500f1ffdd5c9afea47085','2026-02-21 07:19:04','2026-02-14 07:34:17','2026-02-14 07:19:04'),(126,2,'4a047da4f7506abb259b8ee64053a0e603eab9f8c663ad284b5e3c65d7438392','2026-02-21 07:34:17','2026-02-14 07:49:31','2026-02-14 07:34:17'),(127,2,'9f433e776d9e3128cd3405868eed71edcede4ce5800595c0da29d45d94d1a01f','2026-02-21 07:49:31','2026-02-14 08:04:44','2026-02-14 07:49:31'),(128,2,'24ffe0762ad0da3549d4d80f16fd1e58f576d31199bd3f7a35e0f8126c731afe','2026-02-21 08:04:44','2026-02-14 08:19:58','2026-02-14 08:04:44'),(129,2,'b3c4dbb86ba6fb158e19380ce2fb5418f032f7b59a80d5bba9af0a881d19c189','2026-02-21 08:19:58','2026-02-14 08:35:11','2026-02-14 08:19:57'),(130,2,'2996c8d22b6b08db53fb0f9c4046c76391d5a99651b50b0024fd2660a8e42334','2026-02-21 08:35:11','2026-02-14 08:50:24','2026-02-14 08:35:10'),(131,2,'2a6da958ed5fbdb392326eb3b3cd83442bcd0f29f9bf6f9a9d7ff23f676c2f61','2026-02-21 08:50:24','2026-02-14 09:05:37','2026-02-14 08:50:24'),(132,2,'7a639bee9bc84aa3d4a6f5d0f8c2db36d730f51c82c0741e84e24f42d8c00314','2026-02-21 09:05:37','2026-02-14 09:20:51','2026-02-14 09:05:37'),(133,2,'7f2add42101e8544ece7144b3bb8adda44b54c1d6263041539f0e111f934c0fb','2026-02-21 09:20:51','2026-02-14 09:36:04','2026-02-14 09:20:50'),(134,2,'430b3ed674603eeece195cb88b2267a2d3321772a161b3e2ab01ad509e206d00','2026-02-21 09:36:04','2026-02-14 09:51:17','2026-02-14 09:36:04'),(135,2,'59e433c4bbc5a074e376e0935e8c4325668b6ee9b0e1c142cab26ab7d120aa87','2026-02-21 09:51:17','2026-02-14 10:06:31','2026-02-14 09:51:17'),(136,2,'2731eb5b4c1e2051956f4b5d1c2b85911bc5ce51154000d63e79e3c0eaf4ef33','2026-02-21 10:06:31','2026-02-14 10:21:44','2026-02-14 10:06:30'),(137,2,'6c31c2fdba694a66c09c1408611c047220a9f144120e283fd65b8241af92c6af','2026-02-21 10:21:44','2026-02-14 10:36:57','2026-02-14 10:21:44'),(138,2,'7ab04d5d0a0a3702957e2a1829016d7b56b4c9bed6534a1389a46e4ee1781cc9','2026-02-21 10:36:57','2026-02-14 10:52:11','2026-02-14 10:36:57'),(139,2,'0d09b7689deb16a96a6a51f91a0a3031bb59b4949e7aca3c2eee64a047ae956a','2026-02-21 10:52:11','2026-02-14 11:07:24','2026-02-14 10:52:10'),(140,2,'ceb34ed956c5afed1c4b453658c4a3d19ca561f93a852f90ccb7321a23058585','2026-02-21 11:07:24','2026-02-14 11:22:37','2026-02-14 11:07:23'),(141,2,'1d755403b1434853bc109d11362cf61ab6e8da0e50078b6a3e8b681d0cd37075','2026-02-21 11:22:37','2026-02-14 11:37:50','2026-02-14 11:22:37'),(142,2,'0abceeb6a243464d40b2665bc55bb7b84dae34290abf9047bced183324cd65a3','2026-02-21 11:37:50','2026-02-14 11:53:04','2026-02-14 11:37:50'),(143,2,'348bb0cb89bae84a1b552c16befcc1dda8d2aeb494b8d0625e090ad9598bc5c2','2026-02-21 11:53:04','2026-02-14 12:08:17','2026-02-14 11:53:03'),(144,2,'9ae74eac831cb7ce45c731d555baa8481bc96d81abdd47be10cae70def62aa1c','2026-02-21 12:08:17','2026-02-14 12:23:31','2026-02-14 12:08:17'),(145,2,'9412c2f20f261ad35b4f366a36817e06093e8cec1d9042b662aabb5b18904c49','2026-02-21 12:23:31','2026-02-14 12:38:44','2026-02-14 12:23:30'),(146,2,'d68fd7f7a7564a11862e75d73d449d7419117a36dbfce2b25b031605939aa86a','2026-02-21 12:38:44','2026-02-14 12:53:58','2026-02-14 12:38:44'),(147,2,'67c09dc190e7b9cc750bf9062a8e6fa44d7f697d61c99ae7707254d4cb934f5f','2026-02-21 12:53:58','2026-02-14 13:09:12','2026-02-14 12:53:57'),(148,5,'5979bc04bea140efdadaba8fabf748946efdfdb50cc2ade5c53f1b90862d8aa1','2026-02-21 12:57:29','2026-02-14 13:12:52','2026-02-14 12:57:28'),(149,2,'8a46da86d478c233b6b6cf095f36d68cd0b258f09d607456c1e0fa3bae5d9520','2026-02-21 13:09:12','2026-02-14 13:24:25','2026-02-14 13:09:11'),(150,5,'93b0e82396a9f121ab6da8fd5ec13e87d8b538ee6aea49c19ed162412df88260','2026-02-21 13:12:52','2026-02-14 14:18:10','2026-02-14 13:12:51'),(151,2,'58014a377b6d5dc003135f6d71865036134a0ac40921f50e537a935a7832c136','2026-02-21 13:24:25','2026-02-14 13:39:38','2026-02-14 13:24:25'),(152,2,'1079c2b423e88375ce33903946c1bd2b3ed293990b6cd5d917e56910faee5ab0','2026-02-21 13:39:38','2026-02-14 13:54:52','2026-02-14 13:39:38'),(153,2,'3e3b781d944416f7c221ce622742c8f333e69a1b794018eaf1cb12520a9e51d4','2026-02-21 13:54:52','2026-02-14 14:10:06','2026-02-14 13:54:52'),(154,2,'26f782fdb68a5e0375cbcb9ba752d49b52f8289893b4763a7d2047d2fff5e6bf','2026-02-21 14:10:06','2026-02-14 14:25:19','2026-02-14 14:10:05'),(155,5,'c4a11f3f0f7e5fa723f10bbefed702ce193bb7d071b0421041137b61a444c911','2026-02-21 14:18:10','2026-02-15 22:53:31','2026-02-14 14:18:09'),(156,2,'bd5e498c3b5420c4b6745a664844126ecfccab99047d0757f1171c78413789b1','2026-02-21 14:25:19','2026-02-14 14:40:33','2026-02-14 14:25:18'),(157,2,'77b3b13bdab54e7f5f904dc5a4fb263ce562e216782b7b407e1ba4f392b735b2','2026-02-21 14:40:33','2026-02-14 14:55:46','2026-02-14 14:40:32'),(158,2,'379542d7ed4471d808ab29962824fd49516aeaffd665e680d9185a9e060d489d','2026-02-21 14:55:46','2026-02-14 15:10:59','2026-02-14 14:55:45'),(159,2,'8fc3a9d0deb182f996336fb48a3a7741af5ce7e7d0b03c439ff36afae710cfed','2026-02-21 15:10:59','2026-02-14 15:26:12','2026-02-14 15:10:58'),(160,2,'1985e09c93d47d6bf7c8c2a28e0c2fae538d498f77056480563ffab4e6ca3bf6','2026-02-21 15:26:12','2026-02-14 15:41:27','2026-02-14 15:26:12'),(161,2,'d44f253df1ee87289fa5196ca5b0bf85a38d594098122defba31861b86e378b0','2026-02-21 15:41:27','2026-02-14 16:00:50','2026-02-14 15:41:26'),(162,1,'6b843d9eaf3f82e1f5f162938d1571a3fc81f3c4e13605f42872624bf62ada56','2026-02-21 15:42:10',NULL,'2026-02-14 15:42:10'),(163,4,'2f80bb579240ae5e190169e1fe119b78a51303d3c68427cc0fad09a2aa43ddc2','2026-02-21 15:44:03','2026-02-14 16:01:42','2026-02-14 15:44:03'),(164,2,'39278e0e851a65a91cbeb006b3291015abe99b17d48a289a8c660fbfc17497ee','2026-02-21 16:00:50',NULL,'2026-02-14 16:00:49'),(165,2,'a46b13b7b2b338b2637a045aaacdcb3c0addfbb9b2e9eda072e6e50b86d04e37','2026-02-21 16:00:57','2026-02-15 14:24:06','2026-02-14 16:00:56'),(166,4,'701ff7245735569a7cbcc2253ceecdc323475b89451ed446958044da43e3824b','2026-02-21 16:01:42',NULL,'2026-02-14 16:01:41'),(167,2,'d77a9be34742d44c8981bd093ddd1031757f47ac5d0dfa7b58f5f5b197aa5653','2026-02-22 02:12:11',NULL,'2026-02-15 02:12:11'),(168,2,'a7ca06b88aa4fda8c38adb84f2853af26d50b9d47b1457d6f1a0080174b6c919','2026-02-22 14:21:56','2026-02-15 14:37:03','2026-02-15 14:21:55'),(169,4,'ffa4a050ce51263e70ebf59efbd27501d856f14bf3b7ab70d624a62edabefa72','2026-02-22 14:22:53',NULL,'2026-02-15 14:22:52'),(170,4,'17d818c7ed818a362f2ff9da92b8c201796745f5d5e6c1749ff503ed78da8d28','2026-02-22 14:23:02','2026-02-15 14:38:11','2026-02-15 14:23:01'),(171,2,'00cd3d548ae6ffc6453fa71ffce2fc82a8ba8c3a18385878adff340095d44a92','2026-02-22 14:24:06',NULL,'2026-02-15 14:24:06'),(172,1,'1c0ac338f4605567de1afc0ac8d6ab07b132b5e241bf8832b24546da3519fa84','2026-02-22 14:24:20','2026-02-15 21:44:10','2026-02-15 14:24:20'),(173,2,'cb6fcdd876e065e1d2eed261a0012e7ae4c115db4acb8b50d66cb5119ce29838','2026-02-22 14:37:03','2026-02-15 14:52:12','2026-02-15 14:37:02'),(174,4,'fb3467e727e4b85589891d2e6a08617516bab3bfda93042250915c9b49f36c92','2026-02-22 14:38:11','2026-02-15 15:43:50','2026-02-15 14:38:11'),(175,2,'4a762c6fc6aab203679bc054fa4972db2feae6caa23b8745571eb03a70afa5f5','2026-02-22 14:52:12','2026-02-15 15:07:21','2026-02-15 14:52:11'),(176,2,'e3bdda8634bfe2f1d92dc35d576170f6aeac62e8368c245069251bb4f97207af','2026-02-22 15:07:21','2026-02-15 15:22:30','2026-02-15 15:07:20'),(177,2,'c69914082ff5ab75fbd436841c5a7ce59b23aceed22dac803aeed3666952a225','2026-02-22 15:22:30','2026-02-15 15:37:40','2026-02-15 15:22:30'),(178,2,'6375cb08f801e3d80203fe5d7eba19d03c69568f50f8c62763202a235b15c0d5','2026-02-22 15:37:40','2026-02-15 15:52:49','2026-02-15 15:37:39'),(179,4,'e391abb4d45ce3d1ff5b73d2cc391b260091bb3f42be9a82a24bd32aa5f93bcd','2026-02-22 15:43:50',NULL,'2026-02-15 15:43:49'),(180,1,'21a7a40b74330ba604ceedecc9f065df009b64eb4ce89a7e13bdb596175464f0','2026-02-22 15:44:02','2026-02-15 19:51:12','2026-02-15 15:44:01'),(181,2,'a4d180f0edfa8873141928628fc8be6981891c7fd14a13bb0d7888843d154102','2026-02-22 15:52:49','2026-02-15 16:07:59','2026-02-15 15:52:49'),(182,2,'b8c76eeea8824983d031a19e50e15b7f34781b5ed0865362eb49968e3d23136d','2026-02-22 16:07:59','2026-02-15 16:23:08','2026-02-15 16:07:58'),(183,2,'39563d0d6abdc2448d7d6767f80b468b54335ea5f83400828eeaeb9fbd6765b1','2026-02-22 16:23:08','2026-02-15 16:38:17','2026-02-15 16:23:07'),(184,2,'07058c142d8eb63e7f790491154d2ad272ff1cdafba98c49343bc296294fba99','2026-02-22 16:38:17','2026-02-15 16:53:27','2026-02-15 16:38:17'),(185,2,'74cb269054af3a3c19a071e3025fc2a05008318dfcbdf0fa0cc9c64d0edaf0eb','2026-02-22 16:53:27','2026-02-15 17:08:36','2026-02-15 16:53:26'),(186,2,'fc884d096153cfa9609f0e89f4d9d8ff0ff1acd70bb501c3de581e620a7e87ae','2026-02-22 17:08:36','2026-02-15 17:23:45','2026-02-15 17:08:35'),(187,2,'e76244b33fcdd10c78f2e2e888198ccb8cd305deb9d605c4c653f47df1f00eca','2026-02-22 17:23:45','2026-02-15 17:38:54','2026-02-15 17:23:45'),(188,2,'b15869152864c96521752374fecc59fef9cf6fea6411427664cdec943bd94d53','2026-02-22 17:38:54','2026-02-15 17:54:04','2026-02-15 17:38:54'),(189,2,'f652bc4c49d26aef609692fa2dcd33bd68ad760c464ffe571751419fda2c85dd','2026-02-22 17:54:04','2026-02-15 18:09:13','2026-02-15 17:54:03'),(190,2,'d8a3c47b4ec7d72336ee08ffb74dd607db68e036c3518cdd074727465e41752c','2026-02-22 18:09:13','2026-02-15 18:24:22','2026-02-15 18:09:12'),(191,2,'86ae897086b6bffa6550a416d106a5838ab3aa6c3164d6de3a59841f8ac99812','2026-02-22 18:24:22','2026-02-15 18:39:31','2026-02-15 18:24:22'),(192,2,'e9dc4ab56895ec2bd19325cfd831c00f8086c41d7671f8bcd428e0612198c87c','2026-02-22 18:39:31','2026-02-15 18:54:41','2026-02-15 18:39:31'),(193,2,'758f6e58cc2f30cded4b888bf97fbcfaa8c682263ea83b7e3ded66bda6920037','2026-02-22 18:54:41','2026-02-15 19:09:50','2026-02-15 18:54:40'),(194,2,'81402d3e4b9174fcfbf40785c1b6b369e9aef448befdd3d1cab0fd78b653c7f7','2026-02-22 19:09:50','2026-02-15 19:24:59','2026-02-15 19:09:50'),(195,2,'210bfdf9c518e34183ff8e551b8f0d71a17d30bdbb5686f30ecff3e1155980ad','2026-02-22 19:24:59','2026-02-15 19:40:09','2026-02-15 19:24:59'),(196,2,'9059be3928c58baa71c2c48fd288c7e374a767e7196d5e287324fbb6686c5bc6','2026-02-22 19:40:09','2026-02-15 19:55:18','2026-02-15 19:40:09'),(197,1,'80baa8dc45ad5d1b92df0d0fac76057b977cbff024985d7f08a6ba2e5af47061','2026-02-22 19:51:12','2026-02-15 20:24:03','2026-02-15 19:51:12'),(198,2,'2ba12dc0200a2b60bdbf18a9e10daa323fbfd1637632c04525a66e6b039f1d7d','2026-02-22 19:55:18','2026-02-15 20:10:27','2026-02-15 19:55:18'),(199,2,'6dd430b89da011b02eee7ea8a25ce6d8610264ac9bb7c9bd86a3cc609e2d5fe4','2026-02-22 20:10:27','2026-02-15 20:25:37','2026-02-15 20:10:27'),(200,1,'112f8916f5f12c3fdd622ad103f6b44d37566b664f526d3e6fcb699aec07c103','2026-02-22 20:24:03',NULL,'2026-02-15 20:24:03'),(201,2,'79c55ea30d3998ef5198909f0eb4e290868e4d7a69c1c12492d0abb451e0f5ab','2026-02-22 20:25:37','2026-02-15 20:40:46','2026-02-15 20:25:36'),(202,2,'a33fcdb3a49114816df2cc39aeb1e73ed7219b71b5b0a3bcc549ed92f9c1b23f','2026-02-22 20:40:46','2026-02-15 20:55:55','2026-02-15 20:40:46'),(203,2,'bd033d72b5c3a3362cbf39d33150c0d2a5bdb61ea534e80987e3aebab881599a','2026-02-22 20:55:55','2026-02-15 21:11:04','2026-02-15 20:55:55'),(204,2,'0fa9e04bb18a19fa09dceb8e52f9cda1e2757cd92c0edabbb4c077d052729481','2026-02-22 21:11:05','2026-02-15 21:26:14','2026-02-15 21:11:04'),(205,2,'681d213282c507124fc3ea29e13d6012e436c74e4a0901a91f9c7376356baf7b','2026-02-22 21:26:14','2026-02-15 21:41:23','2026-02-15 21:26:13'),(206,2,'933bb3397bf52ac7b4b62c864954c83dfd2902376daacf5edcf490654fc577b0','2026-02-22 21:41:23','2026-02-15 21:56:32','2026-02-15 21:41:23'),(207,2,'586960c59e2fa13003331608c40a71a44afe79f4bb7af1b2d9d3c2f3ca773340','2026-02-22 21:43:39','2026-02-15 23:49:34','2026-02-15 21:43:39'),(208,1,'08ba07b95a6e9f4d9e42a40b577aadc5420499ca5b7a52ac9558b37fb5983771','2026-02-22 21:44:10',NULL,'2026-02-15 21:44:10'),(209,4,'8b10be9e4bf5cbfb5d697e4364d52badc4daad6c53309dd3166705c2aa749ea2','2026-02-22 21:44:20',NULL,'2026-02-15 21:44:19'),(210,2,'5ab479edfd097c1899c4c42388961539bdb7c0e049bd192aef3a977f801056dc','2026-02-22 21:56:32','2026-02-15 22:11:42','2026-02-15 21:56:32'),(211,2,'46119bd5b52cb3d99958d8a184d49d4037b9ef8fec653c1fcae92ef54952d332','2026-02-22 22:11:42','2026-02-15 22:27:11','2026-02-15 22:11:41'),(212,2,'5d28652efe132cf76566859c818a14ff5fb4b744e6d6e394932c4f40758fc368','2026-02-22 22:27:11','2026-02-15 22:42:31','2026-02-15 22:27:10'),(213,2,'b9b8e6b643b2c5dfc829ab80d15f28ea4676354878085006c75fce6a8ec7e0ad','2026-02-22 22:42:31','2026-02-15 22:57:41','2026-02-15 22:42:31'),(214,5,'8e851e423cb5344610064cf884230945b07e15c7dafe41cc8f852c0f59953fd2','2026-02-22 22:53:31','2026-02-15 23:09:24','2026-02-15 22:53:30'),(215,3,'19f116a5b72a8664d88f532a8931cd79c1dde20dedc5ed9bedcb074f40dca629','2026-02-22 22:55:17',NULL,'2026-02-15 22:55:17'),(216,2,'892ddde1884c7183f03b748583609ff6f61ac3a13a5186665575dad8bf96d2ae','2026-02-22 22:57:41','2026-02-15 23:12:50','2026-02-15 22:57:40'),(217,1,'a8924f12e1dfdab80b508dbc5dbe978380d0f97f36ddced507b501a83481248b','2026-02-22 23:05:16',NULL,'2026-02-15 23:05:15'),(218,3,'02075f746fe5346ce83985108b2f81beed7f5158ea6818e17d4745cb5992963b','2026-02-22 23:08:14',NULL,'2026-02-15 23:08:13'),(219,1,'93f02e6de9a41ebf6a738e35d904c0826357aaff80a205831795f23416fe9b8e','2026-02-22 23:08:50','2026-02-16 02:33:15','2026-02-15 23:08:50'),(220,5,'d77e063101ef27af45bafd4c88743f936d68de0e6a0bfd372144442ba20e6a41','2026-02-22 23:09:24',NULL,'2026-02-15 23:09:24'),(221,5,'cf9814214b408af991d6db0e27430671fc026795545dac64ac9794cdc75578a0','2026-02-22 23:09:37','2026-02-16 02:33:18','2026-02-15 23:09:36'),(222,2,'f896a25aad244175046c807ae2c3c8087ef8cb209b4532b53294bdd8349e9a34','2026-02-22 23:12:50','2026-02-15 23:27:59','2026-02-15 23:12:49'),(223,2,'f12f74962f72433831ba8f476fca1e1eab353486536fcc91650d35ba5220a03e','2026-02-22 23:27:59','2026-02-15 23:43:28','2026-02-15 23:27:59'),(224,2,'9ac6fe656020d8b6b8c00dd1ba826d567c53d59b8d87dae215fa01b59af4e134','2026-02-22 23:43:28','2026-02-15 23:58:58','2026-02-15 23:43:27'),(225,2,'fd696752b3da1e82093b80f64943da10da1cebb161ffe9e30b0d51bfc7dd53a2','2026-02-22 23:49:34','2026-02-16 00:06:45','2026-02-15 23:49:34'),(226,2,'21955280230c8b1efaee4265517426441c0dc27c760e24229a8ed7a29ac5e60d','2026-02-22 23:58:58','2026-02-16 00:14:07','2026-02-15 23:58:57'),(227,2,'a75513c0bb78034e517a6957fc22aee91680f341947780986f7c6d37e766323b','2026-02-23 00:06:45',NULL,'2026-02-16 00:06:45'),(228,2,'f6e2c80174b2f273e80ceae81cde84b060b7b896375bb9a55fdf2c851b416667','2026-02-23 00:14:07','2026-02-16 00:39:32','2026-02-16 00:14:07'),(229,2,'1e5c6c622f7621c1050a8cd9c85c3f9770008f7d121e714a64831195d62981ae','2026-02-23 00:39:32','2026-02-16 01:29:17','2026-02-16 00:39:31'),(230,2,'c5504540026b42c1b755b50f884eed0c65ad045803c6c4f6d08bdb69bb42b040','2026-02-23 01:29:17','2026-02-16 02:23:45','2026-02-16 01:29:17'),(231,2,'3ef050964f7512436014b16674f0837f28a795931833f45724fe7544c45cde52','2026-02-23 02:23:45','2026-02-16 02:39:17','2026-02-16 02:23:44'),(232,1,'f1559fb9398fb0cd2a3b368bcf126bb7435a74f6b0f804431a2f661e19bb322a','2026-02-23 02:33:15',NULL,'2026-02-16 02:33:14'),(233,5,'ce8951e60db9dbd4bea92afd77cba42ad03a7a3eb3dba5d08a607ad19570672f','2026-02-23 02:33:18',NULL,'2026-02-16 02:33:18'),(234,3,'6849b450633274c65c725f53f74b7ae73bea31a96625c8640513733cb18ba47d','2026-02-23 02:34:17','2026-02-16 02:49:29','2026-02-16 02:34:17'),(235,2,'d3de5f9c9df47780893c1cbf0e50538d98ab65b4af671fec43ce1cd953cb9964','2026-02-23 02:39:17','2026-02-16 02:54:26','2026-02-16 02:39:16'),(236,3,'382bf3abe13c00bef9477f237c51ca3f403e1c6515a62333b49e4be013ed7660','2026-02-23 02:49:29',NULL,'2026-02-16 02:49:28'),(237,2,'3d339935064a5096e63c6e8402889d5557ca6e37be5877ea99a7771edfcc75cc','2026-02-23 02:54:26','2026-02-16 03:09:35','2026-02-16 02:54:26'),(238,2,'acab205a045e374574042fceadfce8629b83aa3295eae9458154fd985e844ce9','2026-02-23 03:09:35',NULL,'2026-02-16 03:09:35');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_note_attachments`
--

DROP TABLE IF EXISTS `session_note_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_note_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionNoteId` int NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `fileKey` varchar(512) NOT NULL,
  `fileUrl` text NOT NULL,
  `fileSize` int NOT NULL,
  `mimeType` varchar(100) NOT NULL,
  `uploadedBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `session_note_attachments_uploadedBy_users_id_fk` (`uploadedBy`),
  KEY `session_note_attachments_sessionNoteId_idx` (`sessionNoteId`),
  CONSTRAINT `session_note_attachments_sessionNoteId_session_notes_id_fk` FOREIGN KEY (`sessionNoteId`) REFERENCES `session_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `session_note_attachments_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_note_attachments`
--

LOCK TABLES `session_note_attachments` WRITE;
/*!40000 ALTER TABLE `session_note_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_note_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_notes`
--

DROP TABLE IF EXISTS `session_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sessionId` int NOT NULL,
  `tutorId` int NOT NULL,
  `parentId` int NOT NULL,
  `progressSummary` text NOT NULL,
  `homework` text,
  `challenges` text,
  `nextSteps` text,
  `parentNotified` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `session_notes_sessionId_idx` (`sessionId`),
  KEY `session_notes_tutorId_idx` (`tutorId`),
  KEY `session_notes_parentId_idx` (`parentId`),
  CONSTRAINT `session_notes_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `session_notes_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `session_notes_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_notes`
--

LOCK TABLES `session_notes` WRITE;
/*!40000 ALTER TABLE `session_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subscriptionId` int NOT NULL,
  `tutorId` int NOT NULL,
  `parentId` int NOT NULL,
  `scheduledAt` bigint NOT NULL,
  `duration` int NOT NULL,
  `status` enum('scheduled','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  `notes` text,
  `feedbackFromTutor` text,
  `feedbackFromParent` text,
  `rating` int DEFAULT NULL,
  `acuityAppointmentId` int DEFAULT NULL,
  `managementToken` varchar(64) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_tutor_start_unique` (`tutorId`,`scheduledAt`),
  KEY `sessions_subscriptionId_idx` (`subscriptionId`),
  KEY `sessions_tutorId_idx` (`tutorId`),
  KEY `sessions_parentId_idx` (`parentId`),
  KEY `sessions_scheduledAt_idx` (`scheduledAt`),
  CONSTRAINT `sessions_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessions_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessions_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (1,2,2,4,1771005600000,60,'completed',NULL,'The notes are simple...\n',NULL,NULL,NULL,NULL,'2026-02-13 17:38:16','2026-02-13 18:10:10'),(2,1,2,3,1771059600000,60,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-13 17:46:19','2026-02-13 17:46:19'),(3,3,2,5,1771336800000,60,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-13 17:57:12','2026-02-13 17:57:12'),(4,3,2,5,1771614000000,60,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-13 19:12:38','2026-02-13 19:12:38'),(5,4,3,5,1771016400000,60,'completed',NULL,'Anjali and I discussed about the course in detail. Anjalli is really good in understanding the algebra concepts. I\'ve assigned the homework and she is willing to take up and share it in the next class.',NULL,NULL,NULL,NULL,'2026-02-13 20:44:08','2026-02-13 21:03:30'),(6,9,3,5,1771596000000,60,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-13 20:51:25','2026-02-13 20:51:25'),(7,4,3,5,1771200000000,60,'completed',NULL,'In today’s session, Anjalli worked on a long reading passage with very detailed explanations provided throughout. The focus was not just on surface-level understanding, but on developing the skill of reading between the lines. What we focused on: Breaking down the passage step by step, explaining difficult sentences and ideas in depth Understanding implicit meanings, assumptions, and what the author suggests without directly stating Identifying tone, intent, and subtle shifts in perspective Connecting different parts of the passage to draw logical inferences I guided Aadish through the entire thought process required to interpret complex texts, helping him move from literal comprehension to deeper analytical reading. This session was especially important in building his confidence with long, nuanced passages and strengthening higher-order reading skills essential for advanced exams.',NULL,NULL,NULL,NULL,'2026-02-15 22:58:42','2026-02-16 02:36:22'),(8,11,3,5,1771804800000,45,'scheduled',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-16 02:39:19','2026-02-16 02:39:19');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parentId` int NOT NULL,
  `courseId` int NOT NULL,
  `preferredTutorId` int DEFAULT NULL,
  `studentFirstName` varchar(100) DEFAULT NULL,
  `studentLastName` varchar(100) DEFAULT NULL,
  `studentGrade` varchar(50) DEFAULT NULL,
  `status` enum('active','paused','cancelled','completed') NOT NULL DEFAULT 'active',
  `startDate` timestamp NOT NULL,
  `endDate` timestamp NULL DEFAULT NULL,
  `sessionsCompleted` int DEFAULT '0',
  `stripeSubscriptionId` varchar(255) DEFAULT NULL,
  `paymentStatus` enum('paid','pending','failed') NOT NULL DEFAULT 'pending',
  `paymentPlan` enum('full','installment') NOT NULL DEFAULT 'full',
  `firstInstallmentPaid` tinyint(1) NOT NULL DEFAULT '0',
  `secondInstallmentPaid` tinyint(1) NOT NULL DEFAULT '0',
  `firstInstallmentAmount` decimal(10,2) DEFAULT NULL,
  `secondInstallmentAmount` decimal(10,2) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subscriptions_preferredTutorId_users_id_fk` (`preferredTutorId`),
  KEY `subscriptions_parentId_idx` (`parentId`),
  KEY `subscriptions_courseId_idx` (`courseId`),
  CONSTRAINT `subscriptions_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subscriptions_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subscriptions_preferredTutorId_users_id_fk` FOREIGN KEY (`preferredTutorId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
INSERT INTO `subscriptions` VALUES (1,3,1,NULL,'Ashwin','Sivaan','2nd Grade','active','2026-02-12 19:59:59',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-12 19:59:58','2026-02-12 19:59:58'),(2,4,1,2,'Akshay','S','7th Grade','active','2026-02-13 17:37:02','2026-05-13 17:37:02',0,NULL,'paid','full',1,1,NULL,NULL,'2026-02-13 17:37:02','2026-02-13 17:37:02'),(3,5,1,2,'John ','Matt','11th Grade','active','2026-02-13 17:56:34',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-13 17:56:34','2026-02-13 17:56:34'),(4,5,1,3,'Anjali','Sivaaa','8th Grade','active','2026-02-13 18:03:36',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-13 18:03:35','2026-02-13 18:03:35'),(5,5,1,3,'Rishi','Doe','11th Grade','active','2026-02-13 18:05:12',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-13 18:05:12','2026-02-13 18:05:12'),(6,4,2,NULL,'Akshay','S','7th Grade','active','2026-02-13 18:50:39',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-13 18:50:38','2026-02-13 18:50:38'),(7,4,1,3,'Vikas','S','7th Grade','active','2026-02-13 19:00:09','2026-05-13 19:00:09',0,NULL,'paid','full',1,1,NULL,NULL,'2026-02-13 19:00:08','2026-02-13 19:00:08'),(8,4,1,3,'Ninaad','S','8th Grade','active','2026-02-13 19:02:05','2026-05-13 19:02:05',0,NULL,'paid','full',1,1,NULL,NULL,'2026-02-13 19:02:05','2026-02-13 19:02:05'),(9,5,3,3,'John ','Matt','11th Grade','active','2026-02-13 20:51:08',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-13 20:51:07','2026-02-13 20:51:07'),(10,5,2,NULL,'Rishi','Doe','11th Grade','active','2026-02-14 05:05:09',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-14 05:05:08','2026-02-14 05:05:08'),(11,5,4,3,'Suresh','Mannn','8th Grade','active','2026-02-15 23:10:44',NULL,0,NULL,'pending','full',0,0,NULL,NULL,'2026-02-15 23:10:43','2026-02-15 23:10:43');
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testimonials`
--

DROP TABLE IF EXISTS `testimonials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `testimonials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parentName` varchar(255) NOT NULL,
  `parentInitials` varchar(5) NOT NULL,
  `parentRole` varchar(100) DEFAULT NULL,
  `content` text NOT NULL,
  `rating` int NOT NULL DEFAULT '5',
  `displayOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testimonials`
--

LOCK TABLES `testimonials` WRITE;
/*!40000 ALTER TABLE `testimonials` DISABLE KEYS */;
INSERT INTO `testimonials` VALUES (1,'Sarah Thompson','ST','Parent of 7th Grader','My daughter’s confidence in math improved dramatically within just a few weeks. The tutor was patient and extremely knowledgeable.',5,1,1,'2026-02-15 20:29:12','2026-02-15 20:29:12'),(2,'Michael Rodriguez','MR','Parent of High School Student','EdKonnect made it easy to find the right tutor. Scheduling and communication were seamless.',5,2,1,'2026-02-15 20:29:12','2026-02-15 20:29:12'),(3,'Priya Nair','PN','Parent of 5th Grader','The personalized attention helped my son overcome learning gaps he had struggled with for years.',5,3,1,'2026-02-15 20:29:12','2026-02-15 20:29:12');
/*!40000 ALTER TABLE `testimonials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutorPayoutRequests`
--

DROP TABLE IF EXISTS `tutorPayoutRequests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutorPayoutRequests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutorId` int NOT NULL,
  `subscriptionId` int NOT NULL,
  `sessionsCompleted` int NOT NULL,
  `ratePerSession` decimal(10,2) NOT NULL,
  `totalAmount` decimal(10,2) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `adminNotes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutorPayoutRequests_tutorId_idx` (`tutorId`),
  KEY `tutorPayoutRequests_subscriptionId_idx` (`subscriptionId`),
  CONSTRAINT `tutorPayoutRequests_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tutorPayoutRequests_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutorPayoutRequests`
--

LOCK TABLES `tutorPayoutRequests` WRITE;
/*!40000 ALTER TABLE `tutorPayoutRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `tutorPayoutRequests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_availability`
--

DROP TABLE IF EXISTS `tutor_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutorId` int NOT NULL,
  `dayOfWeek` int NOT NULL,
  `startTime` varchar(5) NOT NULL,
  `endTime` varchar(5) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutor_availability_tutorId_idx` (`tutorId`),
  KEY `tutor_availability_dayOfWeek_idx` (`dayOfWeek`),
  CONSTRAINT `tutor_availability_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_availability`
--

LOCK TABLES `tutor_availability` WRITE;
/*!40000 ALTER TABLE `tutor_availability` DISABLE KEYS */;
INSERT INTO `tutor_availability` VALUES (1,2,1,'09:00','17:00',1,'2026-02-13 17:37:28','2026-02-13 17:37:28'),(2,2,2,'09:00','17:00',1,'2026-02-13 17:37:32','2026-02-13 17:37:32'),(3,2,5,'10:00','17:00',1,'2026-02-13 17:37:52','2026-02-13 17:37:52'),(5,3,5,'09:00','17:00',1,'2026-02-13 20:42:45','2026-02-13 20:42:45'),(6,3,6,'09:00','17:00',1,'2026-02-13 20:55:56','2026-02-13 20:55:56'),(7,3,0,'18:10','22:00',1,'2026-02-15 22:58:20','2026-02-15 22:58:20');
/*!40000 ALTER TABLE `tutor_availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_course_preferences`
--

DROP TABLE IF EXISTS `tutor_course_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_course_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutorId` int NOT NULL,
  `courseId` int NOT NULL,
  `hourlyRate` decimal(10,2) NOT NULL DEFAULT '0.00',
  `approvalStatus` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutor_course_pref_unique` (`tutorId`,`courseId`),
  KEY `tutor_course_pref_tutor_idx` (`tutorId`),
  KEY `tutor_course_pref_course_idx` (`courseId`),
  CONSTRAINT `tutor_course_preferences_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tutor_course_preferences_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_course_preferences`
--

LOCK TABLES `tutor_course_preferences` WRITE;
/*!40000 ALTER TABLE `tutor_course_preferences` DISABLE KEYS */;
INSERT INTO `tutor_course_preferences` VALUES (1,2,1,15.00,'APPROVED','2026-02-13 17:33:23','2026-02-13 17:33:48'),(2,3,1,70.00,'APPROVED','2026-02-13 17:55:04','2026-02-15 23:08:30'),(3,3,2,30.00,'APPROVED','2026-02-13 18:55:42','2026-02-15 23:08:30'),(4,3,3,20.00,'APPROVED','2026-02-13 20:50:08','2026-02-15 23:08:30'),(5,3,4,12.00,'APPROVED','2026-02-15 23:08:30','2026-02-15 23:09:55');
/*!40000 ALTER TABLE `tutor_course_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_profiles`
--

DROP TABLE IF EXISTS `tutor_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `bio` text,
  `qualifications` text,
  `subjects` text,
  `gradeLevels` text,
  `hourlyRate` decimal(10,2) DEFAULT NULL,
  `yearsOfExperience` int DEFAULT NULL,
  `availability` text,
  `profileImageUrl` text,
  `introVideoUrl` text,
  `introVideoKey` varchar(512) DEFAULT NULL,
  `acuityLink` text,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `approvalStatus` varchar(20) NOT NULL DEFAULT 'pending',
  `rejectionReason` text,
  `rating` decimal(3,2) DEFAULT '0.00',
  `totalReviews` int DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutor_profiles_userId_idx` (`userId`),
  CONSTRAINT `tutor_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_profiles`
--

LOCK TABLES `tutor_profiles` WRITE;
/*!40000 ALTER TABLE `tutor_profiles` DISABLE KEYS */;
INSERT INTO `tutor_profiles` VALUES (1,2,'I am a Maths tutor','Ms in CS','[\"Mathematics\"]','[\"Elementary School\",\"High School\"]',50.00,5,NULL,NULL,NULL,NULL,NULL,1,'approved',NULL,0.00,0,'2026-02-12 21:18:51','2026-02-13 17:08:56'),(2,3,'professor','MTech','[\"Mathematics\",\"English\"]','[\"Elementary School\",\"High School\",\"Middle School\"]',70.00,6,NULL,NULL,NULL,NULL,NULL,1,'approved',NULL,0.00,0,'2026-02-13 17:44:44','2026-02-13 17:53:32'),(3,4,'I am tutor','as','[\"Mathematics\"]','[\"Elementary School\"]',50.00,5,NULL,NULL,NULL,NULL,NULL,0,'rejected','sample',0.00,0,'2026-02-13 17:46:49','2026-02-13 21:07:31');
/*!40000 ALTER TABLE `tutor_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_reviews`
--

DROP TABLE IF EXISTS `tutor_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutorId` int NOT NULL,
  `parentId` int NOT NULL,
  `sessionId` int DEFAULT NULL,
  `rating` int NOT NULL,
  `review` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutor_reviews_sessionId_sessions_id_fk` (`sessionId`),
  KEY `tutor_reviews_tutorId_idx` (`tutorId`),
  KEY `tutor_reviews_parentId_idx` (`parentId`),
  CONSTRAINT `tutor_reviews_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tutor_reviews_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tutor_reviews_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_reviews`
--

LOCK TABLES `tutor_reviews` WRITE;
/*!40000 ALTER TABLE `tutor_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `tutor_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_time_blocks`
--

DROP TABLE IF EXISTS `tutor_time_blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_time_blocks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutorId` int NOT NULL,
  `startTime` bigint NOT NULL,
  `endTime` bigint NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `acuityBlockId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tutor_time_blocks_tutorId_idx` (`tutorId`),
  KEY `tutor_time_blocks_startTime_idx` (`startTime`),
  CONSTRAINT `tutor_time_blocks_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_time_blocks`
--

LOCK TABLES `tutor_time_blocks` WRITE;
/*!40000 ALTER TABLE `tutor_time_blocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `tutor_time_blocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `email` varchar(320) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `firstName` varchar(100) NOT NULL,
  `lastName` varchar(100) NOT NULL,
  `role` enum('parent','tutor','admin') NOT NULL DEFAULT 'parent',
  `userType` enum('parent','tutor','admin') NOT NULL DEFAULT 'parent',
  `name` text,
  `loginMethod` varchar(64) DEFAULT NULL,
  `emailVerified` tinyint(1) NOT NULL DEFAULT '0',
  `emailVerifiedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_email_idx` (`email`),
  KEY `users_openId_idx` (`openId`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'aca3cfea-0846-11f1-9ec8-06d5b07d465d','admin@edkonnect.com','$2a$10$/NM4uuIpAGOPASoLTdHEpuYIMMUzOlMdcgwyTozNErdD/3ml44Gh6','Admin','Admin','admin','admin',NULL,NULL,1,NULL,'2026-02-12 19:11:46','2026-02-12 19:53:23','2026-02-12 19:11:46'),(2,'4d9f2584-94e7-4b2a-a225-cec77b6bc364','giteshsagvekar07@gmail.com','$2a$12$qRZnGATSgXIKaFAJt9H9f.tQDuFPrFJoMOWEOW4LNozchJpqEODKS','Gitesh','Sagvekar','tutor','parent','Gitesh Sagvekar',NULL,1,'2026-02-12 19:37:54','2026-02-12 19:37:42','2026-02-13 17:08:56','2026-02-12 19:37:42'),(3,'aae86c69-390d-498f-9c99-60644c99710b','arunemba@gmail.com','$2a$12$zn2NwtZfutlxCaeVZbrsUuhUwarFZ.q1j/CCYVp8D5sftKw9ACX3e','Arunn','Sivaan','tutor','parent','Arunn Sivaan',NULL,1,'2026-02-12 19:59:16','2026-02-12 19:58:56','2026-02-13 17:53:32','2026-02-12 19:58:56'),(4,'77c04177-02e6-4c4d-a0a2-9e079a33aeb2','sagvekargitesh@gmail.com','$2a$12$tBsumZUhMTUc/7Gtq4YfRON52Ue3/NaRyYccxeyJyzks/MGihaPba','Gitesh','Sagvekar','parent','parent','Gitesh Sagvekar',NULL,1,'2026-02-13 17:35:48','2026-02-13 17:35:18','2026-02-13 17:35:47','2026-02-13 17:35:18'),(5,'e115bdfa-e123-47d9-97d1-911a455aab15','edkonnectacademy@gmail.com','$2a$12$8rjpcZ72ZkJq2fKEmBx0kOJ2/4GdOiPiaerYulZELSo34N2G5Q4vK','Prem','Kumar','parent','parent','Prem Kumar',NULL,1,'2026-02-13 17:55:59','2026-02-13 17:55:40','2026-02-13 17:55:58','2026-02-13 17:55:40');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'tutor_marketplace'
--

--
-- Dumping routines for database 'tutor_marketplace'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-16  3:19:16
