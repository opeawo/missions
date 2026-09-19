"use client";

import { useState } from "react";

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm text-[var(--bad)]">
      {error}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-[var(--good)]/40 bg-[var(--good)]/10 px-3 py-2 text-sm text-[var(--good)]">
      {message}
    </p>
  );
}

export function useActionStateMessage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return { error, ok, setError, setOk };
}
