"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: 24 }}>
        <h2>Something went wrong</h2>
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          {error?.message || "Unexpected application error"}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

