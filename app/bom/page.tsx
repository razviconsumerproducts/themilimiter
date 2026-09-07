import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function BomPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('boms').select('id,bom_code,version,status,project_id,calculation_run_id,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">BOM / BOQ</h1><div className="muted">Stage 7 — material and component requirements</div></div><a className="status" href="/optimization">Optimization</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load BOMs: {error.message}</p>:<table className="table"><thead><tr><th>Code</th><th>Version</th><th>Status</th><th>Project</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.bom_code}</td><td>v{r.version}</td><td>{r.status}</td><td>{r.project_id}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={4}>No BOMs found.</td></tr>}</tbody></table>}</div></section></main>
}
