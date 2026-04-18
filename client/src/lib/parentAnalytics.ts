import { statusToPercentScore } from "@/lib/progressStatus";

export type AnalyticsPerspective = "family" | "individual";
export type ProgressLevel = "low" | "medium" | "high";
export type ProgressSource = "tutor_status" | "quiz_fallback" | "unrated";

export type StudentOption = {
  key: string;
  label: string;
};

export type StudentProgress = {
  key: string;
  name: string;
  level: ProgressLevel | null;
  score: number | null;
  source: ProgressSource;
};

export type ParentAnalyticsViewModel = {
  studentOptions: StudentOption[];
  activeStudentKey: string | null;
  filteredSubscriptions: any[];
  filteredSessions: any[];
  filteredUpcomingSessions: any[];
  filteredQuizzes: any[];
  filteredGrades: any[];
  totalCompleted: number;
  noShowCount: number;
  cancelledCount: number;
  scheduledCount: number;
  scheduledByStudent: Array<{ key: string; name: string; count: number }>;
  cancellationRate: number | null;
  cancelledByStudent: Array<{ key: string; name: string; count: number }>;
  attendanceRate: number;
  totalHours: number;
  completedQuizzes: number;
  avgQuizScore: number | null;
  avgRubricScore: number | null;
  monthlyActivity: Array<{ label: string; count: number; byStudent: Record<string, number> }>;
  studentBreakdown: Array<{
    key: string;
    name: string;
    sessions: number;
    lastSession: number | null;
    quizScores: number[];
    progressLevel: ProgressLevel | null;
    progressScore: number | null;
    progressSource: ProgressSource;
  }>;
  billing: {
    activeSubscriptions: number;
    totalSpend: number;
    totalSavings: number;
    hasSiblingDiscount: boolean;
    spendByStudent: Array<{ key: string; name: string; amount: number }>;
  };
  proficiency: {
    score: number | null;
    label: string;
    source: ProgressSource | "mixed";
    counts: { low: number; medium: number; high: number; unrated: number };
    students: StudentProgress[];
    summary: string;
  };
};

type BuildParentAnalyticsInput = {
  subscriptions: any[];
  analyticsSessions: any[];
  upcomingSessions: any[];
  quizzes: any[];
  grades: any[];
  selectedMonth: string;
  perspective: AnalyticsPerspective;
  selectedStudentKey: string | null;
};

type SessionStudent = {
  key: string;
  name: string;
};

