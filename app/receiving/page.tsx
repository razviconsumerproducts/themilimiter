import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function ReceivingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: receipts, error } = await supabase
    .from('goods_receipts')
    .select('id,receipt_code,project_id,purchase_order_id,receipt_date,status,supplier_document_no,notes,created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: items, error: itemError } = await supabase
    .from('goods_receipt_items')
    .select('id,goods_receipt_id,item_code,description,ordered_quantity,received_quantity,accepted_quantity,rejected_quantity,hold_quantity,unit')
    .order('created_at', { ascending: false })
    .limit(200)

  const itemMap = new Map<string, any[]>()
  for (const item of items ?? []) {
    const current = itemMap.get(item.goods_receipt_id) ?? []
    current.push(item)
    itemMap.set(item.goods_receipt_id, current)
  }

  return (
    <main className="main">
      <header className="top">
        <div>
          <h1 className="title">Goods Receipt + QC</h1>
          <div className="muted">Stage 13 — receipt, inspection, acceptance and inventory posting control</div>
        </div>
        <a className="status" href="/inventory">Inventory</a>
      </header>
      <section className="section">
        <div className="card">
          <h2>Goods Receipts</h2>
          {error || itemError ? (
            <p role="alert">Unable to load goods receipts: {error?.message ?? itemError?.message}</p>
          ) : (
            <table className="table">
              <thead><tr><th>Receipt</th><th>Date</th><th>Status</th><th>Project</th><th>Purchase order</th><th>Supplier document</th><th>Items</th></tr></thead>
              <tbody>
                {(receipts ?? []).map((receipt: any) => (
                  <tr key={receipt.id}>
                    <td>{receipt.receipt_code}</td>
                    <td>{receipt.receipt_date ?? '—'}</td>
                    <td>{receipt.status}</td>
                    <td>{receipt.project_id}</td>
                    <td>{receipt.purchase_order_id}</td>
                    <td>{receipt.supplier_document_no ?? '—'}</td>
                    <td>{itemMap.get(receipt.id)?.length ?? 0}</td>
                  </tr>
                ))}
                {!(receipts ?? []).length && <tr><td colSpan={7}>No goods receipts found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <section className="section">
        <div className="card">
          <h2>Receipt Items</h2>
          {!itemError && (
            <table className="table">
              <thead><tr><th>Item</th><th>Description</th><th>Ordered</th><th>Received</th><th>Accepted</th><th>Rejected</th><th>Hold</th><th>Unit</th></tr></thead>
              <tbody>
                {(items ?? []).map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.item_code}</td>
                    <td>{item.description}</td>
                    <td>{item.ordered_quantity}</td>
                    <td>{item.received_quantity}</td>
                    <td>{item.accepted_quantity}</td>
                    <td>{item.rejected_quantity}</td>
                    <td>{item.hold_quantity}</td>
                    <td>{item.unit}</td>
                  </tr>
                ))}
                {!(items ?? []).length && <tr><td colSpan={8}>No receipt items found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
