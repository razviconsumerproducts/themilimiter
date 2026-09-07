'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function DemoForm(){
 const [form,setForm]=useState({name:'',company:'',email:'',phone:'',workflow_requirement:''})
 const [state,setState]=useState<'idle'|'sending'|'success'|'error'>('idle')
 const [message,setMessage]=useState('')
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setState('sending');setMessage('')
  try{
   const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   if(!url||!key) throw new Error('Demo service is not configured.')
   const supabase=createClient(url,key)
   const {error}=await supabase.rpc('submit_demo_request',form)
   if(error) throw error
   setState('success');setMessage('Thanks — your demo request has been received.');setForm({name:'',company:'',email:'',phone:'',workflow_requirement:''})
  }catch(err){setState('error');setMessage(err instanceof Error?err.message:'Unable to submit request. Please try again.')}
 }
 const update=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm({...form,[key]:e.target.value})
 return <form className="demo-form" onSubmit={submit}>
  <label>Name<input required value={form.name} onChange={update('name')} placeholder="Your name" /></label>
  <label>Company<input value={form.company} onChange={update('company')} placeholder="Company name" /></label>
  <label>Work email<input required type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" /></label>
  <label>Phone<input value={form.phone} onChange={update('phone')} placeholder="+91" /></label>
  <label>Tell us about your factory<textarea value={form.workflow_requirement} onChange={update('workflow_requirement')} placeholder="What do you manufacture and how does your workflow run today?" rows={5}/></label>
  <button className="landing-cta large" disabled={state==='sending'} type="submit">{state==='sending'?'Sending…':'Request demo'} <span>→</span></button>
  {message&&<small role={state==='error'?'alert':'status'}>{message}</small>}
  {!message&&<small>We’ll use these details only to respond to your request.</small>}
 </form>
}
