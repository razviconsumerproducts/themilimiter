import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CuttingListPage(){
  const s=await createSupabaseServerClient()
  const {data:lists,error}=await s.from('cutting_lists').select('id,cutting_list_code,version,status,project_id,calculation_run_id,created_at,updated_at').order('created_at',{ascending:false}).limit(100)
  const calcIds=(lists??[]).map(x=>x.calculation_run_id).filter(Boolean)
  const {data:items}=calcIds.length?await s.from('cutting_list_items').select('calculation_run_id').in('calculation_run_id',calcIds):{data:[] as any[]}
  const counts=new Map<string,number>()
  for(const i of items??[]) counts.set(i.calculation_run_id,(counts.get(i.calculation_run_id)??0)+1)
  return <main className="main">
    <header className="top"><div><h1 className="title">Cutting List</h1><div className="muted">Stage 6 — reviewed cutting requirements</div></div><a className="status" href="/bom">BOM / BOQ →</a></header>
    <section className="section"><div className="card"><h2>Cutting Lists</h2>
      {error?<p role="alert">Unable to load cutting lists: {error.message}</p>:<table className="table"><thead><tr><th>Code</th><th>Version</th><th>Status</th><th>Project</th><th>Items</th><th>Updated</th></tr></thead><tbody>
        {(lists??[]).map((r:any)=><tr key={r.id}><td>{r.cutting_list_code}</td><td>v{r.version}</td><td>{r.status}</td><td>{r.project_id}</td><td>{counts.get(r.calculation_run_id)??0}</td><td>{r.updated_at?new Date(r.updated_at).toLocaleString('en-IN'):'—'}</td></tr>)}
        {!(lists??[]).length&&<tr><td colSpan={6}>No cutting lists found.</td></tr>}
      </tbody></table>}
    </div></section>
  </main>
}
