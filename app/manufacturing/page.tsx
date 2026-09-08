import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ManufacturingPage() {
  const supabase = await createSupabaseServerClient()
  const [ordersResult, operationsResult, outputsResult, issuesResult] = await Promise.all([
    supabase.from('production_orders').select('id,order_no,status,priority,planned_start_date,planned_end_date,actual_start_date,actual_end_date,notes,project_id').order('created_at', { ascending: false }).limit(100),
    supabase.from('millimetre_production_operations').select('id,production_order_id,operation_code,operation_name,sequence_no,status,planned_minutes,actual_minutes,operator_id,started_at,completed_at,due_at,notes').order('sequence_no', { ascending: true }).limit(200),
    supabase.from('millimetre_production_outputs').select('id,production_order_id,operation_id,output_code,output_type,quantity,status,recorded_at').order('recorded_at', { ascending: false }).limit(100),
    supabase.from('millimetre_material_issues').select('id,issue_no,production_order_id,production_operation_id,material_id,warehouse_id,requested_qty,issued_qty,status,created_at').order('created_at', { ascending: false }).limit(100),
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
      <div className="card"><h2>Production Orders</h2><table className="table"><thead><tr><th>Order</th><th>Project</th><th>Priority</th><th>Status</th><th>Planned start</th><th>Planned end</th><th>Actual start</th><th>Actual end</th></tr></thead><tbody>{orders.map((o: any)=><tr key={o.id}><td>{o.order_no}</td><td>{o.project_id}</td><td>{o.priority ?? '—'}</td><td>{o.status}</td><td>{o.planned_start_date ?? '—'}</td><td>{o.planned_end_date ?? '—'}</td><td>{o.actual_start_date ?? '—'}</td><td>{o.actual_end_date ?? '—'}</td></tr>)}{!orders.length&&<tr><td colSpan={8}>No production orders found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Shop-floor Operations</h2><table className="table"><thead><tr><th>Sequence</th><th>Order</th><th>Code</th><th>Operation</th><th>Status</th><th>Planned min</th><th>Actual min</th><th>Started</th><th>Completed</th></tr></thead><tbody>{operations.map((o: any)=><tr key={o.id}><td>{o.sequence_no}</td><td>{o.production_order_id}</td><td>{o.operation_code}</td><td>{o.operation_name}</td><td>{o.status}</td><td>{o.planned_minutes ?? 0}</td><td>{o.actual_minutes ?? 0}</td><td>{o.started_at ? 'Yes' : 'No'}</td><td>{o.completed_at ? 'Yes' : 'No'}</td></tr>)}{!operations.length&&<tr><td colSpan={9}>No operations found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Material Issues</h2><table className="table"><thead><tr><th>Issue</th><th>Production order</th><th>Operation</th><th>Material</th><th>Requested</th><th>Issued</th><th>Status</th><th>Created</th></tr></thead><tbody>{issues.map((i: any)=><tr key={i.id}><td>{i.issue_no}</td><td>{i.production_order_id}</td><td>{i.production_operation_id ?? '—'}</td><td>{i.material_id}</td><td>{i.requested_qty}</td><td>{i.issued_qty ?? 0}</td><td>{i.status}</td><td>{i.created_at ? new Date(i.created_at).toLocaleString('en-IN') : '—'}</td></tr>)}{!issues.length&&<tr><td colSpan={8}>No material issues found.</td></tr>}</tbody></table></div>
      <div className="card"><h2>Production Outputs</h2><table className="table"><thead><tr><th>Order</th><th>Operation</th><th>Code</th><th>Type</th><th>Quantity</th><th>Status</th><th>Recorded</th></tr></thead><tbody>{outputs.map((o: any)=><tr key={o.id}><td>{o.production_order_id}</td><td>{o.operation_id}</td><td>{o.output_code}</td><td>{o.output_type}</td><td>{o.quantity}</td><td>{o.status}</td><td>{o.recorded_at ? new Date(o.recorded_at).toLocaleString('en-IN') : '—'}</td></tr>)}{!outputs.length&&<tr><td colSpan={7}>No outputs recorded.</td></tr>}</tbody></table></div>
    </section>
  </main>
}
