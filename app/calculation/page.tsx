import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CalculationPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('calculation_runs').select('id,project_id,furniture_item_id,engine_version,status,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Calculation</h1><div className="muted">Stage 5 — deterministic calculation runs</div></div><a className="status" href="/cutting-list">Cutting List</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load calculation runs: {error.message}</p>:<table className="table"><thead><tr><th>Run</th><th>Project</th><th>Furniture</th><th>Engine</th><th>Status</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.id}</td><td>{r.project_id}</td><td>{r.furniture_item_id}</td><td>{r.engine_version}</td><td>{r.status}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={5}>No calculation runs found.</td></tr>}</tbody></table>}</div></section></main>
}
