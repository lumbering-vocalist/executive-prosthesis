"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

/*
 * T1 placeholder plus T2's proof of the authed path: middleware only lets a
 * signed-in founder reach this page, and the viewer line shows the round trip
 * through an authed Convex query. The real home is the stream (§5.5); its
 * frame lands at T4 (proto-stream, D9).
 */
export default function Home() {
  const viewer = useQuery(api.users.viewer);
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
            await signOut();
            router.push("/signin");
          }}
        >
          Sign out
        </button>
      </footer>
    </>
  );
}
