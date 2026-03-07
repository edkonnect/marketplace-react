ALTER TABLE `session_quizzes`
  ADD COLUMN `score` int,
  ADD COLUMN `correctCount` int,
  ADD COLUMN `totalCount` int,
  ADD COLUMN `studentAnswers` text;
