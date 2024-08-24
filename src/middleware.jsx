import { NextResponse } from "next/server";

export function middleware(req) {
  const cookie = req.cookies.get("connect.sid");
  const url = req.nextUrl.clone();

  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next/static/") || // Skip HMR static files
    req.headers.get("upgrade") === "websocket" // Skip WebSocket connections
  ) {
    return NextResponse.next();
  }

  // If the user is already authenticated and tries to access the login page, redirect to the homepage
  if (cookie && url.pathname === "/login") {
    return NextResponse.redirect(
      new URL("/home", `${url.protocol}//${url.host}`),
    );
  }

  // If the user is not authenticated and tries to access a protected route, redirect to the login page
  if (!cookie && url.pathname !== "/login") {
    const loginUrl = new URL("/login", `${url.protocol}//${url.host}`);

    loginUrl.searchParams.set(
      "redirect",
      req.nextUrl.pathname + req.nextUrl.search,
    );

    return NextResponse.rewrite(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
