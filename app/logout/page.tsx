'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
export default function LogoutPage(){const router=useRouter();useEffect(()=>{supabase.auth.signOut().finally(()=>router.replace('/login'))},[router]);return <main className="main"><section className="section"><div className="card">Signing out…</div></section></main>}
