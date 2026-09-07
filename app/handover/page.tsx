import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function HandoverPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('handovers').select('id,handover_code,status,project_id,handover_date,customer_acceptance_status,accepted_at,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Handover</h1><div className="muted">Stage 19 — checklist, snags and customer acceptance</div></div><a className="status" href="/service">Warranty / Service</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load handovers: {error.message}</p>:<table className="table"><thead><tr><th>Handover</th><th>Status</th><th>Project</th><th>Acceptance</th><th>Accepted</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.handover_code}</td><td>{r.status}</td><td>{r.project_id}</td><td>{r.customer_acceptance_status}</td><td>{r.accepted_at?new Date(r.accepted_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No handovers found.</td></tr>}</tbody></table>}</div></section></main>
}
