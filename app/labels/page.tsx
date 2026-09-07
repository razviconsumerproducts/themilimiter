import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function LabelsPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('production_labels').select('id,label_code,status,project_id,production_order_id,production_piece_id,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Labels / QR</h1><div className="muted">Stage 17 — traceable production labels</div></div><a className="status" href="/delivery">Delivery</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load labels: {error.message}</p>:<table className="table"><thead><tr><th>Label</th><th>Status</th><th>Project</th><th>Production Order</th><th>Piece</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.label_code}</td><td>{r.status}</td><td>{r.project_id}</td><td>{r.production_order_id}</td><td>{r.production_piece_id}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No labels found.</td></tr>}</tbody></table>}</div></section></main>
}
