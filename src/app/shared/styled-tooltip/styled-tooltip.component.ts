import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';

/**
 * Tooltip estándar del proyecto (diseño azul degradado, esquinas redondeadas, sombra).
 * Uso en AG Grid: en la colDef poner `tooltipComponent: StyledTooltipComponent` y
 * `tooltipValueGetter` devolviendo un string. Si el string trae varias líneas separadas
 * por "\n", la PRIMERA línea se muestra como encabezado (negrita) y el resto como cuerpo.
 */
@Component({
  selector: 'app-styled-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="styled-tooltip" *ngIf="lines.length || title">
      <div class="st-header" *ngIf="title">{{ title }}</div>
      <div class="st-body">
        <div class="st-line" *ngFor="let l of lines">{{ l }}</div>
      </div>
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
      max-width: 360px;
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
    .st-body { padding: 8px 12px; line-height: 1.5; }
    .st-line { white-space: nowrap; }
  `]
})
export class StyledTooltipComponent implements ITooltipAngularComp {
  title = '';
  lines: string[] = [];

  agInit(params: ITooltipParams): void {
    const raw = (params.value ?? '').toString();
    const parts = raw.split('\n').filter(s => s.trim() !== '');
    if (parts.length > 1) {
      this.title = parts[0];
      this.lines = parts.slice(1);
    } else {
      this.title = '';
      this.lines = parts;
    }
  }
}
