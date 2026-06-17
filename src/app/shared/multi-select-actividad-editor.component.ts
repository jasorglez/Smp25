import { inject, Component, ElementRef, OnInit, ViewChild, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

export interface ActividadOption {
  id: number;
  actividad: string;
  periodicidad: string | null;
  group?: string;
}

function daysUntil(date: Date): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

@Component({
  selector: 'app-multi-select-actividad-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="msa-container" #container>
      <div class="msa-header">{{ title }}</div>
      <div class="msa-list">
        <ng-container *ngFor="let act of options; let i = index">
          <div *ngIf="act.group && (i === 0 || options[i-1].group !== act.group)"
               class="msa-group-header">{{ act.group }}</div>
          <label class="msa-item"
                 [class.msa-item--checked]="isSelected(act.id)"
                 [class.msa-item--blocked]="isBlocked(act.id)">
            <input type="checkbox" [checked]="isSelected(act.id)"
                   [disabled]="isBlocked(act.id)"
                   (change)="toggle(act.id)">
            <div class="msa-info">
              <span class="msa-name" [class.msa-name--blocked]="isBlocked(act.id)">{{ act.actividad }}</span>
              <span *ngIf="blockedLabel(act.id) as label" class="msa-badge msa-badge--blocked">{{ label }}</span>
              <span *ngIf="!blockedLabel(act.id) && act.periodicidad && act.periodicidad !== 'Ninguno'" class="msa-badge">{{ act.periodicidad }}</span>
            </div>
          </label>
        </ng-container>
        <div *ngIf="options.length === 0" class="msa-empty">Sin opciones en catálogo</div>
      </div>
      <div class="msa-footer">
        <span class="msa-count">{{ selectedCount }}/{{ options.length }} seleccionados</span>
        <button class="btn btn-sm btn-primary" (click)="confirm()">Aceptar</button>
        <button class="btn btn-sm btn-secondary ms-1" (click)="cancel()">Cancelar</button>
      </div>
    </div>
  `,
  styles: [`
    .msa-container {
      background: #fff; border: 1px solid #dee2e6; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 0; width: 280px; z-index: 9999;
      overflow: hidden;
    }
    .msa-header {
      background: #e8f5e9; border-bottom: 1px solid #c3e6cb; padding: 6px 10px;
      font-size: 0.78rem; font-weight: 600; color: #155724;
    }
    .msa-list {
      max-height: 260px; overflow-y: auto; display: flex; flex-direction: column;
      padding: 4px 0;
    }
    .msa-item {
      display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px;
      cursor: pointer; transition: background 0.1s;
    }
    .msa-item:hover { background: #f1f8f2; }
    .msa-item--checked { background: #e8f5e9; }
    .msa-item--checked:hover { background: #d4edda; }
    .msa-item input[type=checkbox] { cursor: pointer; flex-shrink: 0; margin-top: 2px; }
    .msa-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .msa-name { font-size: 0.82rem; color: #212529; white-space: normal; word-break: break-word; }
    .msa-badge {
      display: inline-block; font-size: 0.67rem; padding: 0 5px; border-radius: 10px;
      background: #d1ecf1; color: #0c5460; font-weight: 500; width: fit-content;
    }
    .msa-group-header {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      color: #6c757d; padding: 6px 10px 2px; background: #f8f9fa; border-top: 1px solid #e9ecef;
    }
    .msa-group-header:first-child { border-top: none; }
    .msa-empty { font-size: 0.78rem; color: #9e9e9e; text-align: center; padding: 16px; }
    .msa-item--blocked { opacity: 0.55; cursor: not-allowed; }
    .msa-item--blocked input { cursor: not-allowed; }
    .msa-name--blocked { color: #6c757d; }
    .msa-badge--blocked { background: #f8d7da; color: #721c24; }
    .msa-footer {
      display: flex; align-items: center; gap: 6px; justify-content: flex-end;
      padding: 6px 10px; border-top: 1px solid #e9ecef; background: #f8f9fa;
    }
    .msa-count { font-size: 0.75rem; color: #6c757d; margin-right: auto; }
  `]
})
export class MultiSelectActividadEditorComponent implements ICellEditorAngularComp, OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private params: any;
  options: ActividadOption[] = [];
  title = 'Actividades realizadas';
  private selected: Set<number> = new Set();
  private availableIds: Set<number> | null = null;
  private nextAvailableDates: Map<number, Date> | null = null;

  agInit(params: any): void {
    this.params             = params;
    this.options            = (params.options as ActividadOption[]) ?? [];
    this.title              = params.title ?? 'Actividades realizadas';
    this.availableIds       = params.availableIds ?? null;
    this.nextAvailableDates = params.nextAvailableDates ?? null;
    const raw: string = params.value ?? '[]';
    try { (JSON.parse(raw) as number[]).forEach(id => this.selected.add(id)); } catch { /* empty */ }
  
    this.cdr.detectChanges();}

  isBlocked(id: number): boolean {
    if (!this.availableIds) return false;
    return !this.availableIds.has(id) && !this.selected.has(id);
  }

  blockedLabel(id: number): string | null {
    if (!this.nextAvailableDates) return null;
    const next = this.nextAvailableDates.get(id);
    if (!next) return null;
    const days = daysUntil(next);
    return days <= 1 ? 'mañana' : `en ${days} días`;
  }

  ngOnInit(): void {}

  isPopup(): boolean { return true; }

  getValue(): string { return JSON.stringify([...this.selected]); }

  get selectedCount(): number { return this.selected.size; }

  isSelected(id: number): boolean { return this.selected.has(id); }

  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  confirm(): void { this.params.stopEditing(); }
  cancel(): void  { this.params.stopEditing(true); }
}
