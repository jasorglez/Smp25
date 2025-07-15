import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OtService } from 'app/services/ot.service';
import { TrackingService } from 'app/services/tracking.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';

export interface OtDetails {
  id: number;
  registerDate: string;
  idProject: number;
  otNumber: string;
  assignedTo: string;
  description: string;
  timeLimit: string;
  nameConsumer: string;
  propertyNumber: string;
  contractNumber: string;
  phoneConsumer: string;
  address: string;
  addressNumber: string;
  oldAddressNumber: string;
  neighborhood: string;
  addressReferences: string;
  addressCrossings: string;
  chargePhase: string;
  cdc: string;
  hydrometerNumber: string;
  period: string;
  lectureWater: string;
  observations: string;
  results: string;
  active: boolean;
}

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export class DetailsComponent implements OnInit {
  
  private fb = inject(FormBuilder);
  private otService = inject(OtService);
  private trackingService = inject(TrackingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  
  public otForm: FormGroup;
  public isEditMode: boolean = false;
  public isLoading: boolean = false;
  public otId: number | null = null;

  constructor() {
    this.otForm = this.createForm();
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.otId = +params['id'];
        this.isEditMode = true;
        this.loadOtDetails(this.otId);
      } else {
        this.initializeNewOt();
      }
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      registerDate: [new Date().toISOString().split('T')[0], [Validators.required]],
      idProject: [0, [Validators.required, Validators.min(1)]],
      otNumber: ['', [Validators.required, Validators.maxLength(50)]],
      assignedTo: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      timeLimit: ['', [Validators.required]],
      nameConsumer: ['', [Validators.required, Validators.maxLength(100)]],
      propertyNumber: ['', [Validators.maxLength(50)]],
      contractNumber: ['', [Validators.maxLength(50)]],
      phoneConsumer: ['', [Validators.maxLength(20)]],
      address: ['', [Validators.maxLength(200)]],
      addressNumber: ['', [Validators.maxLength(20)]],
      oldAddressNumber: ['', [Validators.maxLength(20)]],
      neighborhood: ['', [Validators.maxLength(100)]],
      addressReferences: ['', [Validators.maxLength(200)]],
      addressCrossings: ['', [Validators.maxLength(200)]],
      chargePhase: ['', [Validators.maxLength(50)]],
      cdc: ['', [Validators.maxLength(50)]],
      hydrometerNumber: ['', [Validators.maxLength(50)]],
      period: ['', [Validators.maxLength(50)]],
      lectureWater: ['', [Validators.maxLength(50)]],
      observations: ['', [Validators.maxLength(1000)]],
      results: ['', [Validators.maxLength(1000)]],
      active: [true]
    });
  }

  private initializeNewOt() {
    // Obtener el proyecto seleccionado del sidebar
    const selectedProject = this.signalsService.getProjectSelectedBySidebar();
    
    this.otForm.patchValue({
      registerDate: new Date().toISOString().split('T')[0],
      idProject: selectedProject ? selectedProject() : 0,
      active: true
    });
  }

  private loadOtDetails(id: number) {
    this.isLoading = true;
    this.otService.getOtDetails(id).subscribe({
      next: (data: any) => {
        const otData = data.data || data;
        
        // Verificar autorización del proyecto
        if (!this.checkProjectAuthorization(otData)) {
          this.router.navigate(['/projects/ot/ordenes']);
          return;
        }
        
        setTimeout(() => {
          this.populateForm(otData);
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 100);
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Cargar Detalle OT ID: ${id}`,
          'Menu Proyectos OT Detalles',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al cargar detalles de OT:', error);
        this.isLoading = false;
        alert('Error al cargar los detalles de la OT');
      }
    });
  }

  private populateForm(otData: any) {
    if (!this.otForm || !otData) {
      return;
    }

    // Encontrar la estructura correcta de datos
    let actualData = otData;
    if (Array.isArray(otData) && otData.length > 0) {
      actualData = otData[0];
    } else if (otData && otData.data) {
      actualData = otData.data;
    }

    // Convertir fechas al formato correcto para input date
    let registerDate = '';
    let timeLimit = '';
    
    try {
      registerDate = actualData.registerDate ? 
        new Date(actualData.registerDate).toISOString().split('T')[0] : '';
      timeLimit = actualData.timeLimit ? 
        new Date(actualData.timeLimit).toISOString().split('T')[0] : '';
    } catch (error) {
      console.error('Error converting dates:', error);
    }

    // Poblar el formulario usando patchValue
    const formData = {
      registerDate: registerDate,
      idProject: actualData.idProject !== undefined ? actualData.idProject : 0,
      otNumber: actualData.otNumber !== undefined ? actualData.otNumber : '',
      assignedTo: actualData.assignedTo !== undefined ? actualData.assignedTo : '',
      description: actualData.description !== undefined ? actualData.description : '',
      timeLimit: timeLimit,
      nameConsumer: actualData.nameConsumer !== undefined ? actualData.nameConsumer : '',
      propertyNumber: actualData.propertyNumber !== undefined ? actualData.propertyNumber : '',
      contractNumber: actualData.contractNumber !== undefined ? actualData.contractNumber : '',
      phoneConsumer: actualData.phoneConsumer !== undefined ? actualData.phoneConsumer : '',
      address: actualData.address !== undefined ? actualData.address : '',
      addressNumber: actualData.addressNumber !== undefined ? actualData.addressNumber : '',
      oldAddressNumber: actualData.oldAddressNumber !== undefined ? actualData.oldAddressNumber : '',
      neighborhood: actualData.neighborhood !== undefined ? actualData.neighborhood : '',
      addressReferences: actualData.addressReferences !== undefined ? actualData.addressReferences : '',
      addressCrossings: actualData.addressCrossings !== undefined ? actualData.addressCrossings : '',
      chargePhase: actualData.chargePhase !== undefined ? actualData.chargePhase : '',
      cdc: actualData.cdc !== undefined ? actualData.cdc : '',
      hydrometerNumber: actualData.hydrometerNumber !== undefined ? actualData.hydrometerNumber : '',
      period: actualData.period !== undefined ? actualData.period : '',
      lectureWater: actualData.lectureWater !== undefined ? actualData.lectureWater : '',
      observations: actualData.observations !== undefined ? actualData.observations : '',
      results: actualData.results !== undefined ? actualData.results : '',
      active: actualData.active !== undefined ? actualData.active : true
    };

    this.otForm.patchValue(formData);
    this.otForm.updateValueAndValidity();
  }

  onSubmit() {
    if (this.otForm.valid) {
      this.isLoading = true;
      const formData = this.prepareFormData();

      if (this.isEditMode && this.otId) {
        this.updateOt(formData);
      } else {
        this.createOt(formData);
      }
    } else {
      this.markFormGroupTouched();
      alert('Por favor complete todos los campos requeridos');
    }
  }

  private prepareFormData(): OtDetails {
    const formValue = this.otForm.value;
    
    // Para nuevas OTs, asegurar que el idProject siempre sea el del signal
    let idProject = formValue.idProject;
    if (!this.isEditMode) {
      const selectedProject = this.signalsService.getProjectSelectedBySidebar();
      idProject = selectedProject ? selectedProject() : 0;
    }
    
    return {
      id: this.otId || 0,
      registerDate: new Date(formValue.registerDate).toISOString(),
      idProject: idProject,
      otNumber: formValue.otNumber,
      assignedTo: formValue.assignedTo,
      description: formValue.description,
      timeLimit: new Date(formValue.timeLimit).toISOString(),
      nameConsumer: formValue.nameConsumer,
      propertyNumber: formValue.propertyNumber,
      contractNumber: formValue.contractNumber,
      phoneConsumer: formValue.phoneConsumer,
      address: formValue.address,
      addressNumber: formValue.addressNumber,
      oldAddressNumber: formValue.oldAddressNumber,
      neighborhood: formValue.neighborhood,
      addressReferences: formValue.addressReferences,
      addressCrossings: formValue.addressCrossings,
      chargePhase: formValue.chargePhase,
      cdc: formValue.cdc,
      hydrometerNumber: formValue.hydrometerNumber,
      period: formValue.period,
      lectureWater: formValue.lectureWater,
      observations: formValue.observations,
      results: formValue.results,
      active: formValue.active
    };
  }

  private createOt(otData: OtDetails) {
    this.otService.addOt(otData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Crear Nueva OT',
          'Menu Proyectos OT Detalles',
          this.trackingService.getEmail()
        );
        alert('OT creada exitosamente');
        this.router.navigate(['../'], { relativeTo: this.route });
      },
      error: (error) => {
        console.error('Error al crear OT:', error);
        this.isLoading = false;
        alert('Error al crear la OT');
      }
    });
  }

  private updateOt(otData: OtDetails) {
    this.otService.updateOt(this.otId!, otData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Actualizar OT ID: ${this.otId}`,
          'Menu Proyectos OT Detalles',
          this.trackingService.getEmail()
        );
        alert('OT actualizada exitosamente');
        this.router.navigate(['../'], { relativeTo: this.route });
      },
      error: (error) => {
        console.error('Error al actualizar OT:', error);
        this.isLoading = false;
        alert('Error al actualizar la OT');
      }
    });
  }

  private markFormGroupTouched() {
    Object.keys(this.otForm.controls).forEach(key => {
      this.otForm.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.otForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.otForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
      if (field.errors['min']) return `El valor mínimo es ${field.errors['min'].min}`;
    }
    return '';
  }

  onCancel() {
    if (this.otForm.dirty) {
      if (confirm('¿Está seguro de que desea cancelar? Se perderán los cambios no guardados.')) {
        this.router.navigate(['../'], { relativeTo: this.route });
      }
    } else {
      this.router.navigate(['../'], { relativeTo: this.route });
    }
  }

  onReset() {
    if (confirm('¿Está seguro de que desea restablecer el formulario?')) {
      if (this.isEditMode && this.otId) {
        this.loadOtDetails(this.otId);
      } else {
        this.otForm.reset();
        this.initializeNewOt();
      }
    }
  }

  private checkProjectAuthorization(otData: any): boolean {
    const selectedProject = this.signalsService.getProjectSelectedBySidebar();
    
    if (!selectedProject) {
      console.warn('No hay proyecto seleccionado en el sidebar');
      return false;
    }
    
    const selectedProjectId = selectedProject();
    const otProjectId = otData.idProject || (Array.isArray(otData) ? otData[0]?.idProject : otData.data?.idProject);
    
    if (!otProjectId || selectedProjectId !== otProjectId) {
      console.warn(`Proyecto no autorizado. Seleccionado: ${selectedProjectId}, OT pertenece a: ${otProjectId}`);
      return false;
    }
    
    return true;
  }

  onDelete() {
    if (!this.isEditMode || !this.otId) {
      alert('No se puede eliminar una OT que no ha sido guardada');
      return;
    }

    if (confirm('¿Está seguro de que desea eliminar esta OT? Esta acción no se puede deshacer.')) {
      this.isLoading = true;
      this.otService.deleteOt(this.otId).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            `Eliminar OT ID: ${this.otId}`,
            'Menu Proyectos OT Detalles',
            this.trackingService.getEmail()
          );
          alert('OT eliminada exitosamente');
          this.router.navigate(['../'], { relativeTo: this.route });
        },
        error: (error) => {
          console.error('Error al eliminar OT:', error);
          this.isLoading = false;
          alert('Error al eliminar la OT');
        }
      });
    }
  }
}