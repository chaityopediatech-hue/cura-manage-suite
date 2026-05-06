// Rule-based triage for clinic appointments.
export type Priority = "emergency" | "high" | "medium" | "low";

const EMERGENCY = [
  "chest pain", "breathing difficulty", "shortness of breath", "can't breathe",
  "stroke", "slurred speech", "facial droop", "severe bleeding", "unconscious",
  "unresponsive", "seizure", "anaphylaxis", "heart attack",
];
const HIGH = [
  "high fever", "severe pain", "vomiting blood", "broken bone", "fracture",
  "deep cut", "asthma attack", "dehydration", "infection", "abdominal pain",
];
const MEDIUM = ["fever", "cough", "headache", "vomiting", "diarrhea", "rash", "earache", "sore throat"];

const SPECIALTY_HINTS: Array<{ kw: string[]; specialty: string }> = [
  { kw: ["chest pain", "heart", "palpitation", "blood pressure"], specialty: "Cardiology" },
  { kw: ["child", "kid", "infant", "pediatric", "baby"], specialty: "Pediatrics" },
  { kw: ["headache", "migraine", "stroke", "seizure", "numb", "dizzy"], specialty: "Neurology" },
  { kw: ["emergency", "unconscious", "bleeding", "accident", "trauma"], specialty: "Emergency Medicine" },
];

export function analyzeSymptoms(text: string): { priority: Priority; emergency: boolean; suggestedSpecialty: string } {
  const t = (text || "").toLowerCase();
  let priority: Priority = "low";
  if (MEDIUM.some((k) => t.includes(k))) priority = "medium";
  if (HIGH.some((k) => t.includes(k))) priority = "high";
  const emergency = EMERGENCY.some((k) => t.includes(k));
  if (emergency) priority = "emergency";

  let suggestedSpecialty = "General Medicine";
  for (const s of SPECIALTY_HINTS) {
    if (s.kw.some((k) => t.includes(k))) { suggestedSpecialty = s.specialty; break; }
  }
  return { priority, emergency, suggestedSpecialty };
}

// Pick best doctor: specialty match + least workload (fewest pending/confirmed appts).
export function pickBestDoctor<T extends { id: string; specialty: string; status?: string }>(
  doctors: T[],
  loadByDoctor: Record<string, number>,
  preferredSpecialty: string,
): T | null {
  const active = doctors.filter((d) => (d.status ?? "active") === "active");
  if (active.length === 0) return null;
  const matches = active.filter((d) => d.specialty?.toLowerCase() === preferredSpecialty.toLowerCase());
  const pool = matches.length > 0 ? matches : active;
  return [...pool].sort((a, b) => (loadByDoctor[a.id] ?? 0) - (loadByDoctor[b.id] ?? 0))[0] ?? null;
}
