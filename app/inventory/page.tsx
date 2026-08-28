import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: inventory, error } = await supabase.from('inventory').select('quantity,reorder_level,products(sku,name,unit),warehouses(code,name)').order('updated_at', { ascending: false })
  return <main className="main"><header className="top"><div><h1 className="title">Inventory</h1><div className="muted">Stock by product and warehouse</div></div><a className="status" href="/">Dashboard</a></header><section className="section"><div className="card">{error ? <p role="alert">Unable to load inventory.</p> : <table className="table"><thead><tr><th>SKU</th><th>Product</th><th>Warehouse</th><th>Quantity</th><th>Reorder Level</th></tr></thead><tbody>{(inventory ?? []).map((r:any,i:number)=><tr key={i}><td>{r.products?.sku ?? '—'}</td><td>{r.products?.name ?? '—'}</td><td>{r.warehouses?.name ?? r.warehouses?.code ?? '—'}</td><td>{r.quantity ?? 0} {r.products?.unit ?? ''}</td><td>{r.reorder_level ?? 0}</td></tr>)}{!(inventory ?? []).length && <tr><td colSpan={5}>No inventory records found.</td></tr>}</tbody></table>}</div></section></main>
}
