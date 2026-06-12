import { Component, ElementRef, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';

/** Params opcionales vía colDef.cellEditorParams */
export interface MaterialIconPickerEditorParams extends ICellEditorParams {
  /** Si se envía, solo se listan estos iconos (ej. pantalla Security). */
  icons?: string[];
  /** Si es true, el listado muestra solo glifos (el nombre va en tooltip). Por defecto false: icono + texto. */
  iconsOnly?: boolean;
}

@Component({
  selector: 'app-material-icon-picker-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:10px;
                width:280px;max-height:260px;display:flex;flex-direction:column;
                box-shadow:0 10px 24px rgba(15,23,42,0.16);z-index:9999;">
      <input
        type="text"
        [(ngModel)]="filter"
        placeholder="Buscar..."
        style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #ddd;
               border-radius:6px;margin-bottom:8px;outline:none;"
        (click)="$event.stopPropagation()"
      />
      <div style="overflow-y:auto;flex:1;min-height:0;">
        <!-- Vista solo iconos (cuadrícula) -->
        <div
          *ngIf="iconsOnly"
          style="display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;">
          <button
            type="button"
            *ngFor="let icon of filteredIcons"
            (mousedown)="selectIcon(icon, $event)"
            [title]="icon"
            style="cursor:pointer;border:1px solid #e5e7eb;background:#fafafa;
                   border-radius:8px;width:40px;height:40px;padding:0;display:flex;
                   align-items:center;justify-content:center;transition:background .15s, border-color .15s, transform .1s;"
            [style.background]="icon === value ? '#dbeafe' : (hovered === icon ? '#f3f4f6' : '#fafafa')"
            [style.borderColor]="icon === value ? '#93c5fd' : '#e5e7eb'"
            (mouseenter)="hovered = icon"
            (mouseleave)="hovered = null"
          >
            <span class="material-icons" style="font-size:22px;color:#1e293b;">{{ icon }}</span>
          </button>
        </div>
        <!-- Vista icono + nombre (comportamiento anterior) -->
        <ng-container *ngIf="!iconsOnly">
          <div
            *ngFor="let icon of filteredIcons"
            (mousedown)="selectIcon(icon, $event)"
            style="cursor:pointer;padding:3px 6px;display:flex;align-items:center;
                   gap:8px;border-radius:3px;transition:background 0.1s;"
            [style.background]="icon === value ? '#dbeafe' : (hovered === icon ? '#f3f4f6' : 'transparent')"
            (mouseenter)="hovered = icon"
            (mouseleave)="hovered = null"
          >
            <span class="material-icons" style="font-size:18px;width:22px;text-align:center;flex-shrink:0;">{{ icon }}</span>
            <span style="font-size:10px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ icon }}</span>
          </div>
        </ng-container>
      </div>
    </div>
  `
})
export class MaterialIconPickerCellEditorComponent implements ICellEditorAngularComp, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  value: string = '';
  filter: string = '';
  hovered: string | null = null;
  iconsOnly = false;
  private params!: ICellEditorParams;
  private sourceIcons: string[] = [];
  /** Cierra el editor al pulsar fuera del popup (fase captura). */
  private docListenerAttached = false;
  private readonly onPointerDownDoc = (event: PointerEvent) => {
    const root = this.host.nativeElement;
    const t = event.target as Node | null;
    if (t && root.contains(t)) return;
    this.params?.stopEditing(false);
  };

  private detachOutsideClick(): void {
    if (!this.docListenerAttached) return;
    document.removeEventListener('pointerdown', this.onPointerDownDoc, true);
    this.docListenerAttached = false;
  }

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
    const list = this.sourceIcons.length ? this.sourceIcons : this.allIcons;
    return f ? list.filter((i) => i.toLowerCase().includes(f)) : list;
  }

  agInit(params: ICellEditorParams): void {
    this.params = params;
    this.value = params.value || '';
    const p = params as MaterialIconPickerEditorParams;
    this.iconsOnly = !!p.iconsOnly;
    this.sourceIcons = Array.isArray(p.icons) && p.icons.length > 0 ? [...p.icons] : [];
  }

  afterGuiAttached(): void {
    // Diferir un tick para no cerrar con el mismo clic que abrió la celda
    queueMicrotask(() => {
      document.addEventListener('pointerdown', this.onPointerDownDoc, true);
      this.docListenerAttached = true;
    });
  }

  destroy(): void {
    this.detachOutsideClick();
  }

  ngOnDestroy(): void {
    this.detachOutsideClick();
  }

  getValue(): string {
    return this.value;
  }

  isPopup(): boolean {
    return true;
  }

  selectIcon(icon: string, ev?: Event): void {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    this.value = icon;
    this.params.stopEditing();
  }
}
