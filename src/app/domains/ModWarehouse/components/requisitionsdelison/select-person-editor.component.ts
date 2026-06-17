import { inject, Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-person-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select
      class="form-select form-select-sm"
      [(ngModel)]="selectedValue"
      (change)="onChange($event)"
      (blur)="onBlur()"
      style="width: 100%; border: none; outline: none; background: transparent;">
      <option value="">Seleccionar persona...</option>
      <option *ngFor="let option of options" [value]="option.id">
        {{ option.name }}
      </option>
    </select>
  `,
  styles: [`
    select {
      font-size: 12px;
    }
  `]
})
export class SelectPersonEditorComponent implements ICellEditorAngularComp, OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  private params: any;
  selectedValue: any = '';
  options: any[] = [];

  ngOnInit() {}

  agInit(params: any): void {
    this.params = params;
    this.options = params.options || [];

    const value = params.value;
    if (value) {
      const option = this.options.find(o => o.id == value || o.name === value);
      this.selectedValue = option ? option.id : value;
    }
  
    this.cdr.detectChanges();}

  getValue(): any {
    const selectedOption = this.options.find(o => o.id == this.selectedValue);
    if (selectedOption) {
      return {
        id: selectedOption.id,
        name: selectedOption.name
      };
    }
    return this.selectedValue;
  }

  isPopup(): boolean {
    return false;
  }

  onChange(event: any) {}

  onBlur() {
    setTimeout(() => {
      if (this.params.api) {
        this.params.api.stopEditing();
      }
    }, 100);
  }
}
