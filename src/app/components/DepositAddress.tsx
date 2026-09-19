"use client";

import { useState } from "react";

export function DepositAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <p className="text-label text-muted-foreground">Deposit address (Base USDC)</p>
      <p className="mt-2 break-all font-mono text-sm">{address}</p>
      <button type="button" className="btn-quiet mt-2" onClick={copy}>
        {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
}
