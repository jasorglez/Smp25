import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-icon-picker-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px;
                width:300px;max-height:240px;display:flex;flex-direction:column;
                box-shadow:0 4px 12px rgba(0,0,0,0.18);z-index:9999;">
      <input
        type="text"
        [(ngModel)]="filter"
        placeholder="Buscar icono..."
        style="width:100%;padding:3px 6px;font-size:11px;border:1px solid #ddd;
               border-radius:4px;margin-bottom:4px;outline:none;"
        (click)="$event.stopPropagation()"
      />
      <div style="overflow-y:auto;flex:1;">
        <div
          *ngFor="let icon of filteredIcons"
          (mousedown)="selectIcon(icon)"
          style="cursor:pointer;padding:3px 6px;display:flex;align-items:center;
                 gap:8px;border-radius:3px;transition:background 0.1s;"
          [style.background]="icon === value ? '#dbeafe' : 'transparent'"
          (mouseenter)="hovered = icon"
          (mouseleave)="hovered = null"
          [style.background]="icon === value ? '#dbeafe' : (hovered === icon ? '#f3f4f6' : 'transparent')"
        >
          <i [class]="icon" style="font-size:15px;width:18px;text-align:center;flex-shrink:0;"></i>
          <span style="font-size:10px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ icon }}</span>
        </div>
      </div>
    </div>
  `
})
export class IconPickerCellEditorComponent implements ICellEditorAngularComp {
  value: string = '';
  filter: string = '';
  hovered: string | null = null;
  private params!: ICellEditorParams;

  private readonly allIcons = [
    'bi bi-houses', 'bi bi-boxes', 'bi bi-box-seam', 'bi bi-journal-text',
    'bi bi-gear-fill', 'bi bi-gear', 'bi bi-people-fill', 'bi bi-person-bounding-box',
    'bi bi-cash-coin', 'bi bi-stopwatch', 'bi bi-list-task', 'bi bi-cart-fill',
    'bi bi-file-earmark-person-fill', 'bi bi-archive-fill', 'bi bi-shop',
    'bi bi-wallet2', 'bi bi-graph-up', 'bi bi-pc-display-horizontal',
    'bi bi-arrow-bar-down', 'bi bi-arrow-bar-up', 'bi bi-building-fill-gear',
    'bi bi-globe2', 'bi bi-box-arrow-in-right', 'bi bi-person-fill',
    'bi bi-shield-fill', 'bi bi-bar-chart-fill', 'bi bi-clipboard-data',
    'bi bi-truck', 'bi bi-tools', 'bi bi-wrench-adjustable',
    'bi bi-calculator', 'bi bi-currency-dollar', 'bi bi-file-earmark-text',
    'bi bi-calendar3', 'bi bi-clock', 'bi bi-bell-fill',
    'bi bi-list-ul', 'bi bi-tag-fill', 'bi bi-star-fill',
    'bi bi-building', 'bi bi-diagram-3', 'bi bi-kanban',
  ];

  get filteredIcons(): string[] {
    const f = this.filter.toLowerCase().trim();
    return f ? this.allIcons.filter(i => i.includes(f)) : this.allIcons;
  }

  agInit(params: ICellEditorParams): void {
    this.params = params;
    this.value = params.value || '';
  }

  getValue(): string {
    return this.value;
  }

  isPopup(): boolean {
    return true;
  }

  selectIcon(icon: string): void {
    this.value = icon;
    this.params.stopEditing();
  }
}
