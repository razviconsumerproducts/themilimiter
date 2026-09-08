import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ManufacturingPage() {
  const supabase = await createSupabaseServerClient()
  const [ordersResult, operationsResult, outputsResult, issuesResult] = await Promise.all([
    supabase.from('production_orders').select('id,order_no,product_id,quantity,status,scheduled_start,scheduled_end,released_at,completed_at,good_qty,scrap_qty,rework_qty,yield_pct,project_id').order('created_at', { ascending: false }).limit(100),
    supabase.from('millimetre_production_operations').select('id,production_order_id,sequence_no,operation_name,status,planned_qty,completed_qty,scrap_qty,rework_qty,actual_minutes,queue_status,priority,due_at').order('sequence_no', { ascending: true }).limit(200),
    supabase.from('millimetre_production_outputs').select('id,production_order_id,production_operation_id,output_type,quantity,reason,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('millimetre_material_issues').select('id,issue_no,production_job_id,production_operation_id,material_id,warehouse_id,quantity,status,created_at').order('created_at', { ascending: false }).limit(100),
  ])
  const error = ordersResult.error || operationsResult.error || outputsResult.error || issuesResult.error
  const orders = ordersResult.data ?? []
  const operations = operationsResult.data ?? []
  const outputs = outputsResult.data ?? []
  const issues = issuesResult.data ?? []
  return <main className="main">
    <header className="top"><div><h1 className="title">Manufacturing</h1><div className="muted">Stage 15 — inventory → release → material issue → operations → output</div></div><div className="landing-actions"><a className="status" href="/quality">Production QC</a><a className="status" href="/labels">Labels / QR</a></div></header>
    <section className="section">
      {error && <div className="card"><p role="alert">Unable to load production data: {error.message}</p></div>}
      <div className="card"><h2>Production Orders</h2><table className="table"><thead><tr><th>Order</th><th>Project</th><th>Qty</th><th>Status</th><th>Good</th><th>Scrap</th><th>Rework</th><th>Yield</th><th>Released</th></tr></thead><tbody>{orders.map((o: any)=><tr key={o.id}><td>{o.order_no}</td><td>{o.project_id}</td><td>{o.quantity}</td><td>{o.status}</td><td>{o.good_qty ?? 0}</td><td>{o.scrap_qty ?? 0}</td><td>{o.rework_qty ?? 0}</td><td>{o.yield_pct == null ? '—' : `${Number(o.yield_pct).toFixed(1)}%`}</td><td>{o.released_at ? 'Yes' : 'No'}</td></tr>)}{!orders.length&&<tr><td colSpan={9}>No production orders found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Shop-floor Operations</h2><table className="table"><thead><tr><th>Sequence</th><th>Order</th><th>Operation</th><th>Status</th><th>Planned</th><th>Complete</th><th>Scrap</th><th>Rework</th><th>Minutes</th></tr></thead><tbody>{operations.map((o: any)=><tr key={o.id}><td>{o.sequence_no}</td><td>{o.production_order_id}</td><td>{o.operation_name}</td><td>{o.status}</td><td>{o.planned_qty ?? 0}</td><td>{o.completed_qty ?? 0}</td><td>{o.scrap_qty ?? 0}</td><td>{o.rework_qty ?? 0}</td><td>{o.actual_minutes ?? 0}</td></tr>)}{!operations.length&&<tr><td colSpan={9}>No operations found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Material Issues</h2><table className="table"><thead><tr><th>Issue</th><th>Production order</th><th>Operation</th><th>Material</th><th>Qty</th><th>Status</th><th>Created</th></tr></thead><tbody>{issues.map((i: any)=><tr key={i.id}><td>{i.issue_no}</td><td>{i.production_job_id}</td><td>{i.production_operation_id ?? '—'}</td><td>{i.material_id}</td><td>{i.quantity}</td><td>{i.status}</td><td>{i.created_at ? new Date(i.created_at).toLocaleString('en-IN') : '—'}</td></tr>)}{!issues.length&&<tr><td colSpan={7}>No material issues found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Production Outputs</h2><table className="table"><thead><tr><th>Order</th><th>Operation</th><th>Type</th><th>Quantity</th><th>Reason</th><th>Created</th></tr></thead><tbody>{outputs.map((o: any)=><tr key={o.id}><td>{o.production_order_id}</td><td>{o.production_operation_id}</td><td>{o.output_type}</td><td>{o.quantity}</td><td>{o.reason ?? '—'}</td><td>{o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : '—'}</td></tr>)}{!outputs.length&&<tr><td colSpan={6}>No outputs recorded.</td></tr>}</tbody></table></div>
    </section>
  </main>
}
