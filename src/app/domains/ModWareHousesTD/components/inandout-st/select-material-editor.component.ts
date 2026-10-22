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
      <input
        [(ngModel)]="searchTerm"
        (ngModelChange)="showOptions = true"
        (focus)="showOptions = true"
        (keydown.escape)="params?.api?.stopEditing(true)"
        [placeholder]="selectedLabel || 'Buscar por código o descripción…'"
        aria-label="Buscar material por código o descripción">
      <div class="material-picker-options" *ngIf="showOptions">
        <button type="button" *ngFor="let option of filteredOptions" (mousedown)="$event.preventDefault(); selectOption(option)">
          <strong *ngIf="option.code">{{ option.code }}</strong>
          <span>{{ option.description }}</span>
          <small *ngIf="option.brandName" class="material-brand">{{ option.brandName }}</small>
          <small *ngIf="option.availableStock !== undefined" class="material-stock">
            Existencia: {{ option.availableStock | number:'1.0-2' }}
          </small>
        </button>
        <button type="button" class="add-material-option" *ngIf="params?.onAddMaterial" (mousedown)="$event.preventDefault(); addMaterial()">
          <i class="bi bi-plus-lg"></i> Agregar material nuevo
        </button>
        <small *ngIf="filteredOptions.length === 0" class="no-results">Sin coincidencias</small>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .material-picker {
      position: relative; display: flex; align-items: center; gap: .45rem; width: 310px; min-height: 34px;
      padding: 3px 8px; border: 1px solid #cbd8e8; border-radius: 8px;
      background: #fff; box-shadow: 0 3px 12px rgba(31, 64, 100, .14);
    }
    .material-picker:focus-within { border-color: #528bd0; box-shadow: 0 0 0 2px rgba(45, 119, 205, .13); }
    .material-picker-search { color: #3979b7; font-size: 12px; }
    input {
      flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #24364b;
      font-size: 10px; font-weight: 500; appearance: none; cursor: pointer;
    }
    .material-picker-options {
      position: absolute; z-index: 1000; top: calc(100% + 3px); left: 0; right: 0; max-height: 250px;
      overflow-y: auto; padding: 4px; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff;
      box-shadow: 0 8px 20px rgba(28, 48, 72, .18);
    }
    .material-picker-options button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 5px; background: transparent; color: #26364a; text-align: left; font-size: 10px; }
    .material-picker-options button:hover { background: #edf5ff; }
    .material-picker-options strong { min-width: 66px; color: #2769a6; }
    .material-picker-options button > span { flex: 1; min-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .material-picker-options .material-brand { color: #7556a6; white-space: nowrap; }
    .material-picker-options .material-stock { margin-left: auto; white-space: nowrap; color: #35734a; font-size: 9px; }
    .material-picker-options .add-material-option { color: #18794e; font-weight: 600; border-top: 1px solid #e8edf3; margin-top: 3px; }
    .no-results { display: block; padding: 7px 8px; color: #79879a; }
  `]
})
export class SelectMaterialEditorComponent implements ICellEditorAngularComp, OnInit {

  params: any;
  selectedValue: any = '';
  private selectedOption: any = null;
  options: any[] = [];
  searchTerm = '';
  showOptions = false;
  selectedLabel = '';

  get filteredOptions(): any[] {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    if (!term) return this.options.filter(option => option.id !== '__ADD_MATERIAL__');
    return this.options.filter(option => option.id !== '__ADD_MATERIAL__' &&
      `${option.code || ''} ${option.description || ''} ${option.brandName || ''}`.toLocaleLowerCase().includes(term));
  }

  ngOnInit() {}

  agInit(params: any): void {
    this.params = params;
    this.options = params.options || [];
    this.showOptions = true;

    // Set initial value
    const value = params.value;
    if (value) {
      const option = this.options.find(o =>
        (o.id == value || o.description === value) &&
        (params.currentIdBrand == null ? o.idBrand == null : Number(o.idBrand) === Number(params.currentIdBrand))
      ) || this.options.find(o => o.id == value || o.description === value);
      this.selectedValue = option ? option.id : value;
      this.selectedOption = option || null;
      this.selectedLabel = option
        ? `${option.code ? `${option.code} · ` : ''}${option.description}${option.brandName ? ` · ${option.brandName}` : ''}`
        : String(value);
    }
  }

  getValue(): any {
    const selectedOption = this.selectedOption || this.options.find(o => o.id == this.selectedValue);
    if (selectedOption) {
      // Return the full object for valueSetter to handle
      return {
        id: selectedOption.id,
        description: selectedOption.description,
        idBrand: selectedOption.idBrand ?? null,
        brandName: selectedOption.brandName || '',
        availableStock: selectedOption.availableStock
      };
    }
    return this.selectedValue;
  }

  isPopup(): boolean {
    return true;
  }

  selectOption(option: any): void {
    this.selectedValue = option.id;
    this.selectedOption = option;
    this.selectedLabel = `${option.code ? `${option.code} · ` : ''}${option.description}${option.brandName ? ` · ${option.brandName}` : ''}`;
    this.showOptions = false;
    this.params.api?.stopEditing();
  }

  addMaterial(): void {
    this.showOptions = false;
    this.params.onAddMaterial?.();
    this.params.api?.stopEditing(true);
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
