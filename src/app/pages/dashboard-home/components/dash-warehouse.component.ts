import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { firstValueFrom } from 'rxjs';
import { InandoutService } from 'app/services/inandout.service';
import { InventarioWarehouseService } from 'app/services/inventario-warehouse.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { PermitionsService } from 'app/services/permitions.service';
import { SignalsService } from 'app/services/signals.service';
import { SetupService } from 'app/services/setup.service';
import { TrackingService } from 'app/services/tracking.service';
import { WarehousesService } from 'app/services/warehouses.service';

@Component({
  selector: 'app-dash-warehouse',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  template: `
    <section class="warehouse-dashboard">
      <div class="hero">
        <div><span class="eyebrow">CONTROL LOGÍSTICO</span><h2>Dashboard de Almacenes</h2><p>Compras, movimientos y existencias en una sola vista.</p></div>
        <div class="context"><i class="bi bi-geo-alt-fill"></i>{{ contextLabel }}<span class="live"></span></div>
      </div>

      <div *ngIf="errorMessage" class="alert alert-warning py-2 mb-3"><i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}</div>

      <div class="kpis">
        <article class="kpi blue"><i class="bi bi-card-checklist"></i><div><span>Requisiciones</span><strong>{{ requisitions.length }}</strong><small>{{ pendingRequisitions }} pendientes</small></div></article>
        <article class="kpi violet"><i class="bi bi-cart-check-fill"></i><div><span>Órdenes de compra</span><strong>{{ purchaseOrders.length }}</strong><small>{{ openOrders }} abiertas</small></div></article>
        <article class="kpi green"><i class="bi bi-box-arrow-in-down"></i><div><span>Entradas</span><strong>{{ entrances.length }}</strong><small>{{ totalEntries | number:'1.0-2' }} unidades</small></div></article>
        <article class="kpi orange"><i class="bi bi-box-arrow-up"></i><div><span>Salidas</span><strong>{{ outings.length }}</strong><small>{{ totalOutings | number:'1.0-2' }} unidades</small></div></article>
        <article class="kpi cyan"><i class="bi bi-boxes"></i><div><span>Inventario</span><strong>{{ inventory.length }}</strong><small>materiales</small></div></article>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-xl-8">
          <article class="card-box h-100">
            <header><span><i class="bi bi-bar-chart-line-fill"></i> Entradas y salidas por mes</span><small>Últimos 6 meses</small></header>
            <div class="chart" *ngIf="movementSeries[0]?.data?.length; else noMovements">
              <apx-chart [series]="movementSeries" [chart]="movementChart" [xaxis]="movementXaxis" [colors]="movementColors"
                         [stroke]="movementStroke" [dataLabels]="noLabels" [legend]="topLegend" [tooltip]="quantityTooltip"></apx-chart>
            </div>
            <ng-template #noMovements><div class="empty">Sin movimientos en el contexto seleccionado</div></ng-template>
          </article>
        </div>
        <div class="col-12 col-xl-4">
          <article class="card-box h-100">
            <header><span><i class="bi bi-pie-chart-fill"></i> Salud del inventario</span></header>
            <div class="chart" *ngIf="stockSeries.length; else noInventory">
              <apx-chart [series]="stockSeries" [chart]="donutChart" [labels]="stockLabels" [colors]="stockColors"
                         [legend]="bottomLegend" [dataLabels]="donutLabels"></apx-chart>
            </div>
            <ng-template #noInventory><div class="empty">Sin existencias registradas</div></ng-template>
          </article>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-xl-4">
          <article class="card-box h-100 value-card">
            <header><span><i class="bi bi-cash-coin"></i> Valor de inventario</span></header>
            <div class="value-body"><span>Valor total estimado</span><strong>{{ inventoryValue | currency:'MXN':'symbol':'1.0-0' }}</strong><small>{{ totalExistence | number:'1.0-2' }} unidades disponibles</small></div>
            <div class="health-row"><div><b class="critical">{{ criticalStock }}</b><span>Críticos</span></div><div><b class="low">{{ lowStock }}</b><span>Bajos</span></div><div><b class="optimal">{{ optimalStock }}</b><span>Óptimos</span></div></div>
          </article>
        </div>
        <div class="col-12 col-xl-8">
          <article class="card-box h-100">
            <header><span><i class="bi bi-exclamation-diamond-fill"></i> Materiales que requieren atención</span><small>{{ attentionInventory.length }} materiales</small></header>
            <div class="attention-list">
              <div class="attention-row" *ngFor="let item of attentionInventory">
                <span class="stock-state" [class.critical]="normalizeState(item.estadoStock) === 'CRITICO'">{{ item.estadoStock }}</span>
                <div><strong>{{ item.description || item.insumo }}</strong><small>{{ item.insumo }} · Existencia {{ item.existencia || 0 }} / Mín. {{ item.stockMin || 0 }}</small></div>
                <b>{{ item.total | currency:'MXN':'symbol':'1.0-0' }}</b>
              </div>
              <div class="empty compact" *ngIf="!attentionInventory.length">No hay materiales críticos o bajos</div>
            </div>
          </article>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12">
          <article class="card-box">
            <header class="movement-header">
              <span><i class="bi bi-arrow-left-right"></i> Últimos 10 movimientos de materiales</span>
              <div class="date-filters">
                <label>Almacén
                  <select [(ngModel)]="selectedWarehouse" (change)="onWarehouseFilterChange()">
                    <option [ngValue]="0">Todos los almacenes</option>
                    <option *ngFor="let warehouse of warehouses" [ngValue]="warehouseId(warehouse)">{{ warehouseName(warehouse) }}</option>
                  </select>
                </label>
                <label>Desde <input type="date" [(ngModel)]="movementDateFrom"></label>
                <label>Hasta <input type="date" [(ngModel)]="movementDateTo"></label>
                <button type="button" (click)="applyMovementDateFilter()" [disabled]="filteringMovements"><i class="bi bi-funnel-fill"></i>{{ filteringMovements ? 'Buscando…' : 'Aplicar' }}</button>
              </div>
            </header>
            <div class="movement-grid-wrap">
              <table class="movement-grid">
                <thead><tr><th>Tipo</th><th>Fecha</th><th>Folio</th><th>Material</th><th class="number">Cantidad</th><th class="number">Existencia actual</th><th>Estado</th><th>Almacén</th></tr></thead>
                <tbody>
                  <tr *ngFor="let row of movementItems">
                    <td><span class="movement-type" [class.out]="row.type === 'OUT'"><i [class]="row.type === 'IN' ? 'bi bi-arrow-down-left me-1' : 'bi bi-arrow-up-right me-1'"></i>{{ row.type === 'IN' ? 'Entrada' : 'Salida' }}</span></td>
                    <td>{{ row.date | date:'dd MMM yyyy' }}</td><td><strong>{{ row.folio }}</strong></td>
                    <td><div class="material-cell"><strong>{{ row.material }}</strong><small>{{ row.code }}</small></div></td>
                    <td class="number quantity" [class.out]="row.type === 'OUT'">{{ row.quantity | number:'1.0-2' }}</td>
                    <td class="number existence">{{ row.existence | number:'1.0-2' }}</td>
                    <td><span class="stock-state" [class.critical]="normalizeState(row.stockState) === 'CRITICO'">{{ row.stockState || '—' }}</span></td>
                    <td>{{ row.warehouse }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="empty compact" *ngIf="!movementItems.length">Sin movimientos entre {{ movementDateFrom | date:'dd MMM yyyy' }} y {{ movementDateTo | date:'dd MMM yyyy' }}</div>
            </div>
          </article>
        </div>
        <div class="col-12">
          <article class="card-box">
            <header><span><i class="bi bi-truck"></i> Órdenes de compra recientes</span><small>{{ purchaseOrderValue | currency:'MXN':'symbol':'1.0-0' }}</small></header>
            <div class="movement-list">
              <div class="movement-row" *ngFor="let order of recentOrders">
                <span class="order-number">{{ order.number || order.folio || order.id }}</span>
                <div><strong>{{ order.providerName || order.nameProvider || order.description || 'Orden de compra' }}</strong><small>{{ order.date || order.dateOrder | date:'dd MMM yyyy' }} · {{ order.state || order.status || 'Sin estado' }}</small></div>
                <b class="order-value">{{ orderTotal(order) | currency:'MXN':'symbol':'1.0-0' }}</b>
              </div>
              <div class="empty compact" *ngIf="!recentOrders.length">Sin órdenes de compra</div>
            </div>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .warehouse-dashboard{padding:2px;color:#172033}.hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;margin-bottom:16px;border-radius:16px;color:#fff;background:linear-gradient(120deg,#064e3b,#047857 55%,#0f766e);box-shadow:0 10px 30px rgba(4,120,87,.2)}
    .eyebrow{font-size:10px;font-weight:800;letter-spacing:2px;opacity:.7}.hero h2{margin:3px 0 2px;font-size:24px;font-weight:800}.hero p{margin:0;font-size:12px;opacity:.78}.context{display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid rgba(255,255,255,.25);border-radius:20px;background:rgba(255,255,255,.1);font-size:10px}.live{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.18)}
    .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}.kpi{display:flex;align-items:center;gap:12px;min-height:91px;padding:14px;background:#fff;border:1px solid #e8edf5;border-radius:13px;box-shadow:0 3px 14px rgba(15,23,42,.05)}.kpi>i{width:41px;height:41px;display:grid;place-items:center;flex:none;border-radius:11px;color:#fff;font-size:18px}.kpi.blue>i{background:linear-gradient(135deg,#2563eb,#60a5fa)}.kpi.violet>i{background:linear-gradient(135deg,#7c3aed,#a78bfa)}.kpi.green>i{background:linear-gradient(135deg,#059669,#34d399)}.kpi.orange>i{background:linear-gradient(135deg,#ea580c,#fb923c)}.kpi.cyan>i{background:linear-gradient(135deg,#0891b2,#22d3ee)}
    .kpi span{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase}.kpi strong{display:inline-block;margin-right:7px;color:#0f172a;font-size:23px;line-height:1.1}.kpi small{color:#94a3b8;font-size:9px}.card-box{overflow:hidden;background:#fff;border:1px solid #e8edf5;border-radius:13px;box-shadow:0 3px 14px rgba(15,23,42,.05)}.card-box header{min-height:43px;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #edf1f7;background:#fbfcff;color:#065f46;font-size:12px;font-weight:800}.card-box header i{margin-right:7px;color:#10b981}.card-box header small{color:#64748b;font-size:9px;font-weight:600}.chart{min-height:270px;display:grid;place-items:center;padding:5px 10px}
    .value-body{padding:22px 18px;text-align:center;background:linear-gradient(145deg,#ecfdf5,#fff)}.value-body span,.value-body small{display:block;color:#64748b;font-size:10px}.value-body strong{display:block;margin:5px 0;color:#064e3b;font-size:27px}.health-row{display:grid;grid-template-columns:repeat(3,1fr);padding:13px}.health-row div{text-align:center;border-right:1px solid #e5e7eb}.health-row div:last-child{border:0}.health-row b,.health-row span{display:block}.health-row b{font-size:18px}.health-row span{color:#64748b;font-size:8px;text-transform:uppercase}.critical{color:#dc2626!important}.low{color:#d97706}.optimal{color:#059669}
    .attention-list,.movement-list{max-height:250px;overflow:auto}.attention-row,.movement-row{display:flex;align-items:center;gap:10px;padding:10px 13px;border-bottom:1px solid #f0f3f8}.attention-row>div,.movement-row>div{flex:1;min-width:0}.attention-row strong,.movement-row strong{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px}.attention-row small,.movement-row small{display:block;color:#64748b;font-size:8px}.attention-row>b{font-size:10px;color:#334155}.stock-state{min-width:52px;padding:4px 6px;text-align:center;border-radius:10px;background:#fef3c7;color:#b45309;font-size:8px;font-weight:800}.stock-state.critical{background:#fee2e2}.movement-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#dcfce7;color:#059669}.movement-icon.out{background:#fee2e2;color:#dc2626}.movement-type{padding:3px 7px;border-radius:9px;background:#dcfce7;color:#047857;font-size:8px;font-weight:800}.movement-type.out{background:#fee2e2;color:#b91c1c}.order-number{min-width:42px;padding:5px;text-align:center;border-radius:8px;background:#eef2ff;color:#4338ca;font-size:8px;font-weight:800}.order-value{font-size:9px;color:#047857}.empty{padding:55px 12px;text-align:center;color:#94a3b8;font-size:11px}.empty.compact{padding:32px 12px}
    .movement-grid-wrap{overflow:auto}.movement-grid{width:100%;min-width:900px;border-collapse:collapse;font-size:10px}.movement-grid th{padding:9px 11px;background:#f8fafc;color:#64748b;font-size:8px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0}.movement-grid td{padding:9px 11px;border-bottom:1px solid #f0f3f8;color:#475569}.movement-grid tbody tr:hover{background:#f8fffc}.movement-grid .number{text-align:right}.movement-grid .quantity{color:#059669;font-weight:800}.movement-grid .quantity.out{color:#dc2626}.movement-grid .existence{color:#1d4ed8;font-size:11px;font-weight:800}.material-cell strong,.material-cell small{display:block}.material-cell strong{color:#172033;font-size:10px}.material-cell small{color:#94a3b8;font-size:8px}
    .movement-header{gap:12px;flex-wrap:wrap}.date-filters{display:flex;align-items:end;gap:7px;flex-wrap:wrap}.date-filters label{display:flex;flex-direction:column;gap:2px;color:#64748b;font-size:7px;text-transform:uppercase}.date-filters input,.date-filters select{height:26px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-size:9px}.date-filters select{min-width:155px}.date-filters button{height:26px;padding:3px 9px;border:0;border-radius:6px;background:#047857;color:#fff;font-size:9px;font-weight:700}.date-filters button i{margin-right:4px;color:#fff}.date-filters button:disabled{opacity:.6}
    @media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.kpis{grid-template-columns:repeat(2,1fr)}.hero{align-items:flex-start;flex-direction:column}}@media(max-width:460px){.kpis{grid-template-columns:1fr}}
  `]
})
export class DashWarehouseComponent {
  private signals = inject(SignalsService);
  private ocReqService = inject(OcAndReqsService);
  private inOutService = inject(InandoutService);
  private inventoryService = inject(InventarioWarehouseService);
  private warehousesService = inject(WarehousesService);
  private setupService = inject(SetupService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);

