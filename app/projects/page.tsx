import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('projects').select('id,code,name,status,current_stage,created_at').order('created_at', { ascending: false }).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Projects</h1><div className="muted">Stage 2 — canonical project register</div></div><a className="status" href="/">Dashboard</a></header><section className="section"><div className="card">{error ? <p role="alert">Unable to load projects: {error.message}</p> : <table className="table"><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Stage</th></tr></thead><tbody>{(data ?? []).map((p:any)=><tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.status}</td><td>{p.current_stage ?? '—'}</td></tr>)}{!(data ?? []).length&&<tr><td colSpan={4}>No projects found.</td></tr>}</tbody></table>}</div></section></main>
}
