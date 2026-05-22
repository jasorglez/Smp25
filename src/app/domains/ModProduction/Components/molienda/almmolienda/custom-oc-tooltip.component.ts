import { Component } from '@angular/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-custom-oc-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-tooltip-container">
      <div class="tooltip-header">Órdenes de Compra</div>
      <div *ngIf="!ocs || ocs.length === 0" class="no-data">Sin órdenes de compra vinculadas</div>
      <div class="oc-card" *ngFor="let oc of ocs">
        <div class="oc-row"><strong>Folio:</strong> {{ oc.folio || '—' }}</div>
        <div class="oc-row"><strong>Proveedor:</strong> {{ oc.proveedor || '—' }}</div>
        <div class="oc-row"><strong>Cantidad:</strong> <span class="qty">{{ oc.cantidad || 0 }}</span></div>
      </div>
    </div>
  `,
  styles: [`
    .custom-tooltip-container {
      background: #3574e6;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      min-width: 260px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      pointer-events: none;
    }
    .tooltip-header {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
    }
    .no-data { color: #64748b; font-size: 12px; font-style: italic; }
    .oc-card {
      background: #f8fafc; /* Fondo gris claro */
      border-left: 4px solid #3b82f6; /* Borde izquierdo azul */
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05); /* Sombra ligera */
    }
    .oc-card:last-child { margin-bottom: 0; }
    .oc-row { margin-bottom: 2px; font-size: 12px; color: #334155; }
    .oc-row strong { color: #475569; margin-right: 4px; }
    .qty { color: #059669; font-weight: 700; }
  `]
})
export class CustomOcTooltipComponent implements ITooltipAngularComp {
  public ocs: any[] = [];
  agInit(params: ITooltipParams): void {
    // El valor devuelto por tooltipValueGetter llega aquí en params.value
    this.ocs = params.value || [];
  }
}