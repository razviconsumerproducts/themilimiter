import { supabase } from '../../lib/supabase'

export default async function ProductsPage() {
  const { data: products, error } = await supabase.from('products').select('sku,name,unit,standard_cost,selling_price,active').order('name')
  return <main className="main"><header className="top"><div><h1 className="title">Products</h1><div className="muted">Product master and pricing</div></div><a className="status" href="/">Dashboard</a></header>{error ? <div className="card">Unable to load products.</div> : <section className="section"><table className="table"><thead><tr><th>SKU</th><th>Name</th><th>Unit</th><th>Cost</th><th>Selling Price</th><th>Status</th></tr></thead><tbody>{(products ?? []).map(p=><tr key={p.sku}><td>{p.sku}</td><td>{p.name}</td><td>{p.unit}</td><td>₹{Number(p.standard_cost).toLocaleString('en-IN')}</td><td>₹{Number(p.selling_price).toLocaleString('en-IN')}</td><td>{p.active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></section>}</main>
}