import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { widgetClient, widgetSite } from "@/lib/widget-admin";

const requestSchema = z.object({
  site: z.string().trim().min(1).max(200),
  visitor: z.string().trim().min(1).max(200),
  session: z.string().trim().min(1).max(200),
  view: z.boolean(),
  name: z.string().trim().max(160),
  email: z.string().trim().max(160),
  browser: z.string().trim().max(160),
  os: z.string().trim().max(160),
  device: z.string().trim().max(160),
  timezone: z.string().trim().max(160),
  page: z.string().max(2048),
});

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: NextRequest) {
  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid presence request" }, { status: 400, headers: cors });
  const client = widgetClient();
  const site = await widgetSite(payload.data.site);
  if (!client || !site) return NextResponse.json({ error: "Site unavailable" }, { status: 503, headers: cors });
  const country = (request.headers.get("x-vercel-ip-country") ?? "").toUpperCase().slice(0, 2);
  const flag = /^[A-Z]{2}$/.test(country)
    ? String.fromCodePoint(...[...country].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
    : "";
  const data = payload.data;
  const { error } = await client.rpc("record_visitor_session", {
    p_session_id: data.session,
    p_site_id: site.id,
    p_visitor_id: data.visitor,
    p_view: data.view,
    p_name: data.name,
    p_email: data.email,
    p_country: country,
    p_flag: flag,
    p_browser: data.browser,
    p_os: data.os,
    p_device: data.device,
    p_timezone: data.timezone,
    p_page: data.page,
  });
  return error
    ? NextResponse.json({ error: "Could not record visit" }, { status: 503, headers: cors })
    : new NextResponse(null, { status: 204, headers: cors });
}
