import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

const text=(v:unknown)=>String(v??'').trim()
const num=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error('Numeric value is invalid');return n}

export async function POST(request:Request){try{const s=await createSupabaseServerClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});const b=await request.json() as Record<string,unknown>;const action=text(b.action);const id=text(b.id);if(!action) return NextResponse.json({error:'action is required.'},{status:400});let data:null|unknown=null;let error:null|{message:string}=null;
if(action==='release_order'){({data,error}=await s.rpc('release_production_order',{p_order_id:id}))}
else if(action==='complete_order'){({data,error}=await s.rpc('complete_production_order',{p_order_id:id}))}
else if(action==='lock_order'){({data,error}=await s.rpc('lock_completed_production_order',{p_order_id:id}))}
else if(action==='start_operation'){({data,error}=await s.rpc('start_production_operation',{p_operation_id:id,p_operator_id:user.id}))}
else if(action==='complete_operation'){({data,error}=await s.rpc('complete_production_operation',{p_operation_id:id,p_completed_qty:num(b.completedQty),p_scrap_qty:num(b.scrapQty??0),p_rework_qty:num(b.reworkQty??0),p_actual_minutes:num(b.actualMinutes??0),p_notes:text(b.notes)||null}))}
else if(action==='hold_operation'){({data,error}=await s.rpc('hold_production_operation',{p_operation_id:id,p_exception_type:text(b.exceptionType)||'HOLD',p_reason:text(b.reason)}))}
else if(action==='record_output'){({data,error}=await s.rpc('record_production_output',{p_order_id:text(b.orderId),p_operation_id:id,p_output_type:text(b.outputType)||'GOOD',p_quantity:num(b.quantity),p_reason:text(b.reason)||null}))}
else if(action==='resolve_exception'){({data,error}=await s.rpc('resolve_production_exception',{p_exception_id:id,p_resolution:text(b.resolution)}))}
else if(action==='issue_material'){({data,error}=await s.rpc('issue_reserved_inventory_for_operation',{p_reservation_id:text(b.reservationId),p_quantity:num(b.quantity),p_project_id:text(b.projectId),p_production_order_id:text(b.orderId),p_operation_id:id,p_notes:text(b.notes)||null}))}
else return NextResponse.json({error:'Unsupported production action.'},{status:400});
if(error)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({ok:true,data})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Production action failed.'},{status:400})}}
