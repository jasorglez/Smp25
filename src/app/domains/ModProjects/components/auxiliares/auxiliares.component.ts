import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import * as XLSX from 'xlsx';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
import { MaterialsService } from 'app/services/materials.service';
import { EquipmentService } from 'app/services/equipment.service';
import { HerramientaService } from 'app/services/herramienta.service';
import { ManoObraService } from 'app/services/mano-obra.service';
import { alerts } from 'app/helpers/alerts';
import { PdfApuService } from 'app/services/pdf-apu.service';
import { WorkprogramApuFactorService } from 'app/services/workprogram-apu-factor.service';
import { ApuConfigService, ApuConfig, APU_CONFIG_DEFAULTS } from 'app/services/apu-config.service';
import { TrackingService } from 'app/services/tracking.service';
import { RootService } from 'app/services/root.service';
import { ContractsService } from 'app/services/contracts.service';
import { ProjectsService } from 'app/services/projects.service';
import { AnexoHImportService, AnexoHImportPreview, AnexoHApuPackage } from 'app/services/anexo-h-import.service';
import { apuFactorSteps, apuMoney, apuUnitPrice } from './apu-pricing';

type ResourceTab = 'PERSONAL' | 'MATERIAL' | 'EQUIPO' | 'HERR' | 'AUXILIAR';

interface ApuImportRow {
  type: ResourceTab;
  idReference: number | null;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  crewName: string;
  crewQuantity: number;
}

interface ApuImportPreview {
  clave: number | null;
  claveUsuario: string;
  description: string;
  unit: string;
  rows: ApuImportRow[];
  directCost: number;
}

@Component({
  selector: 'app-auxiliares',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule],
  templateUrl: './auxiliares.component.html',
  styleUrl: './auxiliares.component.scss',
})
export class AuxiliaresComponent {
  private trackingService = inject(TrackingService);
  private rootService = inject(RootService);
  private contractsService = inject(ContractsService);
  private projectsService = inject(ProjectsService);
  private anexoHImportService = inject(AnexoHImportService);
  private signalsService       = inject(SignalsService);
  private auxiliarService      = inject(AuxiliarService);
  private auxiliarItemsService = inject(AuxiliarItemsService);
  private materialService      = inject(MaterialsService);
  private equipService         = inject(EquipmentService);
  private herramientaService   = inject(HerramientaService);
  private manoObraService      = inject(ManoObraService);
  private pdfApuService        = inject(PdfApuService);
  private factorService        = inject(WorkprogramApuFactorService);
  private apuConfigService     = inject(ApuConfigService);

  // ── Master list ──────────────────────────────────────────────────────────
  rowData: any[]       = [];
  originalData: any[]  = [];
  selectedAuxiliar: any = null;
  hasMainChanges       = false;
  private mainGridApi!: GridApi;
  private idCompany    = 0;
  private tempCounter  = 0;

  // ── Catálogos ────────────────────────────────────────────────────────────
  catalogMaterial:    any[] = [];
  catalogEquipo:      any[] = [];
  catalogHerramienta: any[] = [];
  catalogPersonal:    any[] = [];
  selectedMaterialId: number | null = null;
  selectedEquipoId: number | null = null;
  selectedHerramientaId: number | null = null;
  selectedPersonalId: number | null = null;
  selectedAuxiliarId: number | null = null;
  activeResourceTab: ResourceTab | null = null;
  showImportModal = false;
  parsingImport = false;
  importFileName = '';
  importPreview: ApuImportPreview | null = null;
  importErrors: string[] = [];
  importWarnings: string[] = [];
  showAnexoHImportModal = false;
  loadingAnexoH = false;
  importingAnexoH = false;
  anexoHImportError = '';
  anexoHImportPreview: AnexoHImportPreview | null = null;
  anexoHImportProgress = { done: 0, total: 0, label: '' };
  pdfReportProgress = { active: false, percent: 0, label: '' };
  private anexoHPackage: AnexoHApuPackage | null = null;

  // ── Sub-items (MATERIAL, HERR, EQUIPO) ───────────────────────────────────
  allItems: any[]          = [];
  hasItemChanges           = false;
  selectedMaterialRow: any  = null;
  selectedHerramientaRow: any = null;
  selectedEquipoRow: any    = null;
  selectedAuxiliarRow: any = null;
  private materialGridApi!: GridApi;
  private herramientaGridApi!: GridApi;
  private equipoGridApi!: GridApi;
  private auxiliarGridApi!: GridApi;

  // ── Cuadrillas ───────────────────────────────────────────────────────────
  cuadrillas: any[]         = [];
  selectedCuadrilla: any    = null;
  cuadrillaItemRows: any[]  = [];
  hasCuadrillaChanges       = false;
  selectedCuadrillaItem: any = null;
  private cuadrillaGridApi!: GridApi;

  // ── Unidades personalizadas ──────────────────────────────────────────────
  private baseUnits = ['M2', 'M3', 'ML', 'PZA', 'KG', 'TON', 'HR', 'DIA', 'JGO', 'GLB'];
  customUnits: string[] = [];
  private pendingNewUnitRow: any = null;
  get allUnits(): string[] { return [...this.baseUnits, ...this.customUnits, '+ Nueva unidad...']; }

  private baseEquipoUnits = ['HR', 'DIA', 'SEM', 'MES', 'VIAJE', 'KM', 'GLB'];
  equipoCustomUnits: string[] = [];
  private pendingEquipoUnitItem: any = null;
  get allEquipoUnits(): string[] { return [...this.baseEquipoUnits, ...this.equipoCustomUnits, '+ Nueva medida...']; }

