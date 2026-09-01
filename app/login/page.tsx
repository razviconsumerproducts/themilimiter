'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Unable to sign in.')
      else router.push('/')
    } catch { setError('Unable to sign in. Please try again.') }
    finally { setBusy(false) }
  }

  return <main className="main"><section className="section" style={{maxWidth:460,margin:'8vh auto'}}><div className="card"><h1 className="title">MILLIMETRE</h1><p className="muted">Sign in to the operations system</p><form onSubmit={login} style={{display:'grid',gap:14}}><input aria-label="Email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" autoComplete="email"/><input aria-label="Password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"/><button type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>{error&&<p role="alert">{error}</p>}</form></div></section></main>
}
