import { createSupabaseServerClient } from '../lib/supabase-server'

const modules = [
  ['Dashboard', '/'], ['Customers', '/customers'], ['Projects', '/projects'],
  ['Measurements', '/measurements'], ['Furniture', '/furniture'], ['Calculation', '/calculation'],
  ['Cutting List', '/cutting-list'], ['BOM / BOQ', '/bom'], ['Optimization', '/optimization'],
  ['Costing', '/costing'], ['Quotation', '/sales'], ['Payments', '/payments'],
  ['Purchase', '/purchasing'], ['Goods Receipt', '/receiving'], ['Inventory', '/inventory'],
  ['Production', '/manufacturing'], ['Production QC', '/quality'], ['Labels / QR', '/labels'],
  ['Delivery', '/delivery'], ['Installation', '/installation'], ['Handover', '/handover'],
  ['Warranty / Service', '/service'], ['Reports', '/reports'],
]

const count = async (supabase: any, table: string, filter?: (q: any) => any) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const result = await q
  return result.count ?? 0
}

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const [projects, activeProjects, production, qcFailed, deliveries, installations, handovers, service] = await Promise.all([
    count(supabase, 'projects'),
    count(supabase, 'projects', q => q.not('status', 'in', '(closed,cancelled)')),
    count(supabase, 'production_orders', q => q.not('status', 'in', '(completed,cancelled)')),
    count(supabase, 'quality_inspections', q => q.eq('result', 'fail')),
    count(supabase, 'delivery_orders', q => q.not('status', 'in', '(delivered,closed,cancelled)')),
    count(supabase, 'installation_jobs', q => q.not('status', 'in', '(completed,cancelled)')),
    count(supabase, 'handovers', q => q.in('status', ['ready_for_acceptance', 'customer_review', 'snag_pending'])),
    count(supabase, 'service_requests', q => q.not('status', 'in', '(closed,cancelled)')),
  ])

  const { data: pipeline } = await supabase
    .from('millimetre_project_pipeline')
    .select('project_code,project_name,customer_name,status,current_stage,furniture_count,delivery_count,installation_count,handover_count,service_request_count')
    .order('project_code', { ascending: false })
    .limit(8)

  const cards = [
    ['Projects', projects], ['Active Projects', activeProjects], ['Production Active', production],
    ['QC Failures', qcFailed], ['Deliveries Pending', deliveries], ['Installation Active', installations],
    ['Handover Attention', handovers], ['Open Service', service],
  ]

  return <div className="shell">
    <aside className="side">
      <div className="brand">MILLIMETRE</div>
      <nav className="nav">{modules.map(([name, href], i) => <a key={name} href={href} className={i === 0 ? 'active' : ''}>{name}</a>)}</nav>
    </aside>
    <main className="main">
      <header className="top">
        <div><h1 className="title">Executive Dashboard</h1><div className="muted">Canonical V1 operational control centre</div></div>
        <span className="status">V1</span>
      </header>

      <section className="grid">{cards.map(([label, value]) => <div className="card" key={label}><div className="muted">{label}</div><div className="metric">{value}</div></div>)}</section>

      <section className="section">
        <div className="section-head"><h2>Project Pipeline</h2><span className="muted">Live from canonical project records</span></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Project</th><th>Customer</th><th>Stage</th><th>Status</th><th>Furniture</th><th>Delivery</th><th>Install</th><th>Handover</th></tr></thead>
          <tbody>{(pipeline ?? []).map(p => <tr key={p.project_code}><td><strong>{p.project_code}</strong><br /><span className="muted">{p.project_name}</span></td><td>{p.customer_name ?? '—'}</td><td>{p.current_stage ?? '—'}</td><td><span className="status">{p.status}</span></td><td>{p.furniture_count}</td><td>{p.delivery_count}</td><td>{p.installation_count}</td><td>{p.handover_count}</td></tr>)}{!(pipeline ?? []).length && <tr><td colSpan={8}>No projects yet. Create a project to begin the canonical V1 workflow.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="section"><h2>V1 workflow</h2><div className="workflow">{['Foundation','Customer + Project','Measurements','Furniture','Calculation','Cutting','BOM','Optimization','Costing','Quotation','Approval / Payment','Purchase','Receipt + QC','Inventory','Production','Production QC','Labels / QR','Delivery + Installation','Handover','Warranty / Service','Executive Dashboard'].map((stage, i) => <div className="stage" key={stage}><span>{i + 1}</span>{stage}</div>)}</div></section>
    </main>
  </div>
}
