import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function QualityPage() {
  const supabase = await createSupabaseServerClient()
  const { data: inspections, error } = await supabase
    .from('production_qc_inspections')
    .select('id,inspection_code,project_id,production_order_id,production_piece_id,status,inspected_quantity,accepted_quantity,rework_quantity,rejected_quantity,remarks,inspected_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Production QC</h1>
          <div className="muted">Stage 16 — inspection, acceptance, rework and rejection control</div>
        </div>
        <a className="status" href="/manufacturing">Manufacturing</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>QC Inspections</h2>
          {error ? (
            <p role="alert">Unable to load production QC inspections: {error.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Inspection</th><th>Status</th><th>Project</th><th>Production order</th><th>Inspected</th><th>Accepted</th><th>Rework</th><th>Rejected</th><th>Inspected at</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {(inspections ?? []).map((inspection: any) => (
                  <tr key={inspection.id}>
                    <td>{inspection.inspection_code}</td>
                    <td>{inspection.status}</td>
                    <td>{inspection.project_id}</td>
                    <td>{inspection.production_order_id}</td>
                    <td>{inspection.inspected_quantity}</td>
                    <td>{inspection.accepted_quantity}</td>
                    <td>{inspection.rework_quantity}</td>
                    <td>{inspection.rejected_quantity}</td>
                    <td>{inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleString('en-IN') : '—'}</td>
                    <td>{inspection.remarks ?? '—'}</td>
                  </tr>
                ))}
                {!(inspections ?? []).length && <tr><td colSpan={10}>No production QC inspections found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
