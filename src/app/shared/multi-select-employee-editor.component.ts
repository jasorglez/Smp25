import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

export interface EmployeeOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-multi-select-employee-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mse-container" #container>
      <input #searchInput class="mse-search" type="text" [(ngModel)]="searchText"
             placeholder="Buscar empleado…" (input)="onSearch()" autocomplete="off">
      <div class="mse-list">
        <label *ngFor="let emp of filtered" class="mse-item">
          <input type="checkbox" [checked]="isSelected(emp.id)"
                 (change)="toggle(emp.id)">
          <span>{{ emp.name }}</span>
        </label>
        <div *ngIf="filtered.length === 0" class="mse-empty">Sin resultados</div>
      </div>
      <div class="mse-footer">
        <button class="btn btn-sm btn-primary" (click)="confirm()">Aceptar</button>
        <button class="btn btn-sm btn-secondary ms-1" (click)="cancel()">Cancelar</button>
      </div>
    </div>
  `,
  styles: [`
    .mse-container {
      background: #fff; border: 1px solid #dee2e6; border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 8px; width: 240px; z-index: 9999;
    }
    .mse-search {
      width: 100%; border: 1px solid #ced4da; border-radius: 4px;
      padding: 4px 8px; font-size: 0.82rem; margin-bottom: 6px; outline: none;
    }
    .mse-search:focus { border-color: #86b7fe; box-shadow: 0 0 0 2px rgba(13,110,253,.25); }
    .mse-list {
      max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
    }
    .mse-item {
      display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 3px;
      cursor: pointer; font-size: 0.8rem;
    }
    .mse-item:hover { background: #f8f9fa; }
    .mse-item input[type=checkbox] { cursor: pointer; flex-shrink: 0; }
    .mse-empty { font-size: 0.78rem; color: #9e9e9e; text-align: center; padding: 8px; }
    .mse-footer { display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 6px; border-top: 1px solid #e9ecef; }
  `]
})
export class MultiSelectEmployeeEditorComponent implements ICellEditorAngularComp, OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  private params: any;
  options: EmployeeOption[] = [];
  filtered: EmployeeOption[] = [];
  searchText = '';
  private selected: Set<number> = new Set();

  agInit(params: any): void {
    this.params = params;
    this.options = (params.options as EmployeeOption[]) ?? [];
    this.filtered = [...this.options];
    const raw: string = params.value ?? '[]';
    try { (JSON.parse(raw) as number[]).forEach(id => this.selected.add(id)); } catch { /* empty */ }
  }

  ngOnInit(): void {
    setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 50);
  }

  ngOnDestroy(): void {}

  isPopup(): boolean { return true; }
  getValue(): string { return JSON.stringify([...this.selected]); }

  isSelected(id: number): boolean { return this.selected.has(id); }

  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  onSearch(): void {
    const q = this.searchText.toLowerCase();
    this.filtered = q ? this.options.filter(e => e.name.toLowerCase().includes(q)) : [...this.options];
  }

  confirm(): void {
    this.params.stopEditing();
  }

  cancel(): void {
    this.params.stopEditing(true);
  }
}
