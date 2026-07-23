import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);

// T2: every page requires the signed-in founder; /signin is the only
// unauthenticated page. Next internals and the enumerated static assets are
// excluded by the matcher below, so the manifest, icons, and fonts keep
// loading before auth — the PWA must be installable from the sign-in screen.
export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isSignInPage(request) && authed) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    if (!isSignInPage(request) && !authed) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
  // 30-day cookie instead of the session-cookie default: this is a
  // single-user installed PWA on the founder's own device, and iOS ends
  // "sessions" aggressively — a session cookie would mean re-typing the
  // password most weeks (CX12: installed-app auth continuity).
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Auth runs on every route except Next internals and the enumerated
  // pre-auth static surface (the PWA must be installable from the sign-in
  // screen: manifest, icons, fonts, favicon). Enumerated deliberately — the
  // old "anything with a dot" exclusion was a latent auth bypass for any
  // future route like /export/data.json (review P2). A new static asset that
  // isn't listed here fails safe: it redirects to /signin instead of leaking.
  // The Convex authed* wrappers remain the real enforcement either way.
  matcher: [
    "/((?!_next/|icons/|fonts/|favicon\\.ico$|manifest\\.webmanifest$).*)",
  ],
};
