import { Component, effect, HostListener, inject, NgZone } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { WorkprogramApuService } from 'app/services/workprogram-apu.service';
import { gantt } from 'dhtmlx-gantt';
import { Observable, catchError, finalize, forkJoin, lastValueFrom, map, of, switchMap } from 'rxjs';
import * as XLSX from 'xlsx';

/*import { PdfWorkprogramDistributionComponent } from './distribution/pdf-workprogram-distribution.component';
import { WorkprogramDistributionFullComponent } from './distribution/workprogram-distribution-full.component';
*/

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { AuxiliarItemsService } from 'app/services/auxiliar-items.service';
import { MaterialsService } from 'app/services/materials.service';
import { EquipmentService } from 'app/services/equipment.service';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { WorkprogramApuCuadrillaService } from 'app/services/workprogram-apu-cuadrilla.service';
import { ManoObraService } from 'app/services/mano-obra.service';
import { HerramientaService } from 'app/services/herramienta.service';

type ImportFieldKey =
  | 'wbs'
  | 'level'
  | 'description'
  | 'quantity'
  | 'cost'
  | 'salePrice'
  | 'startDate'
  | 'endDate'
  | 'predecessors'
  | 'successors'
  | 'resources';

interface ImportColumnMatch {
  field: ImportFieldKey;
  column: string;
  inferred: boolean;
}

type ImportColumnMapping = Partial<Record<ImportFieldKey, ImportColumnMatch>>;

interface ImportedRawRow {
  fileName: string;
  rowNumber: number;
  data: Record<string, any>;
  mapping: ImportColumnMapping;
}

interface ImportedTaskDraft {
  sourceFile: string;
  sourceRow: number;
  wbs: string;
  level: number;
  description: string;
  quantity: number | null;
  cost: number | null;
  salePrice: number | null;
  startDate: string;
  endDate: string;
  predecessors: string;
  successors: string;
  resources: string;
  warnings: string[];
  errors: string[];
}

interface ImportedPreviewRow {
  fileName: string;
  rowNumber: number;
  wbs: string;
  level: number;
  description: string;
  startDate: string;
  endDate: string;
  quantity: number | null;
  cost: number | null;
  salePrice: number | null;
  status: 'ok' | 'warning' | 'error';
}

interface ImportAnalysisResult {
  detectedColumns: ImportColumnMatch[];
  warnings: string[];
  previewRows: ImportedPreviewRow[];
  tasks: ImportedTaskDraft[];
  structureMode: boolean;
}

interface ExplosionRowDraft {
  sourceRow: number;
  clave: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  unitCost: number;
  importe: number;
  familia: string;
  tipo: 'AUXILIAR' | 'MATERIAL' | 'PERSONAL' | 'EQUIPO' | 'HERRAMIENTA' | 'CONCEPTO';
  confidence: 'alta' | 'media' | 'baja';
}

@Component({
  selector: 'app-workprograms',
  standalone: true,
 /* imports: [CommonModule, FormsModule, PdfWorkprogramDistributionComponent, WorkprogramDistributionFullComponent],*/
  imports: [CommonModule, FormsModule,],
  templateUrl: './workprograms.component.html',
  
})
export class WorkprogramsComponent {
  showImportPmoModal = false;
  importFiles: File[] = [];
  isAnalyzingImport = false;
  isApplyingImport = false;
  importApplyProgress = 0;
  importApplyStatus = '';
  importMode: 'replace' | 'append' = 'replace';
  importSummary = '';
  importWarnings: string[] = [];
  importDetectedColumns: ImportColumnMatch[] = [];
  importPreviewRows: ImportedPreviewRow[] = [];
  importedTasksDraft: ImportedTaskDraft[] = [];
  importKind: 'program' | 'explosion' = 'program';
  explosionRowsDraft: ExplosionRowDraft[] = [];
  isApplyingExplosion = false;

  phases: { key: any; label: any; }[];

  // Para mostrar el indicador de cambios no guardados
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  private workprogramsService = inject(WorkprogramsService);
  private apuService          = inject(WorkprogramApuService);
  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private auxiliarService = inject(AuxiliarService);
  private auxiliarItemsService = inject(AuxiliarItemsService);
  private materialsService = inject(MaterialsService);
  private equipmentService = inject(EquipmentService);
  private followprojectsService = inject(FollowprojectsService);
  private workprogramApuCuadrillaService = inject(WorkprogramApuCuadrillaService);
  private manoObraService = inject(ManoObraService);
  private herramientaService = inject(HerramientaService);
  private ngZone = inject(NgZone);

  readonly projectName = this.signalsService.getProjectNameBySidebar();

  datosGantt: { data: any; links: any; };
  deletedTasks: Set<number> = new Set();

  idProject: number = null;
  idContract: number = null;
  idConvention: number = null;
  conventionName: string = '';
  typeWorkProgram: 'Contract' | 'Project' = 'Contract';
  contractShortName = '';
  contractNumber = '';

  selectedProgramTask: any = null;
  selectedTaskResources: any[] = [];
  selectedTaskCrews: any[] = [];
  selectedResourceSection: 'TODOS' | 'MATERIAL' | 'PERSONAL' | 'EQUIPO' | 'HERRAMIENTA' | 'AUXILIAR' = 'TODOS';
  isTaskDetailLoading = false;
  private taskSelectionEventId: string | null = null;
  showContractAllocationModal = false;
  isLoadingContractAllocation = false;
  isCopyingContractAllocation = false;
  contractProgramOptions: any[] = [];
  allocationResourceTypes: Record<string, boolean> = {
    MATERIAL: true,
    PERSONAL: true,
    EQUIPO: true,
    HERRAMIENTA: true,
    AUXILIAR: true
  };

  readonly resourceSections = [
    { type: 'TODOS', label: 'Todo', icon: 'bi-grid' },
    { type: 'MATERIAL', label: 'Materiales', icon: 'bi-box-seam' },
    { type: 'PERSONAL', label: 'Personal', icon: 'bi-people' },
    { type: 'EQUIPO', label: 'Equipos', icon: 'bi-truck' },
    { type: 'HERRAMIENTA', label: 'Herramientas', icon: 'bi-tools' },
    { type: 'AUXILIAR', label: 'Auxiliares', icon: 'bi-diagram-2' }
  ] as const;

  /** Valores derivados de los datos cargados (fallback cuando el signal está null) */
  private idContractFallback: number | null = null;
  private idConventionFallback: number | null = null;
  measures: any;
  notSavedChanges: boolean = false;
  isSaving: boolean = false;
  idcompany: number = null;

  get selectedCompanyId(): number {
    return Number(this.signalsService.getRootSelectedBySidebar()() || 0);
  }

  taskCount: number = 0;

  isCalculating: boolean = false;
  calcProgress: number = 0;
  private isDragging: boolean = false;

  // Modalidad de cálculo de ponderado (sólo en pantalla, no persiste en BD)
  pondModalidad: 'precio' | 'tiempo' | 'volumen' = 'precio';

  // Modal de Configuración del Programa de Trabajo
  showConfigModal: boolean = false;
  configModalidad: 'precio' | 'tiempo' | 'volumen' = 'precio'; // copia temporal mientras está abierto el modal

  showNewFaseModal: boolean = false;
  newFaseDescription: string = '';

  // APU modal
  showApuModal    = false;
  apuIdWorkprogram: number | null = null;
  apuTaskName     = '';
  apuItems: any[] = [];
  apuCatalog: any[] = [];
  apuCatalogLoading = false;
  apuSaving = false;
  apuResourceType: 'MATERIAL' | 'PERSONAL' | 'EQUIPO' | 'HERRAMIENTA' | 'AUXILIAR' = 'MATERIAL';
  apuSearch = '';
  apuDraft: any = { idReference: null, description: '', unit: '', quantity: 1, unitCost: 0, applyToCost: true };

  // Distribución modal
  showDistModal        = false;
  distIdWorkprogram: number | null = null;
  distTaskName         = '';
  distTaskQuantity     = 0;

  // PDF distribución
  showPdfDistReport    = false;

  // Distribución completa (todas las tareas)
  showFullDistModal    = false;

  showNewMedidaModal: boolean = false;
  newMedidaDescription: string = '';

  constructor() {
    // Exponer funciones globales para los botones "+" dentro del lightbox del gantt (fuera de la zona Angular)
    (window as any).__openNewFaseModal = () => {
      this.ngZone.run(() => { this.showNewFaseModal = true; });
    };
    (window as any).__openApuModal = (idEntry: number, taskName: string) => {
      this.ngZone.run(() => this.openApuEditor(idEntry, taskName));
    };
    (window as any).__openNewMedidaModal = () => {
      this.ngZone.run(() => { this.showNewMedidaModal = true; });
    };
    (window as any).__openDistModal = (idEntry: number, taskName: string, taskQuantity: number) => {
      this.ngZone.run(() => {
        this.distIdWorkprogram = idEntry;
        this.distTaskName      = taskName;
        this.distTaskQuantity  = Number(taskQuantity) || 0;
        this.showDistModal     = true;
      });
    };

    effect(() => {
      this.idContract = this.signalsService.getContractSelectedBySidebar()();
      this.idProject  = this.signalsService.getProjectSelectedBySidebar()();
      this.idcompany  = this.signalsService.getRootSelectedBySidebar()();
      const vigente   = this.signalsService.getConventionVigente()(); // trackear vigente
      this.idConvention   = vigente?.id   ?? null;
      this.conventionName = vigente?.name ?? '';
      // El alcance lo elige el usuario. Nunca inferir Proyecto sólo porque exista
      // uno seleccionado en el sidebar: eso mezclaba los programas.
      if (this.typeWorkProgram === 'Project' && !this.idProject) {
        this.typeWorkProgram = 'Contract';
      }
      this.loadContractHeader();
      this.loadVigenteAndInit();
    });
  }

  async selectWorkProgramScope(scope: 'Contract' | 'Project'): Promise<void> {
    if (scope === this.typeWorkProgram) return;

    if (scope === 'Project' && !this.idProject) {
      alerts.basicAlert('Selecciona un proyecto', 'Elige un proyecto en el sidebar para abrir su programa de trabajo.', 'warning');
      return;
    }

    if (this.notSavedChanges) {
      const discard = await alerts.confirmAlert(
        'Cambios sin guardar',
        'Al cambiar de programa se descartarán los cambios pendientes.',
        'warning',
        'Cambiar de programa'
      );
      if (!discard.isConfirmed) return;
    }

    this.typeWorkProgram = scope;
    this.notSavedChanges = false;
    this.deletedTasks.clear();
    this.idContractFallback = null;
    this.idConventionFallback = null;
    this.taskCount = 0;
    this.selectedProgramTask = null;
    this.selectedTaskResources = [];
    this.selectedTaskCrews = [];
    gantt.clearAll();
    this.loadDataFromAPI();
  }

  get activeScopeId(): number {
    return Number(this.typeWorkProgram === 'Contract' ? this.idContract : this.idProject) || 0;
  }

  get filteredSelectedTaskResources(): any[] {
    if (this.selectedResourceSection === 'TODOS') return this.selectedTaskResources;
    return this.selectedTaskResources.filter(item => this.normalizeResourceType(item.type) === this.selectedResourceSection);
  }

  get selectedTaskResourceTotal(): number {
    return this.selectedTaskResources.reduce((sum, item) =>
      sum + Number(item.total ?? (Number(item.quantity || 0) * Number(item.unitCost || 0))), 0);
  }

  resourceCount(type: string): number {
    if (type === 'TODOS') return this.selectedTaskResources.length + this.selectedTaskCrews.length;
    if (type === 'PERSONAL') {
      return this.selectedTaskResources.filter(item => this.normalizeResourceType(item.type) === type).length + this.selectedTaskCrews.length;
    }
    return this.selectedTaskResources.filter(item => this.normalizeResourceType(item.type) === type).length;
  }

  normalizeResourceType(type: any): string {
    const value = String(type || '').trim().toUpperCase();
    if (value === 'MATERIALES') return 'MATERIAL';
    if (value === 'EQUIPOS') return 'EQUIPO';
    if (value === 'HERRAMIENTAS') return 'HERRAMIENTA';
    if (value === 'AUXILIARES') return 'AUXILIAR';
    return value;
  }

  private apiErrorMessage(error: any, fallback: string): string {
    if (typeof error?.error === 'string' && error.error.trim()) return error.error;
    return error?.error?.message || error?.error?.Message || error?.message || fallback;
  }

  private loadContractHeader(): void {
    if (!this.idContract) {
      this.contractShortName = '';
      this.contractNumber = '';
      return;
    }
    this.followprojectsService.getContractById(this.idContract).pipe(catchError(() => of(null))).subscribe(contract => {
      this.contractShortName = String(contract?.descripSmall || contract?.description || '').trim();
      this.contractNumber = String(contract?.numberContract || '').trim();
    });
  }

  private async loadSelectedTaskDetails(task: any): Promise<void> {
    this.selectedProgramTask = task ? { ...task } : null;
    this.selectedTaskResources = [];
    this.selectedTaskCrews = [];
    this.selectedResourceSection = 'TODOS';
    const idWorkprogram = Number(task?.idEntry || 0);
    if (!idWorkprogram) return;

    this.isTaskDetailLoading = true;
    try {
      const [resources, crews] = await Promise.all([
        lastValueFrom(this.apuService.getByWorkprogram(idWorkprogram).pipe(catchError(() => of([])))),
        lastValueFrom(this.workprogramApuCuadrillaService.getByWorkprogram(idWorkprogram).pipe(catchError(() => of([]))))
      ]);
      this.selectedTaskCrews = crews ?? [];
      this.selectedTaskResources = await Promise.all((resources ?? []).map(async resource => {
        if (this.normalizeResourceType(resource.type) !== 'AUXILIAR' || !resource.idReference) return resource;
        const detail = await lastValueFrom(
          this.auxiliarItemsService.getDetalle(Number(resource.idReference)).pipe(catchError(() => of(null)))
        );
        return { ...resource, auxiliaryDetail: detail };
      }));
    } finally {
      this.isTaskDetailLoading = false;
    }
  }

