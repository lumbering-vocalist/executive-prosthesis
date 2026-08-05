"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

/*
 * T1 placeholder plus T2's proof of the authed path: middleware only lets a
 * signed-in founder reach this page, and the viewer line shows the round trip
 * through an authed Convex query. The real home is the stream (§5.5); its
 * frame lands at T4 (proto-stream, D9).
 *
 * The viewer query is gated on useConvexAuth (review P2): the middleware
 * cookie can be valid while the WebSocket session is still handshaking or a
 * token is refreshing — firing the authed query in that window throws "Not
 * signed in" and crashes the page for a signed-in founder.
 */
export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <>
      <p style={{ marginTop: "40vh", textAlign: "center" }}>
        Tell me things. I keep them, no matter what.
      </p>
      <footer className="session-footer">
        {viewer !== undefined && viewer.email !== null && (
          <span>{viewer.email}</span>
        )}
        <button
          className="session-signout"
          type="button"
          onClick={async () => {
            try {
              await signOut();
            } catch (error) {
              // A failed sign-out (network drop mid-request) must not strand
              // a half-signed-out UI; navigate anyway and let the middleware
              // decide — a still-valid cookie just bounces back here.
              Sentry.captureException(error);
            }
            router.push("/signin");
          }}
        >
          Sign out
        </button>
      </footer>
    </>
  );
}
