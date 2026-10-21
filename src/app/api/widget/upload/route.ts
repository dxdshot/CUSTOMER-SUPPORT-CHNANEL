import { NextResponse, type NextRequest } from "next/server";
import { widgetClient, widgetSite } from "@/lib/widget-admin";

/* Widget attachment upload → public Supabase Storage URL (D31). */
const MAX_BYTES = 10 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const siteKey = String(form.get("site") ?? "").trim();
  const visitor = String(form.get("visitor") ?? "").trim();
  if (!siteKey || !visitor) {
    return NextResponse.json({ error: "site and visitor are required" }, { status: 400 });
  }
  const client = widgetClient();
  const site = await widgetSite(siteKey);
  if (!client || !site) {
    return NextResponse.json(
      { error: client ? "Unknown site" : "Chat backend is not configured" },
      { status: client ? 404 : 503 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${site.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await client.storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) {
    return NextResponse.json({ error: "Could not upload the file" }, { status: 500 });
  }
  const { data } = client.storage.from("chat-attachments").getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    name: file.name,
    size: humanSize(file.size),
    type: file.type.startsWith("image/") ? "image" : "file",
  });
}
