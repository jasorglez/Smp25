import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { EmployeesService } from 'app/services/employees.service';
import { EvidenceCaptureService, EvidenceFile } from 'app/services/evidence-capture.service';

@Component({
  selector: 'app-ot-app',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './ot-app.component.html',
  styleUrl: './ot-app.component.scss'
})
export class OtAppComponent {
  private otService = inject(OtService);
  private signalsService = inject(SignalsService);
  private employeesService = inject(EmployeesService);
  private evidenceCaptureService = inject(EvidenceCaptureService);

  selectedOT: string = '';
  selectedEmployee: string = '';
  selectedOTDescription: string = '';
  selectedOTData: any = null;
  selectedResultType: string = '';
  results: string = '';
  
  otOptions: any[] = [];
  employeeOptions: any[] = [];
  idProject: number = 0;
  idRoot: number = 0;
  
  resultTypeOptions = [
    { value: 'exitoso', label: 'Exitoso' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'cancelado', label: 'Cancelado' }
  ];
  
  assistantEmployees: any[] = [];
  resultTypesCompleted: any[] = [];
  evidenceFiles: EvidenceFile[] = [];

  constructor() {
    effect(() => {
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.loadOTOptions();
      this.loadEmployees();
    });
  }

  loadOTOptions() {
    if (this.idProject) {
      this.otService.getOtListByProject(this.idProject).subscribe({
        next: (data: any) => {
          console.log('OT obtenidas:', data);
          this.otOptions = data.map((ot: any) => ({
            value: ot.id,
            label: ot.otNumber,
            description: ot.description,
            data: ot
          }));
        },
        error: (error) => {
          console.error('Error al obtener OT:', error);
          this.otOptions = [];
        }
      });
    }
  }

  loadEmployees() {
    if (this.idRoot) {
      const idBranch = -this.idRoot; // Convertir a negativo como se requiere
      
      this.employeesService.getEmployees(idBranch).subscribe({
        next: (response: any) => {
          console.log('Empleados obtenidos:', response);
          
          if (response && Array.isArray(response)) {
            // El endpoint devuelve directamente un array de empleados
            this.employeeOptions = response.map((emp: any) => ({
              value: emp.id,
              label: emp.name,
              data: emp
            }));
          } else if (response && response.data && Array.isArray(response.data)) {
            // Por si acaso viene encapsulado en un objeto con propiedad data
            this.employeeOptions = response.data.map((emp: any) => ({
              value: emp.id,
              label: emp.name,
              data: emp
            }));
          } else {
            this.employeeOptions = [];
            console.log('No se encontraron empleados o formato inesperado:', response);
          }
        },
        error: (error) => {
          console.error('Error al obtener empleados:', error);
          this.employeeOptions = [];
        }
      });
    }
  }

  onEmployeeSelected() {
    if (this.selectedEmployee) {
      const employeeOption = this.employeeOptions.find(emp => emp.value.toString() === this.selectedEmployee);
      if (employeeOption && !this.assistantEmployees.find(emp => emp.id === employeeOption.value)) {
        this.assistantEmployees.push({
          id: employeeOption.value,
          name: employeeOption.label,
          data: employeeOption.data
        });
        this.selectedEmployee = ''; // Limpiar selección
      }
    }
  }

  removeAssistantEmployee(employeeId: any) {
    this.assistantEmployees = this.assistantEmployees.filter(emp => emp.id !== employeeId);
  }

  onOTSelected() {
    if (this.selectedOT) {
      const selectedOTOption = this.otOptions.find(ot => ot.value.toString() === this.selectedOT);
      this.selectedOTDescription = selectedOTOption?.description || '';
      this.selectedOTData = selectedOTOption?.data || null;
    } else {
      this.selectedOTDescription = '';
      this.selectedOTData = null;
    }
  }

  async onAddEvidence() {
    await this.evidenceCaptureService.presentImageSourceOptions();
    this.updateEvidenceFiles();
  }

  updateEvidenceFiles() {
    this.evidenceFiles = this.evidenceCaptureService.getEvidenceFiles();
  }

  removeEvidence(id: string) {
    this.evidenceCaptureService.removeEvidenceFile(id);
    this.updateEvidenceFiles();
  }

  clearAllEvidence() {
    this.evidenceCaptureService.clearAllEvidence();
    this.updateEvidenceFiles();
  }

  getEvidenceCount(): number {
    return this.evidenceCaptureService.getEvidenceCount();
  }

  async previewEvidence(evidence: EvidenceFile) {
    await this.evidenceCaptureService.previewEvidence(evidence);
  }
}