import type { Furniture } from '../../lib/millimetre';

const example: Furniture[] = [
  { id: 'f-001', projectId: 'demo', name: 'Kitchen base unit', code: 'KB-001', type: 'base_cabinet', width: 900, height: 720, depth: 560, carcassThickness: 18, backThickness: 6, shutterGap: 2, shelfCount: 1, drawerCount: 0 },
  { id: 'f-002', projectId: 'demo', name: 'Tall pantry', code: 'TP-001', type: 'tall_cabinet', width: 600, height: 2100, depth: 560, carcassThickness: 18, backThickness: 6, shutterGap: 2, shelfCount: 5, drawerCount: 0 },
];

export default function FurniturePage() {
  return <div className="shell"><aside className="side"><div className="brand">MILLIMETRE</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a href="/measurements">Measurements</a><a href="/furniture" className="active">Furniture</a><a href="/products">Products</a></nav></aside><main className="main"><header className="top"><div><h1 className="title">Furniture</h1><div className="muted">One component model feeding calculation and production</div></div><span className="status">Calculation-ready</span></header><section className="section"><div className="card"><h2>Furniture register</h2><p className="muted">Dimensions are stored as millimetres. The calculation engine consumes this exact model and emits a normalized component list.</p><table className="table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>W × H × D</th><th>Carcass</th><th>Shelves</th><th>Drawers</th></tr></thead><tbody>{example.map((f) => <tr key={f.id}><td>{f.code}</td><td>{f.name}</td><td>{f.type}</td><td>{f.width} × {f.height} × {f.depth} mm</td><td>{f.carcassThickness} mm</td><td>{f.shelfCount ?? 0}</td><td>{f.drawerCount ?? 0}</td></tr>)}</tbody></table></div></section></main></div>;
}
