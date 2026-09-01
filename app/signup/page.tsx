'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Unable to create account.')
      else if (data.authenticated) router.push('/')
      else setMessage('Account created. Check your email to confirm your account, then sign in.')
    } catch { setError('Unable to create account. Please try again.') }
    finally { setBusy(false) }
  }

  return <main className="main"><section className="section" style={{ maxWidth: 460, margin: '8vh auto' }}><div className="card"><h1 className="title">MILLIMETRE</h1><p className="muted">Create an operations account</p><form onSubmit={signup} style={{ display: 'grid', gap: 14 }}><input aria-label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email"/><input aria-label="Password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password"/><input aria-label="Confirm password" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password"/><button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</form><p className="muted" style={{ marginTop: 16 }}><Link href="/login">Already have an account? Sign in</Link></p></div></section></main>
}
