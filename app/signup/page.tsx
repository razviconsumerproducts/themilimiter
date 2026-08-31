'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setBusy(true)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      setError('Supabase configuration is missing. Please contact an administrator.')
      setBusy(false)
      return
    }

    const supabase = createBrowserClient(url, key)
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError) setError(signupError.message)
    else if (data.session) window.location.href = '/'
    else setMessage('Account created. Check your email to confirm your account, then sign in.')
    setBusy(false)
  }

  return (
    <main className="main">
      <section className="section" style={{ maxWidth: 460, margin: '8vh auto' }}>
        <div className="card">
          <h1 className="title">MILLIMETRE</h1>
          <p className="muted">Create an operations account</p>
          <form onSubmit={signup} style={{ display: 'grid', gap: 14 }}>
            <input aria-label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email" />
            <input aria-label="Password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" />
            <input aria-label="Confirm password" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" />
            <button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
          </form>
          <p className="muted" style={{ marginTop: 16 }}><Link href="/login">Already have an account? Sign in</Link></p>
        </div>
      </section>
    </main>
  )
}
