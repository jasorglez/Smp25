import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { RiskmatrixService } from 'app/services/riskmatrix.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ProjectsService } from 'app/services/projects.service';
import { ConventionsService } from 'app/services/conventions.service';

type RiskScope = 'project' | 'wbs' | 'task';
type RiskStatus =
  | 'Identificado'
  | 'En análisis'
  | 'Mitigación en curso'
  | 'Controlado'
  | 'Cerrado'
  | 'Cancelado';

interface RiskRecord {
  id: number | null;
  folio: string;
  title: string;
  description: string;
  cause: string;
  consequence: string;
  category: string;
  scope: RiskScope;
  conceptId: number | null;
  conceptCode: string;
  conceptName: string;
  probability: number;
  impactTimeDays: number;
  impactCost: number;
  criticality: number;
  trafficLight: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  responsible: string;
  responsePlan: string;
  dueDate: string;
  status: RiskStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  followUps: any[];
}

interface ActivityOption {
  id: number;
  code: string;
  name: string;
}

interface RiskFollowUp {
  id: number;
  idRisk: number;
  comment: string;
  previousStatus: string | null;
  newStatus: string | null;
  progressPercent: number | null;
  createdAt: string;
  createdBy: string | null;
}

interface FollowUpForm {
  id: number | null;
  comment: string;
  newStatus: string;
  progressPercent: number | null;
  previousStatus: string | null;
}

type RiskSortField = 'updatedAt' | 'dueDate' | 'criticality' | 'title';

@Component({
  selector: 'app-pmo-riesgos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pmo-riesgos.component.html'
})
export class PmoRiesgosComponent implements OnInit {
  private _signalsService     = inject(SignalsService);
  private _workprogramsService = inject(WorkprogramsService);
  private _riskmatrixService  = inject(RiskmatrixService);
  private _trackingService    = inject(TrackingService);
  private _projectsService    = inject(ProjectsService);
  private _convService        = inject(ConventionsService);

  // ── Empresa ───────────────────────────────────────────────────────────────
  idCompany = 0;

  // ── Proyectos y Convenios ─────────────────────────────────────────────────
  projects: any[]          = [];
  selectedProject: any     = null;
  conventions: any[]       = [];
  selectedConvention: any  = null;
  isLoadingConv            = false;

  // ── Actividades del workprogram ───────────────────────────────────────────
  activityOptions: ActivityOption[] = [];
  isLoadingActivities = false;

  // ── Riesgos ───────────────────────────────────────────────────────────────
  isLoading    = false;
  isSaving     = false;
  isSavingFollowUp = false;
  searchTerm   = '';
  selectedStatusFilter       = '';
  selectedTrafficLightFilter = '';
  sortField: RiskSortField   = 'updatedAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedRiskId: number | null = null;

  readonly categoryOptions = [
    'Clima', 'Ingeniería', 'Suministro', 'Logística', 'Cliente',
    'Permisos', 'Seguridad', 'Calidad', 'Contratista', 'Recurso humano',
    'Financiero', 'Otro'
  ];

  readonly statusOptions: RiskStatus[] = [
    'Identificado', 'En análisis', 'Mitigación en curso',
    'Controlado', 'Cerrado', 'Cancelado'
  ];

  readonly trafficLightOptions: RiskRecord['trafficLight'][] = ['Bajo', 'Medio', 'Alto', 'Crítico'];

  risks: RiskRecord[]    = [];
  form: RiskRecord       = this.createEmptyRisk();
  followUpForm: FollowUpForm = this.createEmptyFollowUp();

