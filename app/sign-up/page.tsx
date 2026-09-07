'use client'

import { FormEvent, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase-browser'

export default function SignUpPage(){
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [sent,setSent]=useState(false)
 async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);const s=getSupabaseBrowserClient();const {data,error}=await s.auth.signUp({email,password,options:{data:{full_name:name}}});if(error){setError(error.message);setLoading(false);return}if(data.session){window.location.href='/executive'}else{setSent(true);setLoading(false)}}
 if(sent)return <main className="auth-page"><div className="auth-card"><a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a><span className="eyebrow">CHECK YOUR EMAIL</span><h1>Confirm your account</h1><p>We sent a verification link to <b>{email}</b>. After confirmation, sign in to start your 7-day free trial.</p><a className="landing-cta large" href="/sign-in">Go to sign in →</a></div></main>
 return <main className="auth-page"><div className="auth-card"><a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a><span className="eyebrow">7-DAY FREE TRIAL</span><h1>Create your account</h1><p>Start with full access to the MILLIMETRE platform for 7 days. No admin approval required.</p><form onSubmit={submit}><label>Name<input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name" /></label><label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password" /></label>{error&&<div className="auth-error">{error}</div>}<button className="landing-cta large" disabled={loading}>{loading?'Creating account…':'Start free trial →'}</button></form><div className="auth-switch">Already have an account? <a href="/sign-in">Sign in</a></div></div></main>
}
