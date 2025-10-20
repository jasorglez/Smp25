import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-modal-material',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './modal-material.component.html',
  styleUrls: ['./modal-material.component.scss']
})
export class ModalMaterialComponent implements OnInit {

  @Input() material: any = null;
  @Input() isEdit: boolean = false;

  materialForm: FormGroup;
  submitting: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder
  ) {
    this.materialForm = this.fb.group({
      activo: [true],
      numMat: ['', [Validators.required]],
      articulo: ['', [Validators.required]],
      categoria: ['', [Validators.required]],
      familia: ['', [Validators.required]],
      subfamilia: ['', [Validators.required]],
      proveedor: ['', [Validators.required]],
      imagen: ['']
    });
  }

  ngOnInit(): void {
    if (this.isEdit && this.material) {
      this.materialForm.patchValue({
        activo: this.material.activo,
        numMat: this.material.numMat,
        articulo: this.material.articulo,
        categoria: this.material.categoria,
        familia: this.material.familia,
        subfamilia: this.material.subfamilia,
        proveedor: this.material.proveedor,
        imagen: this.material.imagen
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.materialForm.invalid) {
      alerts.basicAlert('Formulario inválido', 'Por favor complete todos los campos requeridos', 'warning');
      return;
    }

    this.submitting = true;

    try {
      const formData = this.materialForm.value;

      if (this.isEdit) {
        // Editar material existente
        const updatedMaterial = {
          ...this.material,
          ...formData
        };
        this.activeModal.close(updatedMaterial);
        alerts.basicAlert('Actualizado', 'El material ha sido actualizado correctamente', 'success');
      } else {
        // Crear nuevo material
        const newMaterial = {
          id: Date.now(), // ID temporal
          ...formData,
          proveedoresData: [],
          familiaData: []
        };
        this.activeModal.close(newMaterial);
        alerts.basicAlert('Creado', 'El material ha sido creado correctamente', 'success');
      }
    } catch (error) {
      console.error('Error al guardar material:', error);
      alerts.basicAlert('Error', 'No se pudo guardar el material', 'error');
    } finally {
      this.submitting = false;
    }
  }

  onCancel(): void {
    this.activeModal.dismiss();
  }
}
