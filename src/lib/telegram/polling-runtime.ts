import {
  getTelegramIntegrationRuntimeConfig,
  type TelegramIntegrationRuntimeConfig,
} from "@/lib/storage/telegram-integration-store";

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: unknown;
};

type TelegramPollingState = {
  running: boolean;
  startedAt: string | null;
  lastPollAt: string | null;
  lastError: string | null;
  endpointBaseUrl: string | null;
  nextOffset: number | null;
};

const POLL_TIMEOUT_SECONDS = 25;
const RETRY_DELAY_MS = 2_000;

const state: TelegramPollingState & {
  loopPromise: Promise<void> | null;
  stopRequested: boolean;
} = {
  running: false,
  startedAt: null,
  lastPollAt: null,
  lastError: null,
  endpointBaseUrl: null,
  nextOffset: null,
  loopPromise: null,
  stopRequested: false,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseTelegramError(status: number, payload: TelegramApiResponse | null): string {
  const description = typeof payload?.description === "string" ? payload.description.trim() : "";
  return description
    ? `Telegram API error (${status}): ${description}`
    : `Telegram API error (${status})`;
}

function normalizeBaseUrl(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function resolveEndpointBaseUrl(
  runtime: TelegramIntegrationRuntimeConfig,
  baseUrlHint?: string
): string {
  const candidates = [
    baseUrlHint,
    runtime.publicBaseUrl,
    process.env.APP_BASE_URL,
    "http://127.0.0.1:3000",
  ];
  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate || "");
    if (normalized) return normalized;
  }
  return "";
}

async function callTelegramGetUpdates(params: {
  botToken: string;
  offset?: number;
}): Promise<Array<Record<string, unknown>>> {
  const body: Record<string, unknown> = {
    timeout: POLL_TIMEOUT_SECONDS,
    allowed_updates: ["message"],
    limit: 100,
  };
  if (typeof params.offset === "number" && Number.isFinite(params.offset)) {
    body.offset = params.offset;
  }

  const response = await fetch(`https://api.telegram.org/bot${params.botToken}/getUpdates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(parseTelegramError(response.status, payload));
  }

  const updates = Array.isArray(payload.result) ? payload.result : [];
  return updates.filter((item) => item && typeof item === "object") as Array<
    Record<string, unknown>
  >;
}

async function forwardUpdate(params: {
  endpointBaseUrl: string;
  webhookSecret: string;
  update: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch(`${params.endpointBaseUrl}/api/integrations/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": params.webhookSecret,
    },
    body: JSON.stringify(params.update),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Forwarding update failed (${response.status})`;
    throw new Error(message);
  }
}

async function runPollingLoop(): Promise<void> {
  while (!state.stopRequested) {
    try {
      const runtime = await getTelegramIntegrationRuntimeConfig();
      if (runtime.mode !== "polling" || !runtime.botToken.trim()) {
        break;
      }
      if (!runtime.webhookSecret.trim()) {
        throw new Error(
          "Telegram webhook secret is not configured. Polling forwards updates through the Telegram endpoint."
        );
      }

      const endpointBaseUrl = state.endpointBaseUrl || resolveEndpointBaseUrl(runtime);
      if (!endpointBaseUrl) {
        throw new Error("Cannot resolve local endpoint base URL for Telegram polling");
      }
      state.endpointBaseUrl = endpointBaseUrl;

      const updates = await callTelegramGetUpdates({
        botToken: runtime.botToken.trim(),
        offset: state.nextOffset ?? undefined,
      });
      state.lastPollAt = nowIso();
      state.lastError = null;

      for (const update of updates) {
        if (state.stopRequested) break;
        await forwardUpdate({
          endpointBaseUrl,
          webhookSecret: runtime.webhookSecret.trim(),
          update,
        });
        const updateId =
          typeof update.update_id === "number" && Number.isInteger(update.update_id)
            ? update.update_id
            : null;
        if (updateId !== null) {
          state.nextOffset = updateId + 1;
        }
      }
    } catch (error) {
      state.lastError =
        error instanceof Error ? error.message : "Telegram polling loop failed";
      await sleep(RETRY_DELAY_MS);
    }
  }

  state.running = false;
  state.loopPromise = null;
}

export function getTelegramPollingStatus(): TelegramPollingState {
  return {
    running: state.running,
    startedAt: state.startedAt,
    lastPollAt: state.lastPollAt,
    lastError: state.lastError,
    endpointBaseUrl: state.endpointBaseUrl,
    nextOffset: state.nextOffset,
  };
}

export function stopTelegramPolling(): void {
  state.stopRequested = true;
}

export async function ensureTelegramPolling(params?: {
  baseUrlHint?: string;
}): Promise<void> {
  const runtime = await getTelegramIntegrationRuntimeConfig();
  if (runtime.mode !== "polling" || !runtime.botToken.trim()) {
    stopTelegramPolling();
    return;
  }

  const resolvedEndpoint = resolveEndpointBaseUrl(runtime, params?.baseUrlHint);
  if (resolvedEndpoint) {
    state.endpointBaseUrl = resolvedEndpoint;
  }

  if (state.running) {
    return;
  }

  state.stopRequested = false;
  state.running = true;
  state.startedAt = nowIso();
  state.lastError = null;
  state.loopPromise = runPollingLoop();
}