  requisitions: any[]=[]; purchaseOrders: any[]=[]; entrances: any[]=[]; outings: any[]=[]; inventory: any[]=[]; warehouses: any[]=[];
  movementItems: {type:string;date:any;folio:string;material:string;code:string;quantity:number;existence:number;stockState:string;warehouse:string}[]=[];
  selectedWarehouse=0;
  movementDateFrom=this.toDateInput(this.offsetDate(new Date(),-365)); movementDateTo=this.toDateInput(new Date()); filteringMovements=false;
  loading=false; errorMessage=''; contextLabel='Empresa seleccionada'; private loadKey='';
  stockSeries:number[]=[]; stockLabels:string[]=[];
  movementSeries:any[]=[{name:'Entradas',data:[]},{name:'Salidas',data:[]}]; movementXaxis:any={categories:[]};
  readonly movementChart:any={type:'area',height:270,toolbar:{show:false},fontFamily:'Inter, system-ui, sans-serif'};
  readonly movementColors=['#10b981','#f97316']; readonly movementStroke:any={curve:'smooth',width:3}; readonly noLabels:any={enabled:false};
  readonly topLegend:any={position:'top',horizontalAlign:'right',fontSize:'10px'}; readonly bottomLegend:any={position:'bottom',fontSize:'10px'};
  readonly quantityTooltip:any={shared:true,intersect:false,y:{formatter:(v:number)=>`${v.toLocaleString('es-MX')} unidades`}};
  readonly donutChart:any={type:'donut',height:270,toolbar:{show:false},fontFamily:'Inter, system-ui, sans-serif'};
  readonly donutLabels:any={enabled:true,formatter:(v:number)=>`${v.toFixed(0)}%`}; readonly stockColors=['#ef4444','#f59e0b','#10b981','#3b82f6','#94a3b8'];

