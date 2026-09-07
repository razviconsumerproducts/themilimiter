'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase-browser'

const plans=[
 {id:'MONTHLY',name:'Monthly',price:2999,period:'/ month'},
 {id:'YEARLY',name:'Yearly',price:12999,period:'/ year',badge:'Best value'}
]

function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}

export default function BillingPage(){
 const [sub,setSub]=useState<any>(null),[loading,setLoading]=useState(true),[paying,setPaying]=useState(''),[message,setMessage]=useState(''),[coupon,setCoupon]=useState(''),[applied,setApplied]=useState<any>(null),[checking,setChecking]=useState(''),[cashfreeReady,setCashfreeReady]=useState(false),[verifying,setVerifying]=useState(false),[verifyState,setVerifyState]=useState<'idle'|'checking'|'pending'|'success'|'failed'>('idle')
 const active=useMemo(()=>!!sub?.has_access||sub?.status==='ACTIVE',[sub])

 useEffect(()=>{
  const s=getSupabaseBrowserClient()
  let mounted=true
  ;(async()=>{
   const {data:user}=await s.auth.getUser()
   if(!user.user){window.location.href='/sign-in';return}
   const {data,error}=await s.rpc('get_subscription_access')
   if(!mounted)return
   if(error)setMessage(error.message);else setSub(data)
   setLoading(false)
  })()
  const script=document.createElement('script')
  script.src='https://sdk.cashfree.com/js/v3/cashfree.js';script.async=true
  script.onload=()=>mounted&&setCashfreeReady(true)
  script.onerror=()=>mounted&&setMessage('Cashfree checkout could not be loaded. Please refresh and try again.')
  document.head.appendChild(script)
  return()=>{mounted=false;script.remove()}
 },[])

 useEffect(()=>{
  const orderId=new URLSearchParams(window.location.search).get('order_id')
  if(!orderId)return
  let cancelled=false
  setVerifying(true);setVerifyState('checking');setMessage('Verifying your Cashfree payment…')
  ;(async()=>{
   try{
    const s=getSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession()
    if(!session)throw new Error('Please sign in again to verify your payment.')
    let lastStatus='PENDING'
    for(let attempt=0;attempt<5;attempt++){
     if(cancelled)return
     const r=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cashfree-payment-status`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({order_id:orderId})})
     const d=await r.json().catch(()=>({}))
     if(!r.ok)throw new Error(d.error||d.message||'Unable to verify payment.')
     lastStatus=String(d.payment_status||d.order_status||d.status||'PENDING').toUpperCase()
     if(lastStatus==='SUCCESS'||lastStatus==='PAID'){
      const {data:a,error}=await s.rpc('get_subscription_access')
      if(error)throw new Error(error.message)
      if(a?.has_access||a?.status==='ACTIVE'){
       if(cancelled)return
       setSub(a);setVerifyState('success');setMessage('Payment confirmed. Your MILLIMETRE account is active.');window.history.replaceState({},'',window.location.pathname)
       setTimeout(()=>{if(!cancelled)window.location.href='/executive'},800);return
      }
      await sleep(1000)
     }else if(['FAILED','CANCELLED','USER_DROPPED','EXPIRED'].includes(lastStatus)){
      setVerifyState('failed');setMessage(`Cashfree payment status: ${lastStatus.replaceAll('_',' ')}. No subscription was activated.`);return
     }else{
      setVerifyState('pending');setMessage('Payment is pending confirmation. We will keep checking for a few seconds…');await sleep(2000)
     }
    }
    if(!cancelled){setVerifyState('pending');setMessage(`Cashfree has not confirmed the payment yet (${lastStatus}). Please wait a moment and refresh this page.`)}
   }catch(e:any){if(!cancelled){setVerifyState('failed');setMessage(e.message||'Payment verification failed.')}}
   finally{if(!cancelled){setVerifying(false);setPaying('')}}
  })()
  return()=>{cancelled=true}
 },[])

 async function applyCoupon(plan:string){
  if(!coupon.trim()){setApplied(null);setMessage('');return}
  setMessage('');setChecking(plan)
  try{
   const s=getSupabaseBrowserClient();const {data,error}=await s.rpc('calculate_subscription_discount',{p_code:coupon.trim(),p_plan:plan})
   if(error)throw new Error(error.message)
   const result=Array.isArray(data)?data[0]:data
   if(!result?.valid)throw new Error(result?.message||'Invalid discount code.')
   setApplied({...result,plan})
   setMessage(`Discount applied to the ${plan==='YEARLY'?'Yearly':'Monthly'} plan.`)
  }catch(e:any){setApplied(null);setMessage(e.message||'Unable to validate discount.')}finally{setChecking('')}
 }

 async function checkout(plan:string){
  setMessage('');setPaying(plan)
  try{
   if(active)throw new Error('Your subscription is already active.')
   if(!cashfreeReady)throw new Error('Cashfree checkout is still loading. Please try again in a moment.')
   const s=getSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession();if(!session)throw new Error('Please sign in again.')
   const selected=applied?.plan===plan?applied?.code:null
   const r=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cashfree-create-order-v2`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({plan,discount_code:selected})})
   const data=await r.json().catch(()=>({}))
   if(!r.ok)throw new Error(data.message||data.error||'Unable to create Cashfree order.')
   if(!data.payment_session_id||!data.order_id)throw new Error('Cashfree did not return a valid payment session.')
   const w=window as any
   if(typeof w.Cashfree!=='function')throw new Error('Cashfree checkout is not ready. Please refresh the page.')
   const cashfree=w.Cashfree({mode:(process.env.NEXT_PUBLIC_CASHFREE_MODE||'sandbox') as any})
   await cashfree.checkout({paymentSessionId:data.payment_session_id,redirectTarget:'_self'})
  }catch(e:any){setMessage(e.message||'Payment could not be started.');setPaying('')}
 }

 if(loading)return <main className="auth-page"><div className="auth-card"><h1>Checking access…</h1><p>Please wait while we check your MILLIMETRE account.</p></div></main>
 if(active&&!verifying)return <main className="billing-page"><div className="billing-inner"><a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a><span className="eyebrow">ACCOUNT ACTIVE</span><h1>Your MILLIMETRE workspace is unlocked.</h1><p>Your subscription is active and all workspace features are available.</p><button className="landing-cta large" onClick={()=>window.location.href='/executive'}>Open dashboard →</button>{message&&<div className="auth-error">{message}</div>}</div></main>

 return <main className="billing-page"><div className="billing-inner">
  <a href="/" className="auth-brand"><span>M</span><b>MILLIMETRE</b></a>
  <span className="eyebrow">SUBSCRIPTION</span>
  <h1>{verifying?'Verifying your payment…':'Choose your MILLIMETRE plan.'}</h1>
  <p>{verifying?'We are securely checking Cashfree confirmation and updating your account.':'Choose a plan to continue using the full MILLIMETRE workspace.'}</p>
  {verifying&&<div className="coupon-box"><strong>{verifyState==='success'?'Payment confirmed':verifyState==='failed'?'Payment not confirmed':'Checking Cashfree…'}</strong><small>Do not start another payment while verification is in progress.</small></div>}
  {!verifying&&<div className="coupon-box"><label>Discount code</label><div className="coupon-row"><input value={coupon} onChange={e=>{setCoupon(e.target.value);setApplied(null)}} placeholder="Enter code"/><span>Apply on a plan below</span></div><small>Discounts are controlled and validated securely by MILLIMETRE.</small></div>}
  <div className="plan-grid">{plans.map(p=>{const isApplied=applied?.plan===p.id&&applied?.code;const final=isApplied?Number(applied.final_amount):p.price;const discount=isApplied?Number(applied.discount_amount):0;return <article className="plan-card" key={p.id}>{p.badge&&<small>{p.badge}</small>}<h2>{p.name}</h2>{discount>0?<><del>₹{p.price.toLocaleString('en-IN')}</del><strong>₹{final.toLocaleString('en-IN')}</strong><span>You save ₹{discount.toLocaleString('en-IN')} {applied.discount_type==='PERCENTAGE'?`(${applied.discount_value}%)`:''}</span></>:<><strong>₹{p.price.toLocaleString('en-IN')}</strong><span>{p.period}</span></>} {!verifying&&<><div className="coupon-action"><button type="button" onClick={()=>applyCoupon(p.id)} disabled={!!checking||!!paying}>{checking===p.id?'Checking…':'Apply discount'}</button></div><button className="landing-cta large" disabled={!!paying||verifying} onClick={()=>checkout(p.id)}>{paying===p.id?'Opening Cashfree…':`Choose ${p.name} →`}</button></>}<p>Secure payment through Cashfree. Access activates only after verified payment confirmation.</p></article>})}</div>
  {message&&<div className="auth-error">{message}</div>}
  <div className="auth-switch">Your account unlocks automatically after Cashfree confirms the payment.</div>
 </div></main>
}
