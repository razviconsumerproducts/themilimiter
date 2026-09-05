import { createSupabaseServerClient } from '../../lib/supabase-server'

const stages = [
  ['Projects', 'projects'],
  ['Measurements', 'project_measurements'],
  ['Furniture', 'furniture_items'],
  ['Components', 'furniture_components'],
  ['Calculations', 'calculation_runs'],
  ['Cutting List', 'cutting_list_items'],
]

export default async function ExecutiveDashboard() {
  const supabase = await createSupabaseServerClient()
  const results = await Promise.all(
    stages.map(async ([label, table]) => {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return [label, count ?? 0] as const
    }),
  )

  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, name, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10)

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">MILLIMETRE</div>
        <nav className="nav">
          <a href="/">Dashboard</a>
          <a href="/executive" className="active">Executive</a>
          <a href="/customers">Customers</a>
          <a href="/measurements">Measurements</a>
          <a href="/furniture">Furniture</a>
          <a href="/inventory">Inventory</a>
          <a href="/purchasing">Purchasing</a>
          <a href="/manufacturing">Manufacturing</a>
        </nav>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <h1 className="title">Executive Dashboard</h1>
            <div className="muted">Canonical MILLIMETRE V1 operational data</div>
          </div>
          <span className="status">V1</span>
        </header>

        <section className="grid">
          {results.map(([label, count]) => (
            <div className="card" key={label}>
              <div className="muted">{label}</div>
              <div className="metric">{count}</div>
            </div>
          ))}
        </section>

        <section className="section">
          <h2>Project Pipeline</h2>
          <div className="grid">
            {['draft', 'measurement', 'design', 'calculated', 'quoted', 'approved', 'production', 'delivered', 'closed'].map((status) => (
              <div className="card" key={status}>
                <div className="muted">{status.replace('_', ' ')}</div>
                <div className="metric">{projects?.filter((p) => p.status === status).length ?? 0}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Recent Projects</h2>
          <table className="table">
            <thead><tr><th>Code</th><th>Project</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {(projects ?? []).map((project) => (
                <tr key={project.id}>
                  <td>{project.code}</td>
                  <td>{project.name}</td>
                  <td><span className="status">{project.status}</span></td>
                  <td>{new Date(project.updated_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {!(projects ?? []).length && <tr><td colSpan={4}>No canonical projects found.</td></tr>}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
