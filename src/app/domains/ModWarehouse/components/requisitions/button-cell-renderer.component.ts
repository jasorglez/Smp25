import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IRowNode } from 'ag-grid-community';
import { CommonModule } from '@angular/common';

// Creamos una interfaz personalizada que extiende la de ag-Grid
export interface IButtonCellRendererParams extends ICellRendererParams {
  onClick: (node: IRowNode) => void;
  icon?: string;
  title?: string;
}

@Component({
  selector: 'app-button-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="btn btn-xs btn-outline-primary w-100 py-0 px-1" (click)="onClick($event)" [title]="params.title || 'Hacer clic para ver el detalle'" style="font-size: 0.7rem; line-height: 1.2;">
      <i [class]="iconClass" style="font-size: 0.7rem;"></i>
      <span style="font-size: 0.7rem;">{{ value }}</span>
    </button>
  `,
  styles: [`
    .btn-xs {
      padding: 1px 4px;
      font-size: 0.7rem;
      line-height: 1.2;
    }
  `]
})
export class ButtonCellRendererComponent implements ICellRendererAngularComp {
  public params!: IButtonCellRendererParams; // Usamos nuestra interfaz personalizada
  public value: string | number;
  public iconClass: string;

  agInit(params: IButtonCellRendererParams): void { // Usamos nuestra interfaz personalizada
    this.params = params;
    this.value = this.params.value || 0;
    this.iconClass = this.params.icon || 'bi-folder2-open';
  }

  refresh(params: IButtonCellRendererParams): boolean { // Asegurarse de que el refresco actualice el valor
    this.params = params; // Actualizar los parámetros
    this.value = this.params.value || 0; // Actualizar el valor mostrado
    return true; // Indicar que el componente ha manejado el refresco
  }

  onClick(event: any): void {
    this.params.onClick(this.params.node);
  }
}
