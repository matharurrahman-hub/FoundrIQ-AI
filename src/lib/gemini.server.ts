// Server-only Gemini access. The API key never reaches the browser.

import type { ChatTurn, StartupBlueprint, StartupBlueprintInput } from "./ai.types";

const MODEL = "gemini-3.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 45_000;

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
};

function friendly(message: string): Error {
  return new Error(message);
}

async function callGemini(opts: {
  system: string;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw friendly("The AI service isn't configured yet. Please try again later.");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: opts.contents,
          generationConfig: {
            temperature: opts.temperature ?? 0.9,
            topP: 0.95,
            maxOutputTokens: 32768,
            thinkingConfig: { thinkingLevel: "low" },
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = friendly(
          res.status === 429
            ? "The AI service is busy right now. Please try again in a moment."
            : "The AI service is temporarily unavailable. Please retry.",
        );
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      const body = (await res.json().catch(() => null)) as GeminiResponse | null;
      if (!res.ok) {
        console.error("[gemini] request failed", res.status, body?.error?.message);
        throw friendly(
          res.status === 401 || res.status === 403
            ? "The AI service rejected our credentials. Please contact support."
            : "The AI couldn't complete that request. Please try again.",
        );
      }

      const text = (body?.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        lastError = friendly("The AI returned an empty response. Please retry.");
        continue;
      }
      return text;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = friendly("The AI took too long to respond. Please try again.");
      } else if (err instanceof Error && err.message.includes("AI")) {
        throw err;
      } else {
        console.error("[gemini] network error", err);
        lastError = friendly("We couldn't reach the AI service. Check your connection and retry.");
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? friendly("The AI couldn't complete that request. Please try again.");
}

function repairJson(input: string): string {
  // Attempt to close unterminated strings/arrays/objects from a truncated response.
  let s = input;
  // Trim any trailing partial escape.
  if (s.endsWith("\\")) s = s.slice(0, -1);
  const stack: string[] = [];
  let inStr = false;
  let escape = false;
  let lastCommaSafeLen = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
    if (!inStr && (c === "," || c === "{" || c === "[")) {
      // no-op; used below
    }
    if (!inStr && stack.length >= 0 && (c === "}" || c === "]" || /[\w"\]}]/.test(c))) {
      lastCommaSafeLen = i + 1;
    }
  }
  if (inStr) s += '"';
  // Remove trailing incomplete token after last complete value
  s = s.slice(0, lastCommaSafeLen);
  // Strip trailing comma
  s = s.replace(/,\s*$/, "");
  while (stack.length) s += stack.pop();
  return s;
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const tryParse = (s: string): T | null => {
    try { return JSON.parse(s) as T; } catch { return null; }
  };
  let out = tryParse(cleaned);
  if (out) return out;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    out = tryParse(cleaned.slice(start, end + 1));
    if (out) return out;
  }
  const sliced = start >= 0 ? cleaned.slice(start) : cleaned;
  out = tryParse(repairJson(sliced));
  if (out) return out;
  console.error("[gemini] failed to parse JSON response", cleaned.slice(0, 200));
  throw friendly("The AI returned an unexpected response. Please retry.");
}

const BLUEPRINT_SHAPE = `{
  "startupName": string,
  "tagline": string,
  "elevatorPitch": string,
  "problemStatement": string,
  "solution": string,
  "targetAudience": string,
  "customerPersona": string,
  "marketOpportunity": string,
  "competitorAnalysis": string,
  "uniqueSellingProposition": string,
  "swotAnalysis": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },
  "businessModel": string,
  "revenueModel": string,
  "pricingSuggestions": string,
  "estimatedStartupCost": string,
  "brandingStrategy": string,
  "brandIdentity": string,
  "logoConcept": string,
  "colorPalette": string[],
  "marketingStrategy": string,
  "launchRoadmap": string,
  "financialEstimate": string,
  "risks": string[],
  "growthOpportunities": string[],
  "investorPitchSummary": string,
  "recommendations": string[],
  "nextSteps": string[]
}`;

export async function generateBlueprint(input: StartupBlueprintInput): Promise<StartupBlueprint> {
  const system = [
    "You are a senior venture strategist who has built and funded multiple startups.",
    "You produce concrete, investor-ready business blueprints grounded in current market reality.",
    "Rules: never use placeholder text, never repeat generic AI boilerplate, always name real",
    "competitors and realistic numbers with currency and timeframes, and tailor every section to",
    "the founder's country, budget, experience and timeline.",
    `Return ONLY minified JSON matching this exact shape: ${BLUEPRINT_SHAPE}`,
    "Every string field must be 2-5 substantive sentences. Array fields need 3-5 specific items.",
  ].join(" ");

  const prompt = [
    `Idea: ${input.idea}`,
    `Problem: ${input.problem}`,
    `Target customers: ${input.customers.join(", ") || "not specified"}`,
    `Primary market: ${input.country || "global"}`,
    `Starting budget (USD): ${input.budget}`,
    `Founder experience: ${input.experience}`,
    `Timeline to launch: ${input.timeline}`,
    `Unfair advantage: ${input.advantage}`,
    `Uniqueness seed (use it to avoid repeating past outputs): ${Date.now()}-${Math.random().toString(36).slice(2)}`,
  ].join("\n");

  const raw = await callGemini({
    system,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    json: true,
    temperature: 1,
  });

  const parsed = parseJson<StartupBlueprint>(raw);
  if (!parsed.startupName || !parsed.solution) {
    throw friendly("The AI returned an incomplete blueprint. Please retry.");
  }
  return parsed;
}

export async function chat(args: {
  history: ChatTurn[];
  message: string;
  context?: string | null;
}): Promise<string> {
  const system = [
    "You are FoundrIQ's startup consultant: a professional advisor with operator experience in",
    "product, go-to-market, fundraising and unit economics.",
    "Always answer in the context of the founder's current startup and the ongoing conversation.",
    "Be specific and structured: short intro line, then markdown headings or numbered steps, then",
    "a concrete next action. Use real numbers, benchmarks and named examples. Never give vague,",
    "generic or filler answers, and never invent facts about the founder that were not provided.",
    args.context ? `Current startup context (authoritative):\n${args.context}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const contents = [
    ...args.history.slice(-20).map((t) => ({
      role: t.role === "ai" ? ("model" as const) : ("user" as const),
      parts: [{ text: t.text }],
    })),
    { role: "user" as const, parts: [{ text: args.message }] },
  ];

  return callGemini({ system, contents, temperature: 0.7 });
}
