const features = [
  ['Parametric furniture','Define dimensions once and generate repeatable component requirements.'],
  ['Smart cutting outputs','Transform furniture structures into production-ready cutting information.'],
  ['BOM / BOQ','Keep material and hardware requirements connected to the project.'],
  ['Commercial control','Protect quotation, approval, payment and purchasing gates.'],
  ['Supplier procurement','Compare supplier quotes, lock selections and create controlled POs.'],
  ['Factory execution','Track routing, quantities, exceptions, scrap, rework and yield.'],
  ['QR traceability','Give production pieces an identity from factory through installation.'],
  ['Quality gates','Keep QC decisions visible before dispatch, handover and service.'],
  ['Service lifecycle','Track warranty tickets, visits, parts, labour, costs and SLA performance.'],
]

export default function FeaturesPage(){return <main className="public-page"><nav className="public-nav"><a className="landing-logo" href="/"><span className="landing-mark">M</span><span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span></a><div className="public-links"><a href="/platform">Platform</a><a href="/features">Features</a><a href="/templates">Templates</a><a href="/pricing">Pricing</a></div><div className="landing-actions"><a className="landing-login" href="/executive">Open workspace</a><a className="landing-cta" href="/#demo">Request demo</a></div></nav><section className="public-hero"><span>CAPABILITIES</span><h1>Designed around how furniture is actually made.</h1><p>From the first measurement to the last service ticket, each capability works as part of the same operational chain.</p></section><section className="capability-grid">{features.map(([t,d],i)=><article key={t}><small>{String(i+1).padStart(2,'0')}</small><h2>{t}</h2><p>{d}</p></article>)}</section><section className="public-cta"><span>SEE IT IN ACTION</span><h2>Your factory data, connected from project to site.</h2><a className="landing-cta large" href="/executive">Open MILLIMETRE <b>→</b></a></section><footer className="landing-footer"><div className="landing-logo"><span className="landing-mark">M</span><span><b>MILLIMETRE</b><small>Furniture manufacturing OS</small></span></div><span>Design → Cost → Buy → Make → Deliver → Install</span><span>© 2026 MILLIMETRE</span></footer></main>}
