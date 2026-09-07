import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ServicePage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('service_requests').select('id,request_code,status,project_id,customer_id,subject,priority,requested_at').order('requested_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Warranty / Service</h1><div className="muted">Stage 20 — service requests and warranty cases</div></div><a className="status" href="/">Dashboard</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load service requests: {error.message}</p>:<table className="table"><thead><tr><th>Request</th><th>Subject</th><th>Status</th><th>Priority</th><th>Project</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.request_code}</td><td>{r.subject}</td><td>{r.status}</td><td>{r.priority}</td><td>{r.project_id??'—'}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No service requests found.</td></tr>}</tbody></table>}</div></section></main>
}
