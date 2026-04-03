export type ProgressStatus = "low" | "medium" | "high" | null;

export function statusToStep(status: ProgressStatus): 0 | 1 | 2 | 3 {
  if (status === "low") return 1;
  if (status === "medium") return 2;
  if (status === "high") return 3;
  return 0;
}

export function stepToStatus(step: number): ProgressStatus {
  if (step <= 0) return null;
  if (step === 1) return "low";
  if (step === 2) return "medium";
  return "high";
}

export function statusLabel(status: ProgressStatus): string {
  if (status === "high") return "High";
  if (status === "medium") return "Medium";
  if (status === "low") return "Low";
  return "Not rated";
}

export function statusToPercentScore(
  status: ProgressStatus
): 33 | 66 | 100 | null {
  if (status === "low") return 33;
  if (status === "medium") return 66;
  if (status === "high") return 100;
  return null;
}

