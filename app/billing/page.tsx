'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase-browser'

const plans=[{id:'MONTHLY',name:'Monthly',price:'₹2,999',period:'/ month'},{id:'YEARLY',name:'Yearly',price:'₹12,999',period:'/ year',badge:'Best value'}]
export default function BillingPage(){const [sub,setSub]=useState<any>(null);const [loading,setLoading]=useState(true);const [message,setMessage]=useState('');
 useEffect(()=>{(async()=>{const s=getSupabaseBrowserClient();const {data:user}=await s.auth.getUser();if(!user.user){window.location.href='/sign-in';return}const {data,error}=await s.rpc('get_subscription_access');if(error){setMessage(error.message)}else setSub(data);setLoading(false)})()},[])
 if(loading)return <main className="auth-page"><div className="auth-card"><h1>Checking access…</h1></div></main>
 return <main className="billing-page"><div className="billing-inner"><a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a><span className="eyebrow">SUBSCRIPTION</span><h1>Your trial has ended.</h1><p>Choose a plan to continue using the full MILLIMETRE workspace.</p><div className="plan-grid">{plans.map(p=><article className="plan-card" key={p.id}>{p.badge&&<small>{p.badge}</small>}<h2>{p.name}</h2><strong>{p.price}</strong><span>{p.period}</span><button className="landing-cta large" onClick={()=>setMessage(`Payment checkout for ${p.name} is ready to connect to your payment provider.`)}>Choose {p.name} →</button><p>Automatic activation after successful payment confirmation.</p></article>)}</div>{message&&<div className="auth-error">{message}</div>}<div className="auth-switch">Need help? Your account remains protected while subscription is pending.</div></div></main>}
