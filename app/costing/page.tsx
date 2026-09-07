import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CostingPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('costing_runs').select('id,costing_code,version,status,currency,subtotal,total_cost,margin,selling_price,project_id,created_at').order('created_at',{ascending:false}).limit(100)
  return <main className="main"><header className="top"><div><h1 className="title">Costing</h1><div className="muted">Stage 9 — material, labour, overhead and selling price</div></div><a className="status" href="/sales">Quotation</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load costing runs: {error.message}</p>:<table className="table"><thead><tr><th>Code</th><th>Version</th><th>Status</th><th>Subtotal</th><th>Total cost</th><th>Selling price</th></tr></thead><tbody>{(data??[]).map((r:any)=><tr key={r.id}><td>{r.costing_code}</td><td>v{r.version}</td><td>{r.status}</td><td>{r.currency??'INR'} {Number(r.subtotal??0).toLocaleString('en-IN')}</td><td>{r.currency??'INR'} {Number(r.total_cost??0).toLocaleString('en-IN')}</td><td>{r.currency??'INR'} {Number(r.selling_price??0).toLocaleString('en-IN')}</td></tr>)}{!(data??[]).length&&<tr><td colSpan={6}>No costing runs found.</td></tr>}</tbody></table>}</div></section></main>
}
