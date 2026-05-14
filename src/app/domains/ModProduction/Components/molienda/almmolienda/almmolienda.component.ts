import { Component, inject, signal, effect, Input, Renderer2, RendererFactory2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { DetalleMoliendaComponent } from './detalle-almmolienda.component';
import { lastValueFrom } from 'rxjs';
import { SignalsService } from '../../../../../services/signals.service';
import { BranchsService } from '../../../../../services/branchs.service';
import { MaterialsService } from '../../../../../services/materials.service';
import { MaterialXModuloService } from '../../../../../services/materialxmodulo.service';
import { MoliendaService, Molienda } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { DepartmentsService } from '../../../../../services/departments.service';
import { RolesService } from '../../../../../services/roles.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';
import { ExtractionFermentationBultosService } from '../../../../../services/extraction-fermentation-bultos.service';
import { CatalogProductionService } from '../../../../../services/catalog-production.service';

@Component({
  selector: 'app-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular, SelectWithTooltipEditorV2Component, DetalleMoliendaComponent],
  styles: [`
    .toast-mini {
      display: inline-block;
      background: #198754;
      color: #fff;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 6px;
      animation: fadeInOut 1.5s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-4px); }
      15%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `],
  template: `
    <div class="col-md-12 mt-2">

      <div *ngIf="toastMsg()" class="toast-mini">{{ toastMsg() }}</div>

      <div class="d-flex">

        <!-- BOTONES CRUD — izquierda -->
        <div class="d-flex flex-column gap-2 me-2">
          <button class="btn btn-xs btn-success" title="Agregar" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-xs btn-primary position-relative" title="Guardar" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasUnsavedChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-xs btn-warning" title="Deshacer" (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-xs btn-danger" title="Borrar" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i>
          </button>
        </div>

        <!-- GRID -->
        <div class="flex-grow-1">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [columnDefs]="columnDefs"
            [gridOptions]="gridOptions"
            (gridReady)="onGridReady($event)"
            (firstDataRendered)="onFirstDataRendered($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (rowClicked)="onRowClicked($event)"
            (cellEditingStopped)="onCellEditingStopped($event)"
            style="height: 80vh; width: 100%;">
          </ag-grid-angular>
        </div>

      </div>

    </div>
  `,
})
export class AlmmoliendaComponent {
  @Input() tipo: string = 'Molienda';

  private signalsService = inject(SignalsService);
  private branchsService = inject(BranchsService);
  private materialsService = inject(MaterialsService);
  private mxmService = inject(MaterialXModuloService);
  private moliendaService  = inject(MoliendaService);
  private ocAndReqsService = inject(OcAndReqsService);
  private departmentsService = inject(DepartmentsService);
  private rolesService = inject(RolesService);
  private bultosService = inject(ExtractionFermentationBultosService);
  private catalogService = inject(CatalogProductionService);

  hasUnsavedChanges = false;
  selectedRow: any  = null;
  toastMsg          = signal('');
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private idRoot = 0;
  private enterPressed = false;
  private editableColumnOrder = ['sucursal', 'id_articulo', 'ajustesInventarios', 'comentarios'];

  userBranches: any[] = [];
  branchNames: string[] = [];
  matPrimaOptions: { id: number; name: string }[] = [];
  departmentOptions: any[] = [];
  activeBranchFilter: number | null = null;
  expandedRowId: string | null = null;
  expandedDetailType: string | null = null;
  private _columnDefs: ColDef[] = [];
  bultosCantidad: number | null = null;
  bultosCantidadARevisar: number | null = null;
  proporcionRevision: number | null = null;
  caracteristicasCategories: any[] = [];
  caracteristicasFamilies: any[] = [];

  // Datos precargados del último sync — se pasan al detalle para evitar HTTP redundante
  private lastSyncedReqs: any[]    = [];
  private lastSyncedDetails: any[] = [];

  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) return this._columnDefs;

    this._columnDefs = [
    {
      headerName: 'Activo',
      field: 'active',
      width: 80,
      editable: true,
      cellDataType: 'boolean',
      cellStyle: { textAlign: 'center' },
      valueSetter: (params) => {
        params.data.active = params.newValue ?? false;
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },
    {
      headerName: 'Sucursal',
      field: 'sucursal',
      width: 200,
      editable: (params: any) =>
        (!this.activeBranchFilter || this.activeBranchFilter < 0) && !this.hasEntradas(params.data),
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: this.userBranches.map(b => b.id),
        valueListGap: 0,
        valueListMaxHeight: 220,
        cellWidth: 220,
        formatValue: (value: any) => {
          const branch = this.userBranches.find(b => b.id === value);
          return branch?.name ?? value?.toString() ?? '';
        }
      }),
      filter: true,
      filterValueGetter: (params) => {
        const branch = this.userBranches.find(b => b.id === params.data?.sucursal);
        return branch?.name ?? '';
      },
      valueFormatter: (params) => {
        const branch = this.userBranches.find(b => b.id === params.value);
        return branch?.name ?? '';
      },
      cellStyle: (params: any) => {
        if (this.hasEntradas(params.data)) {
          return { backgroundColor: '#f0f0f0', color: '#6c757d' };
        }
        if (this.activeBranchFilter && this.activeBranchFilter > 0) {
          return { backgroundColor: '#f0f0f0' };
        }
        return {};
      },
      valueSetter: (params) => {
        if (params.newValue == null) return false;
        params.data.sucursal = Number(params.newValue);
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },

    {
      headerName: 'Departamentos Autorizados',
      field: 'departmentCount',
      width: 150,
      editable: false,
      cellRenderer: (params: any) => {
        const count = this.departmentOptions.length;
        const container = document.createElement('div');
        container.style.cssText = 'cursor: pointer; text-align: center; font-weight: bold;';
        container.innerHTML = `${count} Departamento${count !== 1 ? 's' : ''}`;

        container.addEventListener('mouseenter', () => {
          if (this.departmentOptions.length > 0) {
            const rect = container.getBoundingClientRect();
            this.showDepartmentTooltip(this.departmentOptions, rect);
          }
        });

        container.addEventListener('mouseleave', () => {
          this.hideDepartmentTooltip();
        });

        return container;
      },
      cellStyle: { backgroundColor: '#e3f2fd', textAlign: 'center', cursor: 'pointer' }
    },

    {
      headerName: 'Artículo',
      field: 'id_articulo',
      flex: 1,
      minWidth: 180,
      editable: (params: any) => !this.hasEntradas(params.data),
      cellDataType: 'text',
      cellEditor: 'selectV2',
      cellEditorParams: (params: any) => {
        const sucursal = params.data?.sucursal;
        const usados = new Set(
          this.rowData()
            .filter(r => r !== params.data && r.sucursal === sucursal && r.id_articulo)
            .map((r: any) => r.id_articulo)
        );
        return {
          options: this.matPrimaOptions
            .filter(m => !usados.has(m.name))
            .map(m => ({ id: m.name, description: m.name })),
        };
      },
      valueSetter: (params) => {
        params.data.id_articulo = params.newValue ?? '';
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      },
      cellStyle: (params: any) => this.hasEntradas(params.data)
        ? { backgroundColor: '#f0f0f0', color: '#6c757d' }
        : {}
    },

    {
      field: 'entradas',
      headerName: 'Entradas',
      width: 130,
      editable: false,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        const isNew = !!params.data?.__isNew;
        const container = document.createElement('div');
        container.style.cssText = isNew
          ? 'display:flex;align-items:center;cursor:not-allowed;color:#aaa;'
          : 'display:flex;align-items:center;cursor:pointer;color:#2e7d32;text-decoration:underline;';
        container.innerHTML = `<span>${count} registro(s)</span>`;
        if (!isNew) {
          container.addEventListener('click', () => this.toggleCascade(params.node, 'entradas'));
        }
        return container;
      },
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
    },
    {
      field: 'salidas',
      headerName: 'Salidas',
      width: 130,
      editable: false,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        const isNew = !!params.data?.__isNew;
        const container = document.createElement('div');
        container.style.cssText = isNew
          ? 'display:flex;align-items:center;cursor:not-allowed;color:#aaa;'
          : 'display:flex;align-items:center;cursor:pointer;color:#2e7d32;text-decoration:underline;';
        container.innerHTML = `<span>${count} registro(s)</span>`;
        if (!isNew) {
          container.addEventListener('click', () => this.toggleCascade(params.node, 'salidas'));
        }
        return container;
      },
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
    },
   
    {
      headerName: 'Total Inventarios',
      field: 'totalInventarios',
      width: 150,
      editable: false,
      type: 'numericColumn',
      valueFormatter: (p) => String(Math.trunc(p.value ?? 0)),
      cellStyle: { backgroundColor: '#f0f4ff', fontWeight: '600' }
    },
    {
      headerName: 'Ajustes Inventarios',
      field: 'ajustesInventarios',
      width: 150,
      editable: true,
      type: 'numericColumn',
    },
    {
      headerName: 'Comentarios',
      field: 'comentarios',
      flex: 2,
      minWidth: 160,
      editable: true,
    },
    ];
    return this._columnDefs;
  }

  gridOptions: any = {
    components: {
      selectV2: SelectWithTooltipEditorV2Component,
    },
    getRowId: (params: any) => String(params.data.id ?? params.data.__tempId),
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    isExternalFilterPresent: () => this.activeBranchFilter != null,
    doesExternalFilterPass: (node: any) => node.data?.sucursal === this.activeBranchFilter,
    masterDetail: true,
    detailRowHeight: 700,
    isRowMaster: () => true,
    detailCellRenderer: DetalleMoliendaComponent,
    detailCellRendererParams: (params: any) => {
      const isEntradas = params.data?.detailType === 'entradas';
      return {
        departmentOptions: this.departmentOptions,
        preloadedReqs:     isEntradas ? this.lastSyncedReqs    : [],
        preloadedDetails:  isEntradas ? this.lastSyncedDetails : [],
        bultosCantidad:    this.bultosCantidad,
        bultosCantidadARevisar: this.bultosCantidadARevisar,
        proporcionRevision: this.proporcionRevision,
        caracteristicasCategories: this.caracteristicasCategories,
        caracteristicasFamilies: this.caracteristicasFamilies,
      };
    },
    defaultColDef: {
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);

    effect(() => {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idUser && idCompany) {
        this.idRoot = idCompany;
        this.loadUserBranches();
        this.loadRawMaterials(idCompany);
      }
    });

    effect(() => {
      const branchId = this.signalsService.getBranchSelectedBySidebar()();
      const branchName = this.signalsService.getBranchNameSelectedBySidebar()();
      const isAll = !branchName || branchName === 'Todas las sucursales' || (branchId != null && branchId < 0);
      this.activeBranchFilter = isAll ? null : branchId;
      if (this.gridApi) {
        this.gridApi.onFilterChanged();
      }
    });

    // Escucha notificación de OC creada para actualizar contador afectado
    effect(() => {
      const notification = this.signalsService.getOcCreatedNotification()();
      if (notification) {
        this.updateCounterForOcCreation(notification.idRequisition, notification.idMaterial, notification.idBranch);
      }
    });
  }

  private showDepartmentTooltip(departments: any[], cellRect: DOMRect): void {
    this.hideDepartmentTooltip();

    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');

    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.tooltipElement, arrow);

    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-building');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(`${departments.length} Departamento${departments.length !== 1 ? 's' : ''}`);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    departments.forEach((dept: any, index: number) => {
      if (index > 0) {
        const separator = this.renderer.createElement('hr');
        this.renderer.setStyle(separator, 'margin', '6px 0');
        this.renderer.setStyle(separator, 'border', 'none');
        this.renderer.setStyle(separator, 'border-top', '1px solid rgba(255, 255, 255, 0.1)');
        this.renderer.appendChild(body, separator);
      }

      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'display', 'flex');
      this.renderer.setStyle(row, 'align-items', 'center');
      this.renderer.setStyle(row, 'gap', '8px');

      const icon = this.renderer.createElement('i');
      this.renderer.addClass(icon, 'bi');
      this.renderer.addClass(icon, 'bi-check-circle-fill');
      this.renderer.setStyle(icon, 'color', '#22c55e');
      this.renderer.setStyle(icon, 'font-size', '14px');
      this.renderer.appendChild(row, icon);

      const text = this.renderer.createElement('span');
      this.renderer.setStyle(text, 'color', '#ffffff');
      const textNode = this.renderer.createText(dept.name || dept.description || '');
      this.renderer.appendChild(text, textNode);
      this.renderer.appendChild(row, text);
      this.renderer.appendChild(body, row);
    });

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);
    this.renderer.appendChild(document.body, this.tooltipElement);

    const top = cellRect.top;
    const left = cellRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private hideDepartmentTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('rowData', this.rowData());
    if (this.userBranches.length > 0 || this.matPrimaOptions.length > 0) {
      this._columnDefs = [];
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }
  }

  onFirstDataRendered(params: any) {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.autoSizeAllColumns();
    }
  }

  async loadUserBranches() {
    try {
      const idUser = this.signalsService.idUser();
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (!idUser || !idCompany) return;
      const data = await lastValueFrom(this.branchsService.getBranchesByUserAndCompany(idUser, idCompany));
      const list: any[] = (data as any)?.project ?? (Array.isArray(data) ? data : []);
      const mapped = list
        .map((b: any) => ({
          id: b?.idPermission || b?.idBranch || b?.id,
          name: (b?.name || b?.description || b?.Name || '') as string
        }))
        .filter(b => b.id && b.name.trim());
      this.userBranches = mapped;
      this.branchNames = mapped.map(b => b.name);
      this._columnDefs = [];
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.columnDefs);
    } catch (error) {
      console.error('Error loading user branches:', error);
    }
  }

  async loadRawMaterials(idCompany: number) {
    try {
      const [mxmData, matsData, deptsResponse] = await Promise.all([
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')),
        lastValueFrom(this.materialsService.getMaterialsxview(idCompany)),
        lastValueFrom(this.rolesService.getAuthorizedDepartments(idCompany)),
      ]);
      const deptsData = (deptsResponse as any)?.data || deptsResponse || [];
      const matsMap = new Map<number, string>();
      (Array.isArray(matsData) ? matsData : []).forEach((m: any) => matsMap.set(m.id, m.articulo));
      this.matPrimaOptions = (Array.isArray(mxmData) ? mxmData : [])
        .filter((m: any) => m.active !== false)
        .map((m: any) => ({ id: m.idArticulo, name: matsMap.get(m.idArticulo) ?? String(m.idArticulo) }))
        .filter(m => m.name);
      this.departmentOptions = Array.isArray(deptsData) ? deptsData : [];
      this._columnDefs = [];
      if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.columnDefs);
      await Promise.all([
        this.loadData(this.idRoot),
        this.loadCaracteristicasCategories(this.idRoot),
      ]);
    } catch (error) {
      console.error('Error loading raw materials:', error);
    }
  }

  private showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), 1500);
  }

  private hasEntradas(row: any): boolean {
    return Number(row?.entradas ?? 0) > 0;
  }

  private async loadBultosCantidad(idCompany: number, idBranch: number) {
    try {
      const result = await lastValueFrom(this.bultosService.getByBranch(idCompany, idBranch));
      this.bultosCantidad = result?.cantidadBultos ?? null;
      this.bultosCantidadARevisar = result?.cantidadARevisar ?? null;
      this.proporcionRevision = result?.proporcionRevision ?? null;
    } catch (error) {
      console.error('Error loading bultos cantidad:', error);
      this.bultosCantidad = null;
      this.bultosCantidadARevisar = null;
      this.proporcionRevision = null;
    }
  }

  private async loadCaracteristicasCategories(idCompany: number) {
    try {
      const allItems = await lastValueFrom(this.catalogService.getAll(idCompany));
      const itemsArray = Array.isArray(allItems) ? allItems : [];

      this.caracteristicasCategories = itemsArray
        .filter((item: any) => item.type === 'CATEGORY')
        .sort((a: any, b: any) => {
          const aDesc = (a.description || '').toLowerCase();
          const bDesc = (b.description || '').toLowerCase();
          return aDesc.localeCompare(bDesc);
        });

      this.caracteristicasFamilies = itemsArray
        .filter((item: any) => item.type === 'FAM-CAT')
        .sort((a: any, b: any) => {
          const aDesc = (a.description || '').toLowerCase();
          const bDesc = (b.description || '').toLowerCase();
          return aDesc.localeCompare(bDesc);
        });
    } catch (error) {
      console.error('Error loading características:', error);
      this.caracteristicasCategories = [];
      this.caracteristicasFamilies = [];
    }
  }

  onRowClicked(event: any)       { this.selectedRow = event.data; }
  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  async loadData(idCompany: number) {
    try {
      const items = await lastValueFrom(this.moliendaService.getAll(idCompany, this.tipo));
      console.log('Raw data from API:', items);
      const mapped = (Array.isArray(items) ? items : []).map(i => this.mapRow(i));

      const deptsCsv = this.departmentOptions
        .map((d: any) => d.id)
        .filter((id: any) => id)
        .join(',');

      // Entradas: contar requisiciones reales en ocandreq (no DetailsMolienda).
      // Esto da el valor correcto sin necesidad de abrir la cascada.
      // Salidas: sigue contando DetailsMolienda (no hay sync automático para salidas).
      const countsPromises = mapped
        .filter(row => row.id && row.sucursal && row.idMaterial)
        .map(async row => {
          const [reqs, salidas] = await Promise.all([
            lastValueFrom(this.ocAndReqsService.getReqsByBranchMaterial(row.sucursal, row.idMaterial, deptsCsv)),
            lastValueFrom(this.moliendaService.getDetails(row.id, 'SALIDA')),
          ]);
          return {
            id: row.id,
            entradas: (reqs as any[]).length,
            salidas: salidas.length,
          };
        });

      const detailsCounts = await Promise.all(countsPromises);
      const countsMap = new Map(detailsCounts.map(d => [d.id, d]));

      mapped.forEach(row => {
        const counts = countsMap.get(row.id);
        if (counts) {
          row.entradas = counts.entradas;
          row.salidas  = counts.salidas;
        }
      });

      const sorted = this.sortRowsByBranchAndArticle(mapped);

      this.originalRowData = JSON.parse(JSON.stringify(sorted));
      
      this.rowData.set(sorted);
      //console.log('Loaded molienda:', this.rowData());  
      if (this.gridApi) this.gridApi.setGridOption('rowData', sorted);
    } catch (error) {
      console.error('Error loading molienda:', error);
      this.rowData.set([]);
      if (this.gridApi) this.gridApi.setGridOption('rowData', []);
    }
  }

  private sortRowsByBranchAndArticle(rows: any[]): any[] {
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const activeA = a.row.active !== false;
        const activeB = b.row.active !== false;
        if (activeA !== activeB) {
          return activeA ? -1 : 1;
        }

        const branchNameA = this.getBranchName(a.row.sucursal);
        const branchNameB = this.getBranchName(b.row.sucursal);
        const branchCompare = branchNameA.localeCompare(branchNameB, 'es', { sensitivity: 'base' });
        if (branchCompare !== 0) return branchCompare;

        const articleNameA = (a.row.id_articulo ?? '').toString();
        const articleNameB = (b.row.id_articulo ?? '').toString();
        const articleCompare = articleNameA.localeCompare(articleNameB, 'es', { sensitivity: 'base' });
        if (articleCompare !== 0) return articleCompare;

        return a.index - b.index;
      })
      .map(item => item.row);
  }

  private getBranchName(idBranch: number | null | undefined): string {
    return this.userBranches.find(b => b.id === idBranch)?.name ?? '';
  }

  private async updateCounterForOcCreation(idRequisition: number, idMaterial: number, idBranch: number) {
    try {
      const currentRowData = this.rowData();
      const affectedRow = currentRowData.find(r => r.idMaterial === idMaterial && r.sucursal === idBranch);

      if (!affectedRow || !affectedRow.id) return;

      const deptsCsv = this.departmentOptions
        .map((d: any) => d.id)
        .filter((id: any) => id)
        .join(',');

      // Cuenta requisiciones reales (no DetailsMolienda — esos solo existen tras abrir cascada)
      const reqs = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(affectedRow.sucursal, affectedRow.idMaterial, deptsCsv)
      );

      affectedRow.entradas = (reqs as any[]).length;

      if (this.gridApi) {
        const node = this.gridApi.getRowNode(affectedRow.id.toString());
        if (node) {
          node.setData(affectedRow);
          this.gridApi.refreshCells({ rowNodes: [node], columns: ['entradas'], force: true });
        }
      }

      this.toastMsg.set(`✓ Contador actualizado`);
      setTimeout(() => this.toastMsg.set(''), 1500);
    } catch (error) {
      console.warn('Error updating counter for OC creation:', error);
    }
  }

  private mapRow(i: any): any {
    const nombreMaterial = this.matPrimaOptions.find(m => m.id === i.idMaterial)?.name ?? '';
    return {
      id:                 i.id,
      active:             i.active ?? true,
      sucursal:           i.idSucursal   ?? null,
      idMaterial:         i.idMaterial   ?? null,
      id_articulo:        nombreMaterial,
      entradas:           i.entradas     ?? 0,
      salidas:            i.salidas      ?? 0,
      totalEntradas:      (i as any).totalEntradas ?? null,
      totalSalidas:       (i as any).totalSalidas  ?? null,
      totalInventarios:   i.totalInventarios   ?? 0,
      ajustesInventarios: i.ajustesInventarios ?? 0,
      comentarios:        i.comentarios  ?? '',
      __isNew:            false,
      __modified:         false,
    };
  }

  private toPayload(row: any): Molienda {
    const idMaterial = this.matPrimaOptions.find(m => m.name === row.id_articulo)?.id ?? null;
    return {
      idCompany:          this.idRoot,
      idSucursal:         row.sucursal       ?? null,
      idMaterial:         idMaterial,
      entradas:           row.entradas       ?? 0,
      salidas:            row.salidas        ?? 0,
      totalInventarios:   row.totalInventarios   ?? 0,
      ajustesInventarios: row.ajustesInventarios ?? 0,
      comentarios:        row.comentarios    || null,
      type:               this.tipo,
      active:             row.active ?? true,
    };
  }

  async toggleCascade(node: any, type: string) {
    if (node.data?.__isNew) return;

    if (this.expandedRowId === node.id && this.expandedDetailType === type) {
      node.setExpanded(false);
      this.expandedRowId = null;
      this.expandedDetailType = null;
      node.data.detailType = null;
      this.gridApi.forEachNode((n: any) => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }

    if (type === 'entradas') {
      await this.syncEntradasDetails(node.data);
    }

    if (this.expandedRowId) {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === this.expandedRowId) { n.setExpanded(false); }
      });
    }

    this.gridApi.forEachNode((n: any) => {
      if (n.id !== node.id) n.setRowHeight(0);
    });

    node.data.detailType = type;
    this.expandedRowId = node.id;
    this.expandedDetailType = type;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  private async syncEntradasDetails(rowData: any) {
    const { id: idMolienda, sucursal, idMaterial } = rowData;
    if (!idMolienda || !sucursal || !idMaterial) return;

    await this.loadBultosCantidad(this.idRoot, sucursal);

    const today = new Date().toISOString().substring(0, 10);
    const deptsCsv = this.departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');

    const [reqs, existing] = await Promise.all([
      lastValueFrom(this.ocAndReqsService.getReqsByBranchMaterial(sucursal, idMaterial, deptsCsv)),
      lastValueFrom(this.moliendaService.getDetails(idMolienda, 'ENTRADA')),
    ]);

    const existingMap = new Map(existing.map((d: any) => [d.idRequisition, d]));
    const reqIds = new Set(reqs.map((r: any) => r.id));

    const deletePromises = existing
      .filter((detail: any) => detail.idRequisition && !reqIds.has(detail.idRequisition))
      .map(detail => lastValueFrom(this.moliendaService.deleteDetail(detail.id!)));

    const createUpdatePromises: Promise<any>[] = [];
    for (const req of reqs as any[]) {
      const existingDetail = existingMap.get(req.id) as any;
      if (!existingDetail) {
        createUpdatePromises.push(
          lastValueFrom(this.moliendaService.createDetail({
            idMolienda,
            idRequisition: req.id,
            type: 'ENTRADA',
            cantidadReq:   req.cantidadReq,
            numCantidadOc: req.numCantidadOc,
            cantidad:      0,
            fecha:         today,
          }))
        );
      } else if (
        existingDetail.cantidadReq   !== req.cantidadReq ||
        existingDetail.numCantidadOc !== req.numCantidadOc
      ) {
        createUpdatePromises.push(
          lastValueFrom(this.moliendaService.updateDetail(existingDetail.id, {
            idMolienda,
            idRequisition: req.id,
            type:          'ENTRADA',
            cantidadReq:   req.cantidadReq,
            numCantidadOc: req.numCantidadOc,
            cantidad:      existingDetail.cantidad ?? 0,
            fecha:         existingDetail.fecha ?? today,
          }))
        );
      }
    }

    await Promise.all([...deletePromises, ...createUpdatePromises]);

    // Guardar estado final en memoria para pasarlo al componente detalle sin HTTP extra
    this.lastSyncedReqs = reqs as any[];
    this.lastSyncedDetails = (reqs as any[]).map(req => {
      const ex = existingMap.get(req.id) as any;
      return {
        id:            ex?.id ?? null,
        idRequisition: req.id,
        cantidadReq:   req.cantidadReq,
        numCantidadOc: req.numCantidadOc,
        cantidad:      ex?.cantidad ?? 0,
        idCatalog:     ex?.idCatalog ?? null,
      };
    });
  }

  add() {
    const branchName = this.signalsService.getBranchNameSelectedBySidebar()() ?? '';
    const currentBranch = this.userBranches.find(b => b.name === branchName);
    const newRow = {
      id: null,
      __tempId: `new_${Date.now()}`,
      active: true,
      sucursal: currentBranch?.id ?? null,
      tipo: this.tipo,
      id_articulo: '',
      entradas: 0,
      salidas: 0,
      totalEntradas: null,
      totalSalidas: null,
      totalInventarios: 0,
      ajustesInventarios: 0,
      comentarios: '',
      __isNew: true,
    };
    const updated = [newRow, ...this.rowData()];
    this.rowData.set(updated);
    this.hasUnsavedChanges = true;
    if (this.gridApi) this.gridApi.setGridOption('rowData', updated);
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'sucursal' });
    }, 0);
  }

  async saveChanges() {
    const newRows      = this.rowData().filter(r => r.__isNew);
    const modifiedRows = this.rowData().filter(r => r.__modified && !r.__isNew);
    if (newRows.length === 0 && modifiedRows.length === 0) return;

    try {
      for (const row of newRows) {
        const created = await lastValueFrom(this.moliendaService.create(this.toPayload(row)));
        row.id      = created.id;
        row.__isNew = false;
      }
      for (const row of modifiedRows) {
        await lastValueFrom(this.moliendaService.update(row.id, this.toPayload(row)));
        row.__modified = false;
      }

      const saved = newRows.length + modifiedRows.length;
      const sorted = this.sortRowsByBranchAndArticle(this.rowData());
      this.hasUnsavedChanges = false;
      this.rowData.set(sorted);
      this.originalRowData   = JSON.parse(JSON.stringify(sorted));
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', sorted);
        this.gridApi.refreshCells({ columns: ['entradas', 'salidas'], force: true });
      }
      this.showToast(`${saved} registro(s) guardado(s)`);
    } catch (error) {
      console.error('Error saving molienda:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error');
    }
  }

  revertChanges() {
    const reverted = this.sortRowsByBranchAndArticle(JSON.parse(JSON.stringify(this.originalRowData)));
    this.rowData.set(reverted);
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', reverted);
  }

  async deleteRow() {
    if (!this.selectedRow) return;

    if (this.selectedRow.__isNew) {
      const filtered = this.rowData().filter(r => r !== this.selectedRow);
      this.rowData.set(filtered);
      this.selectedRow = null;
      this.hasUnsavedChanges = filtered.some((r: any) => r.__isNew || r.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', filtered);
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Eliminar registro?', '', 'warning', 'Sí, eliminar'
    );
    if (!confirm.isConfirmed) return;

    try {
      await lastValueFrom(this.moliendaService.delete(this.selectedRow.id));
      const afterDelete = this.rowData().filter(r => r !== this.selectedRow);
      this.rowData.set(afterDelete);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      if (this.gridApi) this.gridApi.setGridOption('rowData', afterDelete);
      this.selectedRow = null;
      this.showToast('Eliminado');
    } catch (error) {
      console.error('Error deleting molienda:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al eliminar.', 'error');
    }
  }
}
