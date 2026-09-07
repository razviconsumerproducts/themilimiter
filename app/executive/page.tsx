import { createSupabaseServerClient } from '../../lib/supabase-server'

const stages = [
  ['Projects', 'projects'],
  ['Measurements', 'project_measurements'],
  ['Furniture', 'furniture_items'],
  ['Components', 'furniture_components'],
  ['Calculations', 'calculation_runs'],
  ['Cutting List Items', 'cutting_list_items'],
]

const projectStatuses = ['draft', 'measurement', 'design', 'calculated', 'quoted', 'approved', 'production', 'delivered', 'closed']

export default async function ExecutiveDashboard() {
  const supabase = await createSupabaseServerClient()
  const results = await Promise.all(
    stages.map(async ([label, table]) => {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return [label, count ?? 0] as const
    }),
  )

  const { data: pipeline, error: pipelineError } = await supabase
    .from('millimetre_project_pipeline')
    .select('project_id,project_code,project_name,customer_name,status,current_stage,furniture_count,delivery_count,installation_count,handover_count,service_request_count')
    .order('project_code', { ascending: false })
    .limit(100)

  const statusCounts = new Map(projectStatuses.map((status) => [status, 0]))
  for (const project of pipeline ?? []) {
    if (statusCounts.has(project.status)) statusCounts.set(project.status, (statusCounts.get(project.status) ?? 0) + 1)
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">MILLIMETRE</div>
        <nav className="nav">
          <a href="/">Dashboard</a>
          <a href="/executive" className="active">Executive</a>
          <a href="/payments">Approval / Payment</a>
          <a href="/purchasing">Purchasing</a>
          <a href="/receiving">Goods Receipt</a>
          <a href="/inventory">Inventory</a>
          <a href="/manufacturing">Manufacturing</a>
          <a href="/quality">Production QC</a>
          <a href="/labels">Labels / QR</a>
          <a href="/delivery">Delivery</a>
          <a href="/installation">Installation</a>
          <a href="/handover">Handover</a>
          <a href="/service">Warranty / Service</a>
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
          {pipelineError ? (
            <div className="card"><p role="alert">Unable to load project pipeline: {pipelineError.message}</p></div>
          ) : (
            <div className="grid">
              {projectStatuses.map((status) => (
                <div className="card" key={status}>
                  <div className="muted">{status.replace('_', ' ')}</div>
                  <div className="metric">{statusCounts.get(status) ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <h2>Project Pipeline Detail</h2>
          <div className="card">
            <table className="table">
              <thead><tr><th>Code</th><th>Project</th><th>Customer</th><th>Status</th><th>Stage</th><th>Furniture</th><th>Delivery</th><th>Installation</th><th>Handover</th><th>Service</th></tr></thead>
              <tbody>
                {(pipeline ?? []).map((project: any) => (
                  <tr key={project.project_id}>
                    <td>{project.project_code}</td>
                    <td>{project.project_name}</td>
                    <td>{project.customer_name ?? '—'}</td>
                    <td><span className="status">{project.status}</span></td>
                    <td>{project.current_stage}</td>
                    <td>{project.furniture_count}</td>
                    <td>{project.delivery_count}</td>
                    <td>{project.installation_count}</td>
                    <td>{project.handover_count}</td>
                    <td>{project.service_request_count}</td>
                  </tr>
                ))}
                {!(pipeline ?? []).length && <tr><td colSpan={10}>No canonical project pipeline records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
