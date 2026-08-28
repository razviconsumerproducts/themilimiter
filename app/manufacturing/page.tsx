import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ManufacturingPage(){
 const supabase=await createSupabaseServerClient()
 const {data:orders,error}=await supabase.from('production_orders').select('order_no,quantity,status,scheduled_start,scheduled_end,products(sku,name)').order('created_at',{ascending:false}).limit(100)
 return <main className="main"><header className="top"><div><h1 className="title">Manufacturing</h1><div className="muted">Production orders and planning</div></div><a className="status" href="/">Dashboard</a></header><section className="section"><div className="card"><h2>Production Orders</h2>{error?<p role="alert">Unable to load production orders.</p>:<table className="table"><thead><tr><th>Order</th><th>Product</th><th>Quantity</th><th>Status</th><th>Start</th><th>End</th></tr></thead><tbody>{(orders??[]).map((o:any)=><tr key={o.order_no}><td>{o.order_no}</td><td>{o.products?.sku??'—'} {o.products?.name??''}</td><td>{o.quantity??0}</td><td>{o.status??'—'}</td><td>{o.scheduled_start?new Date(o.scheduled_start).toLocaleString('en-IN'):'—'}</td><td>{o.scheduled_end?new Date(o.scheduled_end).toLocaleString('en-IN'):'—'}</td></tr>)}{!(orders??[]).length&&<tr><td colSpan={6}>No production orders found.</td></tr>}</tbody></table>}</div></section></main>
}
