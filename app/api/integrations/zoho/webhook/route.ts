import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;

function validSignature(rawBody: string, signature: string | null) {
  if (!webhookSecret || !signature) return false;
  const expected = createHash("sha256").update(webhookSecret + "." + rawBody).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret)
    return NextResponse.json({ ok: false, error: "Zoho integration is not configured" }, { status: 503 });

  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-millimetre-signature")))
    return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const module = String(body.module ?? body.module_name ?? "unknown");
  const operation = String(body.operation ?? body.event ?? "upsert");
  const zohoRecordId = body.record_id ?? body.id ?? body.data?.[0]?.id ?? null;
  const eventKey = String(body.event_id ?? body.webhook_id ??
    (module + ":" + operation + ":" + (zohoRecordId ?? createHash("sha256").update(rawBody).digest("hex"))));

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await supabase.schema("millimetre_internal").from("zoho_events").upsert({
    event_key: eventKey, module, operation,
    zoho_record_id: zohoRecordId ? String(zohoRecordId) : null,
    project_id: body.project_id ?? body.millimetre_project_id ?? null,
    payload: body, status: "received",
  }, { onConflict: "event_key", ignoreDuplicates: true });

  if (error) return NextResponse.json({ ok: false, error: "Event persistence failed" }, { status: 500 });
  return NextResponse.json({ ok: true, event_key: eventKey, status: "received" });
}

export async function GET() {
  return NextResponse.json({ service: "MILLIMETRE Zoho CRM integration", endpoint: "/api/integrations/zoho/webhook", status: "ready" });
}
