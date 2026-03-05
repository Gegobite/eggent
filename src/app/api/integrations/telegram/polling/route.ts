import { NextRequest } from "next/server";
import {
  ensureTelegramPolling,
  getTelegramPollingStatus,
  stopTelegramPolling,
} from "@/lib/telegram/polling-runtime";
import { getTelegramIntegrationRuntimeConfig } from "@/lib/storage/telegram-integration-store";

function inferBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (!host) return "";
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runtime = await getTelegramIntegrationRuntimeConfig();
    return Response.json({
      mode: runtime.mode,
      status: getTelegramPollingStatus(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get Telegram polling status",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTelegramPolling({
      baseUrlHint: inferBaseUrl(req),
    });
    const runtime = await getTelegramIntegrationRuntimeConfig();
    return Response.json({
      success: true,
      mode: runtime.mode,
      status: getTelegramPollingStatus(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start Telegram polling",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  stopTelegramPolling();
  return Response.json({
    success: true,
    status: getTelegramPollingStatus(),
  });
}

