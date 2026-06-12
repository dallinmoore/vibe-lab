import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { Route } from "./+types/board";
import { getUser } from "../auth.server";
import { ThemeToggle } from "../components/theme-toggle";
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
    { title: "🦜 FREE THE CAPTIVES — Parrot Rescue Board" },
    {
      name: "description",
      content: "A pixel-art parrot rescue board. Free the captives, one squawk at a time.",
    },
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
    <main className="min-h-screen">
      <CaptiveMarquee />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-jungle-deep bg-jungle px-6 py-5 dark:border-emerald-950 dark:bg-jungle-deep">
        <div className="flex items-center gap-3">
          <span className="animate-bob text-5xl" aria-hidden>
            🦜
          </span>
          <div>
            <h1 className="font-pixel text-base leading-relaxed text-sun drop-shadow-[2px_2px_0_#0a2540] sm:text-xl">
              FREE THE CAPTIVES
            </h1>
            <p className="font-pixel mt-2 text-[10px] text-emerald-50">
              {issues.length} bird{issues.length === 1 ? "" : "s"} on the board · ranger{" "}
              {shortName(currentEmail)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setCreating(true)}
            className="pixel-btn bg-macaw px-4 py-3 text-xs text-white hover:bg-macaw-dark"
          >
            + NEW RESCUE
          </button>
        </div>
      </header>

      <div className="flex gap-4 overflow-x-auto p-6">
        {STATUSES.map((col) => {
          const cards = columnIssues(col.id);
          return (
            <section
              key={col.id}
              className="pixel-box flex w-80 flex-shrink-0 flex-col bg-white/80 dark:bg-emerald-950/80"
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
              <div className="flex items-center justify-between border-b-4 border-jungle-deep bg-leaf/40 px-3 py-3 dark:border-emerald-950 dark:bg-jungle-deep/60">
                <h2 className="font-pixel text-[11px] text-jungle-deep dark:text-leaf">
                  {col.label}
                </h2>
                {/* Column count hidden for now — restore when asked to show it again. */}
                {/* <span className="font-pixel rounded-none border-2 border-jungle-deep bg-sun px-2 py-0.5 text-[10px] text-jungle-deep dark:border-leaf">
                  {cards.length}
                </span> */}
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
                  <p className="font-pixel px-2 py-6 text-center text-[9px] leading-relaxed text-jungle dark:text-leaf/70">
                    🪹 no birds here<br />drop one to free it
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
  return <div className="my-1 h-1 bg-macaw" />;
}

/** Scrolling 8-bit banner — the rallying cry, repeated so the loop is seamless. */
function CaptiveMarquee() {
  const cry =
    "🦜 FREE THE CAPTIVES ★ SQUAWK ★ FREE THE CAPTIVES ★ 🪶 ★ FREE THE CAPTIVES ★ ";
  return (
    <div className="overflow-hidden border-b-4 border-jungle-deep bg-sun py-1.5 dark:border-emerald-950">
      <div className="animate-marquee font-pixel whitespace-nowrap text-[10px] text-jungle-deep">
        <span>{cry.repeat(4)}</span>
        <span aria-hidden>{cry.repeat(4)}</span>
      </div>
    </div>
  );
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
      className={`pixel-box block cursor-grab bg-white p-3 transition active:cursor-grabbing dark:bg-emerald-900 ${
        dragging ? "opacity-40" : "hover:-translate-y-0.5"
      }`}
    >
      <p className="text-lg leading-tight font-medium text-gray-900 dark:text-emerald-50">
        {issue.title}
      </p>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-jungle dark:text-leaf">
            {issueKey(issue.id)}
          </span>
          <span className={`px-1.5 py-0.5 text-xs font-bold ${p.badge}`}>
            {p.label}
          </span>
        </div>
        {issue.assigneeEmail ? (
          <span
            title={issue.assigneeEmail}
            className="flex h-7 w-7 items-center justify-center border-2 border-jungle-deep bg-sun text-[10px] font-bold text-jungle-deep dark:border-leaf"
          >
            {initials(issue.assigneeEmail)}
          </span>
        ) : (
          <span
            title="No ranger assigned"
            className="flex h-7 w-7 items-center justify-center border-2 border-dashed border-jungle/60 text-xs dark:border-leaf/50"
          >
            🪺
          </span>
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
      className="fixed inset-0 z-10 flex items-start justify-center bg-jungle-deep/70 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="pixel-box w-full max-w-lg bg-white p-5 dark:bg-emerald-950"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-pixel mb-4 flex items-center gap-2 text-sm text-macaw">
          <span className="text-2xl">🦜</span> NEW RESCUE
        </h2>
        <fetcher.Form ref={formRef} method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="create" />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
              Bird's name
            </span>
            <input
              name="title"
              required
              autoFocus
              className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
              Rescue notes
            </span>
            <textarea
              name="description"
              rows={3}
              className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
                Cage status
              </span>
              <select
                name="status"
                defaultValue="todo"
                className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
                Urgency
              </span>
              <select
                name="priority"
                defaultValue="medium"
                className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
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
            <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
              Assigned ranger
            </span>
            <input
              name="assigneeEmail"
              list="known-users"
              placeholder="ranger email — blank = no ranger yet"
              defaultValue=""
              className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
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
              className="font-pixel self-start text-[9px] text-sky-deep hover:underline dark:text-sky"
            >
              ▶ assign to me
            </button>
          </label>

          {fetcher.data?.error && (
            <p className="font-pixel text-[10px] text-macaw">{fetcher.data.error}</p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="font-pixel px-3 py-2 text-[10px] text-jungle-deep hover:underline dark:text-leaf"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pixel-btn bg-jungle px-4 py-3 text-[10px] text-white hover:bg-jungle-deep disabled:opacity-50"
            >
              {submitting ? "Freeing…" : "🕊️ Free this bird"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}
