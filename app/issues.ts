/**
 * Shared, client-safe constants and helpers for issues.
 *
 * No DB or server imports here — this module is bundled for the browser too,
 * so both loaders/actions and components can share one source of truth for the
 * status columns, priority levels, and their display metadata.
 */

/** The Kanban columns, in board order. `id` is the value stored in `status`. */
export const STATUSES = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];

export const STATUS_IDS = STATUSES.map((s) => s.id) as StatusId[];

export function isStatus(value: unknown): value is StatusId {
  return typeof value === "string" && STATUS_IDS.includes(value as StatusId);
}

/** Priority levels, low → urgent, with Tailwind classes for the badge. */
export const PRIORITIES = [
  { id: "low", label: "Low", badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  { id: "medium", label: "Medium", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { id: "high", label: "High", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { id: "urgent", label: "Urgent", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
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

/** Human-readable issue key, e.g. `VIBE-42`. */
export function issueKey(id: number) {
  return `VIBE-${id}`;
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
