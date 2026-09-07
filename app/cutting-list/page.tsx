import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CuttingListPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('cutting_lists').select('id,cutting_list_code,version,status,project_id,calculation_run_id,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Cutting List</h1><div className="muted">Stage 6 — review, approval and release</div></div><a className="status" href="/bom">BOM / BOQ</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load cutting lists: {error.message}</p>:<table className="table"><thead><tr><th>Code</th><th>Version</th><th>Status</th><th>Project</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.cutting_list_code}</td><td>v{r.version}</td><td>{r.status}</td><td>{r.project_id}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={4}>No cutting lists found.</td></tr>}</tbody></table>}</div></section></main>
}
