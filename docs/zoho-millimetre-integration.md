# Zoho CRM ↔ MILLIMETRE

## Inbound webhook
POST /api/integrations/zoho/webhook

Required Vercel environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- ZOHO_WEBHOOK_SECRET

Send header x-millimetre-signature:
sha256(ZOHO_WEBHOOK_SECRET + "." + raw_request_body)

Events are stored privately in millimetre_internal.zoho_events and deduplicated by event_key.

## Default mapping
Contacts → contacts
Accounts → customers
Deals → projects
Quotes → quotations
Purchase Orders → purchase orders

The first slice captures events before mutating production ERP records. This preserves MILLIMETRE's existing authorization, commercial-release, purchase, inventory and production controls.

## Next slice
Add Zoho OAuth, server-side CRM API client, event processor, bidirectional status sync, retries/dead-letter handling, and an integration monitor.
