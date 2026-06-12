/**
 * Server-only data access for issues.
 *
 * Centralizes the Prisma queries so the board and issue routes share one
 * implementation. The `.server.ts` suffix keeps it out of the client bundle.
 */
import { db } from "./db.server";
import { isPriority, isStatus, type StatusId } from "./issues";

/** All issues, ordered for board rendering (by column position, then id). */
export function listIssues() {
  return db.issue.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
}

export function getIssue(id: number) {
  return db.issue.findUnique({ where: { id } });
}

/**
 * Distinct set of emails we've seen as creators or assignees, plus the current
 * user. Powers the assignee picker — there's no separate user table, so the
 * people who've touched the board are the known users.
 */
export async function knownUsers(currentEmail: string): Promise<string[]> {
  const issues = await db.issue.findMany({
    select: { creatorEmail: true, assigneeEmail: true },
  });
  const emails = new Set<string>([currentEmail]);
  for (const i of issues) {
    if (i.creatorEmail) emails.add(i.creatorEmail);
    if (i.assigneeEmail) emails.add(i.assigneeEmail);
  }
  return [...emails].sort();
}

/** Create a new issue, appended to the bottom of its column. */
export async function createIssue(input: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeEmail?: string | null;
  creatorEmail: string;
}) {
  const status = isStatus(input.status) ? input.status : "todo";
  const priority = isPriority(input.priority) ? input.priority : "medium";

  // Append to the end of the target column.
  const last = await db.issue.findFirst({
    where: { status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  return db.issue.create({
    data: {
      title: input.title,
      description: input.description ?? "",
      status,
      priority,
      assigneeEmail: normalizeEmail(input.assigneeEmail),
      creatorEmail: input.creatorEmail,
      position,
    },
  });
}

/** Update editable fields of an issue. Undefined fields are left untouched. */
export async function updateIssue(
  id: number,
  input: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeEmail?: string | null;
  },
) {
  return db.issue.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(isStatus(input.status) ? { status: input.status } : {}),
      ...(isPriority(input.priority) ? { priority: input.priority } : {}),
      ...(input.assigneeEmail !== undefined
        ? { assigneeEmail: normalizeEmail(input.assigneeEmail) }
        : {}),
    },
  });
}

/**
 * Move an issue to a column at a given position (drag-and-drop).
 *
 * The client computes `position` as the midpoint between the two cards the
 * issue is dropped between, so only the moved row changes.
 */
export function moveIssue(id: number, status: StatusId, position: number) {
  return db.issue.update({
    where: { id },
    data: { status, position },
  });
}

export function deleteIssue(id: number) {
  return db.issue.delete({ where: { id } });
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}
