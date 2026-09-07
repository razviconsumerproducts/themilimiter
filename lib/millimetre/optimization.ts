import type { CuttingPart, Material } from './domain'
export function optimizeSheets(input:{parts:CuttingPart[];materials:Material[];kerfMm:number;trimAllowanceMm:number}) {
 const sheets:any[]=[]; const unplaced:any[]=[]; let totalRequiredArea=0,totalSheetArea=0
 for(let i=0;i<input.parts.length;i++){const p=input.parts[i]; const m=input.materials.find(x=>x.id===p.materialId); if(!m?.sheetWidth||!m.sheetHeight){unplaced.push({partIndex:i,reason:'Material sheet size is missing'});continue} totalRequiredArea+=p.areaSqM; let placed=false
 for(const s of sheets.filter(x=>x.materialId===m.id)){if(s.usedHeight+p.width+input.kerfMm<=m.sheetHeight&&s.usedWidth+p.length+input.kerfMm<=m.sheetWidth){s.placements.push({partIndex:i,x:s.usedWidth,y:s.usedHeight,width:p.length,height:p.width,rotated:false});s.usedWidth+=p.length+input.kerfMm;placed=true;break}}
 if(!placed){const s={materialId:m.id,materialCode:m.code,width:m.sheetWidth,height:m.sheetHeight,usedWidth:p.length+input.kerfMm,usedHeight:p.width+input.kerfMm,placements:[{partIndex:i,x:input.trimAllowanceMm,y:input.trimAllowanceMm,width:p.length,height:p.width,rotated:false}]};sheets.push(s);placed=true;totalSheetArea+=(m.sheetWidth*m.sheetHeight)/1000000}
 }
 const wasteArea=Math.max(0,totalSheetArea-totalRequiredArea); const utilizationPercentage=totalSheetArea?totalRequiredArea/totalSheetArea*100:0
 return {algorithm:'MILLIMETRE_ROW_PACK_V1',kerfMm:input.kerfMm,trimAllowanceMm:input.trimAllowanceMm,sheets,unplaced,totalRequiredArea,totalSheetArea,wasteArea,utilizationPercentage}
}
