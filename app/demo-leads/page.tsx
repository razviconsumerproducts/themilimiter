import { createSupabaseServerClient } from '../../lib/supabase-server'
import DemoLeadManager from './DemoLeadManager'

export default async function DemoLeadsPage(){
 const supabase=await createSupabaseServerClient()
 const {data:leads}=await supabase.from('millimetre_demo_leads').select('*').order('created_at',{ascending:false}).limit(100)
 return <div className="erp-shell"><aside className="erp-sidebar"><div className="erp-brand"><span className="brand-mark">M</span><div><strong>MILLIMETRE</strong><small>Furniture ERP</small></div></div><div className="workspace">WORKSPACE <span>⌄</span></div><nav>{[['Dashboard','/executive'],['Sales Dashboard','/sales-dashboard'],['Customers','/customers'],['Measurements','/measurements'],['Furniture','/furniture'],['Inventory','/inventory'],['Purchasing','/purchasing'],['Manufacturing','/manufacturing'],['Demo Leads','/demo-leads']].map(([label,href])=><a key={href} href={href} className={href==='/demo-leads'?'active':''}><span className="nav-dot"/>{label}</a>)}</nav></aside><main className="erp-main"><header className="erp-header"><div><div className="eyebrow">CRM / DEMO LEADS</div><h1>Demo Leads</h1><p>Manage, qualify and convert incoming public website requests.</p></div><div className="header-actions"><a className="ghost-btn" href="/sales-dashboard">Sales Dashboard</a><a className="ghost-btn" href="/executive">Dashboard</a></div></header><DemoLeadManager initialLeads={leads||[]}/></main></div>
}
