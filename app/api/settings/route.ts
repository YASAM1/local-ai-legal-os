import { NextResponse } from "next/server";
import { getSettings, setSettings, type AppSettings } from "@/lib/settings";

export async function GET() {
  const s = getSettings();
  // Don't leak the API key — return a masked indicator.
  return NextResponse.json({
    ...s,
    ai_gateway_api_key: s.ai_gateway_api_key ? "•••••" : "",
    ai_gateway_api_key_set: Boolean(s.ai_gateway_api_key),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AppSettings>;
    // Don't overwrite the stored key when the UI sends the masked placeholder.
    if (body.ai_gateway_api_key === "•••••" || body.ai_gateway_api_key === "") {
      delete body.ai_gateway_api_key;
    }
    const next = await setSettings(body);
    return NextResponse.json({
      ok: true,
      settings: {
        ...next,
        ai_gateway_api_key: next.ai_gateway_api_key ? "•••••" : "",
        ai_gateway_api_key_set: Boolean(next.ai_gateway_api_key),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}
