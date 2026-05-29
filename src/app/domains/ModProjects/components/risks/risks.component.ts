import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { RiskmatrixService } from 'app/services/riskmatrix.service';
import { SignalsService } from 'app/services/signals.service';
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
  taskId: number | null;
  taskName: string;
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

interface TaskOption {
  id: number | null;
  name: string;
}

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

  readonly projectName = this.signalsService.getProjectNameBySidebar();

  idProject: number = null;
  idContract: number = null;
  conventionName = '';
  typeWorkProgram: 'Project' | 'Contract' = 'Project';

  isLoading = false;
  isSaving = false;
  searchTerm = '';
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

  taskOptions: TaskOption[] = [];
  risks: RiskRecord[] = [];
  form: RiskRecord = this.createEmptyRisk();

  constructor() {
    effect(() => {
      this.idContract = this.signalsService.getContractSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.conventionName = this.signalsService.getConventionVigente()()?.name ?? '';
      this.typeWorkProgram = this.idProject == null ? 'Contract' : 'Project';
      this.loadTasksAndRisks();
    });
  }

  get filteredRisks(): RiskRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.risks;
    }

    return this.risks.filter(risk =>
      risk.folio.toLowerCase().includes(term)
      || risk.title.toLowerCase().includes(term)
      || risk.category.toLowerCase().includes(term)
      || risk.status.toLowerCase().includes(term)
      || risk.responsible.toLowerCase().includes(term)
      || risk.taskName.toLowerCase().includes(term)
    );
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

  loadTasksAndRisks(): void {
    this.taskOptions = [];
    this.risks = [];
    this.selectedRiskId = null;
    this.form = this.createEmptyRisk();

    if (!this.idProject) {
      return;
    }

    this.isLoading = true;
    const sourceId = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;

    this.workprogramsService.getWorkPrograms(sourceId, this.typeWorkProgram).subscribe({
      next: (data: any[]) => {
        this.taskOptions = (data || [])
          .filter(item => (item.typeActivity ?? '').toLowerCase() !== 'project')
          .map(item => ({
            id: item.idEntry ?? item.id ?? null,
            name: item.text ?? item.name ?? item.activity ?? `Tarea ${item.idEntry ?? item.id ?? ''}`.trim()
          }));
        this.loadRisks();
      },
      error: () => {
        this.taskOptions = [];
        this.loadRisks();
      }
    });
  }

  addRisk(): void {
    this.selectedRiskId = null;
    this.form = this.createEmptyRisk();
  }

  selectRisk(risk: RiskRecord): void {
    this.selectedRiskId = risk.id;
    this.form = { ...risk };
  }

  onScopeChanged(): void {
    if (this.form.scope !== 'task') {
      this.form.taskId = null;
      this.form.taskName = '';
    }
  }

  onTaskChanged(): void {
    const selectedTask = this.taskOptions.find(task => task.id === Number(this.form.taskId));
    this.form.taskName = selectedTask?.name ?? '';
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
        alerts.basicAlert('Error', 'No fue posible guardar el riesgo PMO.', 'error');
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

  private loadRisks(): void {
    this.riskmatrixService.getPmoRisks(this.idProject, this.idContract).subscribe({
      next: (data: any[]) => {
        this.risks = (data || []).map(item => this.mapApiRiskToRecord(item));
        this.isLoading = false;
      },
      error: () => {
        this.risks = [];
        this.isLoading = false;
      }
    });
  }

  private mapApiRiskToRecord(item: any): RiskRecord {
    const taskId = item.idWorkProgram ?? null;
    const taskName = this.taskOptions.find(task => task.id === taskId)?.name ?? '';
    return {
      id: item.id ?? null,
      folio: item.folio ?? '',
      title: item.title ?? '',
      description: item.description ?? '',
      cause: item.cause ?? '',
      consequence: item.consequence ?? '',
      category: item.category ?? '',
      scope: (item.scope ?? 'project') as RiskScope,
      taskId,
      taskName,
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
      followUps: item.followUps ?? []
    };
  }

  private mapFormToPayload(): any {
    return {
      idProject: this.idProject,
      idContract: this.idContract,
      idWorkProgram: this.form.scope === 'task' ? Number(this.form.taskId) : null,
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
      notes: this.form.notes
    };
  }

  private validateForm(): string {
    if (!this.form.title.trim()) return 'Captura el título del riesgo.';
    if (!this.form.description.trim()) return 'Captura la descripción del riesgo.';
    if (!this.form.category) return 'Selecciona la categoría del riesgo.';
    if (!this.form.scope) return 'Selecciona el alcance del riesgo.';
    if (this.form.scope === 'task' && !this.form.taskId) return 'Selecciona la tarea asociada al riesgo.';
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
      taskId: null,
      taskName: '',
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
}
