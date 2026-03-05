import { NextRequest } from "next/server";
import {
  getTelegramIntegrationPublicSettings,
  saveTelegramIntegrationFromPublicInput,
  getTelegramIntegrationRuntimeConfig,
} from "@/lib/storage/telegram-integration-store";
import { ensureTelegramPolling, stopTelegramPolling } from "@/lib/telegram/polling-runtime";

export async function GET() {
  try {
    const runtime = await getTelegramIntegrationRuntimeConfig();
    if (runtime.mode === "polling") {
      await ensureTelegramPolling();
    } else {
      stopTelegramPolling();
    }
    const settings = await getTelegramIntegrationPublicSettings();
    return Response.json(settings);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Telegram integration settings",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await saveTelegramIntegrationFromPublicInput(body);
    const runtime = await getTelegramIntegrationRuntimeConfig();
    if (runtime.mode === "polling") {
      await ensureTelegramPolling();
    } else {
      stopTelegramPolling();
    }
    const settings = await getTelegramIntegrationPublicSettings();
    return Response.json({
      success: true,
      ...settings,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Telegram integration settings",
      },
      { status: 500 }
    );
  }
}
