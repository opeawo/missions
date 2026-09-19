"use client";

import { useState } from "react";

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-field border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad"
    >
      {error}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-field border border-good/30 bg-good/10 px-3 py-2 text-sm text-good">
      {message}
    </p>
  );
}

export function useActionStateMessage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return { error, ok, setError, setOk };
}
