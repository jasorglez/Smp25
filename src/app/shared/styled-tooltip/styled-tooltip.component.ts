import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';

/**
 * Tooltip estándar del proyecto (diseño azul degradado, esquinas redondeadas, sombra).
 *
 * Modo TEXTO (uso clásico): `tooltipValueGetter` devuelve un string. Si trae varias líneas
 * separadas por "\n", la PRIMERA es el encabezado (negrita) y el resto el cuerpo.
 *
 * Modo TABLA: `tooltipValueGetter` devuelve un objeto
 *   { title?: string, table: { headers: string[], rows: string[][], totalFmt?: string } }
 * Renderiza una tabla; si viene `totalFmt`, agrega una fila con línea divisora y el total
 * alineado bajo la última columna.
 */
@Component({
  selector: 'app-styled-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="styled-tooltip" *ngIf="lines.length || title || table || (summary && summary.length) || extra">
      <div class="st-header" *ngIf="title">{{ title }}</div>

      <!-- Modo texto -->
      <div class="st-body" *ngIf="!table">
        <div class="st-line" *ngFor="let l of lines">{{ l }}</div>
      </div>

      <!-- Resumen (pares label:value mostrados una sola vez, sobre la tabla) -->
      <div class="st-summary" *ngIf="summary && summary.length">
        <div class="st-summary-item" *ngFor="let s of summary">
          <span class="st-summary-label">{{ s[0] }}:</span>
          <span class="st-summary-value">{{ s[1] }}</span>
        </div>
      </div>

      <!-- Modo tabla -->
      <div class="st-tablewrap" *ngIf="table">
        <table class="st-table">
          <thead>
            <tr>
              <th *ngFor="let h of table.headers; let i = index" [class.num]="i > 0">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of table.rows">
              <td *ngFor="let c of r; let i = index" [class.num]="i > 0">{{ c }}</td>
            </tr>
          </tbody>
          <tfoot *ngIf="table.totalFmt">
            <tr class="st-total">
              <td [attr.colspan]="table.headers.length - 1"></td>
              <td class="num st-total-cell">{{ table.totalFmt }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Bloque extra (subtítulo + resumen + tabla), p. ej. el ledger del anticipo bajo el pago -->
      <ng-container *ngIf="extra">
        <div class="st-subheader" *ngIf="extra.title">{{ extra.title }}</div>
        <div class="st-summary" *ngIf="extra.summary && extra.summary.length">
          <div class="st-summary-item" *ngFor="let s of extra.summary">
            <span class="st-summary-label">{{ s[0] }}:</span>
            <span class="st-summary-value">{{ s[1] }}</span>
          </div>
        </div>
        <div class="st-tablewrap" *ngIf="extra.table">
          <table class="st-table">
            <thead>
              <tr>
                <th *ngFor="let h of extra.table.headers; let i = index" [class.num]="i > 0">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of extra.table.rows">
                <td *ngFor="let c of r; let i = index" [class.num]="i > 0">{{ c }}</td>
              </tr>
            </tbody>
            <tfoot *ngIf="extra.table.totalFmt">
              <tr class="st-total">
                <td [attr.colspan]="extra.table.headers.length - 1"></td>
                <td class="num st-total-cell">{{ extra.table.totalFmt }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .styled-tooltip {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      color: #ffffff;
      font-size: 12px;
      min-width: 200px;
      max-width: 460px;
      overflow: hidden;
    }
    .st-header {
      font-weight: 700;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.10);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .st-subheader {
      font-weight: 700;
      padding: 6px 12px;
      margin-top: 4px;
      background: rgba(255, 255, 255, 0.10);
      border-top: 1px solid rgba(255, 255, 255, 0.25);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .st-body { padding: 8px 12px; line-height: 1.5; }
    .st-line { white-space: nowrap; }

    .st-summary {
      padding: 8px 12px 0 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 18px;
    }
    .st-summary-item { white-space: nowrap; }
    .st-summary-label { color: rgba(255,255,255,0.8); font-weight: 600; margin-right: 4px; }
    .st-summary-value { font-weight: 700; }

    .st-tablewrap { padding: 8px 12px; }
    .st-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .st-table th, .st-table td { padding: 3px 8px; white-space: nowrap; }
    .st-table th {
      text-align: left;
      font-weight: 700;
      border-bottom: 1px solid rgba(255, 255, 255, 0.35);
    }
    .st-table th.num, .st-table td.num { text-align: right; }
    .st-table tbody td { color: rgba(255, 255, 255, 0.92); }
    .st-total-cell {
      font-weight: 700;
      border-top: 2px solid rgba(255, 255, 255, 0.7);
      padding-top: 4px;
    }
  `]
})
export class StyledTooltipComponent implements ITooltipAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  title = '';
  lines: string[] = [];
  table: { headers: string[]; rows: string[][]; totalFmt?: string } | null = null;
  summary: [string, string][] | null = null;
  extra: { title?: string; summary?: [string, string][]; table?: { headers: string[]; rows: string[][]; totalFmt?: string } } | null = null;

  agInit(params: ITooltipParams): void {
    const v: any = params.value;

    // Modo tabla: objeto con { table: {...}, title?, summary?, extra? }
    if (v && typeof v === 'object' && (v.table || v.summary || v.extra)) {
      this.table = v.table ?? null;
      this.summary = v.summary ?? null;
      this.extra = v.extra ?? null;
      this.title = v.title ?? '';
      this.lines = [];
      return;
    }

    // Modo texto (comportamiento clásico)
    this.table = null;
    this.summary = null;
    this.extra = null;
    const raw = (v ?? '').toString();
    const parts = raw.split('\n').filter((s: string) => s.trim() !== '');
    if (parts.length > 1) {
      this.title = parts[0];
      this.lines = parts.slice(1);
    } else {
      this.title = '';
      this.lines = parts;
    }
  
    this.cdr.detectChanges();}
}
