import { Form, Link, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/issue";
import { getUser } from "../auth.server";
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
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-6 py-8 dark:bg-gray-950">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← Board
        </Link>
        <span className="font-mono text-sm text-gray-400">{issueKey(issue.id)}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${p.badge}`}>
          {p.label}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {statusLabel(issue.status)}
        </span>
      </div>

      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="update" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Title</span>
          <input
            name="title"
            defaultValue={issue.title}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-base font-medium dark:border-gray-700 dark:bg-gray-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Description
          </span>
          <textarea
            name="description"
            defaultValue={issue.description}
            rows={6}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Status</span>
            <select
              name="status"
              defaultValue={issue.status}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
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
              defaultValue={issue.priority}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
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
          <span className="font-medium text-gray-700 dark:text-gray-300">Assignee</span>
          <div className="flex items-center gap-2">
            {issue.assigneeEmail && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {initials(issue.assigneeEmail)}
              </span>
            )}
            <input
              name="assigneeEmail"
              list="known-users"
              defaultValue={issue.assigneeEmail ?? ""}
              placeholder="email — leave blank for unassigned"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <datalist id="known-users">
            {users.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>

        <p className="text-xs text-gray-400">
          Created by {issue.creatorEmail} ·{" "}
          {new Date(issue.createdAt).toLocaleDateString()}
        </p>

        {actionData?.error && (
          <p className="text-sm text-red-600">{actionData.error}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <button
            type="submit"
            name="intent"
            value="delete"
            formNoValidate
            onClick={(e) => {
              if (!confirm("Delete this issue?")) e.preventDefault();
            }}
            className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Form>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
        Issue not found
      </h1>
      <p className="mt-2 text-gray-500">
        That issue doesn't exist or was deleted.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to board
      </Link>
    </main>
  );
}
