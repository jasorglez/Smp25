import { Component, OnInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-material-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="material-picker">
      <i class="bi bi-search material-picker-search"></i>
      <select [(ngModel)]="selectedValue" (change)="onChange($event)" (blur)="onBlur()" aria-label="Seleccionar material">
        <option value="">Buscar o seleccionar material…</option>
        <option value="__ADD_MATERIAL__">＋ Agregar material nuevo</option>
        <option *ngFor="let option of options" [value]="option.id">{{ option.description }}</option>
      </select>
      <i class="bi bi-chevron-down material-picker-chevron"></i>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .material-picker {
      display: flex; align-items: center; gap: .45rem; width: 100%; min-height: 30px;
      padding: 2px 8px; border: 1px solid #cbd8e8; border-radius: 8px;
      background: linear-gradient(135deg, #fff, #f4f8fd); box-shadow: 0 1px 4px rgba(31, 64, 100, .1);
    }
    .material-picker:focus-within { border-color: #528bd0; box-shadow: 0 0 0 2px rgba(45, 119, 205, .13); }
    .material-picker-search { color: #3979b7; font-size: 12px; }
    select {
      flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #24364b;
      font-size: 12px; font-weight: 500; appearance: none; cursor: pointer;
    }
    .material-picker-chevron { color: #7d8da1; font-size: 10px; pointer-events: none; }
  `]
})
export class SelectMaterialEditorComponent implements ICellEditorAngularComp, OnInit {

  private params: any;
  selectedValue: any = '';
  options: any[] = [];

  ngOnInit() {}

  agInit(params: any): void {
    this.params = params;
    this.options = params.options || [];

    // Set initial value
    const value = params.value;
    if (value) {
      const option = this.options.find(o => o.id == value || o.description === value);
      this.selectedValue = option ? option.id : value;
    }
  }

  getValue(): any {
    const selectedOption = this.options.find(o => o.id == this.selectedValue);
    if (selectedOption) {
      // Return the full object for valueSetter to handle
      return {
        id: selectedOption.id,
        description: selectedOption.description
      };
    }
    return this.selectedValue;
  }

  isPopup(): boolean {
    return false;
  }

  onChange(event: any) {
    if (this.selectedValue === '__ADD_MATERIAL__') {
      this.params.onAddMaterial?.();
      this.params.api?.stopEditing(true);
    }
  }

  onBlur() {
    // Close editor when focus lost
    setTimeout(() => {
      if (this.params.api) {
        this.params.api.stopEditing();
      }
    }, 100);
  }
}
