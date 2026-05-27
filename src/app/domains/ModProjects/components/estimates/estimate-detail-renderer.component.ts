import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { GeneratorsComponent } from './generators.component';

@Component({
  selector: 'app-estimate-detail-renderer',
  standalone: true,
  imports: [CommonModule, GeneratorsComponent],
  template: `
    <div style="padding: 12px 16px; background: #f5f0ff;
                border-left: 4px solid #673ab7;
                height: 100%; box-sizing: border-box; overflow-y: auto;">

      <!-- Cabecera del detalle -->
      <div class="d-flex align-items-center gap-2 mb-2">
        <i class="bi bi-gear-wide-connected text-purple" style="color:#673ab7; font-size:1.1rem;"></i>
        <strong style="color:#673ab7;">Generadores — Estimación {{ estimacion?.number }}</strong>
        <span class="badge bg-light text-dark border ms-1">
          {{ estimacion?.typeMoney }} · {{ estimacion?.dateStart | date:'dd/MM/yy' }} – {{ estimacion?.dateEnd | date:'dd/MM/yy' }}
        </span>
      </div>

      <!-- Componente de Generadores -->
      <app-generators [idEstimacion]="estimacion?.id"></app-generators>
    </div>
  `,
})
export class EstimateDetailRendererComponent implements ICellRendererAngularComp {

  estimacion: any = null;

  agInit(params: ICellRendererParams): void {
    this.estimacion = params.data;
  }

  refresh(_params: ICellRendererParams): boolean { return false; }
}
