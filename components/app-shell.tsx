import Link from "next/link";
import type { AuthUser } from "@/lib/auth";

const navItems: Array<{ href: string; label: string }> = [
  { href: "/screen", label: "Screening" },
  { href: "/calibration", label: "Calibration" },
  { href: "/compliance", label: "Compliance" },
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
  const items = user.role === "admin" ? [...navItems, { href: "/admin", label: "Admin" }] : navItems;

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <nav className={`mx-auto flex items-center justify-between gap-4 px-6 py-4 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
          <Link href="/screen" className="font-display text-base font-semibold tracking-tight">
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
        </nav>
      </header>
      <div className={`mx-auto px-6 py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div>
    </div>
  );
}
