import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function CostingPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('costing_runs')
    .select('id,costing_code,version,status,currency,subtotal,discount,tax,total_cost,margin,selling_price,project_id,bom_id,optimization_run_id,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Costing</h1>
          <div className="muted">Stage 9 — material, labour, overhead and selling price</div>
        </div>
        <a className="status" href="/sales">Quotation</a>
      </header>

      <section className="section">
        <div className="card">
          {error ? (
            <p role="alert">Unable to load costing runs: {error.message}</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Total cost</th>
                    <th>Margin</th>
                    <th>Selling price</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((run) => {
                    const currency = run.currency ?? 'INR'
                    const money = (value: unknown) => `${currency} ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    return (
                      <tr key={run.id}>
                        <td>{run.costing_code}</td>
                        <td>v{run.version}</td>
                        <td>{run.status}</td>
                        <td>{run.project_id}</td>
                        <td>{money(run.subtotal)}</td>
                        <td>{money(run.discount)}</td>
                        <td>{money(run.tax)}</td>
                        <td>{money(run.total_cost)}</td>
                        <td>{money(run.margin)}</td>
                        <td>{money(run.selling_price)}</td>
                      </tr>
                    )
                  })}
                  {!(data ?? []).length && <tr><td colSpan={10}>No costing runs found.</td></tr>}
                </tbody>
              </table>
              <p className="muted">Totals are read from the canonical costing run. Total cost is database-generated from subtotal, discount and tax.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
