import { createSupabaseServerClient } from '../../lib/supabase-server'
import CommercialPanel from './commercial-panel'

export default async function PaymentsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: quotations, error } = await supabase
    .from('quotations')
    .select('id,quotation_code,version,status,currency,grand_total,valid_until')
    .order('created_at', { ascending: false })
    .limit(100)

  return <main className="main">
    <header className="top">
      <div><h1 className="title">Approval / Payment</h1><div className="muted">Stage 11 — customer acceptance, approval, payment verification and commercial release</div></div>
      <a className="status" href="/">Dashboard</a>
    </header>
    {error ? <section className="section"><div className="card"><p role="alert">Unable to load quotations: {error.message}</p></div></section> : <CommercialPanel quotations={quotations ?? []} />}
  </main>
}
