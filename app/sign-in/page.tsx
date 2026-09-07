'use client'

import { FormEvent, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase-browser'

export default function SignInPage() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);const s=getSupabaseBrowserClient();const {error}=await s.auth.signInWithPassword({email,password});if(error){setError(error.message);setLoading(false);return} window.location.href='/executive'}
  return <main className="auth-page"><div className="auth-card"><a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a><span className="eyebrow">ACCOUNT</span><h1>Sign in</h1><p>Access your furniture manufacturing workspace.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label>{error&&<div className="auth-error">{error}</div>}<button className="landing-cta large" disabled={loading}>{loading?'Signing in…':'Sign in →'}</button></form><div className="auth-switch">New to MILLIMETRE? <a href="/sign-up">Start 7-day free trial</a></div></div></main>
}
