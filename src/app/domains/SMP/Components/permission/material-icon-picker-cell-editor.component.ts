import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-material-icon-picker-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px;
                width:320px;max-height:260px;display:flex;flex-direction:column;
                box-shadow:0 4px 12px rgba(0,0,0,0.18);z-index:9999;">
      <input
        type="text"
        [(ngModel)]="filter"
        placeholder="Buscar icono Material..."
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
          [style.background]="icon === value ? '#dbeafe' : (hovered === icon ? '#f3f4f6' : 'transparent')"
          (mouseenter)="hovered = icon"
          (mouseleave)="hovered = null"
        >
          <span class="material-icons" style="font-size:18px;width:22px;text-align:center;flex-shrink:0;">{{ icon }}</span>
          <span style="font-size:10px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ icon }}</span>
        </div>
      </div>
    </div>
  `
})
export class MaterialIconPickerCellEditorComponent implements ICellEditorAngularComp {
  value: string = '';
  filter: string = '';
  hovered: string | null = null;
  private params!: ICellEditorParams;

  private readonly allIcons = [
    'home', 'settings', 'people', 'person', 'group',
    'inventory_2', 'warehouse', 'store', 'storefront', 'shopping_cart',
    'diversity_3', 'work', 'badge', 'assignment_ind', 'manage_accounts',
    'bar_chart', 'show_chart', 'pie_chart', 'dashboard', 'analytics',
    'receipt_long', 'request_quote', 'attach_money', 'payments', 'account_balance',
    'build', 'construction', 'engineering', 'handyman', 'plumbing',
    'local_shipping', 'directions_car', 'fork_lift', 'airport_shuttle', 'two_wheeler',
    'factory', 'precision_manufacturing', 'biotech', 'science', 'category',
    'folder', 'folder_open', 'description', 'article', 'summarize',
    'calendar_today', 'schedule', 'timer', 'hourglass_empty', 'date_range',
    'notifications', 'email', 'chat', 'support_agent', 'headset_mic',
    'lock', 'security', 'admin_panel_settings', 'verified_user', 'shield',
    'cloud', 'cloud_upload', 'cloud_download', 'backup', 'sync',
    'print', 'qr_code', 'barcode_reader', 'straighten', 'calculate',
    'map', 'location_on', 'place', 'explore', 'navigation',
    'star', 'favorite', 'thumb_up', 'check_circle', 'flag',
    'logout', 'login', 'power_settings_new', 'refresh', 'help',
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
