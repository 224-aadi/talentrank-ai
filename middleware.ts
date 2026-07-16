import { NextResponse, type NextRequest } from "next/server";
import { isLocalUrl, publicAppUrl } from "@/lib/deployment";

const passthroughPrefixes = ["/api", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

export function middleware(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (passthroughPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) return NextResponse.next();
  if (process.env.VERCEL) return NextResponse.next();

  const appUrl = publicAppUrl();
  if (!appUrl) return NextResponse.next();

  const target = new URL(appUrl);
  if (isLocalUrl(target) || target.host === request.nextUrl.host) return NextResponse.next();

  const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, target);
  return NextResponse.redirect(redirectUrl);
}
