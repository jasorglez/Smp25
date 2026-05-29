import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { RiskmatrixService } from 'app/services/riskmatrix.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';

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

interface ConceptOption {
  id: number | null;
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
  selector: 'app-risks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './risks.component.html'
})
export class RisksComponent {
  private signalsService = inject(SignalsService);
  private workprogramsService = inject(WorkprogramsService);
  private riskmatrixService = inject(RiskmatrixService);
  private trackingService = inject(TrackingService);

  readonly projectName = this.signalsService.getProjectNameBySidebar();

  idProject: number = null;
  idContract: number = null;
  conventionName = '';
  typeWorkProgram: 'Project' | 'Contract' = 'Project';

  isLoading = false;
  isSaving = false;
  isSavingFollowUp = false;
  searchTerm = '';
  selectedStatusFilter = '';
  selectedTrafficLightFilter = '';
  sortField: RiskSortField = 'updatedAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedRiskId: number | null = null;

  readonly categoryOptions = [
    'Clima',
    'Ingeniería',
    'Suministro',
    'Logística',
    'Cliente',
    'Permisos',
    'Seguridad',
    'Calidad',
    'Contratista',
    'Recurso humano',
    'Financiero',
    'Otro'
  ];

  readonly statusOptions: RiskStatus[] = [
    'Identificado',
    'En análisis',
    'Mitigación en curso',
    'Controlado',
    'Cerrado',
    'Cancelado'
  ];

  readonly trafficLightOptions: RiskRecord['trafficLight'][] = [
    'Bajo',
    'Medio',
    'Alto',
    'Crítico'
  ];

  conceptOptions: ConceptOption[] = [];
  risks: RiskRecord[] = [];
  form: RiskRecord = this.createEmptyRisk();
  followUpForm: FollowUpForm = this.createEmptyFollowUp();

  constructor() {
    effect(() => {
      this.idContract = this.signalsService.getContractSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.conventionName = this.signalsService.getConventionVigente()()?.name ?? '';
      this.typeWorkProgram = this.idProject == null ? 'Contract' : 'Project';
      this.loadConceptsAndRisks();
    });
  }

