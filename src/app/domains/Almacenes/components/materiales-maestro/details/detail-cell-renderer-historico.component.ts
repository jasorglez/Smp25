import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-detail-cell-renderer-historico',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px;">
        <strong>Histórico para: {{ materialName }}</strong>
      </div>
      <ag-grid-angular
        style="width: 100%; flex-grow: 1;"
        class="ag-theme-quartz small-text-ag-grid"
        [columnDefs]="historicoColumnDefs"
        [rowData]="historicoRowData"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)">
      </ag-grid-angular>
    </div>
  `
})
export class DetailCellRendererHistoricoComponent implements ICellRendererAngularComp {
  public params!: ICellRendererParams;
  public materialName: string = '';
  private gridApi!: GridApi;

  public historicoRowData: any[] = [];
  public gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
  };

  public historicoColumnDefs: ColDef[] = [
    { headerName: 'Fecha Guardado', field: 'fecha', width: 100 },
    { headerName: 'Num. Material', field: 'material', width: 100 },
    { headerName: 'Articulo', field: 'articulo', width: 120 },
    { headerName: 'Acción', field: 'accion', width: 100 },
    { headerName: 'Campo', field: 'campo', width: 100 },
    { headerName: 'Valor Anterior', field: 'valorAnterior', width: 120 },
    { headerName: 'Valor Nuevo', field: 'valorNuevo', width: 120 },
    { headerName: 'IP', field: 'ip', width: 100 },
    { headerName: 'Navegador2', field: 'navegador2', width: 120 },
    { headerName: 'Sistema', field: 'sistema', width: 100 },
    { headerName: 'Comentario', field: 'comentario', width: 150 },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialName = params.data.articulo || 'N/A';
    this.historicoRowData = this.generateFakeHistoricoData(10);
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
  }

  private generateFakeHistoricoData(rowCount: number): any[] {
    const acciones = ['Crear', 'Editar', 'Eliminar', 'Actualizar'];
    const campos = ['insumo', 'articulo', 'vigente', 'costo', 'stockMin'];
    const usuarios = ['admin', 'user1', 'user2', 'manager'];
    const navegadores = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const sistemas = ['Windows', 'macOS', 'Linux', 'Android'];

    const data = [];
    for (let i = 0; i < rowCount; i++) {
      data.push({
        fecha: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
        usuario: usuarios[Math.floor(Math.random() * usuarios.length)],
        accion: acciones[Math.floor(Math.random() * acciones.length)],
        campo: campos[Math.floor(Math.random() * campos.length)],
        valorAnterior: Math.random().toString(36).substring(7),
        valorNuevo: Math.random().toString(36).substring(7),
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        navegador: navegadores[Math.floor(Math.random() * navegadores.length)],
        sistema: sistemas[Math.floor(Math.random() * sistemas.length)],
        comentario: `Cambio ${i + 1} realizado automáticamente`
      });
    }
    return data;
  }
}
