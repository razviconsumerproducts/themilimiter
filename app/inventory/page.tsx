import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: locations, error } = await supabase
    .from('inventory_locations')
    .select('id,location_code,name,location_type,active,created_at')
    .order('name', { ascending: true })
    .limit(100)

  const { data: transactions, error: transactionError } = await supabase
    .from('inventory_transactions')
    .select('id,location_id,item_code,description,quantity,unit,transaction_type,source_type,source_id,transaction_date')
    .order('transaction_date', { ascending: false })
    .limit(100)

  const locationMap = new Map((locations ?? []).map((location: any) => [location.id, location]))

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Inventory</h1>
          <div className="muted">Stage 14 — physical stock ledger, locations and reservations</div>
        </div>
        <a className="status" href="/manufacturing">Manufacturing</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>Inventory Transactions</h2>
          {error || transactionError ? (
            <p role="alert">Unable to load inventory: {error?.message ?? transactionError?.message}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Item</th><th>Description</th><th>Location</th><th>Transaction</th><th>Quantity</th><th>Source</th></tr>
              </thead>
              <tbody>
                {(transactions ?? []).map((transaction: any) => {
                  const location = locationMap.get(transaction.location_id)
                  return (
                    <tr key={transaction.id}>
                      <td>{transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleString('en-IN') : '—'}</td>
                      <td>{transaction.item_code}</td>
                      <td>{transaction.description ?? '—'}</td>
                      <td>{location?.name ?? location?.location_code ?? transaction.location_id}</td>
                      <td>{transaction.transaction_type}</td>
                      <td>{transaction.quantity} {transaction.unit}</td>
                      <td>{transaction.source_type ? `${transaction.source_type}${transaction.source_id ? ` / ${transaction.source_id}` : ''}` : '—'}</td>
                    </tr>
                  )
                })}
                {!(transactions ?? []).length && <tr><td colSpan={7}>No inventory transactions found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
