'use client'

import { useEffect, useState } from 'react'

type Quotation = { id: string; quotation_code: string; version: number; status: string; currency: string; grand_total: number; valid_until: string | null }
type CommercialState = { quotation: Quotation; gate: any; approvals: any[]; payments: any[] }

const money = (value: unknown, currency = 'INR') => `${currency} ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CommercialPanel({ quotations }: { quotations: Quotation[] }) {
  const [quotationId, setQuotationId] = useState(quotations[0]?.id ?? '')
  const [state, setState] = useState<CommercialState | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [approvalCode, setApprovalCode] = useState('')
  const [approvedAmount, setApprovedAmount] = useState('')
  const [paymentCode, setPaymentCode] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [referenceNumber, setReferenceNumber] = useState('')

  const load = async () => {
    if (!quotationId) return
    setMessage('')
    const response = await fetch(`/api/commercial?quotationId=${encodeURIComponent(quotationId)}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) { setMessage(data.error ?? 'Unable to load commercial state.'); return }
    setState(data)
  }

  useEffect(() => { void load() }, [quotationId])

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/commercial', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quotationId, ...body }) })
      const data = await response.json()
      if (!response.ok) { setMessage(data.error ?? 'Action failed.'); if (data.gate) setState(current => current ? { ...current, gate: data.gate } : current); return }
      setMessage('Saved successfully.')
      await load()
    } catch { setMessage('Network error. Please retry.') } finally { setBusy(false) }
  }

  const selected = state?.quotation ?? quotations.find(q => q.id === quotationId)
  const gate = state?.gate

  return <section className="section">
    <div className="card">
      <div className="section-head"><div><h2>Approval & Payment Control</h2><div className="muted">Stage 11 commercial release gate</div></div><select value={quotationId} onChange={e => setQuotationId(e.target.value)} disabled={busy}>{quotations.map(q => <option key={q.id} value={q.id}>{q.quotation_code} v{q.version} — {q.status}</option>)}</select></div>
      {!quotations.length ? <p>No quotations found. Create and issue a quotation first.</p> : <>
        <div className="grid">
          <div className="card"><div className="muted">Quotation</div><div className="metric">{selected?.quotation_code} v{selected?.version}</div></div>
          <div className="card"><div className="muted">Status</div><div className="metric">{selected?.status}</div></div>
          <div className="card"><div className="muted">Grand total</div><div className="metric">{money(selected?.grand_total, selected?.currency)}</div></div>
          <div className="card"><div className="muted">Gate</div><div className="metric">{gate?.status ?? 'NOT_READY'}</div></div>
        </div>

        <div className="workflow">
          {['ISSUED','SENT','VIEWED','ACCEPTED'].map(status => <button key={status} className="stage" disabled={busy || selected?.status === status} onClick={() => void post({ action: 'quotation_status', status })}>{status}</button>)}
        </div>

        {gate?.reasons?.length ? <div role="alert" className="card"><strong>Release blockers</strong><ul>{gate.reasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul></div> : null}

        <div className="grid">
          <div className="card"><h3>Approve quotation</h3><input placeholder="Approval code" value={approvalCode} onChange={e => setApprovalCode(e.target.value)} /><input placeholder="Approved amount" type="number" min="0" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} /><button disabled={busy || !approvalCode} onClick={() => void post({ action: 'approve', approvalCode, approvedAmount: approvedAmount || undefined })}>Record approval</button></div>
          <div className="card"><h3>Record payment</h3><input placeholder="Payment code" value={paymentCode} onChange={e => setPaymentCode(e.target.value)} /><input placeholder="Amount" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option>BANK_TRANSFER</option><option>UPI</option><option>CARD</option><option>CASH</option><option>CHEQUE</option><option>OTHER</option></select><input placeholder="Reference number" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} /><button disabled={busy || !paymentCode || !paymentAmount} onClick={() => void post({ action: 'payment', paymentCode, amount: Number(paymentAmount), paymentMethod, referenceNumber: referenceNumber || undefined })}>Record payment</button></div>
        </div>

        <div className="card"><h3>Payments</h3>{state?.payments?.length ? <table className="table"><thead><tr><th>Code</th><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Action</th></tr></thead><tbody>{state.payments.map(p => <tr key={p.id}><td>{p.payment_code}</td><td>{p.payment_date}</td><td>{money(p.amount, p.currency)}</td><td>{p.payment_method}</td><td>{p.status}</td><td>{p.status === 'RECEIVED' ? <button disabled={busy} onClick={() => void post({ action: 'verify_payment', paymentId: p.id })}>Verify</button> : '—'}</td></tr>)}</tbody></table> : <p className="muted">No payments recorded.</p>}</div>

        <div className="section-head"><div><strong>Commercial release</strong><div className="muted">Refreshes the canonical gate before release.</div></div><div><button disabled={busy} onClick={() => void post({ action: 'refresh' })}>Refresh gate</button> <button disabled={busy || gate?.status !== 'READY'} onClick={() => void post({ action: 'release' })}>Release to Purchase</button></div></div>
        {message ? <p role="status">{message}</p> : null}
      </>}
    </div>
  </section>
}
