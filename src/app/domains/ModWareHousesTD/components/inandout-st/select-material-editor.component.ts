import { Component, OnInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-material-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select
      class="form-select form-select-sm"
      [(ngModel)]="selectedValue"
      (change)="onChange($event)"
      (blur)="onBlur()"
      style="width: 100%; border: none; outline: none; background: transparent;">
      <option value="">Seleccionar material...</option>
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
    // Optional: could trigger immediate update
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
