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

export function analyzeSymptoms(text: string): { priority: Priority; emergency: boolean; suggestedSpecialty: string; riskScore: number } {
  const t = (text || "").toLowerCase();
  let priority: Priority = "low";
  let riskScore = 10;
  const mediumHits = MEDIUM.filter((k) => t.includes(k)).length;
  const highHits = HIGH.filter((k) => t.includes(k)).length;
  const emergencyHits = EMERGENCY.filter((k) => t.includes(k)).length;
  if (mediumHits > 0) { priority = "medium"; riskScore = Math.min(50, 30 + mediumHits * 5); }
  if (highHits > 0) { priority = "high"; riskScore = Math.min(80, 60 + highHits * 5); }
  const emergency = emergencyHits > 0;
  if (emergency) { priority = "emergency"; riskScore = Math.min(100, 90 + emergencyHits * 3); }
  if (!t.trim()) riskScore = 0;

  let suggestedSpecialty = "General Medicine";
  for (const s of SPECIALTY_HINTS) {
    if (s.kw.some((k) => t.includes(k))) { suggestedSpecialty = s.specialty; break; }
  }
  return { priority, emergency, suggestedSpecialty, riskScore };
}

export function riskBand(score: number): "low" | "medium" | "emergency" {
  if (score >= 85) return "emergency";
  if (score >= 40) return "medium";
  return "low";
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
