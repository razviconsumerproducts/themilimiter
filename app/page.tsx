import { supabase } from '../lib/supabase'

const modules = ['Dashboard','Products','Inventory','Sales','Purchasing','Manufacturing','MES','Maintenance','Quality','Customers','Suppliers','Reports','Users & Roles','Settings']

async function count(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return error ? 0 : (count ?? 0)
}

export default async function Home() {
  const [openWorkOrders, machinesDown, preventiveDue] = await Promise.all([
    supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'open').then(r => r.count ?? 0),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'down').then(r => r.count ?? 0),
    supabase.from('maintenance_records').select('*', { count: 'exact', head: true }).eq('status', 'scheduled').then(r => r.count ?? 0),
  ])

  const { data: workOrders } = await supabase.from('work_orders').select('work_order_no, asset_id, order_type, status').order('created_at', { ascending: false }).limit(4)
  const assetIds = (workOrders ?? []).map(w => w.asset_id).filter(Boolean)
  const { data: assets } = assetIds.length ? await supabase.from('assets').select('id,asset_code').in('id', assetIds) : { data: [] as { id: string; asset_code: string }[] }
  const assetMap = new Map((assets ?? []).map(a => [a.id, a.asset_code]))

  return <div className="shell"><aside className="side"><div className="brand">MILLIMETRE</div><nav className="nav">{modules.map((m,i)=><div key={m} className={i===0?'active':''}>{m}</div>)}</nav></aside><main className="main"><header className="top"><div><h1 className="title">Operations Dashboard</h1><div className="muted">Manufacturing & enterprise operations</div></div><span className="status">Production</span></header><section className="grid"><div className="card"><div className="muted">Open Work Orders</div><div className="metric">{openWorkOrders}</div></div><div className="card"><div className="muted">Machines Down</div><div className="metric">{machinesDown}</div></div><div className="card"><div className="muted">Preventive Due</div><div className="metric">{preventiveDue}</div></div><div className="card"><div className="muted">Inventory Value</div><div className="metric">—</div></div></section><section className="section"><h2>Maintenance Work Orders</h2><table className="table"><thead><tr><th>Work Order</th><th>Asset</th><th>Type</th><th>Status</th></tr></thead><tbody>{(workOrders ?? []).map(r=><tr key={r.work_order_no}><td>{r.work_order_no}</td><td>{r.asset_id ? assetMap.get(r.asset_id) ?? '—' : '—'}</td><td>{r.order_type}</td><td><span className="status">{r.status}</span></td></tr>)}</tbody></table></section><section className="section grid"><div className="card"><div className="muted">PM Compliance</div><div className="metric">—</div></div><div className="card"><div className="muted">Asset Availability</div><div className="metric">—</div></div><div className="card"><div className="muted">MTBF</div><div className="metric">—</div></div><div className="card"><div className="muted">MTTR</div><div className="metric">—</div></div></section></main></div>
}
