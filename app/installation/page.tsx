import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function InstallationPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('installations').select('id,installation_code,status,project_id,planned_date,completed_at,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Installation</h1><div className="muted">Stage 18 — installation progress and customer sign-off</div></div><a className="status" href="/handover">Handover</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load installations: {error.message}</p>:<table className="table"><thead><tr><th>Installation</th><th>Status</th><th>Project</th><th>Planned</th><th>Completed</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.installation_code}</td><td>{r.status}</td><td>{r.project_id}</td><td>{r.planned_date??'—'}</td><td>{r.completed_at?new Date(r.completed_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No installations found.</td></tr>}</tbody></table>}</div></section></main>
}