  async openContractAllocation(): Promise<void> {
    if (!this.idContract || !this.idProject || !this.idConvention) {
      alerts.basicAlert('Falta selección', 'Selecciona contrato, proyecto y convenio en el sidebar.', 'warning');
      return;
    }

    this.showContractAllocationModal = true;
    this.isLoadingContractAllocation = true;
    try {
      const [rows, allocationRows] = await Promise.all([
        lastValueFrom(this.workprogramsService.getWorkPrograms(this.idContract, 'Contract').pipe(catchError(() => of([])))),
        lastValueFrom(this.workprogramsService.getContractAllocation(this.idContract, this.idConvention).pipe(catchError(() => of([]))))
      ]);
      const existingSources = new Set<number>();
      gantt.eachTask(task => {
        const sourceId = Number(task['idSourceWorkprogram'] || 0);
        if (sourceId) existingSources.add(sourceId);
      });

      const scopedRows = (rows ?? []).filter(row =>
        Number(row.idConvention || 0) === Number(this.idConvention) && Number(row.active ?? 1) === 1
      );
      const allocationBySource = new Map((allocationRows ?? []).map(item => [Number(item.sourceWorkprogramId), item]));
      const rowById = new Map(scopedRows.map(row => [Number(row.id), row]));
      const rowByTaskId = new Map(scopedRows.map(row => [Number(row.idTask), row]));
      const depthOf = (row: any): number => {
        let depth = 0;
        let parent = Number(row.parent || 0);
        const visited = new Set<number>();
        while (parent && !visited.has(parent) && depth < 8) {
          const parentRow: any = rowById.get(parent) ?? rowByTaskId.get(parent);
          if (!parentRow) break;
          visited.add(parent);
          depth++;
          parent = Number(parentRow.parent || 0);
        }
        return depth;
      };

      this.contractProgramOptions = scopedRows.map(row => {
        const allocation: any = allocationBySource.get(Number(row.id));
        const availableQuantity = Number(allocation?.availableQuantity ?? row.quantity ?? 0);
        return {
          ...row,
          selected: false,
          alreadyCopied: existingSources.has(Number(row.id)),
          allocationQuantity: availableQuantity,
          allocatedQuantity: Number(allocation?.allocatedQuantity || 0),
          availableQuantity,
          generatedQuantity: Number(allocation?.generatedQuantity || 0),
          authorizedQuantity: Number(allocation?.authorizedQuantity || 0),
          estimatedQuantity: Number(allocation?.estimatedQuantity || 0),
          projectAllocations: allocation?.projects ?? [],
          depth: depthOf(row)
        };
      });
    } finally {
      this.isLoadingContractAllocation = false;
    }
  }

  closeContractAllocation(): void {
    if (!this.isCopyingContractAllocation) this.showContractAllocationModal = false;
  }

