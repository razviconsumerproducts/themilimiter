export type QuotationItemInput = { itemType:string; sourceType?:string; sourceId?:string; itemCode?:string; description:string; quantity:number; unit:string; unitPrice:number; discount?:number; taxRate?:number; notes?:string }
export function buildQuotation(input:any) {
  const items=input.items.map((item:QuotationItemInput)=>{const quantity=Number(item.quantity);const unitPrice=Number(item.unitPrice);const discount=Number(item.discount??0);const taxRate=Number(item.taxRate??0);const taxable=Math.max(0,quantity*unitPrice-discount);const taxAmount=taxable*taxRate/100;return {...item,quantity,unitPrice,discount,taxRate,taxAmount,lineTotal:taxable+taxAmount}})
  const subtotal=items.reduce((s:number,i:any)=>s+i.quantity*i.unitPrice,0); const discount=items.reduce((s:number,i:any)=>s+i.discount,0); const taxableAmount=Math.max(0,subtotal-discount); const taxAmount=items.reduce((s:number,i:any)=>s+i.taxAmount,0); const grandTotal=taxableAmount+taxAmount
  return {...input,items,subtotal,discount,taxableAmount,taxAmount,grandTotal,commercialSnapshot:{project_id:input.projectId,quotation_code:input.quotationCode,version:input.version,grand_total:grandTotal}}
}
