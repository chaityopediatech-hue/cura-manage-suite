import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(4000),
    })
  ).min(1).max(30),
});

const SYSTEM = `You are MediCore Assistant, a helpful clinical-support chatbot.

Rules:
- Do NOT invent patient/doctor data.
- If unknown, say: "I do not have enough information."
- Give safe, educational medical info.
- Always suggest consulting a qualified doctor.
- Keep replies under 200 words.
`;

export const askAI = createServerFn({ method: "POST" })
  .inputValidator((data) => Schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;

    if (!apiKey) {
      return {
        reply:
          "I do not have enough information. (AI not configured)",
      };
    }

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM },
              ...data.messages,
            ],
          }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");

        console.error("AI error:", res.status, txt);

        if (res.status === 429) {
          return {
            reply:
              "Too many requests. Please try again later.",
          };
        }

        if (res.status === 402) {
          return {
            reply:
              "AI credits exhausted. Please recharge account.",
          };
        }

        return {
          reply: "I do not have enough information.",
        };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      return {
        reply:
          json.choices?.[0]?.message?.content?.trim() ||
          "I do not have enough information.",
      };
    } catch (err) {
      console.error(err);
      return {
        reply: "Server error occurred.",
      };
    }
  });
