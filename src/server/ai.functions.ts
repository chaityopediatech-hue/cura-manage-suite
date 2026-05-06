import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
});

const SYSTEM = `You are MediCore Assistant, a helpful clinical-support chatbot for a clinic management app.
Rules:
- Do NOT invent or fabricate patient, doctor, or prescription data.
- If the user asks about specific patients, doctors, or appointments you do not have data for, reply exactly: "I do not have enough information."
- For general medical questions, give cautious, educational information and ALWAYS remind the user to consult a qualified healthcare professional.
- Keep responses concise (under 200 words) and use plain language.
- End any clinical answer with a brief safety disclaimer.`;

export const askAI = createServerFn({ method: "POST" })
  .inputValidator((d) => Schema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "I do not have enough information. (AI service is not configured.)" };
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, ...data.messages],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("AI error:", res.status, txt);
      if (res.status === 429) return { reply: "I'm receiving too many requests right now. Please try again in a moment." };
      if (res.status === 402) return { reply: "AI usage credits are exhausted. Please add credits in Lovable Cloud." };
      return { reply: "I do not have enough information." };
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() || "I do not have enough information.";
    return { reply };
  });
