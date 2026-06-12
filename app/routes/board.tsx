import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { Route } from "./+types/board";
import { getUser } from "../auth.server";
import {
  createIssue,
  deleteIssue,
  knownUsers,
  listIssues,
  moveIssue,
} from "../issues.server";
import {
  initials,
  isStatus,
  issueKey,
  PRIORITIES,
  priorityMeta,
  shortName,
  STATUSES,
  type StatusId,
} from "../issues";

export function meta() {
  return [
    { title: "Vibe Board" },
    { name: "description", content: "A simple team issue board." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = getUser(request);
  const [issues, users] = await Promise.all([
    listIssues(),
    knownUsers(user.email),
  ]);
  return { issues, users, currentEmail: user.email };
}

export async function action({ request }: Route.ActionArgs) {
  const user = getUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      return { ok: false, error: "Title is required." };
    }
    await createIssue({
      title,
      description: String(form.get("description") ?? ""),
      status: String(form.get("status") ?? "todo"),
      priority: String(form.get("priority") ?? "medium"),
      assigneeEmail: String(form.get("assigneeEmail") ?? ""),
      creatorEmail: user.email,
    });
    return { ok: true };
  }

  if (intent === "move") {
    const id = Number(form.get("id"));
    const status = String(form.get("status"));
    const position = Number(form.get("position"));
    if (Number.isFinite(id) && isStatus(status) && Number.isFinite(position)) {
      await moveIssue(id, status, position);
    }
    return { ok: true };
  }

  if (intent === "delete") {
    const id = Number(form.get("id"));
    if (Number.isFinite(id)) await deleteIssue(id);
    return { ok: true };
  }

  return { ok: false, error: "Unknown action." };
}

type Issue = Awaited<ReturnType<typeof listIssues>>[number];

export default function Board({ loaderData }: Route.ComponentProps) {
  const { issues: loaderIssues, users, currentEmail } = loaderData;
  const moveFetcher = useFetcher();
  const [creating, setCreating] = useState(false);

  // Optimistic local copy so drag-and-drop feels instant; resynced whenever the
  // loader revalidates (after any create / move / delete).
  const [issues, setIssues] = useState<Issue[]>(loaderIssues);
  useEffect(() => setIssues(loaderIssues), [loaderIssues]);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    status: StatusId;
    index: number;
  } | null>(null);

  function columnIssues(status: StatusId) {
    return issues
      .filter((i) => i.status === status)
      .sort((a, b) => a.position - b.position || a.id - b.id);
  }

  function handleDrop(status: StatusId, index: number) {
    if (draggingId == null) return;
    const dragged = issues.find((i) => i.id === draggingId);
    setDraggingId(null);
    setDropTarget(null);
    if (!dragged) return;

    const neighbors = columnIssues(status).filter((i) => i.id !== draggingId);
    const before = neighbors[index - 1];
    const after = neighbors[index];
    let position: number;
    if (!before && !after) position = 1;
    else if (!before) position = after.position - 1;
    else if (!after) position = before.position + 1;
    else position = (before.position + after.position) / 2;

    // No-op if it didn't actually move.
    if (dragged.status === status && dragged.position === position) return;

    setIssues((prev) =>
      prev.map((i) => (i.id === draggingId ? { ...i, status, position } : i)),
    );
    moveFetcher.submit(
      { intent: "move", id: String(draggingId), status, position: String(position) },
      { method: "post" },
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Vibe Board
          </h1>
          <p className="text-sm text-gray-500">
            {issues.length} issue{issues.length === 1 ? "" : "s"} · signed in as{" "}
            {shortName(currentEmail)}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + New issue
        </button>
      </header>

      <div className="flex gap-4 overflow-x-auto p-6">
        {STATUSES.map((col) => {
          const cards = columnIssues(col.id);
          return (
            <section
              key={col.id}
              className="flex w-80 flex-shrink-0 flex-col rounded-lg bg-gray-100 dark:bg-gray-900"
              onDragOver={(e) => {
                e.preventDefault();
                // Hovering the column padding (below the cards) → append to end.
                if (e.target === e.currentTarget) {
                  setDropTarget({ status: col.id, index: cards.length });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(
                  col.id,
                  dropTarget?.status === col.id ? dropTarget.index : cards.length,
                );
              }}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {col.label}
                </h2>
                <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {cards.length}
                </span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {cards.map((issue, index) => (
                  <div key={issue.id}>
                    {dropTarget?.status === col.id && dropTarget.index === index && (
                      <DropLine />
                    )}
                    <IssueCard
                      issue={issue}
                      dragging={draggingId === issue.id}
                      onDragStart={() => setDraggingId(issue.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY - rect.top > rect.height / 2;
                        setDropTarget({
                          status: col.id,
                          index: after ? index + 1 : index,
                        });
                      }}
                    />
                  </div>
                ))}
                {dropTarget?.status === col.id &&
                  dropTarget.index === cards.length && <DropLine />}
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-gray-400">
                    Drop issues here
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {creating && (
        <NewIssueModal
          users={users}
          currentEmail={currentEmail}
          onClose={() => setCreating(false)}
        />
      )}
    </main>
  );
}

function DropLine() {
  return <div className="my-1 h-0.5 rounded bg-blue-500" />;
}

function IssueCard({
  issue,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  issue: Issue;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  const p = priorityMeta(issue.priority);
  return (
    <Link
      to={`/issues/${issue.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`block cursor-grab rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-800 ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {issue.title}
      </p>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-400">
            {issueKey(issue.id)}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${p.badge}`}>
            {p.label}
          </span>
        </div>
        {issue.assigneeEmail ? (
          <span
            title={issue.assigneeEmail}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            {initials(issue.assigneeEmail)}
          </span>
        ) : (
          <span
            title="Unassigned"
            className="h-6 w-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600"
          />
        )}
      </div>
    </Link>
  );
}

function NewIssueModal({
  users,
  currentEmail,
  onClose,
}: {
  users: string[];
  currentEmail: string;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = fetcher.state !== "idle";

  // Close once a submission has completed successfully.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          New issue
        </h2>
        <fetcher.Form ref={formRef} method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="create" />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Title</span>
            <input
              name="title"
              required
              autoFocus
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Description
            </span>
            <textarea
              name="description"
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Status
              </span>
              <select
                name="status"
                defaultValue="todo"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Priority
              </span>
              <select
                name="priority"
                defaultValue="medium"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Assignee
            </span>
            <input
              name="assigneeEmail"
              list="known-users"
              placeholder="email — leave blank for unassigned"
              defaultValue=""
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
            <datalist id="known-users">
              {users.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => {
                const input =
                  formRef.current?.elements.namedItem("assigneeEmail");
                if (input instanceof HTMLInputElement) input.value = currentEmail;
              }}
              className="self-start text-xs text-blue-600 hover:underline"
            >
              Assign to me
            </button>
          </label>

          {fetcher.data?.error && (
            <p className="text-sm text-red-600">{fetcher.data.error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create issue"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}
