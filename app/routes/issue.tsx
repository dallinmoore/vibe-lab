import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/issue";
import { getUser } from "../auth.server";
import { ThemeToggle } from "../components/theme-toggle";
import {
  deleteIssue,
  getIssue,
  knownUsers,
  updateIssue,
} from "../issues.server";
import {
  initials,
  issueKey,
  PRIORITIES,
  priorityMeta,
  STATUSES,
  statusLabel,
} from "../issues";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${issueKey(data.issue.id)} · ${data.issue.title}` : "Issue" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = getUser(request);
  const id = Number(params.id);
  const issue = Number.isFinite(id) ? await getIssue(id) : null;
  if (!issue) {
    throw new Response("Issue not found", { status: 404 });
  }
  const users = await knownUsers(user.email);
  return { issue, users };
}

export async function action({ request, params }: Route.ActionArgs) {
  getUser(request); // ensure authenticated
  const id = Number(params.id);
  if (!Number.isFinite(id)) throw new Response("Bad request", { status: 400 });

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await deleteIssue(id);
    return redirect("/");
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) {
    return { error: "Title is required." };
  }
  await updateIssue(id, {
    title,
    description: String(form.get("description") ?? ""),
    status: String(form.get("status") ?? ""),
    priority: String(form.get("priority") ?? ""),
    assigneeEmail: String(form.get("assigneeEmail") ?? ""),
  });
  return redirect("/");
}

export default function IssueDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { issue, users } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const p = priorityMeta(issue.priority);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-8">
      <div className="pixel-box mb-6 flex flex-wrap items-center gap-3 bg-jungle px-4 py-3 dark:bg-jungle-deep">
        <Link to="/" className="font-pixel text-[10px] text-sun hover:underline">
          ← Board
        </Link>
        <span className="font-pixel text-[10px] text-emerald-50">{issueKey(issue.id)}</span>
        <span className={`px-1.5 py-0.5 text-xs font-bold ${p.badge}`}>
          {p.label}
        </span>
        <span className="font-pixel border-2 border-jungle-deep bg-sun px-1.5 py-0.5 text-[10px] text-jungle-deep dark:border-leaf">
          {statusLabel(issue.status)}
        </span>
        <span className="ml-auto">
          <ThemeToggle />
        </span>
      </div>

      <div className="pixel-box bg-white px-6 py-6 dark:bg-emerald-950">
      <p className="font-pixel mb-5 flex items-center gap-2 text-xs text-macaw">
        <span className="animate-bob text-2xl">🦜</span> FREE THIS CAPTIVE
      </p>

      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="update" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">Title</span>
          <input
            name="title"
            defaultValue={issue.title}
            required
            className="border-2 border-jungle-deep bg-white px-3 py-2 text-xl font-medium dark:border-leaf dark:bg-emerald-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">
            Description
          </span>
          <textarea
            name="description"
            defaultValue={issue.description}
            rows={6}
            className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">Status</span>
            <select
              name="status"
              defaultValue={issue.status}
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
              Priority
            </span>
            <select
              name="priority"
              defaultValue={issue.priority}
              className="border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
            >
              {PRIORITIES.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-pixel text-[10px] text-jungle-deep dark:text-leaf">Assignee</span>
          <div className="flex items-center gap-2">
            {issue.assigneeEmail && (
              <span className="flex h-8 w-8 items-center justify-center border-2 border-jungle-deep bg-sun text-[11px] font-bold text-jungle-deep dark:border-leaf">
                {initials(issue.assigneeEmail)}
              </span>
            )}
            <input
              name="assigneeEmail"
              list="known-users"
              defaultValue={issue.assigneeEmail ?? ""}
              placeholder="ranger email — blank = no ranger yet"
              className="flex-1 border-2 border-jungle-deep bg-white px-3 py-2 text-lg dark:border-leaf dark:bg-emerald-900"
            />
          </div>
          <datalist id="known-users">
            {users.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>

        <p className="font-pixel text-[9px] leading-relaxed text-jungle dark:text-leaf/70">
          🪶 spotted by {issue.creatorEmail} ·{" "}
          {new Date(issue.createdAt).toLocaleDateString()}
        </p>

        {actionData?.error && (
          <p className="font-pixel text-[10px] text-macaw">{actionData.error}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <button
            type="submit"
            name="intent"
            value="delete"
            formNoValidate
            onClick={(e) => {
              if (!confirm("Release this bird from the board?")) e.preventDefault();
            }}
            className="font-pixel px-3 py-2 text-[10px] text-macaw hover:underline"
          >
            🗑 Delete
          </button>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-pixel px-3 py-2 text-[10px] text-jungle-deep hover:underline dark:text-leaf"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="pixel-btn bg-jungle px-4 py-3 text-[10px] text-white hover:bg-jungle-deep disabled:opacity-50"
            >
              {busy ? "Saving…" : "🕊️ Save the rescue"}
            </button>
          </div>
        </div>
      </Form>
      </div>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="pixel-box bg-white p-8 text-center dark:bg-emerald-950">
        <div className="mb-3 text-5xl">🦜❓</div>
        <h1 className="font-pixel text-base text-macaw">This bird flew the coop</h1>
        <p className="mt-3 text-lg">
          That captive doesn't exist or was already freed.
        </p>
        <Link
          to="/"
          className="font-pixel mt-5 inline-block text-[10px] text-jungle hover:underline dark:text-leaf"
        >
          ← Back to the board
        </Link>
      </div>
    </main>
  );
}
