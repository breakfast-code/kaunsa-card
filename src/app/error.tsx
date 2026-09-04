"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Kaunsa Card page error", error);
  }, [error]);

  return (
    <main className="review-login">
      <div>
        <span className="step">RECOMMENDATION UNAVAILABLE</span>
        <h1>We could not load the reviewed rules.</h1>
        <p>We will not guess when the source data is unavailable. Check your connection and try again.</p>
        <button className="primary" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
