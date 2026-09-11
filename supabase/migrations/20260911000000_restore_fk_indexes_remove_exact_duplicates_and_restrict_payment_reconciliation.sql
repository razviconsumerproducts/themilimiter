-- Restore indexes required by foreign keys and remove only exact duplicate indexes.
-- This migration is intentionally limited to verified equivalent indexes.

CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS idx_mm_boms_approved_by ON public.millimetre_boms(approved_by);
CREATE INDEX IF NOT EXISTS idx_mm_boms_issued_by ON public.millimetre_boms(issued_by);
CREATE INDEX IF NOT EXISTS idx_mm_costing_runs_approved_by ON public.millimetre_costing_runs(approved_by);
CREATE INDEX IF NOT EXISTS idx_mm_costing_runs_superseded_by ON public.millimetre_costing_runs(superseded_by);

DROP INDEX IF EXISTS public.millimetre_bom_items_millimetre_bom_items_bom_id_fkey_idx;
DROP INDEX IF EXISTS public.idx_mm_production_pieces_order_status;
DROP INDEX IF EXISTS public.millimetre_quotations_millimetre_quotations_project_id_fkey_idx;
DROP INDEX IF EXISTS public.ux_sms_one_preferred_scope;
DROP INDEX IF EXISTS public.sales_orders_sales_orders_customer_id_fkey_idx;

-- Subscription payment reconciliation is webhook/provider reconciliation logic,
-- not a direct signed-in-user RPC.
REVOKE EXECUTE ON FUNCTION public.reconcile_subscription_payment(uuid, text, numeric, timestamptz, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_subscription_payment(uuid, text, numeric, timestamptz, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_subscription_payment(uuid, text, numeric, timestamptz, jsonb) FROM authenticated;
