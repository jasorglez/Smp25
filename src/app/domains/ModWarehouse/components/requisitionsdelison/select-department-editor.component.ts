import { Component, OnInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-department-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select
      class="form-select form-select-sm"
      [(ngModel)]="selectedValue"
      (change)="onChange($event)"
      (blur)="onBlur()"
      style="width: 100%; border: none; outline: none; background: transparent;">
      <option value="">Seleccionar departamento...</option>
      <option *ngFor="let option of options" [value]="option.id">
        {{ option.description }}
      </option>
    </select>
  `,
  styles: [`
    select {
      font-size: 12px;
    }
  `]
})
export class SelectDepartmentEditorComponent implements ICellEditorAngularComp, OnInit {

  private params: any;
  selectedValue: any = '';
  options: any[] = [];

  ngOnInit() {}

  agInit(params: any): void {
    this.params = params;
    this.options = params.options || [];

    const value = params.value;
    if (value) {
      const option = this.options.find(o => o.id == value || o.description === value);
      this.selectedValue = option ? option.id : value;
    }
  }

  getValue(): any {
    console.log('🎯 SelectDepartmentEditor.getValue() - selectedValue:', this.selectedValue);

    const selectedOption = this.options.find(o => o.id == this.selectedValue);

    if (selectedOption) {
      const result = {
        id: selectedOption.id,
        name: selectedOption.description
      };
      console.log('✅ Retornando objeto:', result);
      return result;
    }

    console.log('⚠️ No se encontró opción, retornando valor crudo:', this.selectedValue);
    return this.selectedValue;
  }

  isPopup(): boolean {
    return false;
  }

  onChange(event: any) {
    console.log('🔄 onChange disparado - selectedValue:', this.selectedValue);
  }

  onBlur() {
    setTimeout(() => {
      if (this.params.api) {
        this.params.api.stopEditing();
      }
    }, 100);
  }
}