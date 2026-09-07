import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ManufacturingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: orders, error } = await supabase
    .from('production_orders')
    .select('id,production_code,version,status,priority,planned_start,planned_end,released_at,completed_at,project_id,created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Manufacturing</h1>
          <div className="muted">Stage 15 — production orders and planning</div>
        </div>
        <a className="status" href="/quality">Production QC</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>Production Orders</h2>
          {error ? (
            <p role="alert">Unable to load production orders: {error.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Production code</th><th>Version</th><th>Status</th><th>Priority</th><th>Project</th><th>Planned start</th><th>Planned end</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {(orders ?? []).map((order: any) => (
                  <tr key={order.id}>
                    <td>{order.production_code}</td>
                    <td>v{order.version}</td>
                    <td>{order.status}</td>
                    <td>{order.priority}</td>
                    <td>{order.project_id}</td>
                    <td>{order.planned_start ?? '—'}</td>
                    <td>{order.planned_end ?? '—'}</td>
                    <td>{order.completed_at ? new Date(order.completed_at).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
                {!(orders ?? []).length && <tr><td colSpan={8}>No production orders found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
