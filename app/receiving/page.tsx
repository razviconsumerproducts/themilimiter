import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ReceivingPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('goods_receipts').select('id,receipt_code,status,project_id,purchase_order_id,received_at,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Goods Receipt + QC</h1><div className="muted">Stage 13 — received, accepted and inventory-posted quantities stay distinct</div></div><a className="status" href="/inventory">Inventory</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load goods receipts: {error.message}</p>:<table className="table"><thead><tr><th>Receipt</th><th>Status</th><th>Project</th><th>Purchase Order</th><th>Received</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.receipt_code}</td><td>{r.status}</td><td>{r.project_id}</td><td>{r.purchase_order_id}</td><td>{r.received_at?new Date(r.received_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No goods receipts found.</td></tr>}</tbody></table>}</div></section></main>
}
