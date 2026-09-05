import type { Measurement } from '../../lib/millimetre';

const example: Measurement[] = [
  { id: 'm-001', projectId: 'demo', type: 'wall', name: 'Kitchen back wall', width: 4200, height: 2700, notes: 'Field verified' },
  { id: 'm-002', projectId: 'demo', type: 'opening', name: 'Window opening', width: 1500, height: 1200, depth: 150 },
];

export default function MeasurementsPage() {
  return <div className="shell"><aside className="side"><div className="brand">MILLIMETRE</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a href="/measurements" className="active">Measurements</a><a href="/furniture">Furniture</a><a href="/products">Products</a></nav></aside><main className="main"><header className="top"><div><h1 className="title">Measurements</h1><div className="muted">Project-first site dimensions in millimetres</div></div><span className="status">Foundation V1</span></header><section className="section"><div className="card"><h2>Measurement register</h2><p className="muted">This screen is intentionally backed by the canonical measurement shape. Persistence will connect here once the V1 database schema is established.</p><table className="table"><thead><tr><th>Name</th><th>Type</th><th>Width</th><th>Height</th><th>Depth</th><th>Notes</th></tr></thead><tbody>{example.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.type}</td><td>{m.width} mm</td><td>{m.height} mm</td><td>{m.depth ? `${m.depth} mm` : '—'}</td><td>{m.notes ?? '—'}</td></tr>)}</tbody></table></div></section></main></div>;
}
