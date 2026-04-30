"use client";

import { useEffect, useRef, useState } from "react";


/**
 * Off-screen aria-live region that announces "N new signal(s)" when fresh
 * rows arrive at the top of the table after an auto-refresh. Uses the
 * highest-id-seen-this-session as the watermark; a refresh that introduces
 * higher ids announces only the delta, not the full table.
 *
 * Pure SR-only: visually hidden via Tailwind's `sr-only` so sighted users
 * see no UI change. The wrapping element uses role="status" + aria-live so
 * additions are read promptly without interrupting other content.
 */
export function SignalAnnouncer({ latestId }: { latestId: number | null }) {
  const lastAnnouncedId = useRef<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (latestId == null) return;
    // First pass — establish baseline silently. We only announce changes
    // observed AFTER the user has seen the initial render.
    if (lastAnnouncedId.current === null) {
      lastAnnouncedId.current = latestId;
      return;
    }
    if (latestId > lastAnnouncedId.current) {
      lastAnnouncedId.current = latestId;
      setMessage(`New signal at ${new Date().toLocaleTimeString()}`);
    }
  }, [latestId]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
