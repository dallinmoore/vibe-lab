import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { getUser } from "./auth.server";
import "./app.css";

/**
 * Global root loader — runs on the server for every request.
 *
 * Resolves the authenticated user once at the top of the tree. The returned
 * data is available to every route via `useRouteLoaderData("root")`, which the
 * `useUser()` hook wraps. `getUser` throws a 401 in production if the trusted
 * identity header is missing, which the `ErrorBoundary` below renders cleanly.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = getUser(request);
  return { user };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Set the theme class before first paint to avoid a flash. Uses the
            saved choice, falling back to the OS preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    // Identity guard tripped: the root loader couldn't resolve a user.
    if (error.status === 401) {
      message = "Not signed in";
      details =
        "We couldn't verify your identity. Please access this app through " +
        "the authenticated gateway.";
    } else {
      message = error.status === 404 ? "404" : "Error";
      details =
        error.status === 404
          ? "The requested page could not be found."
          : error.statusText || details;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <div className="pixel-box mx-auto max-w-xl bg-white p-6 dark:bg-emerald-950">
        <div className="mb-3 text-5xl">🦜💔</div>
        <h1 className="font-pixel text-xl text-macaw">{message}</h1>
        <p className="mt-3 text-lg">{details}</p>
        <p className="font-pixel mt-4 text-xs text-jungle dark:text-leaf">
          FREE THE CAPTIVES
        </p>
        {stack && (
          <pre className="mt-4 w-full overflow-x-auto rounded bg-emerald-950 p-4 text-xs text-leaf">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
