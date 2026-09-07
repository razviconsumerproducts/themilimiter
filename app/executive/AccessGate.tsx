'use client'
import {useEffect,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase-browser'
export default function AccessGate({children}:{children:React.ReactNode}){const [state,setState]=useState<'loading'|'allowed'|'blocked'>('loading');useEffect(()=>{(async()=>{const s=getSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession();if(!session){window.location.href='/sign-in';return}const {data,error}=await s.rpc('get_subscription_access');if(error){window.location.href='/sign-in';return}if(data?.has_access)setState('allowed');else window.location.href='/billing'})()},[]);if(state==='loading')return <div className="access-loading"><b>MILLIMETRE</b><span>Checking subscription access…</span></div>;return <>{children}</>}