  constructor(){effect(()=>{const company=Number(this.signals.getRootSelectedBySidebar()()||0);const project=Number(this.signals.getProjectSelectedBySidebar()()||0);const branch=Number(this.signals.getBranchSelectedBySidebar()()||0);const key=`${company}-${project}-${branch}`;if(company&&key!==this.loadKey){this.loadKey=key;this.load(company,project,branch);}})}
  get pendingRequisitions(){return this.requisitions.filter(x=>this.isOpen(x)).length} get openOrders(){return this.purchaseOrders.filter(x=>this.isOpen(x)).length}
  get totalEntries(){return this.sumMovement(this.entrances)} get totalOutings(){return this.sumMovement(this.outings)} get inventoryValue(){return this.inventory.reduce((s,x)=>s+Number(x.total||0),0)} get totalExistence(){return this.inventory.reduce((s,x)=>s+Number(x.existencia||0),0)}
  get criticalStock(){return this.inventory.filter(x=>this.normalizeState(x.estadoStock)==='CRITICO').length} get lowStock(){return this.inventory.filter(x=>this.normalizeState(x.estadoStock)==='BAJO').length} get optimalStock(){return this.inventory.filter(x=>this.normalizeState(x.estadoStock)==='OPTIMO').length}
  get attentionInventory(){return this.inventory.filter(x=>['CRITICO','BAJO'].includes(this.normalizeState(x.estadoStock))).sort((a,b)=>Number(a.existencia||0)-Number(b.existencia||0)).slice(0,7)}
  get recentMovements(){return [...this.entrances.map(x=>({...x,__type:'IN'})),...this.outings.map(x=>({...x,__type:'OUT'}))].sort((a,b)=>new Date(this.movementDate(b)||0).getTime()-new Date(this.movementDate(a)||0).getTime()).slice(0,7)}
  get recentOrders(){return [...this.purchaseOrders].sort((a,b)=>new Date(b.date||b.dateOrder||0).getTime()-new Date(a.date||a.dateOrder||0).getTime()).slice(0,7)} get purchaseOrderValue(){return this.purchaseOrders.reduce((s,x)=>s+this.orderTotal(x),0)}

