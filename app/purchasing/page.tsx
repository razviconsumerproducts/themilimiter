import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function PurchasingPage(){
 const supabase=await createSupabaseServerClient()
 const {data:orders,error}=await supabase.from('purchase_orders').select('id,po_code,status,currency,total,created_at,suppliers(name)').order('created_at',{ascending:false}).limit(100)
 return <main className="main"><header className="top"><div><h1 className="title">Purchasing</h1><div className="muted">Supplier purchase orders</div></div><a className="status" href="/">Dashboard</a></header><section className="section"><div className="card">{error?<p role="alert">Unable to load purchase orders: {error.message}</p>:<table className="table"><thead><tr><th>PO</th><th>Supplier</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>{(orders??[]).map((o:any)=><tr key={o.id}><td>{o.po_code}</td><td>{o.suppliers?.name??'—'}</td><td>{o.status??'—'}</td><td>{o.currency??'INR'} {Number(o.total??0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{o.created_at?new Date(o.created_at).toLocaleDateString('en-IN'):'—'}</td></tr>)}{!(orders??[]).length&&<tr><td colSpan={5}>No purchase orders found.</td></tr>}</tbody></table>}</div></section></main>
}
