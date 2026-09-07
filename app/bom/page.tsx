import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function BomPage() {
  const supabase = await createSupabaseServerClient()
  const { data: boms, error } = await supabase
    .from('boms')
    .select('id,bom_code,version,status,project_id,calculation_run_id,created_at,approved_at,released_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const bomIds = (boms ?? []).map((bom) => bom.id)
  const { data: items, error: itemsError } = bomIds.length
    ? await supabase.from('bom_items').select('bom_id,item_type,description,quantity,unit').in('bom_id', bomIds).order('sort_order', { ascending: true })
    : { data: [], error: null }

  const itemCounts = new Map<string, number>()
  for (const item of items ?? []) itemCounts.set(item.bom_id, (itemCounts.get(item.bom_id) ?? 0) + 1)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">BOM / BOQ</h1>
          <div className="muted">Stage 7 — material and component requirements</div>
        </div>
        <a className="status" href="/optimization">Optimization</a>
      </header>
      <section className="section">
        <div className="card">
          {error || itemsError ? (
            <p role="alert">Unable to load BOM data: {(error ?? itemsError)?.message}</p>
          ) : (
            <table className="table">
              <thead><tr><th>Code</th><th>Version</th><th>Status</th><th>Project</th><th>Items</th><th>Approval</th><th>Release</th></tr></thead>
              <tbody>
                {(boms ?? []).map((bom) => (
                  <tr key={bom.id}>
                    <td>{bom.bom_code}</td>
                    <td>v{bom.version}</td>
                    <td>{bom.status}</td>
                    <td>{bom.project_id}</td>
                    <td>{itemCounts.get(bom.id) ?? 0}</td>
                    <td>{bom.approved_at ? 'Approved' : 'Pending'}</td>
                    <td>{bom.released_at ? 'Released' : 'Not released'}</td>
                  </tr>
                ))}
                {!(boms ?? []).length && <tr><td colSpan={7}>No BOMs found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