  private async load(company:number,project:number,branch:number){this.loading=true;this.errorMessage='';try{
    const setup=this.array(await this.safe(()=>this.setupService.getWarehouseSetup(company)));
    const projectOrBranch=setup.length?this.asBoolean(setup[0].projectOrBranch):!!project;
    const reference=projectOrBranch?project:branch;
    const movementReference=project||branch;
    const typeReference=projectOrBranch?'project':'branch';
    this.contextLabel=projectOrBranch?(project?'Proyecto seleccionado':'Proyecto no seleccionado'):(branch?'Sucursal seleccionada':'Sucursal no seleccionada');
    const email=this.trackingService.getEmail()||localStorage.getItem('mail')||'';
    const [inv,req,oc,permittedWarehouses,fallbackWarehouses]=await Promise.all([this.safe(()=>this.inventoryService.getInventario(company)),reference?this.safe(()=>this.ocReqService.getOcAndReqs(typeReference,reference,'REQUIS')):[],reference?this.safe(()=>this.ocReqService.getOcAndReqs(typeReference,reference,'OC')):[],email?this.safe(()=>this.permitionsService.getPermisionswarehousexEmail(email)):[],this.safe(()=>this.warehousesService.getSimpleWarehouses(company))]);
    this.inventory=this.array(inv);this.requisitions=this.array(req);this.purchaseOrders=this.array(oc);this.warehouses=this.array(permittedWarehouses).length?this.array(permittedWarehouses):this.array(fallbackWarehouses);
    if(this.selectedWarehouse&&!this.warehouses.some(w=>this.warehouseId(w)===this.selectedWarehouse))this.selectedWarehouse=0;
    const movementPairs=movementReference?await Promise.all(this.warehouses.map(w=>Promise.all([this.safe(()=>this.inOutService.getInAndOuts(movementReference,Number(w.id??w.idWarehouse??w.idAlmacen),'IN')),this.safe(()=>this.inOutService.getInAndOuts(movementReference,Number(w.id??w.idWarehouse??w.idAlmacen),'OUT'))]))):[];
    this.entrances=movementPairs.flatMap((x,i)=>this.array(x[0]).map(row=>({...row,__warehouse:this.warehouses[i],__type:'IN'})));this.outings=movementPairs.flatMap((x,i)=>this.array(x[1]).map(row=>({...row,__warehouse:this.warehouses[i],__type:'OUT'})));
    await this.loadMovementItems();this.buildCharts();
  }catch(e){console.error('Error dashboard almacenes:',e);this.errorMessage='No fue posible cargar toda la información de Almacenes.'}finally{this.loading=false}}
  private async safe(factory:()=>any){try{return await firstValueFrom(factory())}catch{return []}} private array(v:any):any[]{return Array.isArray(v)?v:Array.isArray(v?.data)?v.data:[]}
  private buildCharts(){const states=new Map<string,number>();this.inventory.forEach(x=>{const s=this.normalizeState(x.estadoStock)||'SIN ESTADO';states.set(s,(states.get(s)||0)+1)});this.stockLabels=[...states.keys()].map(x=>x.replace('CRITICO','Crítico').replace('OPTIMO','Óptimo').replace('BAJO','Bajo').replace('ALTO','Alto'));this.stockSeries=[...states.values()];
    const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));return d});this.movementXaxis={categories:months.map(d=>d.toLocaleDateString('es-MX',{month:'short'}))};const values=(rows:any[])=>months.map(m=>this.filterByWarehouse(rows).filter(x=>{const d=new Date(this.movementDate(x));return d.getFullYear()===m.getFullYear()&&d.getMonth()===m.getMonth()}).reduce((s,x)=>s+this.movementQuantity(x),0));this.movementSeries=[{name:'Entradas',data:values(this.entrances)},{name:'Salidas',data:values(this.outings)}]}
  normalizeState(v:any){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()} private isOpen(x:any){return !['CERRADO','CERRADA','COMPLETADO','COMPLETADA','CANCELADO','CANCELADA','ENTREGADO','ENTREGADA'].includes(this.normalizeState(x.state||x.status||x.estado))}
  movementDate(x:any){return x.date||x.dateMovement||x.createdAt||x.fecha||null} movementName(x:any){return x.number||x.folio||x.description||x.observation||`Movimiento ${x.id||''}`} private movementQuantity(x:any){return Number(x.quantity||x.totalQuantity||x.countrow||x.total||0)} private sumMovement(rows:any[]){return rows.reduce((s,x)=>s+this.movementQuantity(x),0)} orderTotal(x:any){return Number(x.totalMN||x.totalMx||x.total||x.amount||0)}
  async applyMovementDateFilter(){this.filteringMovements=true;try{await this.loadMovementItems()}finally{this.filteringMovements=false}}
  private async loadMovementItems(){const from=this.movementDateFrom?new Date(`${this.movementDateFrom}T00:00:00`).getTime():Number.MIN_SAFE_INTEGER;const to=this.movementDateTo?new Date(`${this.movementDateTo}T23:59:59`).getTime():Number.MAX_SAFE_INTEGER;const masters=this.filterByWarehouse([...this.entrances,...this.outings]).filter(master=>{const time=new Date(this.movementDate(master)||0).getTime();return time>=from&&time<=to}).sort((a,b)=>new Date(this.movementDate(b)||0).getTime()-new Date(this.movementDate(a)||0).getTime()).slice(0,10);const details=await Promise.all(masters.map(master=>this.safe(()=>this.inOutService.getInAndOutItems(Number(master.id)))));const rows:any[]=[];masters.forEach((master,index)=>{const items=this.array(details[index]);items.forEach(item=>{const inventory=this.findInventory(item);rows.push({type:master.__type,date:this.movementDate(master),folio:String(master.folio||master.number||master.id||'—'),material:inventory?.description||item.description||item.productName||`Material ${item.idProduct||''}`,code:inventory?.insumo||item.insumo||String(item.idProduct||''),quantity:Number(item.quantity||0),existence:Number(inventory?.existencia||0),stockState:inventory?.estadoStock||'',warehouse:this.warehouseName(master.__warehouse)})})});this.movementItems=rows.slice(0,10)}
  private findInventory(item:any){const id=Number(item.idProduct??item.idMaterial);return this.inventory.find(inv=>Number(inv.idMaterial??inv.idProduct??inv.id)===id)||this.inventory.find(inv=>String(inv.insumo||'')===String(item.insumo||item.code||''))}
  private asBoolean(value:any){return value===true||value===1||value==='1'||String(value).toLowerCase()==='true'}
  warehouseId(warehouse:any){return Number(warehouse?.idAlmacen??warehouse?.idWarehouse??warehouse?.id??0)} warehouseName(warehouse:any){return warehouse?.nombreAlmacen||warehouse?.name||warehouse?.description||`Almacén ${this.warehouseId(warehouse)}`}
  async onWarehouseFilterChange(){await this.applyMovementDateFilter();this.buildCharts()} private filterByWarehouse(rows:any[]){return this.selectedWarehouse?rows.filter(row=>this.warehouseId(row.__warehouse)===Number(this.selectedWarehouse)):rows}
  private offsetDate(date:Date,days:number){const value=new Date(date);value.setDate(value.getDate()+days);return value} private toDateInput(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
}