  toggleContractAllocation(row: any): void {
    if (row.alreadyCopied) return;
    row.selected = !row.selected;
    this.contractProgramOptions.forEach(candidate => {
      let parentId = Number(candidate.parent || 0);
      const visited = new Set<number>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = this.contractProgramOptions.find(item => Number(item.id) === parentId || Number(item.idTask) === parentId);
        if (!parent) break;
        if (Number(parent.id) === Number(row.id)) {
          candidate.selected = row.selected && !candidate.alreadyCopied;
          break;
        }
        parentId = Number(parent.parent || 0);
      }
      if (Number(candidate.id) === Number(row.id)) {
        candidate.selected = row.selected && !candidate.alreadyCopied;
      }
    });
  }

  async copySelectedContractAllocation(): Promise<void> {
    const selected = this.contractProgramOptions.filter(row => row.selected && !row.alreadyCopied);
    if (!selected.length) {
      alerts.basicAlert('Selecciona conceptos', 'Marca al menos una actividad o concepto del contrato.', 'warning');
      return;
    }
    const invalidQuantity = selected.find(row =>
      Number(row.allocationQuantity || 0) < 0 || Number(row.allocationQuantity || 0) > Number(row.availableQuantity || 0)
    );
    if (invalidQuantity) {
      alerts.basicAlert(
        'Cantidad fuera del contrato',
        `${invalidQuantity.text}: máximo disponible ${Number(invalidQuantity.availableQuantity || 0).toLocaleString('es-MX')}.`,
        'warning'
      );
      return;
    }

    const ids = new Set<number>(selected.map(row => Number(row.id)));
    const byId = new Map(this.contractProgramOptions.map(row => [Number(row.id), row]));
    const byTaskId = new Map(this.contractProgramOptions.map(row => [Number(row.idTask), row]));
    selected.forEach(row => {
      let parentId = Number(row.parent || 0);
      const visited = new Set<number>();
      while (parentId && !visited.has(parentId)) {
        const parent: any = byId.get(parentId) ?? byTaskId.get(parentId);
        if (!parent) break;
        visited.add(parentId);
        ids.add(Number(parent.id));
        parentId = Number(parent.parent || 0);
      }
    });

    const items = this.contractProgramOptions
      .filter(row => ids.has(Number(row.id)))
      .map(row => ({ sourceWorkprogramId: Number(row.id), quantity: Number(row.allocationQuantity || 0) }));
    const resourceTypes = Object.keys(this.allocationResourceTypes).filter(type => this.allocationResourceTypes[type]);

    this.isCopyingContractAllocation = true;
    try {
      const response = await lastValueFrom(this.workprogramsService.copyContractActivitiesToProject(
        this.idContract,
        this.idProject,
        Array.from(ids),
        this.idConvention,
        items,
        resourceTypes
      ));
      this.showContractAllocationModal = false;
      alerts.basicAlert('Programa actualizado', response?.message || `Se agregaron ${response?.copied || 0} registros del contrato.`, 'success');
      this.loadDataFromAPI();
    } catch (error: any) {
      alerts.basicAlert('No se pudo distribuir', this.apiErrorMessage(error, 'No fue posible agregar los conceptos.'), 'error');
    } finally {
      this.isCopyingContractAllocation = false;
    }
  }

  private async loadVigenteAndInit(): Promise<void> {
    this.taskCount = 0;
    await this.initializeWorkprograms();
  }

  private async initializeWorkprograms(): Promise<void> {
    try {
      await this.getMeasures();
      await this.getPhases();
      this.configGantt();
      gantt.init('gantt_here');
      this.configureTaskEvents();
      // Respaldo: detecta fin de drag por mouseup en el contenedor del gantt
      // ngZone.run() es obligatorio — los eventos DOM corren fuera de Angular
      const ganttEl = document.getElementById('gantt_here');
      if (ganttEl) {
        ganttEl.addEventListener('mouseup', () => {
          setTimeout(() => {
            this.ngZone.run(() => {
              this.recalcSortorder();
              this.notSavedChanges = true;
            });
          }, 100);
        });
      }
      await this.loadDataFromAPI();
    } catch (error) {
      console.error('Error initializing workprograms component:', error);
      // Handle the error appropriately, e.g., show an error message to the user
    }
  }

  openImportPmoModal(): void {
    this.showImportPmoModal = true;
    this.importMode = 'replace';
    this.importSummary = '';
    this.importWarnings = [];
    this.importDetectedColumns = [];
    this.importPreviewRows = [];
    this.importedTasksDraft = [];
    this.importApplyProgress = 0;
    this.importApplyStatus = '';
    this.importFiles = [];
    this.importKind = 'program';
    this.explosionRowsDraft = [];
  }

  closeImportPmoModal(): void {
    if (this.isAnalyzingImport || this.isApplyingImport) {
      return;
    }
    this.showImportPmoModal = false;
  }

  onImportFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFiles = Array.from(input.files || []);
    this.importSummary = '';
    this.importWarnings = [];
    this.importDetectedColumns = [];
    this.importPreviewRows = [];
    this.importedTasksDraft = [];
    this.importApplyProgress = 0;
    this.importApplyStatus = '';
    this.explosionRowsDraft = [];
  }

  async analyzeImportFiles(): Promise<void> {
    if (!this.importFiles.length) {
      alerts.basicAlert('Aviso', 'Selecciona al menos un archivo Excel o CSV para analizar', 'warning');
      return;
    }

    this.isAnalyzingImport = true;
    this.importWarnings = [];
    this.importDetectedColumns = [];
    this.importPreviewRows = [];
    this.importedTasksDraft = [];
    this.importApplyProgress = 0;
    this.importApplyStatus = '';
    this.importSummary = '';

    if (this.importKind === 'explosion') {
      await this.analyzeExplosionFiles();
      return;
    }

    try {
      const analysis = await this.buildImportAnalysis(this.importFiles);
      this.importDetectedColumns = analysis.detectedColumns;
      this.importWarnings = analysis.warnings;
      this.importPreviewRows = analysis.previewRows;
      this.importedTasksDraft = analysis.tasks;
      this.importSummary =
        `${analysis.tasks.length} tarea(s) detectada(s) en ${this.importFiles.length} archivo(s). ` +
        `${analysis.structureMode ? 'Modo cronograma' : 'Modo completo PMO'}.`;

      if (!analysis.tasks.length) {
        alerts.basicAlert('Aviso', 'No se detectaron tareas válidas para importar', 'warning');
      }
    } catch (error: any) {
      console.error('Error analyzing PMO import files:', error);
      alerts.basicAlert('Error', error?.message || 'No fue posible analizar los archivos seleccionados', 'error');
    } finally {
      this.isAnalyzingImport = false;
    }
  }

  private async analyzeExplosionFiles(): Promise<void> {
    this.isAnalyzingImport = true;
    try {
      const rows: ExplosionRowDraft[] = [];
      const warnings: string[] = [];
      for (const file of this.importFiles) {
        const workbook = await this.readWorkbook(file);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });
        if (!rawRows.length) { warnings.push(`${file.name}: sin filas.`); continue; }
        rawRows.forEach((raw, index) => {
          const values = Object.entries(raw).reduce((acc, [key, value]) => { acc[this.normalizeExplosionHeader(key)] = value; return acc; }, {} as Record<string, any>);
          const clave = String(values['clave'] ?? '').trim();
          const descripcion = String(values['descripcion'] ?? '').trim();
          if (!clave && !descripcion) return;
          if (/total|gran total/i.test(descripcion) && !clave) return;
          const classified = this.classifyExplosionRow({ clave, descripcion, unidad: String(values['unidad'] ?? ''), familia: String(values['familia'] ?? ''), tipo: String(values['tipo'] ?? '') });
          rows.push({ sourceRow: index + 2, clave, descripcion, unidad: String(values['unidad'] ?? ''), cantidad: this.parseLocaleNumber(values['cantidad']), unitCost: this.parseLocaleNumber(values['p.u.'] ?? values['pu'] ?? values['precio unitario']), importe: this.parseLocaleNumber(values['importe']), familia: String(values['familia'] ?? ''), ...classified });
        });
      }
      this.explosionRowsDraft = rows;
      this.importWarnings = warnings;
      const counts = rows.reduce((m, row) => { m[row.tipo] = (m[row.tipo] || 0) + 1; return m; }, {} as Record<string, number>);
      this.importSummary = `${rows.length} filas detectadas. ` + Object.entries(counts).map(([type, count]) => `${type}: ${count}`).join(' · ');
      if (!rows.length) alerts.basicAlert('Aviso', 'No se encontraron filas de explosión válidas.', 'warning');
    } catch (error: any) {
      alerts.basicAlert('Error', error?.message || 'No fue posible analizar la explosión de insumos.', 'error');
    } finally { this.isAnalyzingImport = false; }
  }

  private normalizeExplosionHeader(value: string): string { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  private parseLocaleNumber(value: any): number { const text = String(value ?? '').replace(/[$%\s]/g, '').trim(); if (!text) return 0; const normalized = text.includes(',') && text.includes('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.'); return Number(normalized) || 0; }
  private classifyExplosionRow(row: { clave: string; descripcion: string; unidad: string; familia: string; tipo: string }): { tipo: ExplosionRowDraft['tipo']; confidence: ExplosionRowDraft['confidence'] } {
    const text = `${row.clave} ${row.descripcion} ${row.unidad} ${row.familia} ${row.tipo}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/personal|mano de obra|peon|ayudante|albanil|cadenero|velador|carpintero|colocador|fierrero|topografo|jor(nada)?/.test(text)) return { tipo: 'PERSONAL', confidence: row.tipo ? 'alta' : 'media' };
    if (/equipo|revolvedora|vibrador|estacion total|demoledor|karcher|renta|maquina|\b(hr|hora)\b/.test(text)) return { tipo: 'EQUIPO', confidence: row.tipo ? 'alta' : 'media' };
    if (/herr|herramienta|pala|espatula|barreta|rodillo|casco|guante|arnes|plomada|linea de vida/.test(text)) return { tipo: 'HERRAMIENTA', confidence: row.tipo ? 'alta' : 'media' };
    if (/auxiliar|preliminar|drenaje|electrific|alumbrado|planta de tratamiento|agua potable|pavimento|carpeta asfaltica|banqueta|fibra optica|cortes y rellenos|tanque elevado/.test(text)) return { tipo: 'AUXILIAR', confidence: 'media' };
    if (row.tipo.toLowerCase().includes('material') || row.tipo.toLowerCase().includes('insumo') || /cemento|arena|grava|varilla|acero|mortero|concreto|polietileno|madera|clavo|pintura|sanitario/.test(text)) return { tipo: 'MATERIAL', confidence: row.tipo ? 'alta' : 'media' };
    return { tipo: 'CONCEPTO', confidence: 'baja' };
  }

  async saveExplosionImport(): Promise<void> {
    if (!this.explosionRowsDraft.length || this.isApplyingExplosion) return;
    const idCompany = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
    if (!idCompany) { alerts.basicAlert('Empresa requerida', 'Selecciona una empresa antes de importar.', 'warning'); return; }
    const confirm = await alerts.confirmAlert('¿Guardar explosión de insumos?', `Se buscarán y crearán recursos en la empresa seleccionada (${idCompany}).`, 'question', 'Guardar');
    if (!confirm.isConfirmed) return;
    this.isApplyingExplosion = true;
    try {
      const [auxiliares, materiales, equipos] = await Promise.all([
        lastValueFrom(this.auxiliarService.getByCompany(idCompany)).catch(() => []),
        lastValueFrom(this.materialsService.getMaterials(idCompany, 'MATERIAL')).catch(() => []),
        lastValueFrom(this.equipmentService.getEquipment(idCompany)).catch(() => [])
      ]);
      let currentAux: any = null;
      let created = 0, reused = 0, linked = 0;
      for (const row of this.explosionRowsDraft) {
        if (row.tipo === 'AUXILIAR') {
          currentAux = this.findCatalogRecord(auxiliares, row);
          if (!currentAux) {
            currentAux = await lastValueFrom(this.auxiliarService.add({ idCompany, idContract: null, description: row.descripcion, unit: row.unidad || 'M2', costMN: row.unitCost, precioUnitario: row.unitCost, hasPersonal: false, hasMaterial: false, hasHerramienta: false, hasEquipo: false, active: true, clave: row.clave || null, claveUsuario: row.clave || null }));
            currentAux = currentAux?.auxiliar || currentAux;
            created++;
          } else reused++;
          continue;
        }
        if (!currentAux) {
          currentAux = this.findCatalogRecord(auxiliares, { descripcion: 'Explosión de insumos importada' });
          if (!currentAux) {
            currentAux = await lastValueFrom(this.auxiliarService.add({ idCompany, idContract: null, description: 'Explosión de insumos importada', unit: 'M2', costMN: 0, precioUnitario: 0, active: true }));
            currentAux = currentAux?.auxiliar || currentAux; created++;
          }
        }
        let resourceId: number | null = null;
        if (row.tipo === 'MATERIAL') {
          let resource = this.findCatalogRecord(materiales, row, 'insumo');
          if (!resource) {
            resource = await lastValueFrom(this.materialsService.addMaterial({ idCompany, insumo: row.clave || null, description: row.descripcion, quantity: 0, costoMN: row.unitCost, ventaMN: row.unitCost, active: true, vigente: true, typematerial: 'CONSUMIBLE' })); created++;
          } else reused++;
          resourceId = Number(resource?.id || 0) || null;
        } else if (row.tipo === 'EQUIPO') {
          let resource = this.findCatalogRecord(equipos, row);
          if (!resource) {
            resource = await lastValueFrom(this.equipmentService.addEquipment({ idCompany, description: row.descripcion, measure: row.unidad || 'DIA', quantity: 1, costMN: row.unitCost, priceMN: row.unitCost, active: true, print: true, charged: true })); created++;
          } else reused++;
          resourceId = Number(resource?.id || 0) || null;
        }
        await lastValueFrom(this.auxiliarItemsService.saveItem({ idAuxiliar: Number(currentAux.id), type: row.tipo === 'HERRAMIENTA' ? 'HERR' : row.tipo, idReference: resourceId, description: row.descripcion, unit: row.unidad || null, quantity: row.cantidad, unitCost: row.unitCost, active: true }));
        linked++;
      }
      alerts.basicAlert('Importación completada', `${created} registros creados, ${reused} reutilizados y ${linked} componentes asociados en la empresa ${idCompany}.`, 'success');
      this.showImportPmoModal = false;
    } catch (error: any) {
      console.error('Error guardando explosión:', error);
      alerts.basicAlert('Error', error?.message || 'No fue posible guardar la explosión.', 'error');
    } finally { this.isApplyingExplosion = false; }
  }

  private findCatalogRecord(records: any[], row: { clave?: string; descripcion: string }, keyField = 'clave'): any {
    const key = String(row.clave || '').trim().toLowerCase();
    const description = String(row.descripcion || '').trim().toLowerCase();
    return (records || []).find(record => key && String(record[keyField] ?? record.insumo ?? '').trim().toLowerCase() === key)
      || (records || []).find(record => description && String(record.description || '').trim().toLowerCase() === description);
  }

  async applyImportToGantt(): Promise<void> {
    if (!this.importedTasksDraft.length) {
      alerts.basicAlert('Aviso', 'Analiza primero los archivos para generar una vista previa', 'warning');
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Importar planeación PMO?',
      this.importMode === 'replace'
        ? 'Se reemplazará el programa actual en pantalla por la versión importada. Los cambios se guardarán hasta que presiones Guardar.'
        : 'Las tareas importadas se agregarán al programa actual en pantalla. Los cambios se guardarán hasta que presiones Guardar.',
      'question',
      'Importar'
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.isApplyingImport = true;
    this.importApplyProgress = 5;
    this.importApplyStatus = 'Preparando importación...';
    try {
      this.importApplyProgress = 20;
      this.importApplyStatus = 'Construyendo tareas para el Gantt...';
      const ganttData = this.buildGanttDataFromImport(this.importedTasksDraft);
      this.importApplyProgress = 60;
      this.importApplyStatus = this.importMode === 'replace'
        ? 'Reemplazando programa actual...'
        : 'Agregando tareas al programa actual...';
      if (this.importMode === 'replace') {
        this.deletedTasks.clear();
        gantt.getTaskByTime().forEach(task => {
          if (task['idEntry']) {
            this.deletedTasks.add(task['idEntry']);
          }
        });
        gantt.clearAll();
        gantt.parse(ganttData);
      } else {
        gantt.parse(ganttData);
      }

      this.importApplyProgress = 85;
      this.importApplyStatus = 'Renderizando programa importado...';
      this.recalcSortorder();
      gantt.render();
      this.taskCount = gantt.getTaskByTime().length;
      this.notSavedChanges = true;
      this.showImportPmoModal = false;
      this.importApplyProgress = 100;
      this.importApplyStatus = 'Importación completada.';

      alerts.basicAlert(
        'Éxito',
        `Importación PMO cargada en pantalla con ${this.importedTasksDraft.length} tarea(s). Presiona Guardar para persistirla.`,
        'success'
      );
    } catch (error: any) {
      console.error('Error applying PMO import:', error);
      alerts.basicAlert('Error', error?.message || 'No fue posible cargar la importación PMO al Gantt', 'error');
    } finally {
      this.isApplyingImport = false;
    }
  }

  private async buildImportAnalysis(files: File[]): Promise<ImportAnalysisResult> {
    const warnings: string[] = [];
    const detectedColumnsMap = new Map<string, ImportColumnMatch>();
    const rawRows: ImportedRawRow[] = [];

    // Listas separadas para tareas que vienen de XML/XER (no necesitan rawRows)
    const nativeTaskDrafts: ImportedTaskDraft[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // ── MS Project XML ──────────────────────────────────────────────────────
      if (ext === 'xml') {
        try {
          const xmlTasks = await this.parseMSProjectXML(file);
          if (!xmlTasks.length) {
            warnings.push(`${file.name}: no se detectaron tareas válidas en el XML.`);
          } else {
            nativeTaskDrafts.push(...xmlTasks);
          }
        } catch {
          warnings.push(`${file.name}: error al parsear el XML de MS Project.`);
        }
        continue;
      }

      // ── Primavera P6 XER ────────────────────────────────────────────────────
      if (ext === 'xer') {
        try {
          const xerTasks = await this.parsePrimaveraXER(file);
          if (!xerTasks.length) {
            warnings.push(`${file.name}: no se detectaron tareas válidas en el XER.`);
          } else {
            nativeTaskDrafts.push(...xerTasks);
          }
        } catch {
          warnings.push(`${file.name}: error al parsear el XER de Primavera P6.`);
        }
        continue;
      }

      // ── Excel / CSV ─────────────────────────────────────────────────────────
      const workbook = await this.readWorkbook(file);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        warnings.push(`El archivo ${file.name} no contiene una hoja válida.`);
        continue;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false
      });

      if (!rows.length) {
        warnings.push(`El archivo ${file.name} no contiene filas utilizables.`);
        continue;
      }

      const mapping = this.detectImportMapping(rows[0]);
      Object.values(mapping).forEach(match => {
        if (match && !detectedColumnsMap.has(match.field)) {
          detectedColumnsMap.set(match.field, match);
        }
      });

      rows.forEach((row, index) => {
        rawRows.push({
          fileName: file.name,
          rowNumber: index + 2,
          data: row,
          mapping
        });
      });
    }

    // Si solo hay archivos XML/XER (sin Excel), devolvemos directamente sus tareas
    if (!rawRows.length && nativeTaskDrafts.length) {
      const previewRowsNative: ImportedPreviewRow[] = nativeTaskDrafts.slice(0, 50).map((t, i) => ({
        fileName: t.sourceFile,
        rowNumber: t.sourceRow,
        wbs: t.wbs,
        level: t.level,
        description: t.description,
        startDate: t.startDate,
        endDate: t.endDate,
        quantity: t.quantity,
        cost: t.cost,
        salePrice: t.salePrice,
        status: t.errors.length ? 'error' : (t.warnings.length ? 'warning' : 'ok'),
      }));
      return {
        detectedColumns: [],
        warnings,
        previewRows: previewRowsNative,
        tasks: nativeTaskDrafts,
        structureMode: true,
      };
    }

    if (!rawRows.length && !nativeTaskDrafts.length) {
      return {
        detectedColumns: [],
        warnings: warnings.length ? warnings : ['No se encontraron filas válidas para importar.'],
        previewRows: [],
        tasks: [],
        structureMode: true
      };
    }

    const tasks: ImportedTaskDraft[] = [];
    const previewRows: ImportedPreviewRow[] = [];
    let missingEconomicRows = 0;

    rawRows.forEach(raw => {
      const normalized = this.normalizeImportRow(raw);
      if (normalized.errors.length) {
        warnings.push(`${raw.fileName} fila ${raw.rowNumber}: ${normalized.errors.join(', ')}`);
        previewRows.push({
          fileName: raw.fileName,
          rowNumber: raw.rowNumber,
          wbs: normalized.wbs || '(sin WBS)',
          level: normalized.level ?? 0,
          description: normalized.description || '(sin descripción)',
          startDate: normalized.startDate || '',
          endDate: normalized.endDate || '',
          quantity: normalized.quantity,
          cost: normalized.cost,
          salePrice: normalized.salePrice,
          status: 'error'
        });
        return;
      }

      if (normalized.quantity == null || normalized.cost == null || normalized.salePrice == null) {
        missingEconomicRows++;
      }

      tasks.push(normalized);
      previewRows.push({
        fileName: raw.fileName,
        rowNumber: raw.rowNumber,
        wbs: normalized.wbs,
        level: normalized.level,
        description: normalized.description,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        quantity: normalized.quantity,
        cost: normalized.cost,
        salePrice: normalized.salePrice,
        status: normalized.warnings.length ? 'warning' : 'ok'
      });

      normalized.warnings.forEach(warning => {
        warnings.push(`${raw.fileName} fila ${raw.rowNumber}: ${warning}`);
      });
    });

    const structureMode = missingEconomicRows > 0;
    if (structureMode) {
      warnings.unshift(
        'Se detectaron filas sin cantidad, costo o precio de venta. La importación operará en modo cronograma para esas tareas.'
      );
    }

    // Combinar tareas Excel con tareas de archivos XML/XER si hay mixto
    const allTasks = [...nativeTaskDrafts, ...tasks];
    const allPreview = [
      ...nativeTaskDrafts.slice(0, 25).map((t, i): ImportedPreviewRow => ({
        fileName: t.sourceFile, rowNumber: t.sourceRow,
        wbs: t.wbs, level: t.level, description: t.description,
        startDate: t.startDate, endDate: t.endDate,
        quantity: t.quantity, cost: t.cost, salePrice: t.salePrice,
        status: t.errors.length ? 'error' : (t.warnings.length ? 'warning' : 'ok'),
      })),
      ...previewRows,
    ].slice(0, 50);

    return {
      detectedColumns: Array.from(detectedColumnsMap.values()),
      warnings: Array.from(new Set(warnings)),
      previewRows: allPreview,
      tasks: allTasks,
      structureMode
    };
  }

  private readWorkbook(file: File): Promise<XLSX.WorkBook> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          resolve(XLSX.read(data, { type: 'array' }));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private detectImportMapping(sampleRow: Record<string, any>): ImportColumnMapping {
    const columns = Object.keys(sampleRow || {});
    const normalizedColumns = columns.map(column => ({
      original: column,
      normalized: this.normalizeHeader(column)
    }));

    const fieldSynonyms: Record<ImportFieldKey, string[]> = {
      wbs: ['wbs', 'edt', 'estructura', 'codigo wbs', 'codigo edt', 'partida', 'id partida', 'codigo', 'task id'],
      level: ['nivel', 'level', 'jerarquia', 'nivel wbs', 'nivel edt'],
      description: ['descripcion', 'descripción', 'task name', 'nombre', 'actividad', 'concepto', 'descripcion tarea'],
      quantity: ['cantidad', 'qty', 'volumen', 'quantity'],
      cost: ['costo', 'cost', 'costo mxn', 'costomx', 'costo base', 'costo unitario', 'unit cost'],
      salePrice: ['precio venta', 'precio de venta', 'venta', 'price', 'pu', 'precio unitario', 'unit price'],
      startDate: ['fecha inicio', 'inicio', 'start', 'start date', 'fechainicio'],
      endDate: ['fecha termino', 'fecha término', 'termino', 'término', 'finish', 'end', 'end date', 'fechatermino'],
      predecessors: ['predecesoras', 'predecesor', 'predecessor', 'predecessors'],
      successors: ['sucesoras', 'sucesor', 'successor', 'successors'],
      resources: ['recursos', 'resources', 'resource names', 'resource']
    };

    const mapping = {} as ImportColumnMapping;

    (Object.keys(fieldSynonyms) as ImportFieldKey[]).forEach(field => {
      const match = normalizedColumns.find(column =>
        fieldSynonyms[field].some(alias => column.normalized.includes(this.normalizeHeader(alias)))
      );
      if (match) {
        mapping[field] = {
          field,
          column: match.original,
          inferred: match.normalized !== this.normalizeHeader(field)
        };
      }
    });

    return mapping;
  }

  private normalizeImportRow(raw: ImportedRawRow): ImportedTaskDraft {
    const row = raw.data;
    const warnings: string[] = [];
    const errors: string[] = [];

    const wbs = this.readMappedValue(row, raw.mapping.wbs)?.trim();
    const levelValue = this.readMappedValue(row, raw.mapping.level);
    const description = this.readMappedValue(row, raw.mapping.description)?.trim();
    const quantity = this.parseNullableNumber(this.readMappedValue(row, raw.mapping.quantity));
    const cost = this.parseNullableNumber(this.readMappedValue(row, raw.mapping.cost));
    const salePrice = this.parseNullableNumber(this.readMappedValue(row, raw.mapping.salePrice));
    const startDate = this.normalizeDateString(this.readMappedValue(row, raw.mapping.startDate));
    const endDate = this.normalizeDateString(this.readMappedValue(row, raw.mapping.endDate));
    const predecessors = this.readMappedValue(row, raw.mapping.predecessors)?.trim() || '';
    const successors = this.readMappedValue(row, raw.mapping.successors)?.trim() || '';
    const resources = this.readMappedValue(row, raw.mapping.resources)?.trim() || '';

    const level = this.resolveLevel(wbs, levelValue);

    if (!wbs) errors.push('Falta WBS/código');
    if (!description) errors.push('Falta descripción');
    if (!startDate) errors.push('Falta fecha de inicio válida');
    if (!endDate) errors.push('Falta fecha de término válida');
    if (level == null) errors.push('No se pudo inferir nivel');

    if (quantity == null) warnings.push('Sin cantidad');
    if (cost == null) warnings.push('Sin costo');
    if (salePrice == null) warnings.push('Sin precio de venta');

    return {
      sourceFile: raw.fileName,
      sourceRow: raw.rowNumber,
      wbs: wbs || '',
      level: level ?? 1,
      description: description || '',
      quantity,
      cost,
      salePrice,
      startDate: startDate || '',
      endDate: endDate || '',
      predecessors,
      successors,
      resources,
      warnings,
      errors
    };
  }

  private buildGanttDataFromImport(tasks: ImportedTaskDraft[]): { data: any[]; links: any[] } {
    const sorted = [...tasks].sort((a, b) => {
      const wbsCompare = this.compareWbs(a.wbs, b.wbs);
      if (wbsCompare !== 0) return wbsCompare;
      return a.sourceRow - b.sourceRow;
    });

    const taskIdByWbs = new Map<string, number>();
    const stackByLevel = new Map<number, number>();
    const data: any[] = [];
    const links: any[] = [];

    sorted.forEach((task, index) => {
      this.importApplyProgress = Math.min(55, 20 + Math.round(((index + 1) / sorted.length) * 35));
      this.importApplyStatus = `Procesando ${task.sourceFile} fila ${task.sourceRow}...`;

      const id = Date.now() + index;
      const parentFromWbs = this.findParentWbs(task.wbs);
      const parentIdFromWbs = parentFromWbs ? taskIdByWbs.get(parentFromWbs) : undefined;
      const parentIdFromLevel = task.level > 1 ? stackByLevel.get(task.level - 1) : undefined;
      const parent = parentIdFromWbs ?? parentIdFromLevel ?? 0;

      const startDate = this.parseImportedTaskDate(task.startDate, task, 'inicio');
      const endDate = this.parseImportedTaskDate(task.endDate, task, 'término');
      const total = (task.quantity ?? 0) * (task.cost ?? 0);

      if (endDate < startDate) {
        throw new Error(
          `${task.sourceFile} fila ${task.sourceRow}: la fecha de término ${task.endDate} es menor que la fecha de inicio ${task.startDate}.`
        );
      }

      data.push({
        id,
        text: task.description,
        // Pasar como strings en date_format para garantizar parsing correcto en gantt
        start_date: this.formatGanttDate(startDate),
        end_date: this.formatGanttDate(endDate),
        progress: 0,
        parent,
        activity: task.wbs,
        criticRoute: 'No',
        type: this.typeWorkProgram,
        typeActivity: 'Activity',
        costMX: task.cost ?? 0,
        costDLL: 0,
        quantity: task.quantity ?? 0,
        ponderado: null,
        predecesor: this.extractFirstPredecessor(task.predecessors),
        phase: null,
        measure: null,
        total,
        active: 1,
        sortorder: index,
        resourcesRaw: task.resources,
        salePrice: task.salePrice ?? 0,
        successorsRaw: task.successors
      });

      taskIdByWbs.set(task.wbs, id);
      stackByLevel.set(task.level, id);
      Array.from(stackByLevel.keys())
        .filter(level => level > task.level)
        .forEach(level => stackByLevel.delete(level));
    });

    sorted.forEach(task => {
      if (!task.predecessors) return;
      const currentId = taskIdByWbs.get(task.wbs);
      if (!currentId) return;
      const predecessors = task.predecessors
        .split(/[;,]/)
        .map(value => value.trim())
        .filter(Boolean);

      predecessors.forEach((pred, idx) => {
        const sourceId = taskIdByWbs.get(pred);
        if (sourceId) {
          links.push({
            id: `${currentId}-${idx}`,
            source: sourceId,
            target: currentId,
            type: '0'
          });
        }
      });
    });

    return { data, links };
  }

  private readMappedValue(row: Record<string, any>, mapping?: ImportColumnMatch): string {
    if (!mapping?.column) return '';
    const value = row[mapping.column];
    return value == null ? '' : String(value).trim();
  }

  private normalizeHeader(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private parseNullableNumber(value: string): number | null {
    if (!value) return null;
    const normalized = value
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDateString(value: string): string {
    if (!value) return '';
    const rawValue = String(value).trim();
    if (!rawValue) return '';

    const isoMatch = rawValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if (this.isValidDateParts(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return '';
    }

    const excelSerial = Number(value);
    if (Number.isFinite(excelSerial) && excelSerial > 59) {
      const parsed = XLSX.SSF.parse_date_code(excelSerial);
      if (parsed?.y && parsed?.m && parsed?.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }

    const normalized = rawValue.replace(/\./g, '/').replace(/-/g, '/').trim();
    const parts = normalized.split('/');
    if (parts.length === 3) {
      let first = Number(parts[0]);
      let second = Number(parts[1]);
      let year = Number(parts[2]);
      if (year < 100) year += 2000;

      // Heurística para fechas con "/" provenientes de Excel/CSV:
      // - si el primer bloque > 12, asumimos dd/mm
      // - si el segundo bloque > 12, asumimos mm/dd
      // - si ambos son <= 12, preferimos mm/dd para evitar falsos negativos con archivos exportados
      let day = first;
      let month = second;

      if (first > 12 && second <= 12) {
        day = first;
        month = second;
      } else if (second > 12 && first <= 12) {
        day = second;
        month = first;
      } else if (first <= 12 && second <= 12) {
        month = first;
        day = second;
      }

      if (this.isValidDateParts(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const fallback = new Date(rawValue);
    if (!Number.isNaN(fallback.getTime())) {
      return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
    }
    return '';
  }

  private parseImportedTaskDate(value: string, task: ImportedTaskDraft, fieldName: 'inicio' | 'término'): Date {
    if (!value) {
      throw new Error(`${task.sourceFile} fila ${task.sourceRow}: falta fecha de ${fieldName}.`);
    }

    const parsedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`${task.sourceFile} fila ${task.sourceRow}: fecha de ${fieldName} inválida (${value}).`);
    }

    return parsedDate;
  }

  private isValidDateParts(year: number, month: number, day: number): boolean {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return false;
    }

    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const candidate = new Date(year, month - 1, day);
    return candidate.getFullYear() === year
      && candidate.getMonth() === month - 1
      && candidate.getDate() === day;
  }

  private resolveLevel(wbs: string, levelValue: string): number | null {
    const parsedLevel = Number(levelValue);
    if (Number.isFinite(parsedLevel) && parsedLevel > 0) {
      return parsedLevel;
    }
    if (!wbs) return null;
    const segments = wbs.split(/[.\-_/\\]/).filter(Boolean);
    return segments.length || 1;
  }

  private findParentWbs(wbs: string): string | null {
    const segments = wbs.split(/[.\-_/\\]/).filter(Boolean);
    if (segments.length <= 1) return null;
    return segments.slice(0, -1).join('.');
  }

  private compareWbs(a: string, b: string): number {
    const aParts = a.split(/[.\-_/\\]/).filter(Boolean);
    const bParts = b.split(/[.\-_/\\]/).filter(Boolean);
    const maxLength = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] ?? '';
      const bPart = bParts[i] ?? '';
      const aNum = Number(aPart);
      const bNum = Number(bPart);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        if (aNum !== bNum) return aNum - bNum;
      } else if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
    return 0;
  }

  private extractFirstPredecessor(value: string): number {
    if (!value) return 0;
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  configGantt() {
    gantt.config.date_format = "%Y-%m-%d %H:%i";
    gantt.config.work_time = false;
    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;
    gantt.config.open_tree_initially = true;
    gantt.config.multiselect = true;
    gantt.i18n.setLocale("es");

    // Configurar vista mensual
    gantt.config.scales = [
      { unit: "year", step: 1, format: "%Y" },
      { unit: "month", step: 1, format: "%M" }
    ];

    // Aquí monitoreamos que hubo cambios en el Gantt
    gantt.attachEvent("onAfterTaskAdd", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterTaskUpdate", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterTaskDelete", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkAdd", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkUpdate", () => this.notSavedChanges = true);
    gantt.attachEvent("onAfterLinkDelete", () => this.notSavedChanges = true);

    gantt.attachEvent("onAfterTaskUpdate", (id, task) => {
      this.scheduleParentUpdate(task.parent);
    });

    gantt.attachEvent("onAfterTaskAdd", (id, task) => {
      this.scheduleParentUpdate(task.parent);
    });

    // Reordenamiento por drag
    // isDragging bloquea gantt.updateTask() en updateParentPonderado/Total
    // para que no revierta el orden al actualizar el padre
    gantt.attachEvent("onRowDragEnd", (id: any, target: any) => {
      this.ngZone.run(() => {
        this.recalcSortorder();
        this.notSavedChanges = true;
      });
    });
    gantt.attachEvent("onAfterTaskDrag", (id: any, mode: string, e: any) => {
      this.ngZone.run(() => {
        this.recalcSortorder();
        this.notSavedChanges = true;
      });
    });

    gantt['form_blocks']['color_picker'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="color" id="task_color" style="width:100%;">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        if (input) input.value = value || '#ffffff';
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        return input ? input.value : '#ffffff';
      },
      focus: function (node) {
        const input = node.querySelector('#task_color') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['currency_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="currency_input" style="width:100%;" step="0.01" min="0">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        if (input) input.value = value || 0;
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        return input ? parseFloat(input.value) || 0 : 0;
      },
      focus: function (node) {
        const input = node.querySelector('#currency_input') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['number_input'] = {
      render: function (sns) {
        return '<div class="gantt_cal_ltext" style="height:30px;">' +
          '<input type="number" id="number_input" style="width:100%;">' +
          '</div>';
      },
      set_value: function (node, value, task, section) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        if (input) input.value = value || 1;
      },
      get_value: function (node, task, section) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        return input ? parseFloat(input.value) || 0 : 0;
      },
      focus: function (node) {
        const input = node.querySelector('#number_input') as HTMLInputElement;
        if (input) input.focus();
      }
    };

    gantt['form_blocks']['total_readonly'] = {
      render: function (sns) {
        return `<div style="height:28px;">
          <input type="text" id="total_display" readonly
            style="width:100%; height:26px; border:1px solid #ced4da; border-radius:3px; padding:0 6px;
                   font-size:13px; font-weight:600; color:#0e4491; background:#f1f7ff; cursor:default;">
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const el = node.querySelector('#total_display') as HTMLInputElement;
        if (!el) return;
        const total = task['total'] ?? ((task['quantity'] ?? 0) * (task['costMX'] ?? 0));
        el.value = total != null ? `$ ${Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$ 0.00';
      },
      get_value: function (node, task, section) { return null; },
      focus: function (node) {}
    };

    gantt['form_blocks']['activity_color_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:2;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Actividad</div>
            <input type="text" id="activity_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;" maxlength="20">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Color</div>
            <input type="color" id="activity_color_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; cursor:pointer;">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const act   = node.querySelector('#activity_input')       as HTMLInputElement;
        const color = node.querySelector('#activity_color_input') as HTMLInputElement;
        if (act)   act.value   = task['activity'] || '';
        if (color) color.value = task['color']    || '#ffffff';
      },
      get_value: function (node, task, section) {
        const act   = node.querySelector('#activity_input')       as HTMLInputElement;
        const color = node.querySelector('#activity_color_input') as HTMLInputElement;
        task['color'] = color ? color.value : '#ffffff';
        return act ? act.value : '';
      },
      focus: function (node) {
        const act = node.querySelector('#activity_input') as HTMLInputElement;
        if (act) act.focus();
      }
    };

    gantt['form_blocks']['measure_phase_row'] = {
      render: function (sns: any) {
        const measureOpts = (sns.measureOptions || []).map((o: any) => `<option value="${o.key}">${o.label}</option>`).join('');
        const phaseOpts   = (sns.phaseOptions   || []).map((o: any) => `<option value="${o.key}">${o.label}</option>`).join('');
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Unidad de medida</div>
            <div style="display:flex; gap:4px;">
              <select id="measure_picker_select" style="flex:1; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">${measureOpts}</select>
              <button type="button" onclick="event.stopPropagation(); window.__openNewMedidaModal();"
                style="height:24px; width:24px; background:#17a2b8; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:14px; line-height:1; flex-shrink:0;" title="Nueva Medida">+</button>
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Fase</div>
            <div style="display:flex; gap:4px;">
              <select id="phase_picker_select" style="flex:1; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">${phaseOpts}</select>
              <button type="button" onclick="event.stopPropagation(); window.__openNewFaseModal();"
                style="height:24px; width:24px; background:#17a2b8; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:14px; line-height:1; flex-shrink:0;" title="Nueva Fase">+</button>
            </div>
          </div>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        const ps = node.querySelector('#phase_picker_select')   as HTMLSelectElement;
        if (ms && task['measure']) ms.value = task['measure'];
        if (ps && task['phase'])   ps.value = task['phase'];
      },
      get_value: function (node: any, task: any, section: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        const ps = node.querySelector('#phase_picker_select')   as HTMLSelectElement;
        task['phase'] = ps ? ps.value : '';
        return ms ? ms.value : '';
      },
      focus: function (node: any) {
        const ms = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (ms) ms.focus();
      }
    };

    gantt['form_blocks']['route_type_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Ruta Crítica</div>
            <select id="critic_route_select" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Nivel</div>
            <select id="type_activity_select" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-size:12px;">
              <option value="Phase">Fase</option>
              <option value="Activity">Actividad</option>
              <option value="Concept">Concepto</option>
            </select>
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const rc   = node.querySelector('#critic_route_select') as HTMLSelectElement;
        const typeActivity = node.querySelector('#type_activity_select') as HTMLSelectElement;
        if (rc)   rc.value   = task['criticRoute'] || 'No';
        if (typeActivity) typeActivity.value = task['typeActivity'] || 'Activity';
      },
      get_value: function (node, task, section) {
        const rc   = node.querySelector('#critic_route_select') as HTMLSelectElement;
        const typeActivity = node.querySelector('#type_activity_select') as HTMLSelectElement;
        task['typeActivity'] = typeActivity ? typeActivity.value : 'Activity';
        return rc ? rc.value : 'No';
      },
      focus: function (node) {
        const rc = node.querySelector('#critic_route_select') as HTMLSelectElement;
        if (rc) rc.focus();
      }
    };

    gantt['form_blocks']['costs_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:8px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">MXN $</div>
            <input type="number" id="cost_mx" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.01" min="0">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Total</div>
            <input type="text" id="cost_total" readonly style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px; font-weight:600; color:#0e4491; background:#f1f7ff; cursor:default;">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">USD $</div>
            <input type="number" id="cost_dll" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.01" min="0">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const mx    = node.querySelector('#cost_mx')    as HTMLInputElement;
        const total = node.querySelector('#cost_total') as HTMLInputElement;
        const dll   = node.querySelector('#cost_dll')   as HTMLInputElement;
        if (mx)    mx.value    = task['costMX']  ?? 0;
        if (dll)   dll.value   = task['costDLL'] ?? 0;
        if (total) {
          const t = task['total'] ?? ((task['quantity'] ?? 0) * (task['costMX'] ?? 0));
          total.value = `$ ${Number(t).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        }
      },
      get_value: function (node, task, section) {
        const mx  = node.querySelector('#cost_mx')  as HTMLInputElement;
        const dll = node.querySelector('#cost_dll') as HTMLInputElement;
        task['costDLL'] = dll ? parseFloat(dll.value) || 0 : 0;
        return mx ? parseFloat(mx.value) || 0 : 0;
      },
      focus: function (node) {
        const mx = node.querySelector('#cost_mx') as HTMLInputElement;
        if (mx) mx.focus();
      }
    };

    gantt['form_blocks']['qty_ponderado_row'] = {
      render: function (sns) {
        return `<div style="display:flex; gap:10px; align-items:flex-end; height:42px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Cantidad</div>
            <input type="number" id="qty_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" min="0">
          </div>
          <div style="flex:1;">
            <div style="font-size:11px; color:#888; margin-bottom:2px;">Ponderado (0-1)</div>
            <input type="number" id="ponderado_input" style="width:100%; height:24px; border:1px solid #ced4da; border-radius:3px; padding:0 4px;" step="0.001" min="0" max="1" placeholder="0.000">
          </div>
        </div>`;
      },
      set_value: function (node, value, task, section) {
        const qty  = node.querySelector('#qty_input')       as HTMLInputElement;
        const pond = node.querySelector('#ponderado_input') as HTMLInputElement;
        if (qty)  qty.value  = task['quantity']  ?? 0;
        if (pond) pond.value = task['ponderado'] != null ? task['ponderado'] : '';
      },
      get_value: function (node, task, section) {
        const qty  = node.querySelector('#qty_input')       as HTMLInputElement;
        const pond = node.querySelector('#ponderado_input') as HTMLInputElement;
        const p = parseFloat(pond?.value);
        task['ponderado'] = isNaN(p) ? null : p;
        return qty ? parseFloat(qty.value) || 0 : 0;
      },
      focus: function (node) {
        const qty = node.querySelector('#qty_input') as HTMLInputElement;
        if (qty) qty.focus();
      }
    };

    // Block personalizado: select de Medida + botón "+" para crear nueva medida
    gantt['form_blocks']['measure_picker'] = {
      render: function (sns: any) {
        const optionsHtml = (sns.options || [])
          .map((o: any) => `<option value="${o.key}">${o.label}</option>`)
          .join('');
        return `<div style="height:32px; display:flex; align-items:center; gap:4px;">
          <select id="measure_picker_select" style="flex:1; font-size:12px; height:28px; border:1px solid #ced4da; border-radius:4px; padding:0 4px;">${optionsHtml}</select>
          <button type="button" onclick="event.stopPropagation(); window.__openNewMedidaModal();"
            style="height:28px; width:28px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:16px; line-height:1; flex-shrink:0;"
            title="Nueva Medida">+</button>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (select && value) select.value = value;
      },
      get_value: function (node: any, task: any, section: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        return select ? select.value : '';
      },
      focus: function (node: any) {
        const select = node.querySelector('#measure_picker_select') as HTMLSelectElement;
        if (select) select.focus();
      }
    };

    // Block personalizado: select de Fase + botón "+" para crear nueva fase
    gantt['form_blocks']['phase_picker'] = {
      render: function (sns: any) {
        const optionsHtml = (sns.options || [])
          .map((o: any) => `<option value="${o.key}">${o.label}</option>`)
          .join('');
        return `<div style="height:32px; display:flex; align-items:center; gap:4px;">
          <select id="phase_picker_select" style="flex:1; font-size:12px; height:28px; border:1px solid #ced4da; border-radius:4px; padding:0 4px;">${optionsHtml}</select>
          <button type="button" onclick="event.stopPropagation(); window.__openNewFaseModal();"
            style="height:28px; width:28px; background:#17a2b8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:16px; line-height:1; flex-shrink:0;"
            title="Nueva Fase">+</button>
        </div>`;
      },
      set_value: function (node: any, value: any, task: any, section: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        if (select && value) select.value = value;
      },
      get_value: function (node: any, task: any, section: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        return select ? select.value : '';
      },
      focus: function (node: any) {
        const select = node.querySelector('#phase_picker_select') as HTMLSelectElement;
        if (select) select.focus();
      }
    };

    const lbl = (t: string) => `<span style="font-size:10px;font-weight:600;">${t}</span>`;

    gantt.config.columns = [
      { name: "add", label: "", width: 44 },
      {
        name: "apu_btn", label: lbl("APU"), width: 48,
        template: (task) => {
          if (!task['idEntry']) return '';
          return `<button onclick="event.stopPropagation(); window.__openApuModal(${task['idEntry']}, '${(task.text || '').replace(/'/g, "\\'")}')"
            style="font-size:10px; padding:1px 5px; background:#0d6efd; color:#fff; border:none; border-radius:3px; cursor:pointer;" title="Análisis de Precios Unitarios">$ APU</button>`;
        }
      },
      {
        name: "dist_btn", label: lbl("Dist."), width: 46,
        template: (task) => {
          if (!task['idEntry']) return '';
          const qty = Number(task['quantity'] ?? 0);
          return `<button onclick="event.stopPropagation(); window.__openDistModal(${task['idEntry']}, '${(task.text || '').replace(/'/g, "\\'")}', ${qty})"
            style="font-size:10px; padding:1px 4px; background:#198754; color:#fff; border:none; border-radius:3px; cursor:pointer;" title="Distribución Mensual">&#128197;</button>`;
        }
      },
      { name: "activity",   label: lbl("Actividad"),       width: 60,  template: (task) => `<span style="font-size:11px;">${task['activity'] || ''}</span>` },
      { name: "text",       label: lbl("Nombre de la tarea"), tree: true, width: 400, template: (task) => `<span style="font-size:11px;">${task.text}</span>` },
      {
        name: "quantity", label: lbl("Cantidad"), align: "right", width: 75, template: (task) => {
          return `<span style="font-size:11px;">${task['quantity'] ?? 1}</span>`;
        }
      },
      {
        name: "costMX", label: lbl("Costo Mxn"), align: "right", width: 100, template: (task) => {
          const cost = task['costMX'] ? `$${task['costMX'].toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$0.00';
          return `<span style="font-size:11px;">${cost}</span>`;
        }
      },
      {
        name: "total", label: lbl("Total"), align: "right", width: 110, template: (task) => {
          const val = task['total'] != null
            ? Number(task['total'])
            : (Number(task['quantity'] ?? 0) * Number(task['costMX'] ?? 0));
          return `<span style="font-size:11px;">$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
        }
      },
      {
        name: "ponderado", label: lbl("Ponderado"), align: "right", width: 80, template: (task) => {
          const val = task['ponderado'];
          return `<span style="font-size:11px;">${val != null ? Number(val).toFixed(3) : '—'}</span>`;
        }
      },
      { name: "start_date", label: lbl("Inicio"),    align: "center", width: 90,  template: (task) => `<span style="font-size:11px;">${task.start_date ? task.start_date.toLocaleDateString('es-ES') : ''}</span>` },
      { name: "end_date",   label: lbl("Fin"),       align: "center", width: 90,  template: (task) => `<span style="font-size:11px;">${task.end_date   ? task.end_date.toLocaleDateString('es-ES')   : ''}</span>` },
      {
        name: "progress", label: lbl("Progreso"), align: "center", width: 70, template: (task) => {
          return `<span style="font-size:11px;">${Math.round(task.progress * 100)}%</span>`;
        }
      }
    ];

    // Definir los campos personalizados
    // Configuración de las etiquetas para el lightbox
    gantt.locale.labels['section_progress'] = "Progreso";
    gantt.locale.labels['section_time'] = "Fechas";
    gantt.locale.labels['section_responsable'] = "Responsable";
    gantt.locale.labels['section_priority'] = "Prioridad";
    gantt.locale.labels['section_color'] = "Color";
    gantt.locale.labels['section_qty_ponderado'] = "Cantidad / Ponderado";
    gantt.locale.labels['section_route_type'] = "Ruta Crítica / Nivel";
    gantt.locale.labels['section_measure_phase']  = 'Unidad / Fase';
    gantt.locale.labels['section_activity_color'] = 'Actividad / Color';
    gantt.locale.labels['section_costs'] = 'MXN $ / Total / USD $';
    gantt.locale.labels['section_type'] = 'Tipo';
    gantt.locale.labels['section_ponderado'] = 'Ponderado (0-1)';

    gantt.plugins({
      export_api: true,
      multiselect: true
    } as any);

    // Definir escalas de zoom disponibles
    const zoomConfig = {
      levels: [
        {
          name: "day",
          scale_height: 60,
          min_column_width: 30,
          scales: [
            { unit: "day", step: 1, format: "%d %M" },
            { unit: "hour", step: 1, format: "%H" }
          ]
        },
        {
          name: "week", 
          scale_height: 60,
          min_column_width: 50,
          scales: [
            { unit: "week", step: 1, format: function (date) {
              var dateToStr = gantt.date.date_to_str("%d %M");
              var endDate = gantt.date.add(gantt.date.add(date, 1, "week"), -1, "day");
              return dateToStr(date) + " - " + dateToStr(endDate);
            }},
            { unit: "day", step: 1, format: "%j" }
          ]
        },
        {
          name: "month",
          scale_height: 60,
          min_column_width: 120,
          scales: [
            { unit: "year", step: 1, format: "%Y" },
            { unit: "month", step: 1, format: "%M" }
          ]
        },
        {
          name: "quarter",
          height: 60,
          min_column_width: 90,
          scales: [
            { unit: "year", step: 1, format: "%Y" },
            {
              unit: "quarter", step: 1, format: function (date) {
                var dateToStr = gantt.date.date_to_str("%M");
                var endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                return dateToStr(date) + " - " + dateToStr(endDate);
              }
            }
          ]
        },
        {
          name: "year",
          scale_height: 50,
          min_column_width: 30,
          scales: [
            { unit: "year", step: 1, format: "%Y" }
          ]
        }
      ]
    };

    gantt.ext.zoom.init(zoomConfig as any);
    gantt.ext.zoom.setLevel("month"); // Establecer vista mensual por defecto

    gantt.config.lightbox.sections = [
      { name: "description", height: 150, map_to: "text", type: "textarea", focus: true },
      { name: "activity_color", height: 47, map_to: "activity", type: "activity_color_row" },
      { name: "qty_ponderado", height: 47, map_to: "quantity", type: "qty_ponderado_row" },
      { name: "costs", height: 47, map_to: "costMX", type: "costs_row" },
      { name: "time", type: "time", map_to: "auto" },
      { name: "measure_phase", height: 47, map_to: "measure", type: "measure_phase_row", measureOptions: this.measures, phaseOptions: this.phases } as any,
      { name: "route_type", height: 47, map_to: "criticRoute", type: "route_type_row" }
    ];
  }

  // Funcion para mostrar los datos del gantt
  mostrarDatos() {
    const data = gantt.serialize().data;
    const links = gantt.serialize().links;

    this.datosGantt = {
      data: data,
      links: links
    };
  }

  // Funcion para transformar los datos del gantt a los que entiende la API
  // Límites según modelo C#: criticRoute varchar(2), activity varchar(20),
  // especification varchar(20), measure varchar(10), phase varchar(30), color varchar(10)

  // Formatea una fecha como string para gantt.parse() usando date_format "%Y-%m-%d %H:%i"
  // dhtmlx-gantt también acepta Date objects, pero strings son más robustos
  private formatGanttDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00`;
  }

  // Convierte cualquier valor de fecha (Date, string, number) a ISO string o null
  private toIsoString(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
    if (typeof val === 'string') {
      // Intenta parsear string de gantt ("%Y-%m-%d %H:%i") y también ISO
      const d = new Date(val.replace(' ', 'T'));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof val === 'number' && !isNaN(val)) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }

  // Para campos nullable en el backend (string?)
  private trunc(val: any, max: number): string | null {
    if (val == null || val === '') return null;
    return String(val).substring(0, max);
  }

  // Para campos NOT NULL en el backend (string sin ?)
  private truncReq(val: any, max: number, def = ''): string {
    if (val == null || val === '') return def;
    return String(val).substring(0, max);
  }

  transformTaskForSave(task: any): any {
    // Leer siempre en el momento de guardar para evitar problemas de timing
    const vigente = this.signalsService.getConventionVigente()();

    // idContract: señal del sidebar → tarea existente (DB) → fallback datos cargados → 0
    const idContract = this.idContract || task['idContract'] || this.idContractFallback || 0;

    // idConvention: vigente del sidebar → señal local → tarea existente (DB) → fallback datos cargados
    const idConvention = vigente?.id
      ?? this.idConvention
      ?? task['idConvention']
      ?? this.idConventionFallback
      ?? null;

    // Fechas: manejar tanto Date objects como strings de gantt ("%Y-%m-%d %H:%i")
    const startDate = this.toIsoString(task.start_date);
    const endDate   = this.toIsoString(task.end_date) ?? startDate;

    console.log('WP-SAVE', {
      text: task.text,
      start_date_raw: task.start_date,
      end_date_raw:   task.end_date,
      startDate, endDate,
      idConvention, vigente,
      idTask: Number(task.id)
    });

    return {
      id: task.idEntry,
      idSourceWorkprogram: task['idSourceWorkprogram'] ?? null,
      // Number() garantiza que idTask sea número en JSON (gantt puede retornar task.id como string)
      idTask: Number(task.id) || 0,
      text: task.text || '',                                   // NOT NULL en C#
      idContract,                                              // int NOT NULL
      idProject: this.typeWorkProgram === 'Contract' ? 0 : (this.idProject ?? 0), // int NOT NULL
      idConvention,                                            // convenio vigente
      startDate,
      endDate,
      progress: task.progress ?? 0,
      parent: task.parent ?? 0,
      color: this.trunc(task.color, 10),                       // nullable
      measure: this.trunc(task.measure, 10),                   // nullable
      criticRoute: this.truncReq(task.criticRoute, 2, 'No'),   // NOT NULL en C#
      activity: this.truncReq(task.activity, 20, ''),          // NOT NULL en C#
      type: this.typeWorkProgram,                              // alcance explícito
      typeActivity: this.truncReq(task.typeActivity, 10, 'Activity'),
      especification: this.trunc(task.especification, 20),     // nullable
      distribution: task.distribution ?? 0,
      costMX: task.costMX ?? 0,
      costDLL: task.costDLL ?? 0,
      quantity: task.quantity ?? 0,
      ponderado: this.safePonderado(task.ponderado),             // nullable decimal(8,3) — suma de hijos
      predecesor: task.predecesor ?? 0,
      phase: this.trunc(task.phase, 30),                       // nullable
      active: 1,
      sortorder: task['sortorder'] ?? 0
    };
  }

  // Funcion para cargar los datos de la API
  loadDataFromAPI() {
    const id = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;

    if (!id || !this.idConvention) {
      this.taskCount = 0;
      this.selectedProgramTask = null;
      this.selectedTaskResources = [];
      this.selectedTaskCrews = [];
      gantt.clearAll();
      return;
    }

    // El convenio seleccionado delimita tanto el programa contractual como el del proyecto.
    const byConvention$ = this.typeWorkProgram === 'Project' && this.idConvention
      ? this.workprogramsService.getByConvention(this.idConvention, this.idProject ?? undefined)
      : null;

    const byProject$ = this.workprogramsService.getWorkPrograms(id, this.typeWorkProgram).pipe(
      map(rows => this.typeWorkProgram === 'Contract'
        ? (rows ?? []).filter(row => Number(row.idConvention || 0) === Number(this.idConvention))
        : (rows ?? []))
    );

    const source$ = byConvention$
      ? byConvention$.pipe(
          // Si la consulta por convenio devuelve vacío, intentar sin filtro de convenio
          switchMap(data => data && data.length > 0 ? of(data) : byProject$)
        )
      : byProject$;

    source$.pipe(
      map(response => {
        if (response && response.length > 0) {
          this.taskCount = response.length;
          // Capturar contract y convention de los datos cargados como fallback para el save
          const first = response[0];
          if (first.idContract) this.idContractFallback = first.idContract;
          if (first.idConvention) this.idConventionFallback = first.idConvention;
          const transformedData = this.transformData(response);
          gantt.clearAll(); // Limpiar todos los datos existentes
          gantt.parse(transformedData);
          // Inicializa sortorder en orden árbol visual (necesario si todos vienen en 0 desde BD)
          setTimeout(() => this.recalcSortorder(), 0);
          return transformedData;
        } else {
          this.taskCount = 0;
          gantt.clearAll(); // Limpiar todos los datos si no hay respuesta
          return { data: [] };
        }
      }),
      catchError(error => {
        console.error('Error al cargar los datos:', error);
        gantt.clearAll(); // Limpiar todos los datos en caso de error
        return of({ data: [] });
      })
    ).subscribe();
  }

  // Funcion para transformar los datos de la API a los que entiende el gantt
  transformData(apiData: any[]): { data: any[] } {
    const transformedData = apiData.map(item => {
      // Convertir fechas de la API a strings de gantt (date_format "%Y-%m-%d %H:%i")
      // para garantizar parsing correcto en dhtmlx-gantt
      const sdObj = item.startDate ? new Date(item.startDate) : new Date();
      const edObj = item.endDate   ? new Date(item.endDate)   : new Date(sdObj.getTime() + 86400000); // +1 día mínimo si no hay fecha fin
      return {
        // Campos primordiales
        // Usar DB PK (item.id) como fallback cuando idTask=0 (filas importadas sin idtask correcto)
        id: item.idTask || item.id,
        idEntry: item.id,
        text: item.text,
        // Strings en date_format para parsing correcto en dhtmlx-gantt
        start_date: this.formatGanttDate(sdObj),
        end_date:   this.formatGanttDate(edObj),
        progress: item.progress,
        parent: item.parent,
        color: item.color,
        // Campos personalizados
        criticRoute: item.criticRoute,
        activity: item.activity,
        typeActivity: item.typeActivity,
        especification: item.especification,
        distribution: item.distribution,
        costMX: item.costMX,
        costDLL: item.costDLL,
        quantity: item.quantity,
        predecesor: item.predecesor,
        measure: item.measure,
        phase: item.phase,
        // Scope: contrato y convenio (necesarios para el save)
        idContract: item.idContract,
        idSourceWorkprogram: item.idSourceWorkprogram ?? null,
        idConvention: item.idConvention,
        type: item.type,
        ponderado: item.ponderado,
        total: item.total,
        active: item.active,
        sortorder: item.sortorder ?? 0
      };
    });

    return { data: transformedData };
  }

  // Funcion para guardar los cambios en la API
  save() {
    if (this.typeWorkProgram === 'Contract' && !this.idContract) {
      alerts.basicAlert('Selecciona un contrato', 'Debes seleccionar un contrato desde el sidebar antes de guardar.', 'warning');
      return;
    }
    if (this.typeWorkProgram === 'Project' && !this.idProject) {
      alerts.basicAlert('Selecciona un proyecto', 'Debes seleccionar un proyecto desde el sidebar antes de guardar.', 'warning');
      return;
    }

    const vigente = this.signalsService.getConventionVigente()();
    if (!vigente?.id) {
      alerts.basicAlert('Selecciona un convenio', 'Debes seleccionar un convenio en el sidebar antes de guardar el programa.', 'warning');
      return;
    }

    if (this.isSaving) {
      return;
    }

    const tasks = gantt.getTaskByTime();
    const requests: Observable<any>[] = [];
    const createTasks: any[] = [];
    const updateRequestsCountRef = { count: 0 };

    tasks.forEach(task => {
      if (!this.deletedTasks.has(task['idEntry'])) {
        const transformedTask = this.transformTaskForSave(task);

        if (task['idEntry'] === undefined) {
          // Nueva tarea
          createTasks.push(task);
          requests.push(this.workprogramsService.addWorkProgram(transformedTask));

        } else {
          // Tarea existente
          updateRequestsCountRef.count++;
          requests.push(this.workprogramsService.updateWorkProgram(task['idEntry'], transformedTask));
        }
      }
    });

    // Agregar solicitudes DELETE para tareas eliminadas
    this.deletedTasks.forEach(idEntry => {
      requests.push(this.workprogramsService.deleteWorkProgram(idEntry));
    });

    if (requests.length === 0) {
      this.notSavedChanges = false;
      return;
    }

    this.isSaving = true;

    forkJoin(requests).pipe(
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: (results) => {
        alerts.basicAlert('Editar', 'Todas las operaciones completadas con éxito', 'success');
        this.trackingService.addLog(
          this.trackingService.getCompany(),
          `Work Program guardado: ${createTasks.length} nuevas, ${updateRequestsCountRef.count} actualizadas, ${this.deletedTasks.size} eliminadas — Convenio: ${this.conventionName || 'Sin convenio'} — ${this.projectName()}`,
          'WorkPrograms',
          this.trackingService.getEmail()
        );
        // Actualizar idEntry para nuevas tareas usando offset correcto
        const createStartIndex = updateRequestsCountRef.count;
        createTasks.forEach((task, index) => {
          const createResult = results[createStartIndex + index];
          const createdId = typeof createResult === 'number'
            ? createResult
            : createResult?.id ?? createResult?.Id ?? createResult?.data?.id;

          if (createdId !== undefined && createdId !== null) {
            task['idEntry'] = createdId;
          }
        });

        // Limpiar la lista de tareas eliminadas
        this.deletedTasks.clear();
        this.loadDataFromAPI();
        // Refrescar el gantt
        gantt.render();
        this.notSavedChanges = false;
      },
      error: (error) => {
        const detail = this.apiErrorMessage(error, 'No fue posible guardar el programa.');
        console.error('Error al guardar los cambios:', error);
        console.error('Detalle HTTP:', error?.status, detail);
        alerts.basicAlert('Error', `Error al guardar (${error?.status ?? '?'}): ${detail}`, 'error');
      }
    }
    );
  }

  // Funcion para configurar los eventos de las tareas
  configureTaskEvents() {
    if (!this.taskSelectionEventId) {
      this.taskSelectionEventId = gantt.attachEvent('onTaskSelected', id => {
        const task = gantt.getTask(id);
        this.ngZone.run(() => this.loadSelectedTaskDetails(task));
        return true;
      });
    }

    gantt.attachEvent("onBeforeTaskDelete", (id, task) => {
      this.markTaskAndChildrenForDeletion(task);
      return true; // Permitir la eliminación
    });

    gantt.attachEvent("onAfterTaskDelete", (id, task) => {
      this.updateParentTaskDates(task.parent);
      this.updateParentPonderado(task.parent);
      this.updateParentTotal(task.parent);
    });

    // Fechas por defecto para tareas nuevas: inicio hoy, fin hoy +1 día
    gantt.attachEvent("onBeforeLightbox", (id) => {
      const task = gantt.getTask(id);
      if (!task['idEntry']) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        task.start_date = today;
        task.end_date = nextYear;
        task.duration = gantt.calculateDuration(today, nextYear);
        gantt.updateTask(id);
      }
      requestAnimationFrame(() => {
        const box = document.querySelector('.gantt_cal_light') as HTMLElement;
        if (box) {
          box.style.setProperty('width', '700px', 'important');
          box.style.setProperty('min-width', '700px', 'important');
        }
      });
      return true;
    });
  }

  // Funcion para marcar las tareas y sus hijos para eliminacion
  markTaskAndChildrenForDeletion(task: any) {
    if (task.idEntry) {
      this.deletedTasks.add(task.idEntry);
    }

    // Obtener todas las tareas hijas
    const children = gantt.getChildren(task.id);

    // Recursivamente marcar para eliminación todas las tareas hijas
    children.forEach(childId => {
      const childTask = gantt.getTask(childId);
      this.markTaskAndChildrenForDeletion(childTask);
    });
  }

  // Funcion para exportar a PDF
  exportToPDF() {
    gantt.exportToPDF({
      name: "workprogram.pdf",
      locale: "es"
    });
  }

  // Funcion para exportar a Excel
  exportToXLS() {
    gantt.exportToExcel({
      name: "workprogram.xlsx",
      locale: "es"
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUNTO 7 — Integración con MS Project y Primavera P6
  // ══════════════════════════════════════════════════════════════════════════

  // ── EXPORT MS Project XML ─────────────────────────────────────────────────
  exportToMSProject(): void {
    const tasks = gantt.getTaskByTime();
    if (!tasks.length) {
      alerts.basicAlert('Sin tareas', 'No hay tareas en el programa de trabajo.', 'warning');
      return;
    }

    const toISO = (d: Date | string) => {
      const dt = d instanceof Date ? d : new Date(d);
      return isNaN(dt.getTime()) ? '' : dt.toISOString().replace(/\.\d{3}Z$/, '');
    };

    const taskXML = tasks.map((t, i) => {
      const uid    = i + 1;
      const start  = toISO(t.start_date);
      const finish = toISO(t.end_date);
      const isSum  = gantt.hasChild(t.id) ? 1 : 0;
      const pct    = Math.round(Number(t.progress ?? 0) * 100);
      const wbs    = this.escapeXml(t['activity'] || String(uid));
      const level  = t['$level'] ?? 1;
      const cost   = Number(t['costMX'] ?? 0);
      return `    <Task>
      <UID>${uid}</UID><ID>${uid}</ID>
      <Name>${this.escapeXml(t.text || '')}</Name>
      <WBS>${wbs}</WBS>
      <OutlineLevel>${level}</OutlineLevel>
      <Start>${start}</Start>
      <Finish>${finish}</Finish>
      <PercentComplete>${pct}</PercentComplete>
      <Summary>${isSum}</Summary>
      <Milestone>0</Milestone>
      <Type>0</Type>
      <Priority>500</Priority>
      <FixedCost>${cost}</FixedCost>
    </Task>`;
    }).join('\n');

    const name    = this.projectName() || 'Programa de Trabajo';
    const starts  = tasks.map(t => new Date(t.start_date).getTime()).filter(n => !isNaN(n));
    const ends    = tasks.map(t => new Date(t.end_date).getTime()).filter(n => !isNaN(n));
    const minS    = starts.length ? toISO(new Date(Math.min(...starts))) : '';
    const maxE    = ends.length   ? toISO(new Date(Math.max(...ends)))   : '';

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${this.escapeXml(name)}</Name>
  <StartDate>${minS}</StartDate>
  <FinishDate>${maxE}</FinishDate>
  <WeekStartDay>0</WeekStartDay>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DefaultTaskType>0</DefaultTaskType>
  <Tasks>
${taskXML}
  </Tasks>
  <Resources/>
  <Assignments/>
</Project>`;

    this.downloadFile(xml, `${name}.xml`, 'application/xml');
    alerts.basicAlert('Exportado', `${tasks.length} tarea(s) exportadas a MS Project XML.`, 'success');
  }

  // ── EXPORT Primavera P6 XER ───────────────────────────────────────────────
  exportToPrimaveraXER(): void {
    const tasks = gantt.getTaskByTime();
    if (!tasks.length) {
      alerts.basicAlert('Sin tareas', 'No hay tareas en el programa de trabajo.', 'warning');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const name  = (this.projectName() || 'PROYECTO').substring(0, 20).replace(/\s+/g, '_');
    const projId = 100;

    const toXer = (d: Date | string) => {
      const dt = d instanceof Date ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      const y  = dt.getFullYear();
      const m  = String(dt.getMonth() + 1).padStart(2, '0');
      const dy = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dy} 00:00`;
    };

    const starts = tasks.map(t => new Date(t.start_date).getTime()).filter(n => !isNaN(n));
    const ends   = tasks.map(t => new Date(t.end_date).getTime()).filter(n => !isNaN(n));
    const pStart = starts.length ? toXer(new Date(Math.min(...starts))) : `${today} 00:00`;
    const pEnd   = ends.length   ? toXer(new Date(Math.max(...ends)))   : `${today} 00:00`;

    let xer = `ERMHDR\t19.12\t${today}\tProject\tbi2admin\tbi2admin\t\n\n`;

    xer += `%T\tPROJECT\n`;
    xer += `%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date\tstatus_code\n`;
    xer += `%R\t${projId}\t${name}\t${pStart}\t${pEnd}\tTK_Active\n\n`;

    xer += `%T\tTASK\n`;
    xer += `%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\tphys_complete_pct\ttask_type\tstatus_code\tcost_qty_link_flag\tact_work_qty\tremain_work_qty\n`;

    tasks.forEach((t, i) => {
      const tid    = 1000 + i;
      const code   = (t['activity'] || `A${String(i + 1).padStart(4, '0')}`).replace(/\t/g, '');
      const tname  = (t.text || '').replace(/\t/g, ' ').substring(0, 120);
      const start  = toXer(t.start_date);
      const end    = toXer(t.end_date);
      const pct    = Math.round(Number(t.progress ?? 0) * 100);
      const type   = gantt.hasChild(t.id) ? 'TT_WBS' : 'TT_Task';
      const status = pct >= 100 ? 'TK_Complete' : pct > 0 ? 'TK_Active' : 'TK_NotStart';
      const cost   = Number(t['costMX'] ?? 0);
      xer += `%R\t${tid}\t${projId}\t${code}\t${tname}\t${start}\t${end}\t${pct}\t${type}\t${status}\tY\t${cost}\t${cost}\n`;
    });

    xer += `\n%E\n`;
    this.downloadFile(xer, `${name}.xer`, 'text/plain');
    alerts.basicAlert('Exportado', `${tasks.length} tarea(s) exportadas a Primavera P6 XER.`, 'success');
  }

  // ── IMPORT MS Project XML ─────────────────────────────────────────────────
  private async parseMSProjectXML(file: File): Promise<ImportedTaskDraft[]> {
    const text = await file.text();
    const doc  = new DOMParser().parseFromString(text, 'application/xml');
    const taskNodes = Array.from(doc.querySelectorAll('Tasks > Task'));
    const tasks: ImportedTaskDraft[] = [];

    taskNodes.forEach((node, i) => {
      const get = (tag: string) => node.querySelector(tag)?.textContent?.trim() || '';
      const uid = get('UID');
      if (uid === '0') return;                         // fila resumen del proyecto
      const name  = get('Name');
      if (!name) return;
      const wbs   = get('WBS') || get('OutlineNumber') || String(i + 1);
      const level = Number(get('OutlineLevel')) || 1;
      const start = this.normalizeDateString(get('Start').split('T')[0]);
      const end   = this.normalizeDateString(get('Finish').split('T')[0]);
      const errors: string[] = [];
      if (!start) errors.push('Fecha de inicio inválida');
      if (!end)   errors.push('Fecha de término inválida');

      tasks.push({
        sourceFile:   file.name,
        sourceRow:    i + 1,
        wbs,
        level,
        description:  name,
        quantity:     null,
        cost:         null,
        salePrice:    null,
        startDate:    start,
        endDate:      end,
        predecessors: '',
        successors:   '',
        resources:    '',
        warnings:     [],
        errors,
      });
    });

    return tasks;
  }

  // ── IMPORT Primavera P6 XER ───────────────────────────────────────────────
  private async parsePrimaveraXER(file: File): Promise<ImportedTaskDraft[]> {
    const text    = await file.text();
    const lines   = text.split('\n').map(l => l.trimEnd());
    const tasks:  ImportedTaskDraft[] = [];
    let inTask    = false;
    let headers:  string[] = [];

    for (const line of lines) {
      if (line.startsWith('%T\t')) {
        inTask  = line.substring(3).trim() === 'TASK';
        headers = [];
        continue;
      }
      if (line.startsWith('%F\t') && inTask) {
        headers = line.substring(3).split('\t');
        continue;
      }
      if (line.startsWith('%R\t') && inTask && headers.length) {
        const vals = line.substring(3).split('\t');
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ''; });

        const type = row['task_type'] || '';
        if (type === 'TT_WBS' || type === 'TT_Mile') continue;  // saltar WBS summary y milestones

        const code  = row['task_code'] || '';
        const name  = row['task_name'] || '';
        const start = this.normalizeDateString((row['target_start_date'] || row['act_start_date'] || '').split(' ')[0]);
        const end   = this.normalizeDateString((row['target_end_date']   || row['reend_date']     || row['act_end_date'] || '').split(' ')[0]);
        if (!name || !start || !end) continue;

        const level = (code.match(/\./g) || []).length + 1;

        tasks.push({
          sourceFile:   file.name,
          sourceRow:    tasks.length + 1,
          wbs:          code,
          level,
          description:  name,
          quantity:     null,
          cost:         null,
          salePrice:    null,
          startDate:    start,
          endDate:      end,
          predecessors: '',
          successors:   '',
          resources:    '',
          warnings:     [],
          errors:       [],
        });
      }
      if (line.startsWith('%E')) inTask = false;
    }
    return tasks;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // Timer para agrupar todos los renders en uno solo tras onAfterTaskUpdate
  private _renderTimer: any = null;

  scheduleParentUpdate(parentId: string | number) {
    // Actualiza datos en memoria sin tocar gantt API (previene snap-back)
    this.updateParentTaskDates(parentId);
    this.updateParentPonderado(parentId);
    this.updateParentTotal(parentId);
    // Un solo gantt.render() al final para refrescar la vista con el orden correcto
    clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => gantt.render(), 50);
  }

  updateParentTaskDates(parentId: string | number) {
    if (parentId == gantt.config.root_id) return;
    const children = gantt.getChildren(parentId);
    if (children.length === 0) return;

    let minStartDate = new Date(8640000000000000);
    let maxEndDate   = new Date(-8640000000000000);
    children.forEach(childId => {
      const c = gantt.getTask(childId);
      if (c.start_date < minStartDate) minStartDate = new Date(c.start_date);
      if (c.end_date   > maxEndDate)   maxEndDate   = new Date(c.end_date);
    });

    const parentTask = gantt.getTask(parentId);
    parentTask.start_date = minStartDate;
    parentTask.end_date   = maxEndDate;
    // Sin gantt.updateTask / refreshTask — solo memoria
    this.updateParentTaskDates(parentTask.parent);
  }

  // Recalcula sortorder para todos los tasks en orden árbol (depth-first)
  // Se llama después de cualquier drag-reorder para persistir el nuevo orden
  private recalcSortorder() {
    let order = 0;
    gantt.eachTask(task => {
      task['sortorder'] = order++;
    });
  }

  // Protege ponderado contra overflow de decimal(8,3) antes de enviar al backend
  private safePonderado(val: any): number | null {
    if (val == null) return null;
    const p = Number(val);
    if (isNaN(p)) return null;
    return Math.round(Math.min(p, 99999.999) * 1000) / 1000;
  }

  // Ponderado padre = suma de ponderados de sus hijos (recursivo hacia arriba)
  updateParentPonderado(parentId: string | number) {
    if (parentId == gantt.config.root_id) return;
    const children = gantt.getChildren(parentId);
    if (children.length === 0) return; // hoja: el usuario lo ingresa manualmente

    let sum = 0;
    children.forEach(childId => {
      const child = gantt.getTask(childId);
      sum += Number(child['ponderado'] ?? 0);
    });

    const parentTask = gantt.getTask(parentId);
    parentTask['ponderado'] = Math.round(sum * 1000) / 1000;
    // Sin gantt.updateTask / refreshTask — solo memoria
    this.updateParentPonderado(parentTask.parent);
  }

  // Total padre = suma de totales de sus hijos (recursivo hacia arriba)
  // Hoja: total = quantity * costMX (calculado en DB); padre: suma de hijos
  updateParentTotal(parentId: string | number) {
    if (parentId == gantt.config.root_id) return;
    const children = gantt.getChildren(parentId);
    if (children.length === 0) return;

    let sum = 0;
    children.forEach(childId => {
      const child = gantt.getTask(childId);
      const childTotal = child['total'] ?? ((child['quantity'] ?? 0) * (child['costMX'] ?? 0));
      sum += Number(childTotal);
    });

    const parentTask = gantt.getTask(parentId);
    parentTask['total'] = Math.round(sum * 100) / 100;
    // Sin gantt.updateTask / refreshTask — solo memoria
    this.updateParentTotal(parentTask.parent);
  }

  // ─── Calcula ponderado de cada hoja con las 3 modalidades ─────────────────
  // Modalidad se selecciona en pantalla con this.pondModalidad
  // Procesa en lotes para no trabar el hilo principal y mostrar barra de progreso
  async calcularPonderado() {
    if (this.isCalculating) return;

    const allTasks = gantt.getTaskByTime();
    if (!allTasks || allTasks.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas en el programa de trabajo', 'warning');
      return;
    }

    // Solo hojas (sin hijos)
    const leafTasks = allTasks.filter(t => gantt.getChildren(t.id).length === 0);
    if (leafTasks.length === 0) {
      alerts.basicAlert('Aviso', 'No se encontraron conceptos hoja', 'warning');
      return;
    }

    // ── Función métrica según modalidad ─────────────────────────────────────
    let getMetric: (t: any) => number;
    let modalidadLabel: string;
    let denominadorLabel: string;

    if (this.pondModalidad === 'tiempo') {
      // Por Tiempo: duración en días calendario (endDate - startDate)
      getMetric = (t) => {
        const d1 = t.start_date instanceof Date ? t.start_date : new Date(t.start_date);
        const d2 = t.end_date   instanceof Date ? t.end_date   : new Date(t.end_date);
        return Math.max(1, Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      };
      modalidadLabel   = 'Tiempo';
      denominadorLabel = 'días totales';

    } else if (this.pondModalidad === 'volumen') {
      // Por Volumen: cantidad (quantity) de cada hoja
      getMetric = (t) => Math.abs(Number(t['quantity'] ?? 0));
      modalidadLabel   = 'Volumen';
      denominadorLabel = 'unidades totales';

    } else {
      // Por Precio (default): total = quantity × costMX
      getMetric = (t) => {
        const tot = t['total'] != null
          ? Number(t['total'])
          : (Number(t['quantity'] ?? 0) * Number(t['costMX'] ?? 0));
        return Math.max(0, tot);
      };
      modalidadLabel   = 'Precio';
      denominadorLabel = 'total MXN';
    }

    // ── Gran total = suma de métricas de todas las hojas ────────────────────
    const grandTotal = leafTasks.reduce((sum, t) => sum + getMetric(t), 0);

    if (grandTotal === 0) {
      alerts.basicAlert(
        'Aviso',
        `La suma de ${denominadorLabel} es 0. Verifica que las tareas tengan datos de ${modalidadLabel.toLowerCase()} cargados.`,
        'warning'
      );
      return;
    }

    // ── Confirmación ────────────────────────────────────────────────────────
    const unidad = this.pondModalidad === 'precio' ? `$${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : grandTotal.toFixed(2);
    const confirm = await alerts.confirmAlert(
      `¿Calcular ponderado por ${modalidadLabel}?`,
      `Se recalculará el ponderado de ${leafTasks.length} concepto(s) usando la modalidad "${modalidadLabel}" (${denominadorLabel}: ${unidad}). ¿Está seguro?`,
      'question',
      'Sí, calcular'
    );
    if (!confirm.isConfirmed) return;

    // ── Inicio de progreso ──────────────────────────────────────────────────
    this.isCalculating = true;
    this.calcProgress = 0;
    const total = leafTasks.length;
    const CHUNK = 10; // tareas por lote

    // Pre-calcula los ponderados con 3 decimales
    const ponderados: number[] = leafTasks.map(t =>
      Math.round((getMetric(t) / grandTotal) * 100 * 1000) / 1000
    );
    // El último absorbe el residuo para que la suma sea exactamente 100.000
    const sumaParcialesRaw = ponderados.slice(0, -1).reduce((a, b) => a + b, 0);
    ponderados[ponderados.length - 1] = Math.round((100 - sumaParcialesRaw) * 1000) / 1000;

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = leafTasks.slice(i, i + CHUNK);
      chunk.forEach((t, idx) => {
        t['ponderado'] = ponderados[i + idx];
        gantt.updateTask(t.id);
        this.updateParentPonderado(t.parent);
      });
      this.calcProgress = Math.round(((i + chunk.length) / total) * 100);
      // Cede el hilo al navegador para actualizar la UI
      await new Promise(r => setTimeout(r, 0));
    }

    // ── Guardar ponderados en BD: Fase 1 — Hojas (PATCH solo ponderado) ──
    let savedLeaves = 0;
    let savedParents = 0;
    try {
      for (let i = 0; i < leafTasks.length; i++) {
        const t = leafTasks[i];
        if (t['idEntry']) {
          await lastValueFrom(
            this.workprogramsService.patchWorkProgramPonderado(t['idEntry'], ponderados[i])
          );
          savedLeaves++;
        }
        this.calcProgress = Math.round(((i + 1) / leafTasks.length) * 50); // 0-50%
      }

      // ── Fase 2 — Agrupadores (suma recursiva ya está en memoria de Gantt) ───
      const allTasksAfter = gantt.getTaskByTime();
      const parentTasks = allTasksAfter.filter(
        t => gantt.getChildren(t.id).length > 0 && t['idEntry'] && t['ponderado'] != null
      );
      for (let i = 0; i < parentTasks.length; i++) {
        const t = parentTasks[i];
        await lastValueFrom(
          this.workprogramsService.patchWorkProgramPonderado(
            t['idEntry'], this.safePonderado(t['ponderado'])
          )
        );
        savedParents++;
        this.calcProgress = 50 + Math.round(((i + 1) / parentTasks.length) * 50); // 50-100%
      }
    } catch {
      alerts.basicAlert('Error', 'Error al guardar ponderados en la BD.', 'error');
    }

    this.isCalculating = false;
    this.calcProgress = 0;
    this.notSavedChanges = true;
    alerts.basicAlert(
      `✅ Ponderado por ${modalidadLabel} calculado y guardado`,
      `${denominadorLabel.charAt(0).toUpperCase() + denominadorLabel.slice(1)}: ${unidad} — ${savedLeaves} hoja(s) + ${savedParents} agrupador(es) actualizados en la BD.`,
      'success'
    );
  }

  async getMeasures() {
    try {
      const measures = await this.catalogsService.getUnits(this.idcompany).toPromise();
      this.measures = measures.map(measure => ({
        key: measure.description.toString(),
        label: measure.description.toString()
      }));
    } catch (error) {
      // silencioso
    }
  }

  async getPhases() {
    try {
      const phases = await this.catalogsService.getPhases(this.idcompany).toPromise();
      this.phases = phases.map(phase => ({
        key: phase.description.toString(),
        label: phase.description.toString()
      }));
    } catch (error) {
      // silencioso
    }
  }

  // New method to indent selected tasks
  indentSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para aplicar sangría', 'info');
      return;
    }

    selectedIds.forEach(id => {
      const task = gantt.getTask(id);
      const prevSibling = gantt.getPrevSibling(id);
      if (prevSibling) {
        gantt.moveTask(id, gantt.getChildren(prevSibling).length, prevSibling);
        this.updateParentTaskDates(prevSibling);
      }
    });

    gantt.render();
  }

  // New method to outdent selected tasks
  outdentSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para quitar sangría', 'info');
      return;
    }

    selectedIds.forEach(id => {
      const task = gantt.getTask(id);
      if (task.parent !== gantt.config.root_id) {
        const parentTask = gantt.getTask(task.parent);
        const parentOfParent = parentTask.parent;
        const index = gantt.getTaskIndex(parentTask.id) + 1;
        gantt.moveTask(id, index, parentOfParent);
        this.updateParentTaskDates(parentOfParent);
      }
    });

    gantt.render();
  }

  deleteSelectedTasks() {
    const selectedIds = gantt.getSelectedTasks();
    if (selectedIds.length === 0) {
      alerts.basicAlert('Aviso', 'No hay tareas seleccionadas para eliminar', 'info');
      return;
    }

    alerts.confirmAlert('¿Estás seguro?', 'Las tareas seleccionadas serán eliminadas', 'warning', 'Eliminar').then((result) => {
      if (result.isConfirmed) {
        selectedIds.forEach(id => {
          const task = gantt.getTask(id);
          this.markTaskAndChildrenForDeletion(task);
          gantt.deleteTask(id);
        });
        gantt.render();
        alerts.basicAlert('Eliminado', 'Las tareas seleccionadas han sido eliminadas', 'success');
      }
    });
  }

  // Métodos para controlar el zoom
  zoomToYear() {
    gantt.ext.zoom.setLevel("year");
  }

  zoomToQuarter() {
    gantt.ext.zoom.setLevel("quarter");
  }

  zoomToMonth() {
    gantt.ext.zoom.setLevel("month");
  }

  zoomToWeek() {
    gantt.ext.zoom.setLevel("week");
  }

  zoomToDay() {
    gantt.ext.zoom.setLevel("day");
  }

  // ── Modal Nueva Medida ──────────────────────────────────────────────────────

  closeNewMedidaModal() {
    this.showNewMedidaModal = false;
    this.newMedidaDescription = '';
  }

  async saveNewMedida() {
    if (!this.newMedidaDescription.trim()) return;

    try {
      await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: this.idcompany,
        description: this.newMedidaDescription.trim(),
        valueAddition: 'NA',
        valueAdditionBit2: false,
        valueAdditionBit3: false,
        vigente: true,
        type: 'MEASURE',
        active: 1
      }));

      await this.getMeasures();

      const select = document.querySelector('#measure_picker_select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = this.measures
          .map((m: any) => `<option value="${m.key}">${m.label}</option>`)
          .join('');
        select.value = this.newMedidaDescription.trim();
      }

      const measureSection = (gantt.config.lightbox.sections as any[])?.find(s => s.name === 'measure_phase');
      if (measureSection) measureSection.measureOptions = this.measures;

      this.closeNewMedidaModal();
    } catch (error) {
      console.error('Error al crear medida:', error);
      alerts.basicAlert('Error', 'No se pudo crear la medida', 'error');
    }
  }

  // ── Modal Nueva Fase ────────────────────────────────────────────────────────

  closeNewFaseModal() {
    this.showNewFaseModal = false;
    this.newFaseDescription = '';
  }

  // ── Modal APU ───────────────────────────────────────────────────────────────

  get filteredApuCatalog(): any[] {
    const query = this.apuSearch.trim().toLocaleLowerCase('es');
    if (!query) return this.apuCatalog.slice(0, 100);
    return this.apuCatalog.filter(item => this.apuCatalogText(item).toLocaleLowerCase('es').includes(query)).slice(0, 100);
  }

  async openApuEditor(idWorkprogram: number, taskName: string): Promise<void> {
    this.apuIdWorkprogram = idWorkprogram;
    this.apuTaskName = taskName;
    this.showApuModal = true;
    this.apuResourceType = 'MATERIAL';
    this.apuSearch = '';
    this.resetApuDraft();
    await Promise.all([this.loadApuItems(), this.loadApuCatalog()]);
  }

  closeApuEditor(): void {
    this.showApuModal = false;
    this.apuCatalog = [];
    this.apuItems = [];
    this.apuSearch = '';
  }

  async changeApuResourceType(type: 'MATERIAL' | 'PERSONAL' | 'EQUIPO' | 'HERRAMIENTA' | 'AUXILIAR'): Promise<void> {
    this.apuResourceType = type;
    this.apuSearch = '';
    this.resetApuDraft();
    await this.loadApuCatalog();
  }

  private async loadApuItems(): Promise<void> {
    if (!this.apuIdWorkprogram) return;
    this.apuItems = await lastValueFrom(this.apuService.getByWorkprogram(this.apuIdWorkprogram).pipe(catchError(() => of([]))));
  }

  private async loadApuCatalog(): Promise<void> {
    if (!this.idcompany) return;
    this.apuCatalogLoading = true;
    try {
      let request$: Observable<any>;
      switch (this.apuResourceType) {
        case 'PERSONAL': request$ = this.manoObraService.getByCompany(this.idcompany); break;
        case 'EQUIPO': request$ = this.equipmentService.getEquipment(this.idcompany); break;
        case 'HERRAMIENTA': request$ = this.herramientaService.getByCompany(this.idcompany); break;
        case 'AUXILIAR': request$ = this.auxiliarService.getByCompany(this.idcompany); break;
        default: request$ = this.materialsService.getMaterialsForApu(this.idcompany); break;
      }
      const response = await lastValueFrom(request$.pipe(catchError(() => of([]))));
      this.apuCatalog = Array.isArray(response) ? response : (response?.data ?? response?.items ?? []);
    } finally {
      this.apuCatalogLoading = false;
    }
  }

  apuCatalogText(item: any): string {
    return String(item?.description ?? item?.name ?? item?.insumo ?? item?.articulo ?? item?.clave ?? item?.id ?? '');
  }

  selectApuCatalogItem(item: any): void {
    this.apuDraft = {
      idReference: Number(item?.id ?? item?.Id) || null,
      description: this.apuCatalogText(item),
      unit: String(item?.unit ?? item?.measure ?? item?.unidad ?? ''),
      quantity: 1,
      unitCost: Number(item?.unitCost ?? item?.unitPrice ?? item?.costMN ?? item?.costoMN ?? item?.costo ?? item?.precioUnitario ?? item?.priceMN ?? item?.price ?? 0),
      applyToCost: true
    };
  }

  resetApuDraft(): void {
    this.apuDraft = { idReference: null, description: '', unit: '', quantity: 1, unitCost: 0, applyToCost: true };
  }

  async saveApuResource(): Promise<void> {
    if (!this.apuIdWorkprogram || !String(this.apuDraft.description || '').trim()) {
      alerts.basicAlert('Recurso requerido', 'Selecciona un recurso del catálogo o captura su descripción.', 'warning');
      return;
    }
    if (Number(this.apuDraft.quantity) <= 0 || Number(this.apuDraft.unitCost) < 0) {
      alerts.basicAlert('Datos incorrectos', 'La cantidad debe ser mayor a cero y el costo no puede ser negativo.', 'warning');
      return;
    }
    this.apuSaving = true;
    try {
      await lastValueFrom(this.apuService.add({
        idWorkprogram: this.apuIdWorkprogram,
        type: this.apuResourceType,
        idReference: this.apuDraft.idReference,
        description: String(this.apuDraft.description).trim(),
        unit: String(this.apuDraft.unit || '').trim() || null,
        quantity: Number(this.apuDraft.quantity),
        unitCost: Number(this.apuDraft.unitCost),
        unitCostDll: 0,
        applyToCost: !!this.apuDraft.applyToCost,
        active: true
      }));
      await this.refreshApuAfterChange();
      this.resetApuDraft();
    } catch (error: any) {
      alerts.basicAlert('No se pudo agregar', this.apiErrorMessage(error, 'No fue posible guardar el recurso.'), 'error');
    } finally {
      this.apuSaving = false;
    }
  }

  async deleteApuResource(item: any): Promise<void> {
    if (!item?.id) return;
    try {
      await lastValueFrom(this.apuService.delete(Number(item.id)));
      await this.refreshApuAfterChange();
    } catch (error: any) {
      alerts.basicAlert('No se pudo eliminar', this.apiErrorMessage(error, 'El recurso no pudo eliminarse.'), 'error');
    }
  }

  private async refreshApuAfterChange(): Promise<void> {
    await this.loadApuItems();
    const total = this.apuItems
      .filter(item => item.applyToCost)
      .reduce((sum, item) => sum + Number(item.total ?? (Number(item.quantity || 0) * Number(item.unitCost || 0))), 0);
    this.onApuCostUpdated(total, false);
    const selected = this.selectedProgramTask;
    if (selected && Number(selected.idEntry) === Number(this.apuIdWorkprogram)) {
      await this.loadSelectedTaskDetails(selected);
    }
  }

  onApuCostUpdated(newCost: number, closeModal = true): void {
    if (!this.apuIdWorkprogram) return;
    // Actualiza costMX en el registro del Gantt que corresponde al idEntry
    const tasks = gantt.getTaskByTime();
    const task = tasks.find(t => t['idEntry'] === this.apuIdWorkprogram);
    if (task) {
      task['costMX'] = newCost;
      gantt.updateTask(task.id);
      this.scheduleParentUpdate(task.parent);
      this.notSavedChanges = true;
      this.workprogramsService.updateWorkProgram(this.apuIdWorkprogram, this.transformTaskForSave(task)).subscribe({
        error: error => alerts.basicAlert('No se pudo actualizar el costo', this.apiErrorMessage(error, 'Revisa el concepto e inténtalo nuevamente.'), 'error')
      });
    }
    if (closeModal) this.showApuModal = false;
  }

  // ── Modal Configuración ─────────────────────────────────────────────────────

  openConfigModal(): void {
    this.configModalidad = this.pondModalidad; // pre-carga con el valor actual
    this.showConfigModal = true;
  }

  saveConfig(): void {
    this.pondModalidad = this.configModalidad;
    this.showConfigModal = false;
  }

  closeConfigModal(): void {
    this.showConfigModal = false;
  }

  async saveNewFase() {
    if (!this.newFaseDescription.trim()) return;

    try {
      await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: this.idcompany,
        description: this.newFaseDescription.trim(),
        valueAddition: 'NA',
        valueAdditionBit2: false,
        valueAdditionBit3: false,
        vigente: true,
        type: 'Fase',
        active: 1
      }));

      // Recargar fases
      await this.getPhases();

      // Actualizar el select dentro del lightbox si está abierto
      const select = document.querySelector('#phase_picker_select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = this.phases
          .map((p: any) => `<option value="${p.key}">${p.label}</option>`)
          .join('');
        select.value = this.newFaseDescription.trim();
      }

      // Actualizar las opciones en la config del gantt para la próxima vez
      const phaseSection = (gantt.config.lightbox.sections as any[])?.find(s => s.name === 'measure_phase');
      if (phaseSection) phaseSection.phaseOptions = this.phases;

      this.closeNewFaseModal();
    } catch (error) {
      console.error('Error al crear fase:', error);
      alerts.basicAlert('Error', 'No se pudo crear la fase', 'error');
    }
  }
}
