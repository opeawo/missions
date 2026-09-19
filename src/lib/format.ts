export function formatReward(amount: number | string, currency = "USDC"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function truncateWallet(address: string | null): string {
  if (!address) return "No wallet";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerTxUrl(hash: string, chain = "base"): string {
  if (hash.startsWith("mock_")) return "";
  if (chain === "base") return `https://basescan.org/tx/${hash}`;
  return `https://basescan.org/tx/${hash}`;
}