  get filteredRisks(): RiskRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.risks.filter(risk => {
      const matchesTerm = !term
        || risk.folio.toLowerCase().includes(term)
        || risk.title.toLowerCase().includes(term)
        || risk.category.toLowerCase().includes(term)
        || risk.status.toLowerCase().includes(term)
        || risk.responsible.toLowerCase().includes(term)
        || risk.conceptName.toLowerCase().includes(term)
        || risk.conceptCode.toLowerCase().includes(term);

      const matchesStatus = !this.selectedStatusFilter || risk.status === this.selectedStatusFilter;
      const matchesTrafficLight = !this.selectedTrafficLightFilter || risk.trafficLight === this.selectedTrafficLightFilter;

      return matchesTerm && matchesStatus && matchesTrafficLight;
    }).sort((left, right) => this.compareRisks(left, right));
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchTerm.trim() || this.selectedStatusFilter || this.selectedTrafficLightFilter);
  }

  get totalRisks(): number {
    return this.risks.length;
  }

  get criticalRisks(): number {
    return this.risks.filter(risk => risk.trafficLight === 'Crítico').length;
  }

  get openRisks(): number {
    return this.risks.filter(risk => !['Cerrado', 'Cancelado'].includes(risk.status)).length;
  }

  get overdueRisks(): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.risks.filter(risk =>
      risk.dueDate
      && risk.dueDate < today
      && !['Cerrado', 'Cancelado'].includes(risk.status)
    ).length;
  }

  get currentCriticalityPreview(): number {
    return this.calculateCriticality(this.form.probability, this.form.impactTimeDays, this.form.impactCost);
  }

  get currentTrafficLightPreview(): RiskRecord['trafficLight'] {
    return this.calculateTrafficLight(this.form.probability, this.form.impactTimeDays, this.form.impactCost);
  }

  loadConceptsAndRisks(): void {
    this.conceptOptions = [];
    this.risks = [];
    this.selectedRiskId = null;
    this.form = this.createEmptyRisk();
    this.followUpForm = this.createEmptyFollowUp();

    if (!this.idProject) {
      return;
    }

    this.isLoading = true;
    const sourceId = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;

    this.workprogramsService.getWorkPrograms(sourceId, this.typeWorkProgram).subscribe({
      next: (data: any[]) => {
        this.conceptOptions = (data || [])
          .filter(item => String(item.measure ?? '').toUpperCase() === 'CONCEPTO')
          .map(item => ({
            id: item.id ?? null,
            code: item.activity ?? '',
            name: `${item.activity ?? ''} ${item.text ?? item.name ?? ''}`.trim()
          }));
        this.loadRisks();
      },
      error: () => {
        this.conceptOptions = [];
        this.loadRisks();
      }
    });
  }

  addRisk(): void {
    this.selectedRiskId = null;
    this.form = this.createEmptyRisk();
    this.followUpForm = this.createEmptyFollowUp();
  }

  selectRisk(risk: RiskRecord): void {
    this.selectedRiskId = risk.id;
    this.form = { ...risk };
    this.followUpForm = this.createEmptyFollowUp();
  }

  onScopeChanged(): void {
    if (this.form.scope !== 'task') {
      this.form.conceptId = null;
      this.form.conceptCode = '';
      this.form.conceptName = '';
    }
  }

  onConceptChanged(): void {
    const selectedConcept = this.conceptOptions.find(concept => concept.id === Number(this.form.conceptId));
    this.form.conceptCode = selectedConcept?.code ?? '';
    this.form.conceptName = selectedConcept?.name ?? '';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatusFilter = '';
    this.selectedTrafficLightFilter = '';
  }

  startEditFollowUp(followUp: RiskFollowUp): void {
    this.followUpForm = {
      id: followUp.id,
      comment: followUp.comment,
      newStatus: followUp.newStatus ?? '',
      progressPercent: followUp.progressPercent,
      previousStatus: followUp.previousStatus
    };
  }

  cancelFollowUpEdit(): void {
    this.followUpForm = this.createEmptyFollowUp();
  }

  setSort(field: RiskSortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortField = field;
    this.sortDirection = field === 'title' ? 'asc' : 'desc';
  }

  saveRisk(): void {
    if (!this.idProject) {
      alerts.basicAlert('Aviso', 'Selecciona primero un proyecto desde el sidebar.', 'warning');
      return;
    }

    const validationMessage = this.validateForm();
    if (validationMessage) {
      alerts.basicAlert('Aviso', validationMessage, 'warning');
      return;
    }

    this.isSaving = true;
    const request$ = this.form.id
      ? this.riskmatrixService.updatePmoRisk(this.form.id, this.mapFormToPayload())
      : this.riskmatrixService.addPmoRisk(this.mapFormToPayload());

    request$.subscribe({
      next: (risk: any) => {
        const mapped = this.mapApiRiskToRecord(risk);
        const exists = this.risks.some(item => item.id === mapped.id);
        this.risks = exists
          ? this.risks.map(item => item.id === mapped.id ? mapped : item)
          : [mapped, ...this.risks];
        this.selectedRiskId = mapped.id;
        this.form = { ...mapped };
        this.isSaving = false;
        alerts.basicAlert('Guardar', 'Riesgo PMO guardado correctamente', 'success');
      },
      error: () => {
        this.isSaving = false;
        alerts.basicAlert('Error', 'No fue posible guardar el riesgo PMO. Revisa el microservicio SMP o la estructura remota de PMO risk.', 'error');
      }
    });
  }

  saveFollowUp(): void {
    if (!this.form.id) {
      alerts.basicAlert('Aviso', 'Guarda primero el riesgo antes de agregar seguimiento.', 'warning');
      return;
    }

    if (!this.followUpForm.comment.trim()) {
      alerts.basicAlert('Aviso', 'Captura el comentario de seguimiento.', 'warning');
      return;
    }

    if (this.followUpForm.progressPercent != null && (this.followUpForm.progressPercent < 0 || this.followUpForm.progressPercent > 100)) {
      alerts.basicAlert('Aviso', 'El avance debe estar entre 0 y 100%.', 'warning');
      return;
    }

    this.isSavingFollowUp = true;
    const previousStatus = this.form.status;
    const nextStatus = (this.followUpForm.newStatus || this.form.status) as RiskStatus;
    const payload = {
      comment: this.followUpForm.comment.trim(),
      previousStatus: this.followUpForm.previousStatus ?? previousStatus,
      newStatus: nextStatus,
      progressPercent: this.followUpForm.progressPercent,
      createdBy: this.trackingService.getEmail()
    };

    const request$ = this.followUpForm.id
      ? this.riskmatrixService.updatePmoRiskFollowUp(this.form.id, this.followUpForm.id, payload)
      : this.riskmatrixService.addPmoRiskFollowUp(this.form.id, payload);

    request$.subscribe({
      next: (response: any) => {
        if (this.followUpForm.id) {
          const mapped = this.mapApiRiskToRecord(response);
          this.replaceRiskRecord(mapped);
          alerts.basicAlert('Seguimiento', 'Seguimiento actualizado correctamente.', 'success');
        } else {
          const followUp = response as RiskFollowUp;
          this.form.followUps = [followUp, ...(this.form.followUps || [])];
          this.form.status = nextStatus;
          this.form.updatedAt = followUp.createdAt;
          this.risks = this.risks.map(risk =>
            risk.id === this.form.id
              ? {
                  ...risk,
                  status: this.form.status,
                  updatedAt: this.form.updatedAt,
                  followUps: this.form.followUps
                }
              : risk
          );
          alerts.basicAlert('Seguimiento', 'Seguimiento registrado correctamente.', 'success');
        }

        this.followUpForm = this.createEmptyFollowUp();
        this.isSavingFollowUp = false;
      },
      error: () => {
        this.isSavingFollowUp = false;
        alerts.basicAlert('Error', `No fue posible ${this.followUpForm.id ? 'actualizar' : 'registrar'} el seguimiento.`, 'error');
      }
    });
  }

  async deleteFollowUp(followUp: RiskFollowUp): Promise<void> {
    if (!this.form.id) {
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Eliminar seguimiento?',
      'Se quitará del historial del riesgo PMO.',
      'question',
      'Eliminar'
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.riskmatrixService.deletePmoRiskFollowUp(this.form.id, followUp.id).subscribe({
      next: (risk: any) => {
        const mapped = this.mapApiRiskToRecord(risk);
        this.replaceRiskRecord(mapped);
        this.followUpForm = this.createEmptyFollowUp();
        alerts.basicAlert('Seguimiento', 'Seguimiento eliminado correctamente.', 'success');
      },
      error: () => {
        alerts.basicAlert('Error', 'No fue posible eliminar el seguimiento.', 'error');
      }
    });
  }

  async deleteRisk(): Promise<void> {
    if (!this.selectedRiskId) {
      alerts.basicAlert('Aviso', 'Selecciona un riesgo para eliminarlo.', 'warning');
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Eliminar riesgo?',
      'El riesgo quedará inactivo en PMO.',
      'question',
      'Eliminar'
    );

    if (!confirm.isConfirmed) {
      return;
    }

    this.riskmatrixService.deletePmoRisk(this.selectedRiskId).subscribe({
      next: () => {
        this.risks = this.risks.filter(risk => risk.id !== this.selectedRiskId);
        this.selectedRiskId = null;
        this.form = this.createEmptyRisk();
        this.followUpForm = this.createEmptyFollowUp();
        alerts.basicAlert('Eliminar', 'Riesgo eliminado correctamente', 'success');
      },
      error: () => {
        alerts.basicAlert('Error', 'No fue posible eliminar el riesgo PMO.', 'error');
      }
    });
  }

  duplicateRisk(): void {
    if (!this.selectedRiskId) {
      alerts.basicAlert('Aviso', 'Selecciona un riesgo para duplicarlo.', 'warning');
      return;
    }

    this.form = {
      ...this.form,
      id: null,
      folio: '',
      title: `${this.form.title} (copia)`,
      createdAt: '',
      updatedAt: '',
      followUps: []
    };
    this.selectedRiskId = null;
  }

  getTrafficLightClass(light: RiskRecord['trafficLight']): string {
    if (light === 'Crítico') return 'bg-danger';
    if (light === 'Alto') return 'bg-warning text-dark';
    if (light === 'Medio') return 'bg-info text-dark';
    return 'bg-success';
  }

  getSortButtonClass(field: RiskSortField): string {
    return this.sortField === field ? 'btn-primary' : 'btn-outline-secondary';
  }

  private loadRisks(): void {
    this.riskmatrixService.getPmoRisks(this.idProject, this.idContract).subscribe({
      next: (data: any[]) => {
        this.risks = (data || []).map(item => this.mapApiRiskToRecord(item));
        this.isLoading = false;
      },
      error: () => {
        this.risks = [];
        this.isLoading = false;
        alerts.basicAlert('Error', 'El endpoint PMO risk respondió con error. Falta alinear el backend desplegado o la base remota.', 'error');
      }
    });
  }

  private replaceRiskRecord(risk: RiskRecord): void {
    this.risks = this.risks.map(item => item.id === risk.id ? risk : item);
    this.form = { ...risk };
    this.selectedRiskId = risk.id;
  }

  private mapApiRiskToRecord(item: any): RiskRecord {
    const conceptId = item.idWorkProgram ?? null;
    const selectedConcept = this.conceptOptions.find(concept => concept.id === conceptId);
    const conceptDisplay = item.workProgramDisplay ?? item.workProgramText ?? selectedConcept?.name ?? '';
    return {
      id: item.id ?? null,
      folio: item.folio ?? '',
      title: item.title ?? '',
      description: item.description ?? '',
      cause: item.cause ?? '',
      consequence: item.consequence ?? '',
      category: item.category ?? '',
      scope: (item.scope ?? 'project') as RiskScope,
      conceptId,
      conceptCode: item.workProgramActivity ?? selectedConcept?.code ?? '',
      conceptName: conceptDisplay,
      probability: Number(item.probability ?? 3),
      impactTimeDays: Number(item.impactTimeDays ?? 0),
      impactCost: Number(item.impactCost ?? 0),
      criticality: Number(item.criticality ?? 0),
      trafficLight: (item.trafficLight ?? 'Bajo') as RiskRecord['trafficLight'],
      responsible: item.responsible ?? '',
      responsePlan: item.responsePlan ?? '',
      dueDate: this.toInputDate(item.dueDate),
      status: (item.status ?? 'Identificado') as RiskStatus,
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? '',
      updatedAt: item.updatedAt ?? '',
      followUps: item.followUps ?? item.FollowUps ?? []
    };
  }

  private compareRisks(left: RiskRecord, right: RiskRecord): number {
    let comparison = 0;

    switch (this.sortField) {
      case 'title':
        comparison = left.title.localeCompare(right.title);
        break;
      case 'dueDate':
        comparison = this.compareDates(left.dueDate, right.dueDate);
        break;
      case 'criticality':
        comparison = left.criticality - right.criticality;
        break;
      case 'updatedAt':
      default:
        comparison = this.compareDates(left.updatedAt || left.createdAt, right.updatedAt || right.createdAt);
        break;
    }

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private compareDates(left: string, right: string): number {
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return leftTime - rightTime;
  }

  private mapFormToPayload(): any {
    return {
      idProject: this.idProject,
      idContract: this.idContract,
      idWorkProgram: this.form.scope === 'task' ? Number(this.form.conceptId) : null,
      scope: this.form.scope,
      folio: this.form.folio || null,
      title: this.form.title,
      description: this.form.description,
      cause: this.form.cause,
      consequence: this.form.consequence,
      category: this.form.category,
      probability: this.form.probability,
      impactTimeDays: this.form.impactTimeDays,
      impactCost: this.form.impactCost,
      responsible: this.form.responsible,
      responsePlan: this.form.responsePlan,
      dueDate: this.form.dueDate,
      status: this.form.status,
      notes: this.form.notes,
      userName: this.trackingService.getEmail()
    };
  }

  private validateForm(): string {
    if (!this.form.title.trim()) return 'Captura el título del riesgo.';
    if (!this.form.description.trim()) return 'Captura la descripción del riesgo.';
    if (!this.form.category) return 'Selecciona la categoría del riesgo.';
    if (!this.form.scope) return 'Selecciona el alcance del riesgo.';
    if (this.form.scope === 'task' && !this.form.conceptId) return 'Selecciona el concepto asociado al riesgo.';
    if (!this.form.responsible.trim()) return 'Captura el responsable del riesgo.';
    if (!this.form.responsePlan.trim()) return 'Captura el plan de respuesta.';
    if (!this.form.dueDate) return 'Captura la fecha compromiso.';
    if (!this.form.probability || this.form.probability < 1 || this.form.probability > 5) {
      return 'La probabilidad debe estar entre 1 y 5.';
    }
    if (this.form.impactTimeDays < 0) return 'El impacto en tiempo no puede ser negativo.';
    if (this.form.impactCost < 0) return 'El impacto en costo no puede ser negativo.';
    return '';
  }

  private calculateCriticality(probability: number, impactTimeDays: number, impactCost: number): number {
    const timeScale = this.getTimeScale(impactTimeDays);
    const costScale = this.getCostScale(impactCost);
    return probability * Math.max(timeScale, costScale);
  }

  private calculateTrafficLight(probability: number, impactTimeDays: number, impactCost: number): RiskRecord['trafficLight'] {
    const criticality = this.calculateCriticality(probability, impactTimeDays, impactCost);
    if (criticality >= 16) return 'Crítico';
    if (criticality >= 11) return 'Alto';
    if (criticality >= 6) return 'Medio';
    return 'Bajo';
  }

  private getTimeScale(days: number): number {
    if (days >= 15) return 5;
    if (days >= 8) return 4;
    if (days >= 4) return 3;
    if (days >= 2) return 2;
    return 1;
  }

  private getCostScale(amount: number): number {
    if (amount >= 500000) return 5;
    if (amount >= 200000) return 4;
    if (amount >= 100000) return 3;
    if (amount >= 25000) return 2;
    return 1;
  }

  private toInputDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return String(value).slice(0, 10);
  }

  private createEmptyRisk(): RiskRecord {
    return {
      id: null,
      folio: '',
      title: '',
      description: '',
      cause: '',
      consequence: '',
      category: '',
      scope: 'project',
      conceptId: null,
      conceptCode: '',
      conceptName: '',
      probability: 3,
      impactTimeDays: 0,
      impactCost: 0,
      criticality: 3,
      trafficLight: 'Bajo',
      responsible: '',
      responsePlan: '',
      dueDate: '',
      status: 'Identificado',
      notes: '',
      createdAt: '',
      updatedAt: '',
      followUps: []
    };
  }

  private createEmptyFollowUp(): FollowUpForm {
    return {
      id: null,
      comment: '',
      newStatus: '',
      progressPercent: null,
      previousStatus: null
    };
  }
}