function normalizeNamePart(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildStudentKey(firstName: unknown, lastName: unknown, fallback: string): string {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (first || last) {
    return `${first}__${last}`;
  }
  return fallback;
}

function buildStudentLabel(firstName: unknown, lastName: unknown, fallback = "Student"): string {
  const label = [String(firstName ?? "").trim(), String(lastName ?? "").trim()].filter(Boolean).join(" ").trim();
  return label || fallback;
}

function getMonthKey(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function scoreToLevel(score: number): ProgressLevel {
  if (score <= 44) return "low";
  if (score <= 83) return "medium";
  return "high";
}

function levelToLabel(level: ProgressLevel | null): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  if (level === "low") return "Low";
  return "Not yet rated";
}

function buildSummary(counts: { low: number; medium: number; high: number; unrated: number }): string {
  const parts: string[] = [];
  if (counts.high > 0) parts.push(`${counts.high} student${counts.high !== 1 ? "s are" : " is"} excelling`);
  if (counts.medium > 0) parts.push(`${counts.medium} student${counts.medium !== 1 ? "s are" : " is"} improving`);
  if (counts.low > 0) parts.push(`${counts.low} student${counts.low !== 1 ? "s need" : " needs"} attention`);
  if (parts.length === 0) {
    return counts.unrated > 0 ? "No proficiency signal yet" : "No data for this period";
  }
  return parts.join(" · ");
}

function getSubscriptionAmount(item: any): number {
  if (item?.nextBillingAmount != null) return Number(item.nextBillingAmount);
  const subscription = item?.subscription;
  if (!subscription) return 0;
  if (subscription.paymentPlan === "installment" && subscription.firstInstallmentAmount != null) {
    return Number(subscription.firstInstallmentAmount);
  }
  const coursePrice = Number(item?.course?.price ?? 0);
  const promo = Number(subscription.promoDiscountAmount ?? 0);
  const discount = Number(subscription.discountAmount ?? 0);
  return Math.max(0, coursePrice - promo - discount);
}

export function buildParentAnalyticsViewModel(input: BuildParentAnalyticsInput): ParentAnalyticsViewModel {
  const subscriptions = input.subscriptions || [];
  const analyticsSessions = input.analyticsSessions || [];
  const upcomingSessions = input.upcomingSessions || [];
  const quizzes = input.quizzes || [];
  const grades = input.grades || [];

  const studentMap = new Map<string, StudentOption>();
  const addStudent = (firstName: unknown, lastName: unknown, fallback: string) => {
    const key = buildStudentKey(firstName, lastName, fallback);
    if (!studentMap.has(key)) {
      studentMap.set(key, {
        key,
        label: buildStudentLabel(firstName, lastName),
      });
    }
    return key;
  };

  subscriptions.forEach((item, idx) => addStudent(item?.subscription?.studentFirstName, item?.subscription?.studentLastName, `subscription:${item?.subscription?.id ?? idx}`));
  analyticsSessions.forEach((item, idx) => addStudent(item?.studentFirstName, item?.studentLastName, `session:${item?.id ?? idx}`));
  upcomingSessions.forEach((item, idx) => addStudent(item?.studentFirstName, item?.studentLastName, `upcoming:${item?.id ?? idx}`));

  const studentOptions = Array.from(studentMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  const activeStudentKey =
    input.perspective === "individual"
      ? (input.selectedStudentKey && studentMap.has(input.selectedStudentKey) ? input.selectedStudentKey : studentOptions[0]?.key ?? null)
      : null;

  const selectedMonth = input.selectedMonth;

  const monthFilteredSubscriptions = selectedMonth === "all"
    ? subscriptions
    : subscriptions.filter((item) => {
        const [y, m] = selectedMonth.split("-").map(Number);
        const startOfMonth = new Date(y, m - 1, 1);
        const endOfMonth = new Date(y, m, 0, 23, 59, 59);
        const subscription = item.subscription;
        const subStart = subscription?.startDate ? new Date(subscription.startDate) : new Date(subscription?.createdAt);
        const subEnd = subscription?.endDate ? new Date(subscription.endDate) : null;
        return subStart <= endOfMonth && (subEnd === null || subEnd >= startOfMonth);
      });

  const monthFilteredSessions = selectedMonth === "all"
    ? analyticsSessions
    : analyticsSessions.filter((session) => getMonthKey(session?.scheduledAt) === selectedMonth);
  const monthFilteredUpcomingSessions = selectedMonth === "all"
    ? upcomingSessions
    : upcomingSessions.filter((session) => getMonthKey(session?.scheduledAt) === selectedMonth);

  const sessionStudentById = new Map<number, SessionStudent>();
  analyticsSessions.forEach((session) => {
    if (!session?.id) return;
    const key = buildStudentKey(session.studentFirstName, session.studentLastName, `session:${session.id}`);
    const name = studentMap.get(key)?.label ?? buildStudentLabel(session.studentFirstName, session.studentLastName);
    sessionStudentById.set(session.id, { key, name });
  });
  const upcomingStudentById = new Map<number, SessionStudent>();
  upcomingSessions.forEach((session) => {
    if (!session?.id) return;
    const key = buildStudentKey(session.studentFirstName, session.studentLastName, `upcoming:${session.id}`);
    const name = studentMap.get(key)?.label ?? buildStudentLabel(session.studentFirstName, session.studentLastName);
    upcomingStudentById.set(session.id, { key, name });
  });

  const monthFilteredQuizzes = selectedMonth === "all"
    ? quizzes
    : quizzes.filter((quiz) => getMonthKey(quiz?.completedAt) === selectedMonth);

  const monthFilteredGrades = selectedMonth === "all"
    ? grades
    : grades.filter((grade) => getMonthKey(grade?.rubricGradedAt) === selectedMonth);

  const matchesPerspective = (key: string) => input.perspective === "family" || key === activeStudentKey;

  const filteredSubscriptions = monthFilteredSubscriptions.filter((item) => {
    const key = buildStudentKey(item?.subscription?.studentFirstName, item?.subscription?.studentLastName, `subscription:${item?.subscription?.id}`);
    return matchesPerspective(key);
  });

  const filteredSessions = monthFilteredSessions.filter((session) => {
    const student = sessionStudentById.get(session.id);
    if (!student) return input.perspective === "family";
    return matchesPerspective(student.key);
  });
  const filteredUpcomingSessions = monthFilteredUpcomingSessions.filter((session) => {
    const student = upcomingStudentById.get(session.id);
    if (!student) return input.perspective === "family";
    return matchesPerspective(student.key);
  });

  const filteredQuizzes = monthFilteredQuizzes.filter((quiz) => {
    const student = quiz?.sessionId ? sessionStudentById.get(quiz.sessionId) : null;
    if (!student) return input.perspective === "family";
    return matchesPerspective(student.key);
  });

  const filteredGrades = monthFilteredGrades.filter((grade) => {
    const student = grade?.sessionId ? sessionStudentById.get(grade.sessionId) : null;
    if (!student) return input.perspective === "family";
    return matchesPerspective(student.key);
  });

  const completedSessions = filteredSessions.filter((session) => session.status === "completed");
  const noShowSessions = filteredSessions.filter((session) => session.status === "no_show");
  const cancelledSessions = filteredSessions.filter((session) => session.status === "cancelled");

  const completedMinutes = completedSessions.reduce((sum, session) => sum + Number(session?.duration || 0), 0);

  const cancelledByStudentMap = new Map<string, { key: string; name: string; count: number }>();
  cancelledSessions.forEach((session) => {
    const student = sessionStudentById.get(session.id);
    if (!student) return;
    const existing = cancelledByStudentMap.get(student.key) ?? { key: student.key, name: student.name, count: 0 };
    existing.count += 1;
    cancelledByStudentMap.set(student.key, existing);
  });

  const cancelledByStudent = Array.from(cancelledByStudentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const scheduledByStudentMap = new Map<string, { key: string; name: string; count: number }>();
  filteredUpcomingSessions
    .filter((session) => session.status === "scheduled")
    .forEach((session) => {
      const student = upcomingStudentById.get(session.id);
      if (!student) return;
      const existing = scheduledByStudentMap.get(student.key) ?? { key: student.key, name: student.name, count: 0 };
      existing.count += 1;
      scheduledByStudentMap.set(student.key, existing);
    });
  const scheduledByStudent = Array.from(scheduledByStudentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const scheduledCount = scheduledByStudent.reduce((sum, row) => sum + row.count, 0);

  const attendanceDenominator = completedSessions.length + noShowSessions.length + scheduledCount;
  const attendanceRate = attendanceDenominator > 0
    ? Math.round((completedSessions.length / attendanceDenominator) * 100)
    : 0;

  const cancellationDenominator = completedSessions.length + noShowSessions.length + cancelledSessions.length;
  const cancellationRate = cancellationDenominator > 0
    ? Math.round((cancelledSessions.length / cancellationDenominator) * 100)
    : null;

  const monthlyActivity: Array<{ label: string; count: number; byStudent: Record<string, number> }> = [];
  if (selectedMonth === "all") {
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthCompleted = completedSessions.filter((session) => getMonthKey(session.scheduledAt) === key);
      const byStudent: Record<string, number> = {};
      monthCompleted.forEach((session) => {
        const student = sessionStudentById.get(session.id);
        if (!student) return;
        byStudent[student.key] = (byStudent[student.key] ?? 0) + 1;
      });
      monthlyActivity.push({ label: monthLabel(key), count: monthCompleted.length, byStudent });
    }
  } else {
    const byStudent: Record<string, number> = {};
    completedSessions.forEach((session) => {
      const student = sessionStudentById.get(session.id);
      if (!student) return;
      byStudent[student.key] = (byStudent[student.key] ?? 0) + 1;
    });
    monthlyActivity.push({ label: monthLabel(selectedMonth), count: completedSessions.length, byStudent });
  }

  const completedQuizzesList = filteredQuizzes.filter((quiz) => quiz.status === "completed");
  const scoredQuizzes = completedQuizzesList.filter((quiz) => quiz.score != null);
  const avgQuizScore = scoredQuizzes.length > 0
    ? Math.round(scoredQuizzes.reduce((sum, quiz) => sum + Number(quiz.score ?? 0), 0) / scoredQuizzes.length)
    : null;

  const gradedRows = filteredGrades.filter((grade) => grade.rubricOverallScore != null);
  const avgRubricScore = gradedRows.length > 0
    ? Math.round((gradedRows.reduce((sum, grade) => sum + Number(grade.rubricOverallScore), 0) / gradedRows.length) * 10) / 10
    : null;

  const studentProgressMap = new Map<string, StudentProgress>();

  const relevantStudentOptions = studentOptions.filter((student) => matchesPerspective(student.key));

  relevantStudentOptions.forEach((student) => {
    const studentSubscriptions = filteredSubscriptions.filter((item) => {
      const key = buildStudentKey(item?.subscription?.studentFirstName, item?.subscription?.studentLastName, `subscription:${item?.subscription?.id}`);
      return key === student.key;
    });

    const statusScores = studentSubscriptions
      .map((item) => statusToPercentScore(item?.subscription?.progressStatus))
      .filter((score): score is 33 | 66 | 100 => score != null);

    if (statusScores.length > 0) {
      const avgScore = Math.round(statusScores.reduce((sum, score) => sum + score, 0) / statusScores.length);
      studentProgressMap.set(student.key, {
        key: student.key,
        name: student.label,
        level: scoreToLevel(avgScore),
        score: avgScore,
        source: "tutor_status",
      });
      return;
    }

    const studentSessions = filteredSessions.filter((session) => {
      const mapped = sessionStudentById.get(session.id);
      return mapped?.key === student.key;
    });

    const studentCompleted = studentSessions.filter((session) => session.status === "completed").length;
    const studentNoShows = studentSessions.filter((session) => session.status === "no_show").length;
    const studentScheduled = scheduledByStudentMap.get(student.key)?.count ?? 0;
    const studentAttendanceDenominator = studentCompleted + studentNoShows + studentScheduled;
    const studentAttendance = studentAttendanceDenominator > 0
      ? Math.round((studentCompleted / studentAttendanceDenominator) * 100)
      : 0;

    const studentQuizzes = filteredQuizzes.filter((quiz) => {
      const mapped = quiz?.sessionId ? sessionStudentById.get(quiz.sessionId) : null;
      return mapped?.key === student.key && quiz.status === "completed" && quiz.score != null;
    });

    const avgStudentQuiz = studentQuizzes.length > 0
      ? Math.round(studentQuizzes.reduce((sum, quiz) => sum + Number(quiz.score ?? 0), 0) / studentQuizzes.length)
      : null;

    if (avgStudentQuiz != null) {
      let level: ProgressLevel = "medium";
      if (avgStudentQuiz >= 70 && studentAttendance >= 80) level = "high";
      else if (avgStudentQuiz < 50 || studentAttendance < 50) level = "low";

      studentProgressMap.set(student.key, {
        key: student.key,
        name: student.label,
        level,
        score: statusToPercentScore(level),
        source: "quiz_fallback",
      });
      return;
    }

    studentProgressMap.set(student.key, {
      key: student.key,
      name: student.label,
      level: null,
      score: null,
      source: "unrated",
    });
  });

  const progressStudents = relevantStudentOptions.map((student) => studentProgressMap.get(student.key) ?? {
    key: student.key,
    name: student.label,
    level: null,
    score: null,
    source: "unrated" as const,
  });

  const ratedStudents = progressStudents.filter((student) => student.score != null);
  const proficiencyScore = ratedStudents.length > 0
    ? Math.round(ratedStudents.reduce((sum, student) => sum + Number(student.score), 0) / ratedStudents.length)
    : null;

  const proficiencySourceSet = new Set(ratedStudents.map((student) => student.source));
  const proficiencySource =
    proficiencySourceSet.size === 0
      ? "unrated"
      : proficiencySourceSet.size === 1
      ? (Array.from(proficiencySourceSet)[0] as ProgressSource)
      : "mixed";

  const proficiencyCounts = {
    low: progressStudents.filter((student) => student.level === "low").length,
    medium: progressStudents.filter((student) => student.level === "medium").length,
    high: progressStudents.filter((student) => student.level === "high").length,
    unrated: progressStudents.filter((student) => student.level == null).length,
  };

  const proficiencyLabel = proficiencyScore != null
    ? `${levelToLabel(scoreToLevel(proficiencyScore))} (${proficiencyScore}%)`
    : "Not yet rated";

  const breakdownMap = new Map<string, {
    key: string;
    name: string;
    sessions: number;
    lastSession: number | null;
    quizScores: number[];
  }>();

  relevantStudentOptions.forEach((student) => {
    breakdownMap.set(student.key, {
      key: student.key,
      name: student.label,
      sessions: 0,
      lastSession: null,
      quizScores: [],
    });
  });

  completedSessions.forEach((session) => {
    const student = sessionStudentById.get(session.id);
    if (!student || !breakdownMap.has(student.key)) return;
    const entry = breakdownMap.get(student.key)!;
    entry.sessions += 1;
    if (entry.lastSession == null || Number(session.scheduledAt) > entry.lastSession) {
      entry.lastSession = Number(session.scheduledAt);
    }
  });

  scoredQuizzes.forEach((quiz) => {
    const student = quiz?.sessionId ? sessionStudentById.get(quiz.sessionId) : null;
    if (!student || !breakdownMap.has(student.key)) return;
    breakdownMap.get(student.key)!.quizScores.push(Number(quiz.score));
  });

  const studentBreakdown = Array.from(breakdownMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const progress = studentProgressMap.get(entry.key);
      return {
        ...entry,
        progressLevel: progress?.level ?? null,
        progressScore: progress?.score ?? null,
        progressSource: progress?.source ?? "unrated",
      };
    });

  const activeSubs = filteredSubscriptions.filter((item) => item?.subscription?.status === "active");
  const totalSpend = activeSubs.reduce((sum, item) => sum + getSubscriptionAmount(item), 0);
  const totalSavings = filteredSubscriptions.reduce(
    (sum, item) => sum + Number(item?.subscription?.promoDiscountAmount ?? 0) + Number(item?.subscription?.discountAmount ?? 0),
    0,
  );
  const hasSiblingDiscount = filteredSubscriptions.some((item) => item?.subscription?.siblingDiscountApplied);

  const spendByStudentMap = new Map<string, { key: string; name: string; amount: number }>();
  activeSubs.forEach((item) => {
    const key = buildStudentKey(item?.subscription?.studentFirstName, item?.subscription?.studentLastName, `subscription:${item?.subscription?.id}`);
    if (!matchesPerspective(key)) return;
    const current = spendByStudentMap.get(key) ?? {
      key,
      name: studentMap.get(key)?.label ?? buildStudentLabel(item?.subscription?.studentFirstName, item?.subscription?.studentLastName),
      amount: 0,
    };
    current.amount += getSubscriptionAmount(item);
    spendByStudentMap.set(key, current);
  });

  return {
    studentOptions,
    activeStudentKey,
    filteredSubscriptions,
    filteredSessions,
    filteredUpcomingSessions,
    filteredQuizzes,
    filteredGrades,
    totalCompleted: completedSessions.length,
    noShowCount: noShowSessions.length,
    cancelledCount: cancelledSessions.length,
    scheduledCount,
    scheduledByStudent,
    cancellationRate,
    cancelledByStudent,
    attendanceRate,
    totalHours: Math.round((completedMinutes / 60) * 10) / 10,
    completedQuizzes: completedQuizzesList.length,
    avgQuizScore,
    avgRubricScore,
    monthlyActivity,
    studentBreakdown,
    billing: {
      activeSubscriptions: activeSubs.length,
      totalSpend,
      totalSavings,
      hasSiblingDiscount,
      spendByStudent: Array.from(spendByStudentMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    },
    proficiency: {
      score: proficiencyScore,
      label: proficiencyLabel,
      source: proficiencySource,
      counts: proficiencyCounts,
      students: progressStudents,
      summary: buildSummary(proficiencyCounts),
    },
  };
}
