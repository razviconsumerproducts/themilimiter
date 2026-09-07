const modules = [
  ['01','Design & Templates','Build reusable furniture structures and start new projects from proven parametric templates.'],
  ['02','Measurements','Capture site dimensions and project requirements in a structured project record.'],
  ['03','Calculation & Cutting','Convert designs into component quantities, cutting requirements and production-ready outputs.'],
  ['04','BOM & Costing','Connect materials, hardware, labour and overheads into transparent commercial calculations.'],
  ['05','Procurement','Move approved requirements through RFQ, supplier comparison, purchase orders and receipt.'],
  ['06','Production & QC','Schedule factory work, track output, record exceptions and release quality-controlled production.'],
  ['07','Delivery & Installation','Trace pieces from factory dispatch through site receipt, installation and customer handover.'],
  ['08','Warranty & Service','Keep the project alive after installation with tickets, visits, parts, costs and SLA tracking.'],
]

export default function PlatformPage() {
  return <main className="public-page">
    <nav className="public-nav"><a className="landing-logo" href="/"><span className="landing-mark">M</span><span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span></a><div className="public-links"><a href="/platform">Platform</a><a href="/features">Features</a><a href="/templates">Templates</a><a href="/pricing">Pricing</a></div><div className="landing-actions"><a className="landing-login" href="/executive">Open workspace</a><a className="landing-cta" href="/#demo">Request demo</a></div></nav>
    <section className="public-hero"><span>THE MILLIMETRE PLATFORM</span><h1>One system for the entire furniture operation.</h1><p>Connect customer projects, design, commercial control and factory execution without rebuilding information at every stage.</p><div><a className="landing-cta large" href="/executive">Open workspace <b>→</b></a><a className="text-link" href="#modules">Explore modules ↓</a></div></section>
    <section className="platform-grid" id="modules">{modules.map(([n,t,d])=><article key={n}><small>{n}</small><h2>{t}</h2><p>{d}</p><a href="/features">See capability →</a></article>)}</section>
    <section className="platform-flow"><div><span>CONNECTED DATA</span><h2>Every handoff keeps the same project context.</h2><p>A quotation can become an authorized purchase. A purchase can become a receipt. A receipt can feed production. A production piece can carry its identity to delivery, installation and service.</p></div><div className="flow-card">{['Commercial release','Procurement','Goods receipt + QC','Inventory','Production','Production QC','Delivery + installation','Handover + service'].map((x,i)=><div key={x}><b>{String(i+1).padStart(2,'0')}</b><span>{x}</span><i>→</i></div>)}</div></section>
    <section className="public-cta"><span>BUILT FOR CUSTOM FURNITURE</span><h2>Turn your factory workflow into one operating system.</h2><p>Use MILLIMETRE as the digital layer connecting design decisions to measurable factory execution.</p><a className="landing-cta large" href="/#demo">Request a demo <b>→</b></a></section>
    <footer className="landing-footer"><div className="landing-logo"><span className="landing-mark">M</span><span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span></div><span>Design → Cost → Buy → Make → Deliver → Install</span><span>© 2026 MILLIMETRE</span></footer>
  </main>
}
