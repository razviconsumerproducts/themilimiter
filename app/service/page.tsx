import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ServicePage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('service_requests')
    .select('id,request_code,status,project_id,customer_id,subject,priority,requested_at,preferred_visit_date,contact_method,description')
    .order('requested_at', { ascending: false })
    .limit(100)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Warranty / Service</h1>
          <div className="muted">Stage 20 — service requests and warranty cases</div>
        </div>
        <a className="status" href="/handover">Handover</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>Service Requests</h2>
          {error ? (
            <p role="alert">Unable to load service requests: {error.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Request</th><th>Subject</th><th>Status</th><th>Priority</th><th>Project</th><th>Requested</th><th>Preferred visit</th><th>Contact</th></tr>
              </thead>
              <tbody>
                {(data ?? []).map((request: any) => (
                  <tr key={request.id}>
                    <td>{request.request_code}</td>
                    <td>{request.subject}</td>
                    <td>{request.status}</td>
                    <td>{request.priority}</td>
                    <td>{request.project_id ?? '—'}</td>
                    <td>{request.requested_at ? new Date(request.requested_at).toLocaleString('en-IN') : '—'}</td>
                    <td>{request.preferred_visit_date ?? '—'}</td>
                    <td>{request.contact_method ?? '—'}</td>
                  </tr>
                ))}
                {!(data ?? []).length && <tr><td colSpan={8}>No service requests found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
