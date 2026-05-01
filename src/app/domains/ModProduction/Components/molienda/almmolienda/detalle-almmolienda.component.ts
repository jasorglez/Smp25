import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { SelectWithTooltipEditorV2Component } from '../../../../../shared/select-with-tooltip-editor-v2.component';
import { CustomersService } from '../../../../../services/customers.service';

interface ReqOption {
  id: number;
  folio: string;
  cantidadReq: number;
  numCantidadOc: number;
}

@Component({
  selector: 'app-detalle-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;"
         [style.backgroundColor]="detailType === 'entradas' ? '#e8f5e9' : '#fce4ec'">

      <!-- Título -->
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">{{ detailType === 'entradas' ? 'Entradas' : 'Salidas' }}</strong>
      </div>

      <!-- Grid nivel 2 (requisiciones) -->
      <div [style.flex]="selectedReqRow ? '0 0 58px' : '1 1 auto'"
           style="min-height: 58px; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellClicked)="onCellClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Cascade 3: OCs de la requisición seleccionada -->
      <div *ngIf="selectedReqRow"
           style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #1565c0; background: #e3f2fd;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #1565c0; margin-bottom: 3px; flex-shrink: 0;">
          OC de {{ selectedReqRow.folio }}
        </div>
        <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="cascadeOcData"
            [columnDefs]="cascadeOcColDefs"
            [gridOptions]="cascadeOcGridOptions"
            (gridReady)="onCascadeOcGridReady($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>
      </div>

    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetalleMoliendaComponent {
  private moliendaService  = inject(MoliendaService);
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);

  private internalParams: any;
  private gridApi!: GridApi;
  private cascadeOcGridApi!: GridApi;
  private deptsCsv: string = '';
  private initCompleted = false;
  private providersMap: Map<number, string> | null = null;

  detailType: 'entradas' | 'salidas' = 'entradas';
  rowData: any[] = [];
  reqOptions: ReqOption[] = [];

  selectedReqRow: any = null;
  cascadeOcData: any[] = [];

  // ── Nivel 2: Requisiciones ────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'folio',
      headerName: 'Folio / Req',
      width: 160,
      editable: false,
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const div = document.createElement('div');
        div.style.cssText = val
          ? 'cursor:pointer;color:#2e7d32;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
      cellStyle: { backgroundColor: '#e8f5e9' },
      tooltipValueGetter: (p) => {
        const req = this.reqOptions.find(r => r.id === p.data?.idRequisition);
        if (!req) return null;
        return `Requisición: ${req.folio}\nCant. Req: ${req.cantidadReq}\n# OC: ${req.numCantidadOc}`;
      },
    },
    {
      field: 'cantidadReq',
      headerName: 'Cant Req',
      width: 120,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Cantidad requisitada: ${p.value ?? 0}`,
    },
    {
      field: 'numCantidadOc',
      headerName: '# OC',
      width: 80,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Órdenes de compra: ${p.value ?? 0}`,
    },
    {
      headerName: 'Resta',
      width: 110,
      editable: false,
      type: 'numericColumn',
      valueGetter: (p) => (p.data?.cantidadReq ?? 0) - (p.data?.cantidad ?? 0),
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'selected-row-highlight': (p: any) => p.data === this.selectedReqRow,
    },
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true },
  };

  // ── Nivel 3: OCs ──────────────────────────────────────────────────
  cascadeOcColDefs: ColDef[] = [
    { field: 'folio',        headerName: 'OC',              width: 110 },
    { field: 'proveedor',    headerName: 'Proveedor',        flex: 2, minWidth: 140 },
    { field: 'cantidad',     headerName: 'Cantidad',         width: 110, type: 'numericColumn' },
    { field: 'condEspecial', headerName: 'Cond. Especial',   flex: 2, minWidth: 130 },
    { field: 'resta',        headerName: 'Resta',            width: 90, type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' } },
  ];

  cascadeOcGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────
  agInit(params: any) { this.init(params); }
  refresh(params: any): boolean { this.internalParams = params; return true; }

  private async init(params: any) {
    this.initCompleted = false;
    this.internalParams = params;
    this.detailType = params?.data?.detailType ?? 'entradas';

    const departmentOptions = params?.departmentOptions ?? [];
    this.deptsCsv = departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');

    // Si el padre ya sincronizó y pasó los datos, úsalos directamente sin HTTP
    const preloadedReqs    = params?.preloadedReqs    as any[] | undefined;
    const preloadedDetails = params?.preloadedDetails as any[] | undefined;

    if (preloadedReqs?.length && preloadedDetails !== undefined) {
      this.reqOptions = preloadedReqs;
      this.rowData = preloadedDetails.map((d: any) => {
        const req = this.reqOptions.find((r: any) => r.id === d.idRequisition);
        return {
          id:            d.id,
          idRequisition: d.idRequisition ?? null,
          folio:         req?.folio ?? '',
          cantidadReq:   d.cantidadReq   ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad:      d.cantidad ?? 0,
          idCatalog:     d.idCatalog ?? null,
        };
      });
      this.initCompleted = true;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      }
      return;
    }

    // Flujo normal (salidas o sin precarga)
    await this.loadReqOptions();
    this.initCompleted = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  private async loadReqOptions() {
    const idBranch   = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idBranch || !idMaterial) { this.reqOptions = []; return; }
    try {
      this.reqOptions = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(idBranch, idMaterial, this.deptsCsv)
      );
    } catch (err) {
      console.error('Error cargando requisiciones:', err);
      this.reqOptions = [];
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.initCompleted) {
      // Si hay datos ya cargados por el path rápido, solo los setea en el grid
      if (this.rowData.length) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      } else {
        this.loadData();
      }
    }
    // Si init() aún no terminó, él mismo llamará loadData() al terminar
  }

  onCascadeOcGridReady(params: GridReadyEvent) {
    this.cascadeOcGridApi = params.api;
    if (this.cascadeOcData.length)
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
  }

  async loadData() {
    const idMolienda = this.internalParams?.data?.id;
    if (!idMolienda || typeof idMolienda === 'string') {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const type  = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map((d: any) => {
        const req = this.reqOptions.find(r => r.id === d.idRequisition);
        return {
          id:            d.id,
          idRequisition: d.idRequisition ?? null,
          folio:         req?.folio ?? '',
          cantidadReq:   d.cantidadReq   ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad:      d.cantidad ?? 0,
          idCatalog:     d.idCatalog ?? null,
        };
      });
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  }

  async onCellClicked(event: any) {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.idRequisition) { 
      this.selectedReqRow = null; 
      this.cascadeOcData = []; 
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
      }
      return; 
    }

    if (this.selectedReqRow === row) {
      this.selectedReqRow = null;
      this.cascadeOcData  = [];
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ force: true });
      }
      return;
    }

    this.selectedReqRow = row;
    
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data === row) {
          node.setRowHeight(undefined);
        } else {
          node.setRowHeight(0);
        }
      });
      this.gridApi.onRowHeightChanged();
    }

    const idMaterial = this.internalParams?.data?.idMaterial;
    try {
      const { lastValueFrom } = await import('rxjs');
      
      // 1. Obtener Pedimentos de la Requisición
      const pedsRes: any = await lastValueFrom(
        this.ocAndReqsService.getPedimentosByRequisicion(row.idRequisition)
      ).catch(() => []);
      const pedimentos = Array.isArray(pedsRes) ? pedsRes : [];

      // 2. Obtener OCs de cada Pedimento
      let allOcs = [];
      for (const p of pedimentos) {
        const ocsRes: any = await lastValueFrom(
          this.ocAndReqsService.getOcsByPedimento(p.id)
        ).catch(() => []);
        const ocsArray = Array.isArray(ocsRes) ? ocsRes : [];
        allOcs.push(...ocsArray);
      }

      // 3. Filtrar OCs por idMaterial buscando en sus ítems
      const matchedOcs = [];
      for (const oc of allOcs) {
        const itemsRes: any = await lastValueFrom(
          this.ocAndReqsService.getReqItems(oc.id)
        ).catch(() => []);
        const itemsArray = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.data || itemsRes?.project || itemsRes?.items || []);
        
        const matchingItem = itemsArray.find((item: any) => 
          item.idMaterial === idMaterial || 
          item.id_material === idMaterial || 
          item.idarticle === idMaterial ||
          item.idArticle === idMaterial ||
          item.id_article === idMaterial
        );

        if (matchingItem) {
          // Obtener nombre del proveedor dinámicamente
          let provName = `Prov. ${oc.idProvider || oc.id_provider || ''}`;
          try {
            const idCompany = this.internalParams?.data?.idCompany || this.internalParams?.context?.idCompany || 0;
            if (idCompany && (oc.idProvider || oc.id_provider)) {
              if (!this.providersMap) {
                 const { CustomersService } = await import('app/services/customers.service');
                 const customersSvc = this.internalParams?.context?.componentParent?.customersService;
                 if (customersSvc) {
                    // Try to get from parent context if it exists
                    const pList = customersSvc.proveedores || [];
                    this.providersMap = new Map(pList.map(p => [p.id, p.name]));
                 } else {
                    // Fallback to fetch (if injector allows, but safer to just use injected service)
                    const data = await lastValueFrom(this.customersService.getCustomersByCompany(idCompany, 'PROVIDERS')).catch(() => []);
                    const pList = Array.isArray(data) ? data : [];
                    this.providersMap = new Map(pList.map(p => [p.id, p.name || p.Description || p.description]));
                 }
              }
              if (this.providersMap?.has(oc.idProvider || oc.id_provider)) {
                 provName = this.providersMap.get(oc.idProvider || oc.id_provider);
              }
            }
          } catch (e) {
            console.warn('No se pudo mapear el proveedor', e);
          }
          
          matchedOcs.push({
            folio: oc.folio || '',
            proveedor: provName,
            cantidad: matchingItem.quantity || matchingItem.cantidad || 0,
            condEspecial: oc.conditions || '',
            resta: matchingItem.resta || matchingItem.rest || 0
          });
        }
      }

      this.cascadeOcData = matchedOcs;
    } catch (err) {
      console.error('Error cargando OCs:', err);
      this.cascadeOcData = [];
    }

    if (this.cascadeOcGridApi) this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  }

  private updateParentCount() {
    if (!this.internalParams?.node) return;
    const data = this.internalParams.node.data;
    const countField = this.detailType === 'entradas' ? 'entradas' : 'salidas';
    data[countField] = this.rowData.length;

    if (this.internalParams.api) {
      this.internalParams.api.refreshCells({
        rowNodes: [this.internalParams.node],
        columns: [countField],
        force: true,
      });
    }
  }
}
