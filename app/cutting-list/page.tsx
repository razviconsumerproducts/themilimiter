import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CuttingListPage() {
  const supabase = await createSupabaseServerClient()
  const result = await supabase
    .from('cutting_lists')
    .select('id,cutting_list_code,version,status,project_id,calculation_run_id,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const lists = result.data ?? []
  const calcIds = lists.map((row) => row.calculation_run_id).filter(Boolean)
  const itemsResult = calcIds.length
    ? await supabase.from('cutting_list_items').select('calculation_run_id').in('calculation_run_id', calcIds)
    : { data: [] as { calculation_run_id: string | null }[] }

  const counts = new Map<string, number>()
  for (const item of itemsResult.data ?? []) {
    if (item.calculation_run_id) {
      counts.set(item.calculation_run_id, (counts.get(item.calculation_run_id) ?? 0) + 1)
    }
  }

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Cutting List</h1>
          <div className="muted">Stage 6 — reviewed cutting requirements</div>
        </div>
        <a className="status" href="/bom">BOM / BOQ →</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>Cutting Lists</h2>
          {result.error ? (
            <p role="alert">Unable to load cutting lists: {result.error.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Code</th><th>Version</th><th>Status</th><th>Project</th><th>Items</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {lists.map((row) => (
                  <tr key={row.id}>
                    <td>{row.cutting_list_code}</td>
                    <td>v{row.version}</td>
                    <td>{row.status}</td>
                    <td>{row.project_id}</td>
                    <td>{counts.get(row.calculation_run_id) ?? 0}</td>
                    <td>{row.updated_at ? new Date(row.updated_at).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
                {lists.length === 0 ? (
                  <tr><td colSpan={6}>No cutting lists found.</td></tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