  // ── ColDefs comunes ──────────────────────────────────────────────────────
  readonly rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };
  readonly defaultColDef: ColDef = { resizable: true, sortable: true, minWidth: 80 };

  // ── ColDefs master grid ──────────────────────────────────────────────────
  readonly mainColDefs: ColDef[] = [
    { headerName: '#', width: 40, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1, cellStyle: { textAlign: 'center', color: '#888' } },
    { field: 'clave', headerName: 'Clave', width: 75, editable: true, sort: 'asc',
      comparator: (a: any, b: any) => (parseInt(a) || 0) - (parseInt(b) || 0),
      cellStyle: { fontWeight: '700', textAlign: 'center', color: '#333' } },
    { field: 'claveUsuario', headerName: 'Cl. Usuario', width: 100, editable: true,
      cellStyle: { fontStyle: 'italic', color: '#555' } },
    { field: 'description', headerName: 'Descripción del Precio Unitario', editable: true, flex: 3, wrapText: true, autoHeight: true },
    { field: 'unit', headerName: 'Unidad', editable: true, width: 100,
      cellEditor: 'agSelectCellEditor', cellEditorParams: () => ({ values: this.allUnits }) },
    { field: 'costMN', headerName: 'Costo Directo', editable: false, width: 130, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: (p) => p.value != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '$0.00' },
    { field: 'precioUnitario', headerName: 'Precio Unitario', editable: false, width: 140, type: 'numericColumn',
      cellStyle: { fontWeight: '700', color: '#155724', background: '#d4edda' },
      valueFormatter: (p) => p.value ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '-' },
  ];

  // ── ColDefs Material / Equipo ────────────────────────────────────────────
  private itemColDefsCache: Partial<Record<'MATERIAL' | 'EQUIPO' | 'AUXILIAR', ColDef[]>> = {};
  getItemColDefs(type: 'MATERIAL' | 'EQUIPO' | 'AUXILIAR'): ColDef[] {
    if (this.itemColDefsCache[type]) return this.itemColDefsCache[type];
    const catalog = () => type === 'MATERIAL' ? this.catalogMaterial : type === 'EQUIPO' ? this.catalogEquipo : this.catalogAuxiliares;
    return this.itemColDefsCache[type] = [
      { headerName: '#', width: 45, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      { field: 'description', headerName: type === 'MATERIAL' ? 'Material' : type === 'EQUIPO' ? 'Equipo' : 'Análisis auxiliar', flex: 2, editable: type !== 'AUXILIAR',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: catalog().map((i) => i.description) }),
        valueSetter: (p: any) => {
          const item = catalog().find((i) => i.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = item.unit ?? ''; p.data.unitCost = item.cost ?? item.costMN ?? 0; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      ...(type === 'EQUIPO' ? [{
        field: 'unit', headerName: 'Medida', width: 110, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.allEquipoUnits }),
      } as ColDef] : [{ field: 'unit', headerName: 'Unidad', width: 90, editable: type !== 'AUXILIAR' } as ColDef]),
      { field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(5) : '' },
      { field: 'unitCost', headerName: type === 'AUXILIAR' ? 'Costo directo hijo' : 'Precio Unitario', width: 140, editable: type !== 'AUXILIAR', type: 'numericColumn',
        valueGetter: type === 'AUXILIAR' ? (p) => this.getAuxiliarUnitCost(p.data) : undefined,
        valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
      { headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => apuMoney((Number(p.data?.quantity) || 0) * (type === 'AUXILIAR' ? this.getAuxiliarUnitCost(p.data) : (Number(p.data?.unitCost) || 0))),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' } },
    ];
  }

  // ── ColDefs Herramienta (% MO) ───────────────────────────────────────────
  private herramientaColDefsCache: ColDef[] | null = null;
  get herramientaItemColDefs(): ColDef[] {
    return this.herramientaColDefsCache ??= [
      { headerName: '#', width: 45, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      { field: 'description', headerName: 'Herramienta', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.catalogHerramienta.map((h) => h.description) }),
        valueSetter: (p: any) => {
          const item = this.catalogHerramienta.find((h) => h.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = '(%)mo'; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'quantity', headerName: '% MO', width: 110, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? (Number(p.value) * 100).toFixed(2) + '%' : '' },
      { headerName: 'Base MO', width: 130, editable: false, type: 'numericColumn',
        valueGetter: () => this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { color: '#666' } },
      { headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (Number(p.data?.quantity) || 0) * this.totalPersonal,
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' } },
    ];
  }

  // ── ColDefs Cuadrilla items ──────────────────────────────────────────────
  private cuadrillaColDefsCache: ColDef[] | null = null;
  get cuadrillaItemColDefs(): ColDef[] {
    return this.cuadrillaColDefsCache ??= [
      { headerName: '#', width: 45, editable: false, valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1 },
      { field: 'description', headerName: 'Trabajador', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.catalogPersonal.map((i) => i.description) }),
        valueSetter: (p: any) => {
          const item = this.catalogPersonal.find((i) => i.description === p.newValue);
          if (item) { p.data.idReference = item.id; p.data.unit = 'JORNADA'; p.data.unitCost = item.cost ?? 0; }
          p.data.description = p.newValue; return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
      { field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '' },
      { field: 'unitCost', headerName: 'Precio Unitario', width: 140, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '' },
      { headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (Number(p.data?.quantity) || 0) * (Number(p.data?.unitCost) || 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' } },
    ];
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────
  get materialItems(): any[]    { return this.allItems.filter((i) => i.type === 'MATERIAL'); }
  get herramientaItems(): any[] { return this.allItems.filter((i) => i.type === 'HERR'); }
  get equipoItems(): any[]      { return this.allItems.filter((i) => i.type === 'EQUIPO'); }
  get auxiliarItems(): any[] { return this.allItems.filter((i) => i.type === 'AUXILIAR'); }
  get catalogAuxiliares(): any[] {
    return this.rowData.filter((row) => Number(row.id) > 0 && Number(row.id) !== Number(this.selectedAuxiliar?.id))
      .map((row) => ({ id: Number(row.id), description: `${row.claveUsuario || row.clave || row.id} · ${row.description}`,
        unit: row.unit, cost: Number(row.costMN) || 0 }));
  }
  getAuxiliarUnitCost(item: any): number {
    const current = this.rowData.find((row) => Number(row.id) === Number(item?.idReference));
    return Number(current?.costMN ?? item?.unitCost ?? 0) || 0;
  }

  getCuadrillaSubtotal(c: any): number {
    return apuMoney((c.items ?? []).reduce((sum: number, i: any) => {
      const qty  = Number(i.quantity ?? i.Quantity ?? 0) || 0;
      const cost = Number(i.unitCost ?? i.unit_cost ?? i.UnitCost ?? 0) || 0;
      return sum + apuMoney(qty * cost);
    }, 0));
  }

  get totalPersonal(): number {
    return apuMoney(this.cuadrillas.reduce((sum, c) => sum + apuMoney(this.getCuadrillaSubtotal(c) * (Number(c.cantidad) || 1)), 0));
  }
  get materialTotal(): number {
    return apuMoney(this.materialItems.reduce((sum, i) => sum + apuMoney((Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0)), 0));
  }
  get herramientaTotal(): number {
    return apuMoney(this.herramientaItems.reduce((sum, i) => sum + apuMoney((Number(i.quantity) || 0) * this.totalPersonal), 0));
  }
  get equipoTotal(): number {
    return apuMoney(this.equipoItems.reduce((sum, i) => sum + apuMoney((Number(i.quantity) || 0) * (Number(i.unitCost ?? i.unit_cost) || 0)), 0));
  }
  get auxiliarTotal(): number {
    return apuMoney(this.auxiliarItems.reduce((sum, item) => sum + apuMoney((Number(item.quantity) || 0) * this.getAuxiliarUnitCost(item)), 0));
  }
  get costoTotal(): number { return apuMoney(this.totalPersonal + this.materialTotal + this.herramientaTotal + this.equipoTotal + this.auxiliarTotal); }

  // ── Init ─────────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.signalsService.getContractSelectedBySidebar()();
      this.loadData();
      this.loadCatalogs();
    });
    effect(() => {
      this.signalsService.getRootSelectedBySidebar()();
      this.signalsService.getContractSelectedBySidebar()();
      void this.loadFactors();
      void this.loadApuConfig();
    });
  }

  loadData() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    const idCompany = this.idCompany;
    this.rowData = [];
    this.originalData = [];
    this.selectedAuxiliar = null;
    this.allItems = [];
    this.cuadrillas = [];
    this.hasMainChanges = false;
    this.hasItemChanges = false;
    this.hasCuadrillaChanges = false;
    if (!idCompany || !idContract) return;
    this.auxiliarService.getByContract(idContract, idCompany).subscribe({
      next: (data) => {
        if (this.signalsService.getContractSelectedBySidebar()() !== idContract || this.idCompany !== idCompany) return;
        this.rowData = (data ?? []).map((row: any) => ({
          ...row,
          costMN: Number(row.costMN ?? row.cost_mn ?? row.CostMN ?? 0) || 0,
          precioUnitario: Number(row.precioUnitario ?? row.precio_unitario ?? row.PrecioUnitario ?? 0) || 0,
        }));
        this.originalData = JSON.parse(JSON.stringify(this.rowData));
        this.hasMainChanges = false;
      },
      error: (e) => console.error('Error cargando precios unitarios', e),
    });
  }

  loadCatalogs() {
    if (!this.idCompany) return;
    this.materialService.getMaterialsForApu(this.idCompany).subscribe({
      next: (d) => this.catalogMaterial = d
        .map((i: any) => ({ id: Number(i.id ?? i.Id), description: i.description ?? i.materialDescription ?? '',
          unit: i.measure ?? i.unit ?? '', cost: Number(i.costoMN ?? i.costMN ?? i.unitPrice ?? 0) || 0 }))
        .filter((i: any) => i.id && i.description),
    });
    this.equipService.getEquipment(this.idCompany).subscribe({
      next: (d: any[]) => this.catalogEquipo = d.map((i) => ({ id: Number(i.Id ?? i.id), description: i.description ?? '',
        unit: i.measure ?? i.unit ?? 'HR', cost: Number(i.costMN ?? i.costoMN ?? i.unitPrice ?? 0) || 0 }))
        .filter((i) => i.id && i.description),
    });
    this.herramientaService.getByCompany(this.idCompany).subscribe({
      next: (d) => this.catalogHerramienta = d.map((i) => ({ id: Number(i.Id ?? i.id), description: i.description ?? '', unit: i.unit ?? 'HR', cost: i.costMN ?? 0 }))
        .filter((i) => i.id && i.description),
    });
    this.manoObraService.getByCompany(this.idCompany).subscribe({
      next: (d: any[]) => this.catalogPersonal = d.filter((i) => i.active !== false && i.active !== 0)
        .map((i) => ({ id: Number(i.Id ?? i.id), description: i.description ?? '', unit: i.unit ?? 'JORNADA',
          cost: Number(i.unitPrice ?? i.costMN ?? i.costo ?? 0) || 0 }))
        .filter((i) => i.id && i.description),
    });
  }

  openImportModal(): void {
    if (!this.idCompany || !this.signalsService.getContractSelectedBySidebar()()) {
      alerts.basicAlert('Seleccione un contrato', 'Seleccione un contrato antes de importar un análisis.', 'warning');
      return;
    }
    if (this.hasMainChanges || this.hasDetailChanges) {
      alerts.basicAlert('Cambios sin guardar', 'Guarde o deshaga los cambios actuales antes de importar otro análisis.', 'warning');
      return;
    }
    this.importFileName = '';
    this.importPreview = null;
    this.importErrors = [];
    this.importWarnings = [];
    this.showImportModal = true;
  }

  async openAnexoHImportModal(): Promise<void> {
    const idContract = Number(this.signalsService.getContractSelectedBySidebar()() || 0);
    const idProject = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
    if (Number(this.idCompany) !== this.anexoHImportService.companyId
        || idContract !== this.anexoHImportService.contractId
        || idProject !== this.anexoHImportService.projectId) {
      alerts.basicAlert('Contexto distinto',
        'Selecciona empresa 10, contrato CONTRATO-1003 (ID 178) y proyecto MONTES PRUEBA PMO (ID 799) para revisar este paquete.', 'warning');
      return;
    }
    if (this.hasDetailChanges) {
      alerts.basicAlert('Cambios sin guardar', 'Guarda o deshaz los cambios actuales antes de importar el Anexo H.', 'warning');
      return;
    }
    this.anexoHImportError = '';
    this.anexoHImportPreview = null;
    this.anexoHImportProgress = { done: 0, total: 0, label: '' };
    this.showAnexoHImportModal = true;
    this.loadingAnexoH = true;
    try {
      this.anexoHPackage = await this.anexoHImportService.loadPackage();
      this.anexoHImportPreview = this.anexoHImportService.prepare(this.anexoHPackage);
    } catch (error: any) {
      this.anexoHImportError = error?.message || 'No se pudo preparar el paquete Anexo H.';
    } finally {
      this.loadingAnexoH = false;
    }
  }

  async importAnexoHSequentially(): Promise<void> {
    if (!this.anexoHImportPreview || !this.anexoHPackage || this.importingAnexoH) return;
    const idContract = Number(this.signalsService.getContractSelectedBySidebar()() || 0);
    const idProject = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
    if (Number(this.idCompany) !== this.anexoHImportService.companyId
        || idContract !== this.anexoHImportService.contractId
        || idProject !== this.anexoHImportService.projectId) {
      this.anexoHImportError = 'Cambió la empresa, contrato o proyecto seleccionado. Cierra esta ventana y vuelve a abrirla en el contexto destino.';
      return;
    }
    this.importingAnexoH = true;
    this.anexoHImportError = '';
    try {
      await this.anexoHImportService.importSequentially(this.anexoHImportPreview,
        (done, total, label) => this.anexoHImportProgress = { done, total, label });
      this.showAnexoHImportModal = false;
      this.loadData();
      await this.loadFactors();
      await this.loadApuConfig();
      alerts.basicAlert('Anexo H cargado', 'Se revisaron y sincronizaron las 97 claves del paquete en el contrato seleccionado.', 'success');
    } catch (error: any) {
      this.anexoHImportError = error?.message || 'La carga se detuvo. Puedes volver a ejecutarla para continuar sin duplicar las claves o componentes ya guardados.';
    } finally {
      this.importingAnexoH = false;
    }
  }

  get existingAnexoHKeys(): number {
    return this.rowData.filter((row) => /^I\.\d/.test(String(row.claveUsuario ?? row.clave_usuario ?? ''))).length;
  }

  downloadApuExample(): void {
    const workbook = XLSX.utils.book_new();
    const apu = XLSX.utils.aoa_to_sheet([
      ['Clave', 'Clave Usuario', 'Descripcion', 'Unidad'],
      ['', 'APU-EJ-001', 'Suministro e instalación de tubería PVC', 'ML'],
    ]);
    const components = XLSX.utils.aoa_to_sheet([
      ['Tipo', 'Recurso', 'Unidad', 'Cantidad', 'Costo Unitario', 'Cuadrilla', 'Cantidad Cuadrilla'],
      ['MATERIAL', 'Tubería PVC 4 pulgadas', 'ML', 1, '', '', ''],
      ['PERSONAL', 'Oficial plomero', 'JORNADA', 0.2, '', 'Cuadrilla 1', 1],
      ['EQUIPO', 'Cortadora', 'HR', 0.1, '', '', ''],
      ['HERRAMIENTA', 'Herramienta menor', '% MO', 3, '', '', ''],
    ]);
    const instructions = XLSX.utils.aoa_to_sheet([
      ['Cómo usar el ejemplo'],
      ['Este archivo importa un análisis de precio unitario por vez.'],
      ['En APU captura una sola fila con descripción y unidad. La clave es opcional.'],
      ['En Componentes usa MATERIAL, PERSONAL, EQUIPO o HERRAMIENTA.'],
      ['Reemplaza los recursos del ejemplo por los de tu catálogo. Si no coinciden, se cargarán como texto sin vínculo al catálogo.'],
      ['Para PERSONAL indica la cuadrilla; Cantidad Cuadrilla multiplica el subtotal de sus trabajadores.'],
      ['Para HERRAMIENTA, Cantidad es el porcentaje de mano de obra: escribe 3 para 3%.'],
      ['Si el recurso existe en el catálogo, siempre se toma su costo actual; Costo Unitario es respaldo para recursos sin coincidencia.'],
      ['Después de cargar el archivo, revisa las pestañas y pulsa Guardar Componentes.'],
    ]);
    apu['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 55 }, { wch: 12 }];
    components['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 20 }];
    instructions['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(workbook, apu, 'APU');
    XLSX.utils.book_append_sheet(workbook, components, 'Componentes');
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucciones');
    XLSX.writeFile(workbook, 'Ejemplo_Analisis_Precio_Unitario.xlsx');
  }

  downloadApuTextExample(): void {
    const content = [
      '[APU]',
      'Clave;Clave Usuario;Descripcion;Unidad',
      ';APU-EJ-001;Suministro e instalación de tubería PVC;ML',
      '',
      '[Componentes]',
      'Tipo;Recurso;Unidad;Cantidad;Costo Unitario;Cuadrilla;Cantidad Cuadrilla',
      'MATERIAL;Tubería PVC 4 pulgadas;ML;1;;;',
      'PERSONAL;Oficial plomero;JORNADA;0.2;;Cuadrilla 1;1',
      'EQUIPO;Cortadora;HR;0.1;;;',
      'HERRAMIENTA;Herramienta menor;% MO;3;;;',
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Ejemplo_Analisis_Precio_Unitario.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  async onApuImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importPreview = null;
    this.importErrors = [];
    this.importWarnings = [];
    if (!file) return;
    this.importFileName = file.name;
    this.parsingImport = true;
    try {
      let apuRows: Record<string, any>[];
      let itemRows: Record<string, any>[];
      if (/\.(txt|csv)$/i.test(file.name)) {
        ({ apuRows, itemRows } = this.parseApuText(await file.text()));
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const apuSheet = workbook.Sheets[workbook.SheetNames.find(name => this.normalizeImportText(name) === 'APU')];
        const itemsSheet = workbook.Sheets[workbook.SheetNames.find(name => this.normalizeImportText(name) === 'COMPONENTES')];
        if (!apuSheet || !itemsSheet) throw new Error('El Excel debe tener las hojas APU y Componentes. Descarga el ejemplo para ver el formato.');
        apuRows = XLSX.utils.sheet_to_json<Record<string, any>>(apuSheet, { defval: '', raw: true });
        itemRows = XLSX.utils.sheet_to_json<Record<string, any>>(itemsSheet, { defval: '', raw: true });
      } else {
        throw new Error('Selecciona un archivo Excel o de texto (.txt o .csv).');
      }
      this.parseApuImportRows(apuRows, itemRows);
    } catch (error: any) {
      this.importErrors.push(error?.message || 'No se pudo leer el archivo.');
    } finally {
      this.parsingImport = false;
      input.value = '';
    }
  }

  private parseApuImportRows(apuRows: Record<string, any>[], itemRows: Record<string, any>[]): void {
      if (apuRows.length !== 1) throw new Error('La sección APU debe contener exactamente una fila de análisis.');
      if (!itemRows.length) throw new Error('La sección Componentes no contiene recursos.');
      const apu = this.normalizeImportRecord(apuRows[0]);
      const description = String(apu['DESCRIPCION'] ?? '').trim();
      const unit = String(apu['UNIDAD'] ?? '').trim();
      const claveRaw = String(apu['CLAVE'] ?? '').trim();
      const clave = claveRaw ? Number(claveRaw) : null;
      if (!description || !unit) this.importErrors.push('La hoja APU necesita Descripcion y Unidad.');
      if (claveRaw && !Number.isInteger(clave)) this.importErrors.push('La Clave del APU debe ser un número entero o quedar vacía.');

      const rows: ApuImportRow[] = [];
      itemRows.forEach((raw, index) => {
        const values = this.normalizeImportRecord(raw);
        const rowNumber = index + 2;
        const typeText = this.normalizeImportText(values['TIPO']);
        const type: ResourceTab | null = ['MATERIAL', 'MATERIALES'].includes(typeText) ? 'MATERIAL'
          : ['PERSONAL', 'MO', 'MANO DE OBRA'].includes(typeText) ? 'PERSONAL'
          : ['EQUIPO', 'EQUIPOS'].includes(typeText) ? 'EQUIPO'
          : ['HERRAMIENTA', 'HERRAMIENTAS', 'HERR'].includes(typeText) ? 'HERR' : null;
        const resource = String(values['RECURSO'] ?? '').trim();
        const quantity = this.parseImportNumber(values['CANTIDAD']);
        if (!type || !resource || !Number.isFinite(quantity) || quantity <= 0) {
          this.importErrors.push(`Componentes, fila ${rowNumber}: indica Tipo, Recurso y Cantidad mayor que cero.`);
          return;
        }
        const catalog = type === 'MATERIAL' ? this.catalogMaterial : type === 'EQUIPO' ? this.catalogEquipo
          : type === 'HERR' ? this.catalogHerramienta : this.catalogPersonal;
        const match = catalog.find(item => this.normalizeImportText(item.description) === this.normalizeImportText(resource));
        if (!match) this.importWarnings.push(`Fila ${rowNumber}: "${resource}" no coincide con el catálogo; quedará como texto.`);
        const costRaw = String(values['COSTO UNITARIO'] ?? '').trim();
        const unitCost = type === 'HERR' ? 0 : match ? Number(match.cost ?? 0)
          : costRaw ? this.parseImportNumber(values['COSTO UNITARIO']) : 0;
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          this.importErrors.push(`Componentes, fila ${rowNumber}: Costo Unitario no válido.`);
          return;
        }
        if (type !== 'HERR' && match && costRaw && Math.abs(this.parseImportNumber(values['COSTO UNITARIO']) - unitCost) > 0.005)
          this.importWarnings.push(`Fila ${rowNumber}: se usará el costo vigente de "${resource}" ($${unitCost.toFixed(2)}) en lugar del archivo.`);
        if (type !== 'HERR' && !costRaw && !match) this.importWarnings.push(`Fila ${rowNumber}: sin costo; se cargará en 0 para revisión.`);
        const crewName = type === 'PERSONAL' ? String(values['CUADRILLA'] ?? '').trim() || 'Cuadrilla 1' : '';
        const crewQuantityRaw = String(values['CANTIDAD CUADRILLA'] ?? '').trim();
        const crewQuantity = type === 'PERSONAL' && crewQuantityRaw ? this.parseImportNumber(values['CANTIDAD CUADRILLA']) : 1;
        if (!Number.isFinite(crewQuantity) || crewQuantity <= 0) {
          this.importErrors.push(`Componentes, fila ${rowNumber}: Cantidad Cuadrilla debe ser mayor que cero.`);
          return;
        }
        rows.push({ type, idReference: match?.id ?? null, description: resource,
          unit: type === 'HERR' ? '(%)mo' : String(values['UNIDAD'] ?? '').trim() || match?.unit || '',
          quantity, unitCost, crewName, crewQuantity });
      });
      if (!rows.length) this.importErrors.push('No hay componentes válidos para cargar.');
      const crews = new Map<string, { quantity: number; subtotal: number }>();
      rows.filter(row => row.type === 'PERSONAL').forEach(row => {
        const key = this.normalizeImportText(row.crewName);
        const crew = crews.get(key);
        if (crew && crew.quantity !== row.crewQuantity) this.importErrors.push(`La cuadrilla "${row.crewName}" tiene cantidades distintas en el archivo.`);
        else crews.set(key, { quantity: row.crewQuantity, subtotal: apuMoney((crew?.subtotal ?? 0) + apuMoney(row.quantity * row.unitCost)) });
      });
      const personalCost = apuMoney([...crews.values()].reduce((sum, crew) => sum + apuMoney(crew.subtotal * crew.quantity), 0));
      const directCost = apuMoney(personalCost + rows.filter(row => row.type === 'MATERIAL' || row.type === 'EQUIPO')
        .reduce((sum, row) => sum + apuMoney(row.quantity * row.unitCost), 0)
        + rows.filter(row => row.type === 'HERR').reduce((sum, row) => sum + apuMoney(row.quantity / 100 * personalCost), 0));
      if (!this.importErrors.length) this.importPreview = { clave, claveUsuario: String(apu['CLAVE USUARIO'] ?? '').trim(),
        description, unit, rows, directCost };
  }

  private parseApuText(content: string): { apuRows: Record<string, any>[]; itemRows: Record<string, any>[] } {
    const sections = new Map<string, string[]>();
    let current = '';
    for (const rawLine of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const section = /^\[(APU|COMPONENTES)\]$/i.exec(line);
      if (section) {
        current = section[1].toUpperCase();
        sections.set(current, []);
      } else if (current) {
        sections.get(current).push(line);
      }
    }
    if (!sections.has('APU') || !sections.has('COMPONENTES')) {
      throw new Error('El texto debe incluir las secciones [APU] y [Componentes]. Descarga el ejemplo TXT.');
    }
    const readRows = (lines: string[], name: string): Record<string, any>[] => {
      if (lines.length < 2) throw new Error(`La sección ${name} necesita encabezados y datos.`);
      const header = lines[0];
      const separator = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';
      const columns = this.splitDelimitedLine(header, separator);
      return lines.slice(1).map((line, index) => {
        const values = this.splitDelimitedLine(line, separator);
        if (values.length !== columns.length) throw new Error(`${name}, fila ${index + 2}: número de columnas incorrecto.`);
        return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
      });
    };
    return { apuRows: readRows(sections.get('APU'), 'APU'),
      itemRows: readRows(sections.get('COMPONENTES'), 'Componentes') };
  }

  private splitDelimitedLine(line: string, separator: string): string[] {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (char === separator && !quoted) {
        values.push(value.trim());
        value = '';
      } else {
        value += char;
      }
    }
    values.push(value.trim());
    return values;
  }

  private normalizeImportText(value: any): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  private normalizeImportRecord(raw: Record<string, any>): Record<string, any> {
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [this.normalizeImportText(key), value]));
  }

  private parseImportNumber(value: any): number {
    if (typeof value === 'number') return value;
    const text = String(value ?? '').replace(/[$%\s]/g, '');
    if (!text) return NaN;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    const normalized = comma >= 0 && dot >= 0
      ? comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
      : text.replace(',', '.');
    return Number(normalized);
  }

  applyApuImport(): void {
    const preview = this.importPreview;
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    if (!preview || !idContract || this.importErrors.length) return;
    const tempId = `temp_${++this.tempCounter}`;
    const apu = { id: tempId, idCompany: this.idCompany, idContract,
      clave: preview.clave, claveUsuario: preview.claveUsuario, description: preview.description,
      unit: preview.unit, costMN: preview.directCost, precioUnitario: 0,
      hasPersonal: preview.rows.some(row => row.type === 'PERSONAL'),
      hasMaterial: preview.rows.some(row => row.type === 'MATERIAL'),
      hasHerramienta: preview.rows.some(row => row.type === 'HERR'),
      hasEquipo: preview.rows.some(row => row.type === 'EQUIPO'), __isNew: true };
    const items = preview.rows.filter(row => row.type !== 'PERSONAL').map(row => ({
      id: null, idAuxiliar: tempId, type: row.type, idReference: row.idReference,
      description: row.description, unit: row.unit, quantity: row.type === 'HERR' ? row.quantity / 100 : row.quantity,
      unitCost: row.unitCost, active: true, __isNew: true, __modified: false,
    }));
    const crewMap = new Map<string, any>();
    preview.rows.filter(row => row.type === 'PERSONAL').forEach(row => {
      const key = this.normalizeImportText(row.crewName);
      if (!crewMap.has(key)) crewMap.set(key, { id: null, idAuxiliar: tempId, name: row.crewName,
        cantidad: row.crewQuantity, sortOrder: crewMap.size + 1, active: true,
        items: [], __isNew: true, __modified: false });
      crewMap.get(key).items.push({ id: null, idCuadrilla: null, idReference: row.idReference,
        description: row.description, unit: row.unit, quantity: row.quantity, unitCost: row.unitCost,
        active: true, __isNew: true, __modified: false });
    });
    const crews = [...crewMap.values()];
    this.rowData = [apu, ...this.rowData];
    this.mainGridApi?.setGridOption('rowData', this.rowData);
    this.showImportModal = false;
    setTimeout(() => {
      this.mainGridApi?.forEachNode(node => {
        if (node.data?.id === tempId) node.setSelected(true);
      });
      this.selectedAuxiliar = apu;
      this.allItems = items;
      this.cuadrillas = crews;
      this.selectedCuadrilla = crews[0] ?? null;
      this.cuadrillaItemRows = this.selectedCuadrilla?.items ?? [];
      this.activeResourceTab = null;
      this.selectAvailableResourceTab();
      this.hasMainChanges = true;
      this.hasItemChanges = items.length > 0;
      this.hasCuadrillaChanges = crews.length > 0;
      this.refreshSubGrids();
      alerts.basicAlert('Análisis cargado', 'Revisa las pestañas y pulsa Guardar Componentes para guardar el precio unitario.', 'success');
    }, 0);
  }

  loadDetalle(idAuxiliar: number) {
    this.allItems = []; this.cuadrillas = [];
    this.selectedCuadrilla = null; this.cuadrillaItemRows = [];
    this.hasItemChanges = false; this.hasCuadrillaChanges = false;
    this.auxiliarItemsService.getDetalle(idAuxiliar).subscribe({
      next: (data) => {
        if (Number(this.selectedAuxiliar?.id) !== Number(idAuxiliar)) return;
        this.allItems = (data.items ?? []).map((i: any) => ({
          ...i,
          unitCost: Number(i.unitCost ?? i.unit_cost ?? i.UnitCost ?? i.precioUnitario ?? i.precio_unitario ?? 0) || 0,
          __isNew: false, __modified: false,
        }));
        this.cuadrillas = (data.cuadrillas ?? []).map((c: any) => ({
          ...c,
          sortOrder: Number(c.sortOrder ?? c.sort_order ?? 0),
          items: (c.items ?? []).map((i: any) => ({
            ...i,
            unitCost: Number(i.unitCost ?? i.unit_cost ?? i.UnitCost ?? i.precioUnitario ?? i.precio_unitario ?? 0) || 0,
            __isNew: false, __modified: false,
          })),
          __isNew: false, __modified: false,
        }));
        if (this.cuadrillas.length) this.selectCuadrilla(this.cuadrillas[0]);
        this.refreshSubGrids();
      },
    });
  }

  // ── Master grid events ───────────────────────────────────────────────────
  onMainGridReady(event: GridReadyEvent) { this.mainGridApi = event.api; }

  onMainSelectionChanged() {
    const rows = this.mainGridApi.getSelectedRows();
    if (!rows.length) { this.selectedAuxiliar = null; this.activeResourceTab = null; this.clearDetalle(); return; }
    this.selectedAuxiliar = rows[0];
    this.clearDetalle();
    this.activeResourceTab = null;
    this.selectAvailableResourceTab();
    if (this.selectedAuxiliar.id && !String(this.selectedAuxiliar.id).startsWith('temp_')) {
      this.loadDetalle(this.selectedAuxiliar.id);
    }
  }

  private clearDetalle(): void {
    this.allItems = [];
    this.cuadrillas = [];
    this.selectedCuadrilla = null;
    this.cuadrillaItemRows = [];
    this.selectedMaterialId = null;
    this.selectedEquipoId = null;
    this.selectedHerramientaId = null;
    this.selectedPersonalId = null;
    this.selectedAuxiliarId = null;
    this.selectedMaterialRow = null;
    this.selectedEquipoRow = null;
    this.selectedAuxiliarRow = null;
    this.selectedHerramientaRow = null;
    this.selectedCuadrillaItem = null;
    this.hasItemChanges = false;
    this.hasCuadrillaChanges = false;
    this.refreshSubGrids();
    if (this.cuadrillaGridApi && !this.cuadrillaGridApi.isDestroyed()) this.cuadrillaGridApi.setGridOption('rowData', []);
  }

  onMainCellValueChanged(event: any) {
    if (event.column.getColId() === 'unit' && event.newValue === '+ Nueva unidad...') {
      event.data.unit = event.oldValue ?? '';
      this.mainGridApi.refreshCells({ rowNodes: [event.node], force: true });
      this.pendingNewUnitRow = event.data;
      alerts.inputAlert('Nueva Unidad', 'Escribe la nueva unidad', 'text', '', { confirmButtonText: 'Agregar', required: true }).then((r) => {
        if (r.isConfirmed && r.value) {
          const newUnit = (r.value as string).trim().toUpperCase();
          if (!this.allUnits.includes(newUnit)) this.customUnits = [...this.customUnits, newUnit];
          if (this.pendingNewUnitRow) { this.pendingNewUnitRow.unit = newUnit; this.mainGridApi.refreshCells({ force: true }); }
        }
        this.pendingNewUnitRow = null;
      });
      return;
    }
    event.data.__modified = true;
    this.hasMainChanges = true;
  }

  // ── Main CRUD ────────────────────────────────────────────────────────────
  addRow() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    if (!this.idCompany || !idContract) {
      alerts.basicAlert('Seleccione un contrato', 'Seleccione empresa y contrato antes de agregar un precio unitario.', 'warning');
      return;
    }
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo precio unitario', 'Proyectos', this.trackingService.getEmail());
    const newRow = { id: `temp_${++this.tempCounter}`, idCompany: this.idCompany, idContract: idContract ?? null,
      clave: null, claveUsuario: '',
      description: '', unit: 'M2', costMN: 0, precioUnitario: 0,
      hasPersonal: false, hasMaterial: false, hasHerramienta: false, hasEquipo: false, __isNew: true };
    this.rowData = [newRow, ...this.rowData];
    this.hasMainChanges = true;
    setTimeout(() => this.mainGridApi.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async saveMain() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = this.cleanRow(row);
        if (row.__isNew) {
          const saved = await this.auxiliarService.add(payload).toPromise();
          row.id = saved.id; row.__isNew = false;
        } else {
          await this.auxiliarService.update(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasMainChanges = false;
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      alerts.basicAlert('OK', 'Precios unitarios guardados', 'success');
    } catch { alerts.basicAlert('Error', 'No se pudieron guardar', 'error'); }
  }

  revertMain() { this.rowData = JSON.parse(JSON.stringify(this.originalData)); this.hasMainChanges = false; }

  async deleteMain() {
    if (!this.selectedAuxiliar) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${this.selectedAuxiliar.description}"?`, 'warning', 'Sí, eliminar');
    if (!r.isConfirmed) return;
    if (typeof this.selectedAuxiliar.id === 'string') {
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null; return;
    }
    try {
      await this.auxiliarService.delete(this.selectedAuxiliar.id).toPromise();
      this.rowData = this.rowData.filter((x) => x !== this.selectedAuxiliar);
      this.selectedAuxiliar = null;
    } catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); }
  }

  // ── Flag checkboxes ──────────────────────────────────────────────────────
  private selectAvailableResourceTab(preferred?: ResourceTab): void {
    const selected = this.selectedAuxiliar;
    const available: ResourceTab[] = [];
    if (selected?.hasPersonal) available.push('PERSONAL');
    if (selected?.hasMaterial) available.push('MATERIAL');
    if (selected?.hasEquipo) available.push('EQUIPO');
    if (selected?.hasHerramienta) available.push('HERR');
    available.push('AUXILIAR');
    if (preferred && available.includes(preferred)) this.activeResourceTab = preferred;
    else if (!this.activeResourceTab || !available.includes(this.activeResourceTab)) this.activeResourceTab = available[0] ?? null;
  }

  onFlagChange(tab?: ResourceTab) {
    if (this.selectedAuxiliar) {
      this.selectedAuxiliar.__modified = true;
      this.hasMainChanges = true;
      if (tab === 'PERSONAL' && this.selectedAuxiliar.hasPersonal && !this.cuadrillas.length) this.addCuadrilla();
      this.selectAvailableResourceTab(tab);
    }
  }

  // ── Sub-items CRUD ───────────────────────────────────────────────────────
  addItem(type: 'MATERIAL' | 'HERR' | 'EQUIPO' | 'AUXILIAR') {
    if (!this.selectedAuxiliar) return;
    const selectedId = type === 'MATERIAL' ? this.selectedMaterialId : type === 'HERR' ? this.selectedHerramientaId : type === 'EQUIPO' ? this.selectedEquipoId : this.selectedAuxiliarId;
    const catalog = type === 'MATERIAL' ? this.catalogMaterial : type === 'HERR' ? this.catalogHerramienta : type === 'EQUIPO' ? this.catalogEquipo : this.catalogAuxiliares;
    const selected = catalog.find(item => item.id === Number(selectedId));
    if (!selected) return;
    const newItem = { id: null, idAuxiliar: this.selectedAuxiliar.id, type,
      idReference: selected.id, description: selected.description, unit: type === 'HERR' ? '(%)mo' : selected.unit,
      quantity: type === 'HERR' ? 0.03 : 1, unitCost: type === 'HERR' ? 0 : selected.cost,
      active: true, __isNew: true, __modified: false };
    this.allItems = [newItem, ...this.allItems];
    if (type === 'MATERIAL') this.selectedMaterialId = null;
    else if (type === 'HERR') this.selectedHerramientaId = null;
    else if (type === 'EQUIPO') this.selectedEquipoId = null;
    else this.selectedAuxiliarId = null;
    this.hasItemChanges = true;
    this.refreshSubGrids();
  }

  onItemValueChanged(event: any) {
    if (event.data.type === 'EQUIPO' && event.column.getColId() === 'unit' && event.newValue === '+ Nueva medida...') {
      event.data.unit = event.oldValue ?? '';
      this.equipoGridApi?.refreshCells({ rowNodes: [event.node], force: true });
      this.pendingEquipoUnitItem = event.data;
      alerts.inputAlert('Nueva Medida', 'Escribe la nueva medida', 'text', '', { confirmButtonText: 'Agregar', required: true }).then((r) => {
        if (r.isConfirmed && r.value) {
          const newUnit = (r.value as string).trim().toUpperCase();
          if (!this.allEquipoUnits.includes(newUnit)) this.equipoCustomUnits = [...this.equipoCustomUnits, newUnit];
          if (this.pendingEquipoUnitItem) { this.pendingEquipoUnitItem.unit = newUnit; this.equipoGridApi?.refreshCells({ force: true }); }
        }
        this.pendingEquipoUnitItem = null;
      });
      return;
    }
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasItemChanges = true;
  }

  onMaterialSelectionChanged()    { const r = this.materialGridApi?.getSelectedRows(); this.selectedMaterialRow = r?.length ? r[0] : null; }
  onHerramientaSelectionChanged() { const r = this.herramientaGridApi?.getSelectedRows(); this.selectedHerramientaRow = r?.length ? r[0] : null; }
  onEquipoSelectionChanged()      { const r = this.equipoGridApi?.getSelectedRows(); this.selectedEquipoRow = r?.length ? r[0] : null; }
  onAuxiliarSelectionChanged() { const r = this.auxiliarGridApi?.getSelectedRows(); this.selectedAuxiliarRow = r?.length ? r[0] : null; }

  async deleteItem(item: any) {
    if (!item) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar "${item.description}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (item.id) {
      await this.auxiliarItemsService.deleteItem(item.id).toPromise();
    }
    this.allItems = this.allItems.filter((x) => x !== item);
    this.selectedMaterialRow = null; this.selectedHerramientaRow = null; this.selectedEquipoRow = null; this.selectedAuxiliarRow = null;
    this.refreshSubGrids();
  }

  // ── Cuadrillas CRUD ──────────────────────────────────────────────────────
  selectCuadrilla(c: any) {
    this.selectedCuadrilla = c;
    this.cuadrillaItemRows = c?.items ?? [];
    if (this.cuadrillaGridApi && !this.cuadrillaGridApi.isDestroyed()) this.cuadrillaGridApi.setGridOption('rowData', this.cuadrillaItemRows);
  }

  addCuadrilla() {
    const newC = { id: null, idAuxiliar: this.selectedAuxiliar?.id, name: `Cuadrilla ${this.cuadrillas.length + 1}`, cantidad: 1,
      sortOrder: this.cuadrillas.length + 1, active: true, items: [], __isNew: true, __modified: false };
    this.cuadrillas = [...this.cuadrillas, newC];
    this.selectCuadrilla(newC);
    this.hasCuadrillaChanges = true;
  }

  onCuadrillaChange(c: any) { if (!c.__isNew) c.__modified = true; this.hasCuadrillaChanges = true; }

  addCuadrillaItem() {
    if (!this.selectedCuadrilla) return;
    const selected = this.catalogPersonal.find(item => item.id === Number(this.selectedPersonalId));
    if (!selected) return;
    const newItem = { id: null, idCuadrilla: this.selectedCuadrilla.id, idReference: selected.id,
      description: selected.description, unit: selected.unit, quantity: 1, unitCost: selected.cost,
      active: true, __isNew: true, __modified: false };
    this.selectedCuadrilla.items = [newItem, ...this.selectedCuadrilla.items];
    this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
    this.selectedPersonalId = null;
    this.hasCuadrillaChanges = true;
  }

  onCuadrillaItemValueChanged(event: any) { if (!event.data.__isNew) event.data.__modified = true; this.hasCuadrillaChanges = true; }
  onCuadrillaItemSelectionChanged() { const r = this.cuadrillaGridApi?.getSelectedRows(); this.selectedCuadrillaItem = r?.length ? r[0] : null; }

  async deleteCuadrilla() {
    if (!this.selectedCuadrilla) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar cuadrilla "${this.selectedCuadrilla.name}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedCuadrilla.id) await this.auxiliarItemsService.deleteCuadrilla(this.selectedCuadrilla.id).toPromise();
    this.cuadrillas = this.cuadrillas.filter((x) => x !== this.selectedCuadrilla);
    this.selectedCuadrilla = this.cuadrillas[0] ?? null;
    if (this.selectedCuadrilla) this.selectCuadrilla(this.selectedCuadrilla);
    else this.cuadrillaItemRows = [];
  }

  async deleteCuadrillaItem() {
    if (!this.selectedCuadrillaItem || !this.selectedCuadrilla) return;
    const item = this.selectedCuadrillaItem;
    if (item.id) await this.auxiliarItemsService.deleteCuadrillaItem(item.id).toPromise();
    this.selectedCuadrilla.items = this.selectedCuadrilla.items.filter((x: any) => x !== item);
    this.cuadrillaItemRows = [...this.selectedCuadrilla.items];
    this.selectedCuadrillaItem = null;
  }

  // ── Guardar todo el detalle ──────────────────────────────────────────────
  async saveDetalle() {
    if (!this.selectedAuxiliar) return;
    if (this.hasFactorChanges) {
      alerts.basicAlert('Factores sin guardar', 'Guarda los factores del contrato antes de guardar el precio unitario.', 'warning');
      return;
    }
    let saving = 'precio unitario';
    try {
      if (this.selectedAuxiliar.__isNew) {
        await this.saveMain();
        if (this.selectedAuxiliar.__isNew) return;
      }
      // 1. Items (MATERIAL, HERR, EQUIPO)
      for (const item of this.allItems.filter((i) => i.__isNew || i.__modified)) {
        saving = `componente ${item.type.toLowerCase()}: ${item.description || '(sin descripción)'}`;
        const payload = { idAuxiliar: this.selectedAuxiliar.id, type: item.type,
          idReference: item.idReference ?? null, description: item.description?.trim() ?? '',
          unit: item.unit ?? null, quantity: Number(item.quantity) || 0,
          unitCost: item.type === 'HERR' ? this.totalPersonal : item.type === 'AUXILIAR' ? this.getAuxiliarUnitCost(item) : (Number(item.unitCost) || 0), active: true };
        if (item.__isNew) { const saved = await this.auxiliarItemsService.saveItem(payload).toPromise(); item.id = saved.id; item.__isNew = false; }
        else { await this.auxiliarItemsService.updateItem(item.id, payload).toPromise(); item.__modified = false; }
      }
      // 2. Cuadrillas + sus items
      for (const c of this.cuadrillas) {
        saving = `cuadrilla: ${c.name || '(sin nombre)'}`;
        const cPayload = { idAuxiliar: this.selectedAuxiliar.id, idCompany: this.idCompany,
          name: c.name?.trim() ?? '', cantidad: Number(c.cantidad) || 1,
          sortOrder: Number(c.sortOrder ?? c.sort_order) || 0, active: true };
        if (c.__isNew) { const saved = await this.auxiliarItemsService.saveCuadrilla(cPayload).toPromise(); c.id = saved.id; c.__isNew = false; c.items.forEach((i: any) => i.idCuadrilla = saved.id); }
        else if (c.__modified) { await this.auxiliarItemsService.updateCuadrilla(c.id, cPayload).toPromise(); c.__modified = false; }
        for (const item of (c.items ?? []).filter((i: any) => i.__isNew || i.__modified)) {
          saving = `trabajador de ${c.name || 'cuadrilla'}: ${item.description || '(sin descripción)'}`;
          const iPayload = { idCuadrilla: c.id, idReference: item.idReference ?? null,
            description: item.description?.trim() ?? '', unit: item.unit ?? null,
            quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0, active: true };
          if (item.__isNew) { const saved = await this.auxiliarItemsService.saveCuadrillaItem(iPayload).toPromise(); item.id = saved.id; item.__isNew = false; }
          else { await this.auxiliarItemsService.updateCuadrillaItem(item.id, iPayload).toPromise(); item.__modified = false; }
        }
      }
      // 3. Actualizar flags y cost_mn en el auxiliar
      saving = 'costo del precio unitario';
      this.selectedAuxiliar.costMN = this.costoTotal;
      this.selectedAuxiliar.precioUnitario = this.precioUnitario;
      const auxPayload = this.cleanRow(this.selectedAuxiliar);
      await this.auxiliarService.update(this.selectedAuxiliar.id, auxPayload).toPromise();
      this.hasItemChanges = false; this.hasCuadrillaChanges = false; this.hasMainChanges = false;
      this.mainGridApi?.refreshCells({ force: true });
      alerts.basicAlert('Guardado', 'Componentes guardados. Costo: $' + this.costoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }), 'success');
    } catch (e: any) {
      console.error(`Error al guardar ${saving}`, e);
      const detail = typeof e?.error === 'string' ? e.error : e?.error?.title || e?.error?.message || '';
      alerts.basicAlert('Error al guardar', `${saving}. ${detail || 'Revisa los datos e intenta de nuevo.'}`, 'error');
    }
  }

  // ── Grid ready events ────────────────────────────────────────────────────
  onMaterialGridReady(e: GridReadyEvent)    { this.materialGridApi = e.api; }
  onHerramientaGridReady(e: GridReadyEvent) { this.herramientaGridApi = e.api; }
  onEquipoGridReady(e: GridReadyEvent)      { this.equipoGridApi = e.api; }
  onAuxiliarGridReady(e: GridReadyEvent) { this.auxiliarGridApi = e.api; }
  onCuadrillaGridReady(e: GridReadyEvent)   { this.cuadrillaGridApi = e.api; }

  refreshSubGrids() {
    if (this.materialGridApi && !this.materialGridApi.isDestroyed()) this.materialGridApi.setGridOption('rowData', this.materialItems);
    if (this.herramientaGridApi && !this.herramientaGridApi.isDestroyed()) this.herramientaGridApi.setGridOption('rowData', this.herramientaItems);
    if (this.equipoGridApi && !this.equipoGridApi.isDestroyed()) this.equipoGridApi.setGridOption('rowData', this.equipoItems);
    if (this.auxiliarGridApi && !this.auxiliarGridApi.isDestroyed()) this.auxiliarGridApi.setGridOption('rowData', this.auxiliarItems);
  }

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew; delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }

  get hasDetailChanges(): boolean { return this.hasItemChanges || this.hasCuadrillaChanges || this.hasMainChanges; }

  // ── Config encabezado PDF por contrato ───────────────────────────────────
  apuConfig: ApuConfig = { ...APU_CONFIG_DEFAULTS };
  hasConfigChanges     = false;

  async loadApuConfig() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    const idCompany = this.idCompany;
    if (!idContract || !idCompany) { this.apuConfig = { ...APU_CONFIG_DEFAULTS }; return; }
    let cfg: ApuConfig | null = null;
    try {
      cfg = await this.apuConfigService.get(idContract, idCompany).toPromise();
    } catch { /* A contract without a saved header uses its own company and contract. */ }
    let nextConfig: ApuConfig;
    if (cfg) {
      nextConfig = cfg;
    } else {
      const idProject = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
      const [companyResult, contractResult, projectResult] = await Promise.allSettled([
        this.rootService.getRootbyId(idCompany).toPromise(),
        this.contractsService.getContractById(idContract).toPromise(),
        idProject ? this.projectsService.getProjectsById(idProject).toPromise() : Promise.resolve(null),
      ]);
      const company: any = companyResult.status === 'fulfilled' ? companyResult.value : null;
      const contract: any = contractResult.status === 'fulfilled' ? contractResult.value : null;
      const projectRaw: any = projectResult.status === 'fulfilled' ? projectResult.value : null;
      const project: any = Array.isArray(projectRaw) ? projectRaw[0] : projectRaw;
      nextConfig = { ...APU_CONFIG_DEFAULTS, idCompany, idContract,
        companyName: company?.name || 'EMPRESA', subdirection: '', anexoLabel: '',
        projectTitle: project?.name || project?.description || contract?.name || contract?.description || '' };
    }
    if (this.signalsService.getContractSelectedBySidebar()() !== idContract || this.idCompany !== idCompany) return;
    this.apuConfig = nextConfig;
    this.hasConfigChanges = false;
  }

  async saveApuConfig() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    if (!idContract) return;
    try {
      const saved = await this.apuConfigService.save({
        ...this.apuConfig, idCompany: this.idCompany, idContract, active: true,
      }).toPromise();
      this.apuConfig = saved!;
      this.hasConfigChanges = false;
      alerts.basicAlert('OK', 'Encabezado guardado', 'success');
    } catch { alerts.basicAlert('Error', 'No se pudo guardar el encabezado', 'error'); }
  }

  // ── Configuración de factores por contrato ───────────────────────────────
  showConfigModal      = false;
  configFactors: any[] = [];
  hasFactorChanges     = false;
  selectedConfigRow: any = null;
  private configGridApi!: GridApi;

  readonly configColDefs: ColDef[] = [
    { field: 'sortOrder', headerName: '#',   width: 60,  editable: false, type: 'numericColumn', cellStyle: { textAlign: 'center', color: '#888' } },
    { field: 'name',      headerName: 'Factor',           editable: true,  flex: 2 },
    { field: 'percentage', headerName: '% Aplicar', width: 120, editable: true, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(2) + ' %' : '' },
  ];

  openConfigModal()  { this.showConfigModal = true; this.configGridApi?.setGridOption('rowData', this.configFactors); }
  closeConfigModal() { this.showConfigModal = false; }

  async loadFactors() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    const idCompany  = this.idCompany;
    if (!idContract || !idCompany) { this.configFactors = []; return; }
    const all = ((await this.factorService.getByContract(idContract, idCompany).toPromise()) ?? []) as any[];
    if (this.signalsService.getContractSelectedBySidebar()() !== idContract || this.idCompany !== idCompany) return;
    // API retorna sortOrder (camelCase), no sort_order — deduplicar por sortOrder
    const seen = new Set<number>();
    this.configFactors = all
      .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))
      .filter(f => {
        const so = Number(f.sortOrder ?? f.sort_order ?? 0);
        if (seen.has(so)) return false;
        seen.add(so);
        return true;
      })
      .map(f => ({
        ...f,
        sortOrder:  f.sortOrder ?? f.sort_order ?? 0,
        percentage: Number(f.percentage),
        __modified: false,
      }));
    this.hasFactorChanges = false;
    this.selectedConfigRow = null;
    this.configGridApi?.setGridOption('rowData', this.configFactors);
  }

  onConfigGridReady(e: GridReadyEvent) { this.configGridApi = e.api; }
  onConfigSelectionChanged() {
    const r = this.configGridApi?.getSelectedRows();
    this.selectedConfigRow = r?.length ? r[0] : null;
  }
  onConfigCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasFactorChanges = true;
  }

  addConfigFactor() {
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    const maxSo = this.configFactors.reduce((m, f) => Math.max(m, Number(f.sortOrder) || 0), 0);
    const newRow = {
      id: null, name: 'Nuevo Factor', percentage: 0,
      sortOrder: maxSo + 10,
      id_contract: idContract, id_company: this.idCompany,
      active: true, __isNew: true, __modified: false,
    };
    this.configFactors = [...this.configFactors, newRow];
    this.hasFactorChanges = true;
    this.configGridApi?.setGridOption('rowData', this.configFactors);
    setTimeout(() => {
      this.configGridApi?.startEditingCell({ rowIndex: this.configFactors.length - 1, colKey: 'name' });
    }, 100);
  }

  addStandardFactors() {
    const names = ['Indirectos', 'Financiamiento', 'Utilidad', 'Cargos adicionales'];
    const existing = new Set(this.configFactors.map(f => String(f.name || '').trim().toLocaleLowerCase('es-MX')));
    let sortOrder = this.configFactors.reduce((max, f) => Math.max(max, Number(f.sortOrder) || 0), 0);
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    const additions = names.filter(name => !existing.has(name.toLocaleLowerCase('es-MX'))).map(name => ({
      id: null, name, percentage: 0, sortOrder: (sortOrder += 10),
      id_company: this.idCompany, id_contract: idContract,
      active: true, __isNew: true, __modified: false,
    }));
    if (!additions.length) return;
    this.configFactors = [...this.configFactors, ...additions];
    this.hasFactorChanges = true;
    this.configGridApi?.setGridOption('rowData', this.configFactors);
  }

  async deleteConfigFactor() {
    if (!this.selectedConfigRow) return;
    const r = await alerts.confirmAlert('¿Eliminar?', `¿Eliminar factor "${this.selectedConfigRow.name}"?`, 'warning', 'Sí');
    if (!r.isConfirmed) return;
    if (this.selectedConfigRow.id) {
      try { await this.factorService.delete(this.selectedConfigRow.id).toPromise(); }
      catch { alerts.basicAlert('Error', 'No se pudo eliminar', 'error'); return; }
    }
    this.configFactors = this.configFactors.filter(f => f !== this.selectedConfigRow);
    this.selectedConfigRow = null;
    this.configGridApi?.setGridOption('rowData', this.configFactors);
  }

  async revertFactors() { await this.loadFactors(); }

  getFactorAdd(i: number): number {
    return apuFactorSteps(this.costoTotal, this.configFactors)[i]?.amount ?? 0;
  }

  getFactorSubtotal(i: number): number {
    return apuFactorSteps(this.costoTotal, this.configFactors)[i]?.subtotal ?? this.costoTotal;
  }

  get precioUnitario(): number {
    return apuUnitPrice(this.costoTotal, this.configFactors);
  }

  async saveFactors() {
    const toSave = this.configFactors.filter(f => f.__isNew || f.__modified);
    if (!toSave.length) return;
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    try {
      for (const f of toSave) {
        const payload = {
          name: f.name, percentage: f.percentage, sortOrder: f.sortOrder,
          id_company: this.idCompany, id_contract: idContract, active: true,
        };
        if (f.__isNew) {
          const saved: any = await this.factorService.add(payload).toPromise();
          f.id = saved.id ?? saved.Id; f.__isNew = false;
        } else {
          await this.factorService.update(f.id, payload).toPromise();
          f.__modified = false;
        }
      }
      this.hasFactorChanges = false;
      alerts.basicAlert('OK', 'Factores actualizados', 'success');
    } catch { alerts.basicAlert('Error', 'No se pudieron guardar los factores', 'error'); }
  }

  async recalcularPrecios() {
    if (this.hasFactorChanges) {
      alerts.basicAlert('Factores sin guardar', 'Guarda los factores antes de recalcular precios.', 'warning');
      return;
    }
    if (!this.configFactors.length) {
      alerts.basicAlert('Sin factores', 'Carga la configuración primero (botón Configuración)', 'warning');
      return;
    }
    const idContract = this.signalsService.getContractSelectedBySidebar()();
    if (!idContract) { alerts.basicAlert('Sin contrato', 'No hay contrato seleccionado', 'warning'); return; }

    const precios = this.rowData
      .filter(r => r.id && !String(r.id).startsWith('temp_') && Number(r.costMN) > 0)
      .map(r => {
        return { id: r.id, precioUnitario: apuUnitPrice(Number(r.costMN) || 0, this.configFactors) };
      });

    if (!precios.length) { alerts.basicAlert('Sin datos', 'No hay precios unitarios con costo calculado', 'warning'); return; }

    try {
      await this.auxiliarService.recalcularPrecios(idContract, this.idCompany, precios).toPromise();
      precios.forEach(p => {
        const row = this.rowData.find((r: any) => r.id === p.id);
        if (row) row.precioUnitario = p.precioUnitario;
      });
      this.mainGridApi?.refreshCells({ force: true });
      alerts.basicAlert('OK', `${precios.length} precios unitarios recalculados`, 'success');
    } catch { alerts.basicAlert('Error', 'No se pudo recalcular', 'error'); }
  }

  // ── PDF APU ──────────────────────────────────────────────────────────────
  async printSelectedOrCatalogPdf() {
    if (!this.selectedAuxiliar) {
      await this.printCatalogPdf();
      return;
    }

    const auxiliar = this.selectedAuxiliar;
    const id = Number(auxiliar.id);
    if (!id || id < 1) {
      alerts.basicAlert('Guarda el APU', 'Guarda el precio unitario antes de generar su reporte.', 'warning');
      return;
    }
    if (this.hasDetailChanges || this.hasFactorChanges || this.hasMainChanges) {
      alerts.basicAlert('Cambios sin guardar', 'Guarda el APU y sus factores antes de generar el reporte.', 'warning');
      return;
    }

    const reportWindow = this.startPdfReport('Cargando el APU seleccionado…');
    if (!reportWindow) return;

    try {
      const detail: any = await this.auxiliarItemsService.getDetalle(id).toPromise();
      this.updatePdfReportProgress(45, 'Preparando el análisis y sus recursos…');
      const items = (detail?.items ?? detail?.Items ?? []).map((item: any) => ({
        ...item,
        type: String(item.type ?? item.Type ?? '').toUpperCase(),
        description: item.description ?? item.Description ?? '',
        unit: item.unit ?? item.Unit ?? '',
        quantity: Number(item.quantity ?? item.Quantity) || 0,
        unitCost: Number(item.unitCost ?? item.unit_cost ?? item.UnitCost) || 0,
      }));
      const cuadrillas = (detail?.cuadrillas ?? detail?.Cuadrillas ?? []).map((crew: any) => ({
        ...crew,
        name: crew.name ?? crew.Name ?? '',
        cantidad: Number(crew.cantidad ?? crew.Cantidad) || 1,
        items: (crew.items ?? crew.Items ?? []).map((worker: any) => ({
          ...worker,
          description: worker.description ?? worker.Description ?? '',
          unit: worker.unit ?? worker.Unit ?? '',
          quantity: Number(worker.quantity ?? worker.Quantity) || 0,
          unitCost: Number(worker.unitCost ?? worker.unit_cost ?? worker.UnitCost) || 0,
        })),
      }));
      const materialItems = items.filter((item: any) => item.type === 'MATERIAL');
      const herramientaItems = items.filter((item: any) => item.type === 'HERR');
      const equipoItems = items.filter((item: any) => item.type === 'EQUIPO');
      const auxiliarItems = items.filter((item: any) => item.type === 'AUXILIAR').map((item: any) => ({
        ...item, unitCost: this.getAuxiliarUnitCost(item),
      }));
      const totalPersonal = apuMoney(cuadrillas.reduce((sum: number, crew: any) => {
        const subtotal = apuMoney(crew.items.reduce((crewSum: number, worker: any) =>
          crewSum + apuMoney(worker.quantity * worker.unitCost), 0));
        return sum + apuMoney(subtotal * crew.cantidad);
      }, 0));
      const materialTotal = apuMoney(materialItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));
      const herramientaTotal = apuMoney(herramientaItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * totalPersonal), 0));
      const equipoTotal = apuMoney(equipoItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));
      const auxiliarTotal = apuMoney(auxiliarItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));

      await this.pdfApuService.openApuPdf({
        auxiliar,
        cuadrillas,
        materialItems,
        herramientaItems,
        equipoItems,
        auxiliarItems,
        factors: this.configFactors,
        totalPersonal,
        materialTotal,
        herramientaTotal,
        equipoTotal,
        auxiliarTotal,
        costoTotal: Number(auxiliar.costMN ?? auxiliar.cost_mn) || apuMoney(totalPersonal + materialTotal + herramientaTotal + equipoTotal + auxiliarTotal),
        companyName: this.apuConfig.companyName,
        subdirection: this.apuConfig.subdirection,
        anexoLabel: this.apuConfig.anexoLabel,
        analysisTitle: this.apuConfig.analysisTitle,
        licitacionNo: this.apuConfig.licitacionNo,
        projectTitle: this.apuConfig.projectTitle,
      }, reportWindow, (percent, label) => this.updatePdfReportProgress(percent, label));
      this.finishPdfReport();
    } catch (error) {
      this.abortPdfReport(reportWindow);
      console.error('Error generando el reporte del APU seleccionado:', error);
      alerts.basicAlert('Error', 'No se pudo cargar el detalle del precio unitario seleccionado.', 'error');
    }
  }

  async printCatalogPdf() {
    const auxiliars = this.rowData.filter(row => Number(row.id) > 0);
    if (!auxiliars.length) {
      alerts.basicAlert('Sin datos', 'Este contrato no tiene precios unitarios guardados.', 'warning');
      return;
    }
    if (this.hasFactorChanges || this.hasMainChanges) {
      alerts.basicAlert('Cambios sin guardar', 'Guarda los precios y factores antes de generar el reporte.', 'warning');
      return;
    }
    const reportWindow = this.startPdfReport('Preparando catálogo de precios…');
    if (!reportWindow) return;
    try {
      await this.pdfApuService.openCatalogPdf({
        companyName: this.apuConfig.companyName,
        projectTitle: this.apuConfig.projectTitle,
        licitacionNo: this.apuConfig.licitacionNo,
        auxiliars,
        factors: this.configFactors,
      }, reportWindow, (percent, label) => this.updatePdfReportProgress(percent, label));
      this.finishPdfReport();
    } catch (error) {
      this.abortPdfReport(reportWindow);
      console.error('Error generando el catálogo PDF:', error);
      alerts.basicAlert('Error', 'No se pudo generar el catálogo de precios unitarios.', 'error');
    }
  }

  async printFullExplosionPdf() {
    const auxiliars = this.rowData.filter(row => Number(row.id) > 0)
      .sort((a, b) => String(a.claveUsuario ?? a.clave_usuario ?? a.clave ?? '').localeCompare(String(b.claveUsuario ?? b.clave_usuario ?? b.clave ?? ''), 'es-MX', { numeric: true }));
    if (!auxiliars.length) {
      alerts.basicAlert('Sin datos', 'Este contrato no tiene análisis guardados para generar la explosión.', 'warning');
      return;
    }
    if (this.hasDetailChanges || this.hasFactorChanges) {
      alerts.basicAlert('Cambios sin guardar', 'Guarda los componentes y factores antes de generar la explosión completa.', 'warning');
      return;
    }
    const reportWindow = this.startPdfReport('Cargando análisis para la explosión completa…');
    if (!reportWindow) return;
    const report: any[] = [];
    try {
      for (const [index, auxiliar] of auxiliars.entries()) {
        const detail: any = await this.auxiliarItemsService.getDetalle(Number(auxiliar.id)).toPromise();
        this.updatePdfReportProgress(5 + Math.round(((index + 1) / auxiliars.length) * 72),
          `Preparando APU ${index + 1} de ${auxiliars.length}…`);
        const items = detail?.items ?? detail?.Items ?? [];
        const cuadrillas = (detail?.cuadrillas ?? detail?.Cuadrillas ?? []).map((crew: any) => ({
          ...crew,
          name: crew.name ?? crew.Name ?? '',
          cantidad: Number(crew.cantidad ?? crew.Cantidad) || 1,
          items: crew.items ?? crew.Items ?? [],
        }));
        const byType = (type: string) => items.filter((item: any) => String(item.type ?? item.Type).toUpperCase() === type)
          .map((item: any) => ({ ...item, description: item.description ?? item.Description, unit: item.unit ?? item.Unit,
            quantity: Number(item.quantity ?? item.Quantity) || 0, unitCost: Number(item.unitCost ?? item.UnitCost) || 0 }));
        const materialItems = byType('MATERIAL');
        const herramientaItems = byType('HERR');
        const equipoItems = byType('EQUIPO');
        const auxiliarItems = byType('AUXILIAR').map((item: any) => ({ ...item, unitCost: this.getAuxiliarUnitCost(item) }));
        const totalPersonal = apuMoney(cuadrillas.reduce((sum: number, crew: any) => {
          const crewSubtotal = apuMoney((crew.items ?? []).reduce((crewSum: number, worker: any) =>
            crewSum + apuMoney((Number(worker.quantity ?? worker.Quantity) || 0) * (Number(worker.unitCost ?? worker.UnitCost) || 0)), 0));
          return sum + apuMoney(crewSubtotal * crew.cantidad);
        }, 0));
        const materialTotal = apuMoney(materialItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));
        const herramientaTotal = apuMoney(herramientaItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * totalPersonal), 0));
        const equipoTotal = apuMoney(equipoItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));
        const auxiliarTotal = apuMoney(auxiliarItems.reduce((sum: number, item: any) => sum + apuMoney(item.quantity * item.unitCost), 0));
        report.push({
          auxiliar,
          cuadrillas,
          materialItems,
          herramientaItems,
          equipoItems,
          auxiliarItems,
          factors: this.configFactors,
          totalPersonal,
          materialTotal,
          herramientaTotal,
          equipoTotal,
          auxiliarTotal,
          costoTotal: Number(auxiliar.costMN ?? auxiliar.cost_mn) || 0,
          companyName: this.apuConfig.companyName,
          subdirection: this.apuConfig.subdirection,
          anexoLabel: this.apuConfig.anexoLabel,
          analysisTitle: this.apuConfig.analysisTitle,
          licitacionNo: this.apuConfig.licitacionNo,
          projectTitle: this.apuConfig.projectTitle,
        });
      }
      await this.pdfApuService.openApusPdf(report, reportWindow,
        (percent, label) => this.updatePdfReportProgress(percent, label));
      this.finishPdfReport();
    } catch (error) {
      this.abortPdfReport(reportWindow);
      console.error('Error generando la explosión APU:', error);
      alerts.basicAlert('Error', 'No se pudo cargar el detalle completo de todos los análisis para el PDF.', 'error');
    }
  }

  private startPdfReport(label: string): Window | null {
    const output = window.open('', '_blank');
    if (!output) {
      alerts.basicAlert('Permite las ventanas emergentes', 'El navegador bloqueó la ventana donde se abrirá el PDF.', 'warning');
      return null;
    }
    this.pdfReportProgress = { active: true, percent: 3, label };
    return output;
  }

  private updatePdfReportProgress(percent: number, label: string): void {
    this.pdfReportProgress = { active: true, percent: Math.max(0, Math.min(100, percent)), label };
  }

  private finishPdfReport(): void {
    this.pdfReportProgress = { active: true, percent: 100, label: 'PDF listo' };
    setTimeout(() => this.pdfReportProgress = { active: false, percent: 0, label: '' }, 1800);
  }

  private abortPdfReport(output: Window): void {
    if (!output.closed) output.close();
    this.pdfReportProgress = { active: false, percent: 0, label: '' };
  }

  async printPdf() {
    if (!this.selectedAuxiliar) {
      alerts.basicAlert('Sin selección', 'Selecciona un auxiliar primero', 'warning');
      return;
    }
    await this.pdfApuService.openApuPdf({
      auxiliar:        this.selectedAuxiliar,
      cuadrillas:      this.cuadrillas,
      materialItems:   this.materialItems,
      herramientaItems: this.herramientaItems,
      equipoItems:     this.equipoItems,
      auxiliarItems: this.auxiliarItems.map((item) => ({ ...item, unitCost: this.getAuxiliarUnitCost(item) })),
      factors: this.configFactors,
      totalPersonal:    this.totalPersonal,
      materialTotal:    this.materialTotal,
      herramientaTotal: this.herramientaTotal,
      equipoTotal:      this.equipoTotal,
      auxiliarTotal: this.auxiliarTotal,
      costoTotal:       this.costoTotal,
      // Textos configurables del encabezado
      companyName:    this.apuConfig.companyName,
      subdirection:   this.apuConfig.subdirection,
      anexoLabel:     this.apuConfig.anexoLabel,
      analysisTitle:  this.apuConfig.analysisTitle,
      licitacionNo:   this.apuConfig.licitacionNo,
      projectTitle:   this.apuConfig.projectTitle,
    });
  }
}