  constructor() {
    effect(() => {
      const id = this._signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) {
        this.idCompany = id;
        this.loadProjects();
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this._signalsService.getRootSelectedBySidebar()() ?? 0;
    if (this.idCompany) this.loadProjects();
  }

  // ── Carga proyectos ───────────────────────────────────────────────────────
  async loadProjects(): Promise<void> {
    try {
      const res: any = await lastValueFrom(this._projectsService.getProjectListByCompany(this.idCompany));
      this.projects = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch { this.projects = []; }
  }

  // ── Cambio de proyecto ────────────────────────────────────────────────────
  async onProjectChange(): Promise<void> {
    this.selectedConvention  = null;
    this.conventions         = [];
    this.activityOptions     = [];
    this.risks               = [];
    this.form                = this.createEmptyRisk();
    if (!this.selectedProject) return;
    await this.loadConventions();
  }

  // ── Convenios del contrato ────────────────────────────────────────────────
  async loadConventions(): Promise<void> {
    const idContrato = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? 0;
    if (!idContrato) {
      await this.loadActivitiesAndRisks();
      return;
    }
    this.isLoadingConv = true;
    try {
      const res: any = await lastValueFrom(
        this._convService.getConventionsByContractOrProject('contract', idContrato)
      );
      const raw = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      this.conventions = raw.filter((c: any) => c.active !== false).sort((a: any, b: any) => a.id - b.id);

      const vigente = this.conventions.find((c: any) => c.vigente);
      if (vigente) { this.selectedConvention = vigente; }
      else if (this.conventions.length === 1) { this.selectedConvention = this.conventions[0]; }
    } catch { this.conventions = []; }
    finally { this.isLoadingConv = false; }

    await this.loadActivitiesAndRisks();
  }

  async onConventionChange(): Promise<void> {
    this.activityOptions = [];
    this.risks           = [];
    this.form            = this.createEmptyRisk();
    await this.loadActivitiesAndRisks();
  }

  convTypeBadge(type: string): { label: string; css: string } {
    const t = (type ?? '').toLowerCase();
    if (t.includes('reprog'))                          return { label: 'Reprogramación',        css: 'bg-warning text-dark' };
    if (t.includes('adend') || t.includes('addend'))   return { label: 'Adenda',                css: 'bg-info text-dark'    };
    if (t.includes('amend'))                           return { label: 'Enmienda',              css: 'bg-secondary'         };
    return                                                    { label: 'Prog. Original',        css: 'bg-primary'           };
  }

  // ── Carga actividades del workprogram ─────────────────────────────────────
  async loadActivitiesAndRisks(): Promise<void> {
    if (!this.selectedProject) return;
    this.isLoadingActivities = true;
    const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
    try {
      let raw: any[];
      if (this.selectedConvention) {
        raw = await lastValueFrom(
          this._workprogramsService.getByConvention(this.selectedConvention.id, idProject)
        );
      } else {
        raw = await lastValueFrom(
          this._workprogramsService.getWorkPrograms(idProject, 'Project')
        );
      }
      // Todas las actividades del workprogram — sin filtrar por measure
      this.activityOptions = (raw ?? []).map((a: any) => ({
        id:   a.id ?? a.idEntry,
        code: a.activity ?? a.wbs ?? '',
        name: `${a.activity ?? ''} — ${(a.text ?? a.description ?? '').substring(0, 60)}`.trim()
      })).sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
    } catch { this.activityOptions = []; }
    finally { this.isLoadingActivities = false; }

    this.loadRisks(idProject);
  }

  // ── Filtros / ordenamiento ────────────────────────────────────────────────
  get filteredRisks(): RiskRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.risks.filter(r => {
      const matchTerm = !term
        || r.folio.toLowerCase().includes(term)
        || r.title.toLowerCase().includes(term)
        || r.category.toLowerCase().includes(term)
        || r.status.toLowerCase().includes(term)
        || r.responsible.toLowerCase().includes(term)
        || r.conceptName.toLowerCase().includes(term)
        || r.conceptCode.toLowerCase().includes(term);
      const matchStatus = !this.selectedStatusFilter || r.status === this.selectedStatusFilter;
      const matchLight  = !this.selectedTrafficLightFilter || r.trafficLight === this.selectedTrafficLightFilter;
      return matchTerm && matchStatus && matchLight;
    }).sort((a, b) => this.compareRisks(a, b));
  }

  get hasActiveFilters(): boolean { return !!(this.searchTerm.trim() || this.selectedStatusFilter || this.selectedTrafficLightFilter); }
  get totalRisks():    number { return this.risks.length; }
  get criticalRisks(): number { return this.risks.filter(r => r.trafficLight === 'Crítico').length; }
  get openRisks():     number { return this.risks.filter(r => !['Cerrado','Cancelado'].includes(r.status)).length; }
  get overdueRisks():  number {
    const today = new Date().toISOString().slice(0, 10);
    return this.risks.filter(r => r.dueDate && r.dueDate < today && !['Cerrado','Cancelado'].includes(r.status)).length;
  }

  get currentCriticalityPreview(): number { return this.calculateCriticality(this.form.probability, this.form.impactTimeDays, this.form.impactCost); }
  get currentTrafficLightPreview(): RiskRecord['trafficLight'] { return this.calculateTrafficLight(this.form.probability, this.form.impactTimeDays, this.form.impactCost); }

  // ── CRUD Riesgos ──────────────────────────────────────────────────────────
  addRisk(): void {
    this.selectedRiskId = null;
    this.form           = this.createEmptyRisk();
    this.followUpForm   = this.createEmptyFollowUp();
  }

  selectRisk(risk: RiskRecord): void {
    this.selectedRiskId = risk.id;
    this.form           = { ...risk };
    this.followUpForm   = this.createEmptyFollowUp();
  }

  onScopeChanged(): void {
    if (this.form.scope !== 'task') {
      this.form.conceptId   = null;
      this.form.conceptCode = '';
      this.form.conceptName = '';
    }
  }

  onActivityChanged(): void {
    const sel = this.activityOptions.find(a => a.id === Number(this.form.conceptId));
    this.form.conceptCode = sel?.code ?? '';
    this.form.conceptName = sel?.name ?? '';
  }

  clearFilters(): void { this.searchTerm = ''; this.selectedStatusFilter = ''; this.selectedTrafficLightFilter = ''; }

  startEditFollowUp(fu: RiskFollowUp): void {
    this.followUpForm = { id: fu.id, comment: fu.comment, newStatus: fu.newStatus ?? '', progressPercent: fu.progressPercent, previousStatus: fu.previousStatus };
  }

  cancelFollowUpEdit(): void { this.followUpForm = this.createEmptyFollowUp(); }

  setSort(field: RiskSortField): void {
    if (this.sortField === field) { this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; return; }
    this.sortField     = field;
    this.sortDirection = field === 'title' ? 'asc' : 'desc';
  }

  saveRisk(): void {
    if (!this.selectedProject) { alerts.basicAlert('Aviso', 'Selecciona primero un proyecto.', 'warning'); return; }
    const msg = this.validateForm();
    if (msg) { alerts.basicAlert('Aviso', msg, 'warning'); return; }

    this.isSaving = true;
    const idProject = this.selectedProject.id ?? this.selectedProject.idProject;
    const request$  = this.form.id
      ? this._riskmatrixService.updatePmoRisk(this.form.id, this.mapFormToPayload(idProject))
      : this._riskmatrixService.addPmoRisk(this.mapFormToPayload(idProject));

    request$.subscribe({
      next: (risk: any) => {
        const mapped = this.mapApiRiskToRecord(risk);
        const exists = this.risks.some(r => r.id === mapped.id);
        this.risks      = exists ? this.risks.map(r => r.id === mapped.id ? mapped : r) : [mapped, ...this.risks];
        this.selectedRiskId = mapped.id;
        this.form       = { ...mapped };
        this.isSaving   = false;
        alerts.basicAlert('Guardar', 'Riesgo PMO guardado correctamente', 'success');
      },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No fue posible guardar el riesgo PMO.', 'error'); }
    });
  }

  saveFollowUp(): void {
    if (!this.form.id) { alerts.basicAlert('Aviso', 'Guarda primero el riesgo antes de agregar seguimiento.', 'warning'); return; }
    if (!this.followUpForm.comment.trim()) { alerts.basicAlert('Aviso', 'Captura el comentario de seguimiento.', 'warning'); return; }

    this.isSavingFollowUp = true;
    const nextStatus = (this.followUpForm.newStatus || this.form.status) as RiskStatus;
    const payload = {
      comment: this.followUpForm.comment.trim(),
      previousStatus: this.followUpForm.previousStatus ?? this.form.status,
      newStatus: nextStatus,
      progressPercent: this.followUpForm.progressPercent,
      createdBy: this._trackingService.getEmail()
    };

    const req$ = this.followUpForm.id
      ? this._riskmatrixService.updatePmoRiskFollowUp(this.form.id, this.followUpForm.id, payload)
      : this._riskmatrixService.addPmoRiskFollowUp(this.form.id, payload);

    req$.subscribe({
      next: (response: any) => {
        if (this.followUpForm.id) {
          this.replaceRiskRecord(this.mapApiRiskToRecord(response));
          alerts.basicAlert('Seguimiento', 'Seguimiento actualizado correctamente.', 'success');
        } else {
          const fu = response as RiskFollowUp;
          this.form.followUps = [fu, ...(this.form.followUps || [])];
          this.form.status    = nextStatus;
          this.form.updatedAt = fu.createdAt;
          this.risks = this.risks.map(r => r.id === this.form.id ? { ...r, status: this.form.status, updatedAt: this.form.updatedAt, followUps: this.form.followUps } : r);
          alerts.basicAlert('Seguimiento', 'Seguimiento registrado correctamente.', 'success');
        }
        this.followUpForm = this.createEmptyFollowUp();
        this.isSavingFollowUp = false;
      },
      error: () => { this.isSavingFollowUp = false; alerts.basicAlert('Error', 'No fue posible guardar el seguimiento.', 'error'); }
    });
  }

  async deleteFollowUp(fu: RiskFollowUp): Promise<void> {
    if (!this.form.id) return;
    const res = await alerts.confirmAlert('¿Eliminar seguimiento?', 'Se quitará del historial.', 'question', 'Eliminar');
    if (!res.isConfirmed) return;
    this._riskmatrixService.deletePmoRiskFollowUp(this.form.id, fu.id).subscribe({
      next: (risk: any) => { this.replaceRiskRecord(this.mapApiRiskToRecord(risk)); this.followUpForm = this.createEmptyFollowUp(); alerts.basicAlert('Seguimiento', 'Seguimiento eliminado.', 'success'); },
      error: () => alerts.basicAlert('Error', 'No fue posible eliminar el seguimiento.', 'error')
    });
  }

  async deleteRisk(): Promise<void> {
    if (!this.selectedRiskId) { alerts.basicAlert('Aviso', 'Selecciona un riesgo para eliminarlo.', 'warning'); return; }
    const res = await alerts.confirmAlert('¿Eliminar riesgo?', 'El riesgo quedará inactivo en PMO.', 'question', 'Eliminar');
    if (!res.isConfirmed) return;
    this._riskmatrixService.deletePmoRisk(this.selectedRiskId).subscribe({
      next: () => {
        this.risks = this.risks.filter(r => r.id !== this.selectedRiskId);
        this.selectedRiskId = null;
        this.form = this.createEmptyRisk();
        this.followUpForm = this.createEmptyFollowUp();
        alerts.basicAlert('Eliminar', 'Riesgo eliminado correctamente', 'success');
      },
      error: () => alerts.basicAlert('Error', 'No fue posible eliminar el riesgo PMO.', 'error')
    });
  }

  duplicateRisk(): void {
    if (!this.selectedRiskId) { alerts.basicAlert('Aviso', 'Selecciona un riesgo para duplicarlo.', 'warning'); return; }
    this.form = { ...this.form, id: null, folio: '', title: `${this.form.title} (copia)`, createdAt: '', updatedAt: '', followUps: [] };
    this.selectedRiskId = null;
  }

  getTrafficLightClass(light: RiskRecord['trafficLight']): string {
    if (light === 'Crítico') return 'bg-danger';
    if (light === 'Alto')    return 'bg-warning text-dark';
    if (light === 'Medio')   return 'bg-info text-dark';
    return 'bg-success';
  }

  getSortButtonClass(field: RiskSortField): string { return this.sortField === field ? 'btn-primary' : 'btn-outline-secondary'; }

  // ── Privados ──────────────────────────────────────────────────────────────
  private loadRisks(idProject: number): void {
    this.isLoading = true;
    const idContract = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? null;
    this._riskmatrixService.getPmoRisks(idProject, idContract).subscribe({
      next: (data: any[]) => { this.risks = (data || []).map(r => this.mapApiRiskToRecord(r)); this.isLoading = false; },
      error: () => { this.risks = []; this.isLoading = false; alerts.basicAlert('Error', 'Error al cargar los riesgos PMO.', 'error'); }
    });
  }

  private replaceRiskRecord(risk: RiskRecord): void {
    this.risks = this.risks.map(r => r.id === risk.id ? risk : r);
    this.form  = { ...risk };
    this.selectedRiskId = risk.id;
  }

  private mapApiRiskToRecord(item: any): RiskRecord {
    const conceptId  = item.idWorkProgram ?? null;
    const selAct     = this.activityOptions.find(a => a.id === conceptId);
    return {
      id: item.id ?? null, folio: item.folio ?? '', title: item.title ?? '',
      description: item.description ?? '', cause: item.cause ?? '', consequence: item.consequence ?? '',
      category: item.category ?? '', scope: (item.scope ?? 'project') as RiskScope,
      conceptId,
      conceptCode: item.workProgramActivity ?? selAct?.code ?? '',
      conceptName: item.workProgramDisplay ?? item.workProgramText ?? selAct?.name ?? '',
      probability: Number(item.probability ?? 3), impactTimeDays: Number(item.impactTimeDays ?? 0),
      impactCost: Number(item.impactCost ?? 0), criticality: Number(item.criticality ?? 0),
      trafficLight: (item.trafficLight ?? 'Bajo') as RiskRecord['trafficLight'],
      responsible: item.responsible ?? '', responsePlan: item.responsePlan ?? '',
      dueDate: this.toInputDate(item.dueDate), status: (item.status ?? 'Identificado') as RiskStatus,
      notes: item.notes ?? '', createdAt: item.createdAt ?? '', updatedAt: item.updatedAt ?? '',
      followUps: item.followUps ?? item.FollowUps ?? []
    };
  }

  private compareRisks(a: RiskRecord, b: RiskRecord): number {
    let cmp = 0;
    switch (this.sortField) {
      case 'title':       cmp = a.title.localeCompare(b.title); break;
      case 'dueDate':     cmp = this.compareDates(a.dueDate, b.dueDate); break;
      case 'criticality': cmp = a.criticality - b.criticality; break;
      default:            cmp = this.compareDates(a.updatedAt || a.createdAt, b.updatedAt || b.createdAt); break;
    }
    return this.sortDirection === 'asc' ? cmp : cmp * -1;
  }

  private compareDates(a: string, b: string): number {
    return (a ? new Date(a).getTime() : 0) - (b ? new Date(b).getTime() : 0);
  }

  private mapFormToPayload(idProject: number): any {
    const idContract = this.selectedProject?.idContrato ?? this.selectedProject?.id_contrato ?? null;
    return {
      idProject, idContract,
      idWorkProgram: this.form.scope === 'task' ? Number(this.form.conceptId) : null,
      scope: this.form.scope, folio: this.form.folio || null,
      title: this.form.title, description: this.form.description,
      cause: this.form.cause, consequence: this.form.consequence,
      category: this.form.category, probability: this.form.probability,
      impactTimeDays: this.form.impactTimeDays, impactCost: this.form.impactCost,
      responsible: this.form.responsible, responsePlan: this.form.responsePlan,
      dueDate: this.form.dueDate, status: this.form.status,
      notes: this.form.notes, userName: this._trackingService.getEmail()
    };
  }

  private validateForm(): string {
    if (!this.form.title.trim())       return 'Captura el título del riesgo.';
    if (!this.form.description.trim()) return 'Captura la descripción del riesgo.';
    if (!this.form.category)           return 'Selecciona la categoría del riesgo.';
    if (!this.form.scope)              return 'Selecciona el alcance del riesgo.';
    if (this.form.scope === 'task' && !this.form.conceptId) return 'Selecciona la actividad asociada al riesgo.';
    if (!this.form.responsible.trim()) return 'Captura el responsable del riesgo.';
    if (!this.form.responsePlan.trim()) return 'Captura el plan de respuesta.';
    if (!this.form.dueDate)            return 'Captura la fecha compromiso.';
    if (!this.form.probability || this.form.probability < 1 || this.form.probability > 5) return 'La probabilidad debe estar entre 1 y 5.';
    if (this.form.impactTimeDays < 0)  return 'El impacto en tiempo no puede ser negativo.';
    if (this.form.impactCost < 0)      return 'El impacto en costo no puede ser negativo.';
    return '';
  }

  private calculateCriticality(p: number, t: number, c: number): number {
    return p * Math.max(this.getTimeScale(t), this.getCostScale(c));
  }

  private calculateTrafficLight(p: number, t: number, c: number): RiskRecord['trafficLight'] {
    const cr = this.calculateCriticality(p, t, c);
    if (cr >= 16) return 'Crítico'; if (cr >= 11) return 'Alto'; if (cr >= 6) return 'Medio'; return 'Bajo';
  }

  private getTimeScale(d: number): number { if (d >= 15) return 5; if (d >= 8) return 4; if (d >= 4) return 3; if (d >= 2) return 2; return 1; }
  private getCostScale(a: number): number { if (a >= 500000) return 5; if (a >= 200000) return 4; if (a >= 100000) return 3; if (a >= 25000) return 2; return 1; }
  private toInputDate(v: any): string { return v ? String(v).slice(0, 10) : ''; }

  private createEmptyRisk(): RiskRecord {
    return { id: null, folio: '', title: '', description: '', cause: '', consequence: '', category: '', scope: 'project', conceptId: null, conceptCode: '', conceptName: '', probability: 3, impactTimeDays: 0, impactCost: 0, criticality: 3, trafficLight: 'Bajo', responsible: '', responsePlan: '', dueDate: '', status: 'Identificado', notes: '', createdAt: '', updatedAt: '', followUps: [] };
  }

  private createEmptyFollowUp(): FollowUpForm {
    return { id: null, comment: '', newStatus: '', progressPercent: null, previousStatus: null };
  }
}
