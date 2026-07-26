import type { StartupBlueprint, StartupBlueprintInput } from "./ai.types";

/**
 * Local-only persistence for generated startups.
 *
 * Everything is stored in the browser's localStorage under a single key so
 * that Reports and History always load — no backend, no network, no failures
 * once the browser has the data. The public API is intentionally shaped like
 * the previous server functions so callers keep working unchanged.
 */

export type StartupRow = {
  id: string;
  name: string;
  industry: string | null;
  problem: string | null;
  solution: string | null;
  business_model: string | null;
  revenue_model: string | null;
  pricing: string | null;
  marketing_plan: string | null;
  score: number | null;
  report: StartupBlueprint;
  inputs: StartupBlueprintInput | null;
  created_at: string;
  updated_at: string;
};

export type HistoryRow = {
  id: string;
  startup_id: string | null;
  action: string;
  title: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const STORAGE_KEY = "foundriq:startups:v1";
const HISTORY_KEY = "foundriq:history:v1";
const CHANGE_EVENT = "foundriq:startups-changed";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): StartupRow[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StartupRow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: StartupRow[]) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch { /* ignore */ }
}

function readHistory(): HistoryRow[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryRow[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(rows: HistoryRow[]) {
  if (!isBrowser()) return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function scoreBlueprint(b: StartupBlueprint): number {
  // Deterministic-ish score based on how much substance the blueprint has.
  const fields: unknown[] = [
    b.elevatorPitch, b.problemStatement, b.solution, b.targetAudience,
    b.marketOpportunity, b.competitorAnalysis, b.businessModel, b.revenueModel,
    b.pricingSuggestions, b.marketingStrategy, b.launchRoadmap, b.financialEstimate,
    b.brandingStrategy, b.uniqueSellingProposition,
  ];
  const filled = fields.filter(v => typeof v === "string" && v.trim().length >= 20).length;
  const swot = b.swotAnalysis ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const swotCount =
    (swot.strengths?.length ?? 0) +
    (swot.weaknesses?.length ?? 0) +
    (swot.opportunities?.length ?? 0) +
    (swot.threats?.length ?? 0);
  const base = 62 + filled * 2 + Math.min(swotCount, 12);
  return Math.max(60, Math.min(97, base));
}

/* -------------------- Public API -------------------- */

export async function listStartups(): Promise<StartupRow[]> {
  const rows = readAll();
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getStartup({
  data: args,
}: {
  data: { id: string };
}): Promise<StartupRow> {
  const row = readAll().find(r => r.id === args.id);
  if (!row) throw new Error("This report is no longer available.");
  return row;
}

export async function saveStartup({
  data: args,
}: {
  data: { blueprint: StartupBlueprint; inputs: StartupBlueprintInput };
}): Promise<{ id: string }> {
  const b = args.blueprint;
  const now = new Date().toISOString();
  const industry = args.inputs.customers?.length
    ? args.inputs.customers.join(", ")
    : null;
  const row: StartupRow = {
    id: newId(),
    name: b.startupName?.trim() || "Untitled startup",
    industry,
    problem: b.problemStatement ?? null,
    solution: b.solution ?? null,
    business_model: b.businessModel ?? null,
    revenue_model: b.revenueModel ?? null,
    pricing: b.pricingSuggestions ?? null,
    marketing_plan: b.marketingStrategy ?? null,
    score: scoreBlueprint(b),
    report: b,
    inputs: args.inputs,
    created_at: now,
    updated_at: now,
  };

  // Retry-once semantics: if the first write throws (e.g. QuotaExceeded),
  // trim the oldest entries and try one more time.
  const persist = () => {
    const rows = readAll();
    rows.unshift(row);
    writeAll(rows);
  };

  try {
    persist();
  } catch {
    try {
      const trimmed = readAll().slice(0, 20);
      writeAll(trimmed);
      persist();
    } catch (err) {
      throw new Error("We couldn't save this startup locally. Please free up space and try again.");
    }
  }

  const hist = readHistory();
  hist.unshift({
    id: newId(),
    startup_id: row.id,
    action: "startup_generated",
    title: row.name,
    metadata: { score: row.score },
    created_at: now,
  });
  writeHistory(hist.slice(0, 200));

  return { id: row.id };
}

export async function renameStartup({
  data: args,
}: {
  data: { id: string; name: string };
}): Promise<{ ok: true }> {
  const name = args.name.trim();
  if (!name) throw new Error("Please enter a name.");
  const rows = readAll();
  const idx = rows.findIndex(r => r.id === args.id);
  if (idx === -1) throw new Error("This report is no longer available.");
  rows[idx] = { ...rows[idx], name, updated_at: new Date().toISOString() };
  writeAll(rows);

  const hist = readHistory();
  hist.unshift({
    id: newId(),
    startup_id: args.id,
    action: "startup_renamed",
    title: name,
    metadata: {},
    created_at: new Date().toISOString(),
  });
  writeHistory(hist.slice(0, 200));
  return { ok: true };
}

export async function deleteStartup({
  data: args,
}: {
  data: { id: string };
}): Promise<{ ok: true }> {
  const rows = readAll().filter(r => r.id !== args.id);
  writeAll(rows);
  return { ok: true };
}

export async function listHistory(limit = 50): Promise<HistoryRow[]> {
  return readHistory().slice(0, limit);
}
