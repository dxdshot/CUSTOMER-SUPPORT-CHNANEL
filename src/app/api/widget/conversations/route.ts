import { NextResponse, type NextRequest } from "next/server";
import { widgetClient, widgetSite } from "@/lib/widget-admin";

/* Past chats for one visitor — summaries only (D31). */
export async function GET(request: NextRequest) {
  const siteKey = request.nextUrl.searchParams.get("site") ?? "";
  const visitor = request.nextUrl.searchParams.get("visitor") ?? "";
  if (!siteKey || !visitor) {
    return NextResponse.json({ error: "Missing site or visitor" }, { status: 400 });
  }
  const client = widgetClient();
  const site = await widgetSite(siteKey);
  if (!client || !site) {
    return NextResponse.json(
      { error: client ? "Unknown site" : "Chat backend is not configured" },
      { status: client ? 404 : 503 },
    );
  }

  const { data } = await client
    .from("conversations")
    .select("id, status, last_message, updated_at")
    .eq("site_id", site.id)
    .eq("visitor_id", visitor)
    .order("updated_at", { ascending: false })
    .limit(20);

  return NextResponse.json(
    (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      lastMessage: row.last_message ?? "",
      updatedAt: row.updated_at,
    })),
  );
}
