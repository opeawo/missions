import { DomainError } from "./types";

const BASE_USDC = process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const MICROS_PER_USDC = 10n ** BigInt(USDC_DECIMALS);
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DEFAULT_FEE_BPS = 1500;

export function paymentMode(): "mock" | "live" {
  return process.env.PAYMENT_MODE === "live" ? "live" : "mock";
}

export function assertAddress(value: string | null | undefined, label: string): string {
  if (!value || !ADDRESS_PATTERN.test(value)) {
    throw new DomainError(`${label} must be a 0x Base address`, "invalid_address");
  }
  return value;
}

export function platformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  const bps = raw === undefined || raw === "" ? DEFAULT_FEE_BPS : Number(raw);
  if (!Number.isInteger(bps) || bps < 0 || bps >= 10_000) {
    throw new DomainError("PLATFORM_FEE_BPS must be a whole number below 10000", "fee_config");
  }
  return bps;
}

export function masterWalletAddress(): string {
  return assertAddress(
    process.env.PLATFORM_MASTER_WALLET_ADDRESS,
    "PLATFORM_MASTER_WALLET_ADDRESS",
  );
}

/** USDC has 6 decimals, so all money math runs on integer micro-units. */
export function toMicros(amount: number | string): bigint {
  const text = typeof amount === "number" ? amount.toFixed(USDC_DECIMALS) : amount.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new DomainError(`Expected a positive USDC amount, got "${amount}"`, "validation");
  }
  const [whole, fraction = ""] = text.split(".");
  const micros = (fraction + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole) * MICROS_PER_USDC + BigInt(micros);
}

export function toDecimalString(micros: bigint): string {
  const whole = micros / MICROS_PER_USDC;
  const fraction = (micros % MICROS_PER_USDC).toString().padStart(USDC_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

export function toAmount(micros: bigint): number {
  return Number(toDecimalString(micros));
}

export type FeeSplit = {
  bps: number;
  rewardMicros: bigint;
  feeMicros: bigint;
  grossMicros: bigint;
};

/**
 * The fee is charged on top of the reward: the developer always receives the full
 * reward and the organization pays reward + fee. Integer division truncates, so
 * rounding favours the organization by at most one micro-USDC.
 */
export function splitFee(reward: number | string, bps: number = platformFeeBps()): FeeSplit {
  const rewardMicros = toMicros(reward);
  if (rewardMicros <= 0n) {
    throw new DomainError("Reward must be greater than 0", "validation");
  }
  const feeMicros = (rewardMicros * BigInt(bps)) / 10_000n;
  return { bps, rewardMicros, feeMicros, grossMicros: rewardMicros + feeMicros };
}

async function thirdwebContext() {
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  if (!secretKey) {
    throw new DomainError(
      "THIRDWEB_SECRET_KEY is required for wallet operations",
      "thirdweb_config",
    );
  }
  const [{ createThirdwebClient, getContract, getContractEvents, Engine }, { base }, erc20] =
    await Promise.all([
      import("thirdweb"),
      import("thirdweb/chains"),
      import("thirdweb/extensions/erc20"),
    ]);
  const client = createThirdwebClient({ secretKey });
  return {
    client,
    Engine,
    erc20,
    getContractEvents,
    usdc: getContract({ client, chain: base, address: BASE_USDC }),
  };
}

export type ServerWalletAddresses = {
  address: string;
  smartAccountAddress: string | null;
};

/**
 * Server wallets are keyed by label, so the same label always resolves to the same
 * wallet and no private key is ever exposed. `address` is the one to fund: Engine
 * executes from it directly on Base.
 */
export async function provisionServerWallet(label: string): Promise<ServerWalletAddresses> {
  const { client, Engine } = await thirdwebContext();
  const { accounts } = await Engine.getServerWallets({ client, limit: 1000 });
  const existing = accounts.find((account) => account.label === label);
  if (existing) {
    return {
      address: existing.address,
      smartAccountAddress: existing.smartAccountAddress ?? null,
    };
  }
  const created = await Engine.createServerWallet({ client, label });
  return {
    address: created.address,
    smartAccountAddress: created.smartAccountAddress ?? null,
  };
}

export async function usdcBalanceMicros(address: string): Promise<bigint> {
  const { usdc, erc20 } = await thirdwebContext();
  const balance = await erc20.getBalance({
    contract: usdc,
    address: assertAddress(address, "Wallet address"),
  });
  return balance.value;
}

export type DepositOrigin = { from: string; amountMicros: bigint };

/**
 * Reconstructs who funded a wallet from USDC Transfer logs, largest first. Money may
 * only ever be returned to these addresses: allowing a company to nominate a
 * different destination would turn the platform into a way to pay USDC in at one
 * address and take it out at another.
 */
export async function usdcDepositsBySender(address: string): Promise<DepositOrigin[]> {
  const wallet = assertAddress(address, "Wallet address");
  const { usdc, erc20, getContractEvents } = await thirdwebContext();
  const events = await getContractEvents({
    contract: usdc,
    events: [erc20.transferEvent({ to: wallet })],
  });

  const totals = new Map<string, bigint>();
  for (const event of events) {
    const from = event.args.from;
    if (!from || from === ZERO_ADDRESS) continue;
    if (from.toLowerCase() === wallet.toLowerCase()) continue;
    totals.set(from, (totals.get(from) ?? 0n) + event.args.value);
  }

  return [...totals.entries()]
    .map(([from, amountMicros]) => ({ from, amountMicros }))
    .sort((a, b) => (a.amountMicros === b.amountMicros ? 0 : a.amountMicros > b.amountMicros ? -1 : 1));
}

export type UsdcTransfer = { to: string; amountMicros: bigint };

/** Sends USDC from a server wallet. Multiple transfers share a single batch transaction. */
export async function sendUsdcFrom(from: string, transfers: UsdcTransfer[]): Promise<string> {
  if (transfers.length === 0) {
    throw new DomainError("Nothing to transfer", "validation");
  }
  const { client, Engine, erc20, usdc } = await thirdwebContext();
  const wallet = Engine.serverWallet({ client, address: assertAddress(from, "Sender wallet") });
  const prepared = transfers.map((item) =>
    erc20.transfer({
      contract: usdc,
      to: assertAddress(item.to, "Recipient wallet"),
      amountWei: item.amountMicros,
    }),
  );
  const { transactionId } =
    prepared.length === 1
      ? await wallet.enqueueTransaction({ transaction: prepared[0] })
      : await wallet.enqueueBatchTransaction({ transactions: prepared });
  const { transactionHash } = await Engine.waitForTransactionHash({ client, transactionId });
  return transactionHash;
}
