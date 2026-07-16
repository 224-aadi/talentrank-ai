import Link from "next/link";
import { canAccessInternalTools, type AuthUser } from "@/lib/auth";

const navItems: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
];

const internalNavItems: Array<{ href: string; label: string }> = [
  { href: "/quality", label: "Quality" },
  { href: "/trust", label: "Trust" },
];

export function AppShell({
  user,
  children,
  wide,
}: {
  user: AuthUser;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const items = [
    ...navItems,
    ...(canAccessInternalTools(user) ? internalNavItems : []),
    ...(user.role === "admin" ? [{ href: "/workspace", label: "Workspace" }] : []),
  ];

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <nav className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
          <Link href="/dashboard" className="font-display text-base font-semibold tracking-tight">
            TalentRank<span className="text-primary">AI</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Sign out
              </button>
            </form>
          </div>
          <details className="mobile-nav w-full md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md border border-border bg-card px-3 text-sm font-medium">
              Menu
              <span aria-hidden="true">+</span>
            </summary>
            <div className="mt-2 grid gap-2 rounded-md border border-border bg-card p-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </header>
      <div className={`app-content mx-auto px-6 py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div>
    </div>
  );
}
