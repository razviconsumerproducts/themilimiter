import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function DeliveryPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('deliveries').select('id,delivery_code,status,project_id,planned_date,delivery_date,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Delivery</h1><div className="muted">Stage 18 — dispatch and delivery control</div></div><a className="status" href="/installation">Installation</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load deliveries: {error.message}</p>:<table className="table"><thead><tr><th>Delivery</th><th>Status</th><th>Project</th><th>Planned</th><th>Delivered</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.delivery_code}</td><td>{r.status}</td><td>{r.project_id}</td><td>{r.planned_date??'—'}</td><td>{r.delivery_date??'—'}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No deliveries found.</td></tr>}</tbody></table>}</div></section></main>
}
