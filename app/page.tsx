const features = [
  { n: '01', title: 'Design to production', text: 'Capture projects, measurements and furniture designs in one connected workflow.' },
  { n: '02', title: 'Parametric cutting', text: 'Turn furniture dimensions into repeatable component and cutting requirements.' },
  { n: '03', title: 'Accurate costing', text: 'Build transparent material, hardware, labour and overhead costing before you quote.' },
  { n: '04', title: 'BOM & procurement', text: 'Convert approved requirements into supplier quotes, purchase orders and receipts.' },
  { n: '05', title: 'Optimization & labels', text: 'Reduce sheet waste and keep every production piece traceable with QR labels.' },
  { n: '06', title: 'Factory to site', text: 'Connect production, QC, delivery, installation, handover and service.' },
]

const workflow = ['Project', 'Measure', 'Design', 'Calculate', 'Cut', 'BOM', 'Buy', 'Make', 'QC', 'Deliver', 'Install', 'Handover']

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <a className="landing-logo" href="/">
          <span className="landing-mark">M</span>
          <span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span>
        </a>
        <div className="landing-links">
          <a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#features">Features</a><a href="#about">Why Millimetre</a>
        </div>
        <div className="landing-actions"><a className="landing-login" href="/executive">Open workspace</a><a className="landing-cta" href="#demo">Request demo</a></div>
      </nav>

      <section className="hero" id="platform">
        <div className="hero-copy">
          <div className="hero-kicker"><span></span> Built for furniture manufacturers</div>
          <h1>From <em>measurement</em><br />to finished furniture.</h1>
          <p>One connected operating system for custom furniture design, costing, procurement, production, quality, delivery and installation.</p>
          <div className="hero-buttons"><a className="landing-cta large" href="/executive">Explore workspace <span>→</span></a><a className="text-link" href="#workflow">See how it works ↓</a></div>
          <div className="hero-proof"><span>●</span> Designed for modular furniture, kitchens, wardrobes, office furniture & custom projects</div>
        </div>
        <div className="hero-visual" aria-label="MILLIMETRE workspace preview">
          <div className="browser-bar"><i></i><i></i><i></i><span>millimetre / project / production</span></div>
          <div className="mock-workspace">
            <aside><strong>MILLIMETRE</strong><span className="mock-active">Overview</span><span>Projects</span><span>Design</span><span>Cutting</span><span>Procurement</span><span>Production</span><span>Quality</span></aside>
            <div className="mock-main"><div className="mock-top"><div><small>PROJECT / MW-1042</small><b>Residence — Wardrobe Package</b></div><label>IN PRODUCTION</label></div><div className="mock-cards"><div><small>Quotation</small><b>₹ 8.42L</b></div><div><small>Materials</small><b>94%</b></div><div><small>Production</small><b>68%</b></div></div><div className="mock-panel"><div className="mock-panel-head"><b>Production flow</b><small>12 components</small></div><div className="mock-line"><span style={{width:'82%'}}></span></div><div className="mock-stages"><span>Cutting<br /><b>Complete</b></span><span>Edge banding<br /><b>In progress</b></span><span>Assembly<br /><b>Queued</b></span></div></div></div>
          </div>
        </div>
      </section>

      <section className="workflow" id="workflow"><div className="section-intro"><span>THE OPERATING SYSTEM</span><h2>A single flow. No disconnected spreadsheets.</h2><p>Every commercial and factory step stays connected to the same project, materials and production data.</p></div><div className="workflow-track">{workflow.map((item, i)=><div key={item}><b>{String(i+1).padStart(2,'0')}</b><span>{item}</span></div>)}</div></section>

      <section className="feature-section" id="features"><div className="section-intro"><span>ONE PLATFORM</span><h2>Everything your furniture business needs to move faster.</h2></div><div className="feature-grid">{features.map(f=><article className="feature-card" key={f.n}><small>{f.n}</small><h3>{f.title}</h3><p>{f.text}</p><a href="#demo">Explore capability →</a></article>)}</div></section>

      <section className="split-section"><div className="split-copy"><span>BUILT AROUND YOUR FACTORY</span><h2>Templates make repeat work dramatically faster.</h2><p>Define reusable furniture structures, materials, hardware and production logic once. New projects start from proven building blocks instead of rebuilding the same work.</p><ul><li>Reusable furniture and cutting templates</li><li>Connected BOM, costing and procurement</li><li>Traceable production pieces and QR labels</li><li>QC gates before dispatch and handover</li></ul></div><div className="template-card"><div className="template-head"><span>FURNITURE TEMPLATE</span><b>Wardrobe / 3-door</b></div><div className="dimension-row"><div><small>WIDTH</small><b>2400</b><i>mm</i></div><div><small>HEIGHT</small><b>2100</b><i>mm</i></div><div><small>DEPTH</small><b>600</b><i>mm</i></div></div><div className="template-list"><div><span>Side panel</span><b>2 pcs</b></div><div><span>Vertical divider</span><b>2 pcs</b></div><div><span>Shelf</span><b>5 pcs</b></div><div><span>Door assembly</span><b>3 pcs</b></div></div><div className="template-footer"><span>PARAMETRIC OUTPUT</span><b>Cut list + BOM + Costing →</b></div></div></section>

      <section className="trust-section" id="about"><div><span>WHY MILLIMETRE</span><h2>Control the detail without slowing the business.</h2></div><div className="trust-stats"><div><b>01</b><span>One project record from design to service</span></div><div><b>02</b><span>Commercial gates protect margins</span></div><div><b>03</b><span>Factory execution stays measurable</span></div><div><b>04</b><span>Customer handover closes the loop</span></div></div></section>

      <section className="demo-section" id="demo"><div><span>READY WHEN YOU ARE</span><h2>Build your factory around one source of truth.</h2><p>Explore the live MILLIMETRE workspace or connect your team to a tailored implementation.</p></div><div className="demo-actions"><a className="landing-cta large" href="/executive">Open MILLIMETRE <span>→</span></a><a className="landing-outline" href="mailto:demo@millimetre.app">Request a demo</a></div></section>

      <footer className="landing-footer"><div className="landing-logo"><span className="landing-mark">M</span><span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span></div><span>Design → Cost → Buy → Make → Deliver → Install</span><span>© 2026 MILLIMETRE</span></footer>
    </main>
  )
}
