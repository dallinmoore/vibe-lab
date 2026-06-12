/**
 * Shared, client-safe constants and helpers for issues.
 *
 * No DB or server imports here — this module is bundled for the browser too,
 * so both loaders/actions and components can share one source of truth for the
 * status columns, priority levels, and their display metadata.
 */

/** The Kanban columns, in board order. `id` is the value stored in `status`.
   Labels are parrot-rescue themed — the journey from cage to freedom. */
export const STATUSES = [
  { id: "todo", label: "🔒 Caged" },
  { id: "in_progress", label: "🪶 Breaking Free" },
  { id: "done", label: "🦜 Freed!" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];

export const STATUS_IDS = STATUSES.map((s) => s.id) as StatusId[];

export function isStatus(value: unknown): value is StatusId {
  return typeof value === "string" && STATUS_IDS.includes(value as StatusId);
}

/** Priority levels, low → urgent, with Tailwind classes for the badge.
   Themed as how urgently a captive parrot needs rescuing. */
export const PRIORITIES = [
  { id: "low", label: "Chillin'", badge: "bg-sky/20 text-sky-deep border-2 border-sky-deep dark:bg-sky/20 dark:text-sky" },
  { id: "medium", label: "Squawky", badge: "bg-leaf/30 text-jungle-deep border-2 border-jungle dark:text-leaf dark:border-leaf" },
  { id: "high", label: "Caged!", badge: "bg-sun/40 text-bark border-2 border-bark dark:text-sun dark:border-sun" },
  { id: "urgent", label: "SOS! 🚨", badge: "bg-macaw/20 text-macaw-dark border-2 border-macaw dark:text-macaw dark:border-macaw" },
] as const;

export type PriorityId = (typeof PRIORITIES)[number]["id"];

export const PRIORITY_IDS = PRIORITIES.map((p) => p.id) as PriorityId[];

export function isPriority(value: unknown): value is PriorityId {
  return typeof value === "string" && PRIORITY_IDS.includes(value as PriorityId);
}

export function priorityMeta(id: string) {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];
}

export function statusLabel(id: string) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

/** Human-readable issue key, e.g. `FREE-42`. */
export function issueKey(id: number) {
  return `FREE-${id}`;
}

/** First part of an email, used as a short display name / avatar seed. */
export function shortName(email: string) {
  return email.split("@")[0];
}

/** Two-letter initials for an avatar chip. */
export function initials(email: string) {
  const name = shortName(email).replace(/[._-]+/g, " ").trim();
  const parts = name.split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
