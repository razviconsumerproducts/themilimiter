import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function OptimizationPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('optimization_runs').select('id,project_id,bom_id,status,algorithm,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Sheet Optimization</h1><div className="muted">Stage 8 — sheet layout and waste reduction</div></div><a className="status" href="/costing">Costing</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load optimization runs: {error.message}</p>:<table className="table"><thead><tr><th>Run</th><th>Project</th><th>BOM</th><th>Algorithm</th><th>Status</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.id}</td><td>{r.project_id}</td><td>{r.bom_id}</td><td>{r.algorithm}</td><td>{r.status}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No optimization runs found.</td></tr>}</tbody></table>}</div></section></main>
}
