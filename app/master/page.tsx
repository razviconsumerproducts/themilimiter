import { createSupabaseServerClient } from '../../lib/supabase-server'

const masterModules = [
  { code: '01', title: 'Carcass Materials', href: '/products', text: 'Boards and sheet goods used for carcasses: plywood, MDF, HDHMR and prelaminated panels.', fields: 'Thickness · sheet size · finish · purchase rate · billing rate' },
  { code: '02', title: 'Pastings & Finishes', href: '/products', text: 'Inner and outer laminates, veneers and decorative surfaces with grain and application rules.', fields: 'Thickness · code · grain · side · sheet / sq.ft rate' },
  { code: '03', title: 'Hardware', href: '/products', text: 'Hinges, drawer channels, handles, locks, hanger rods and other fittings.', fields: 'Code · brand · unit · price · supplier · active status' },
  { code: '04', title: 'Suppliers', href: '/suppliers', text: 'Central supplier directory for boards, laminates, hardware and factory procurement.', fields: 'Company · contact · category · delivery · status' },
  { code: '05', title: 'Templates', href: '/templates', text: 'Reusable furniture families and parametric engineering standards for faster design.', fields: 'Family · components · rules · cutting logic · outputs' },
  { code: '06', title: 'Global Settings', href: '/settings', text: 'Company identity, GSTIN, currency, factory defaults, quotation and production rules.', fields: 'Company · tax · currency · costing · documents · production' },
]

export default async function MasterPage() {
  const supabase = await createSupabaseServerClient()
  const [{ count: materials }, { count: suppliers }, { count: products }] = await Promise.all([
    supabase.from('materials').select('id', { count: 'exact', head: true }),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('sku', { count: 'exact', head: true }),
  ])

  return <div className="erp-shell">
    <aside className="erp-sidebar">
      <div className="erp-brand"><span className="brand-mark">M</span><div><strong>MILLIMETRE</strong><small>Furniture ERP</small></div></div>
      <div className="workspace">MASTER WORKSPACE <span>⌄</span></div>
      <nav>
        <a href="/executive"><span className="nav-dot"/>Dashboard</a>
        <a href="/projects"><span className="nav-dot"/>Projects</a>
        <a href="/measurements"><span className="nav-dot"/>Measurements</a>
        <a href="/furniture"><span className="nav-dot"/>Furniture</a>
        <a className="active" href="/master"><span className="nav-dot"/>Master Pages</a>
        <a href="/templates"><span className="nav-dot"/>Templates</a>
        <a href="/suppliers"><span className="nav-dot"/>Suppliers</a>
        <a href="/settings"><span className="nav-dot"/>Settings</a>
      </nav>
      <div className="sidebar-bottom"><a href="/account">◉ Subscription</a><a href="/sign-out">↪ Sign out</a></div>
    </aside>
    <main className="erp-main">
      <header className="erp-header">
        <div><div className="eyebrow">FOUNDATION / MASTER PAGES</div><h1>Set the rules once. Use them everywhere.</h1><p>Configure materials, finishes, hardware, suppliers and factory standards before creating production projects.</p></div>
        <div className="header-actions"><a className="ghost-btn" href="/settings">Company settings</a><a className="primary-btn" href="/products">Open material master</a></div>
      </header>

      <section className="metric-grid">
        <a className="metric-card" href="/products"><span>Materials</span><strong>{materials ?? 0}</strong><small>Carcass and sheet master →</small></a>
        <a className="metric-card" href="/products"><span>Pastings / Products</span><strong>{products ?? 0}</strong><small>Finish and product records →</small></a>
        <a className="metric-card" href="/suppliers"><span>Suppliers</span><strong>{suppliers ?? 0}</strong><small>Procurement directory →</small></a>
        <a className="metric-card" href="/templates"><span>Templates</span><strong>6</strong><small>Furniture families →</small></a>
      </section>

      <section className="panel master-intro"><div className="panel-head"><div><h2>Manufacturing master data</h2><p>These records feed calculation, BOM, costing, quotation and procurement.</p></div><span className="master-badge">FOUNDATION</span></div><div className="master-grid">
        {masterModules.map(m => <a className="master-card" href={m.href} key={m.code}><span>{m.code}</span><div><h3>{m.title}</h3><p>{m.text}</p><small>{m.fields}</small></div><b>→</b></a>)}
      </div></section>

      <section className="content-grid">
        <section className="panel"><div className="panel-head"><div><h2>How master data flows</h2><p>One change propagates through downstream commercial and factory stages.</p></div></div><div className="flow-steps"><div><b>01</b><span>Master</span><small>Materials · hardware · suppliers</small></div><i>→</i><div><b>02</b><span>Furniture</span><small>Templates · components · rules</small></div><i>→</i><div><b>03</b><span>Calculation</span><small>Dimensions → requirements</small></div><i>→</i><div><b>04</b><span>Factory</span><small>Cutting · BOM · costing</small></div></div></section>
        <section className="panel"><div className="panel-head"><div><h2>Recommended setup</h2><p>Complete these before your first live project.</p></div></div><div className="setup-list"><div><b>01</b><span>Enter standard sheet sizes and base rates</span><em>Materials</em></div><div><b>02</b><span>Define laminate / veneer and grain rules</span><em>Pastings</em></div><div><b>03</b><span>Load hardware codes and supplier prices</span><em>Hardware</em></div><div><b>04</b><span>Configure company and GST settings</span><em>Settings</em></div></div></section>
      </section>
    </main>
  </div>
}
