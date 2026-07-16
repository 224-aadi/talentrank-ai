import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth-page min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-base font-semibold tracking-tight">
            TalentRank<span className="text-primary">AI</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-lg flex-col justify-center px-6 py-12">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Secure workspace</p>
          <h1 className="auth-title mt-3 font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
