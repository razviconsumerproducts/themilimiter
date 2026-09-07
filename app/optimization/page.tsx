import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function OptimizationPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('optimization_runs')
    .select('id,project_id,cutting_list_id,optimization_code,version,status,algorithm,kerf_mm,trim_allowance_mm,sheet_count,total_required_area,total_sheet_area,waste_area,utilization_percentage,created_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Sheet Optimization</h1>
          <div className="muted">Stage 8 — sheet layout and waste reduction</div>
        </div>
        <a className="status" href="/costing">Costing</a>
      </header>
      <section className="section">
        <div className="card">
          {error ? (
            <p role="alert">Unable to load optimization runs: {error.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Optimization</th>
                  <th>Project</th>
                  <th>Cutting list</th>
                  <th>Status</th>
                  <th>Algorithm</th>
                  <th>Sheets</th>
                  <th>Utilization</th>
                  <th>Waste area</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((run) => (
                  <tr key={run.id}>
                    <td>{run.optimization_code} v{run.version}</td>
                    <td>{run.project_id}</td>
                    <td>{run.cutting_list_id}</td>
                    <td>{run.status}</td>
                    <td>{run.algorithm}</td>
                    <td>{run.sheet_count}</td>
                    <td>{Number(run.utilization_percentage).toFixed(1)}%</td>
                    <td>{Number(run.waste_area).toFixed(0)} mm²</td>
                  </tr>
                ))}
                {!(data ?? []).length && (
                  <tr><td colSpan={8}>No optimization runs found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
