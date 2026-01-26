import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-pedimentos-items',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <!-- Barra de botones CRUD -->
      <div style="margin-bottom: 5px; display: flex; justify-content: flex-end; align-items: center; flex-shrink: 0;">
        <div class="d-flex gap-1">
          <button class="btn btn-primary btn-xs position-relative" (click)="save()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                  *ngIf="hasUnsavedChanges">
            </span>
          </button>
          <button class="btn btn-warning btn-xs" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-xs" (click)="delete()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>

      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    .btn-xs {
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
      line-height: 1.3;
    }
  `]
})
export class DetailCellRendererPedimentosItemsComponent {
  private params!: ICellRendererParams;
  private context: any;
  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  selectedRow: any = null;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.buildRowData();
  }

  buildRowData() {
    const articulos = this.params.data.articulos || [];
    console.log('📋 buildRowData - articulos recibidos:', articulos);

    // Mapear todos los items
    const mappedItems = articulos.map((item: any, index: number) => {
      console.log(`   Item ${index}: pedimento (solicitado) = ${item.pedimento}, pedimentoNum = "${item.pedimentoNum}"`);
      return {
        recurrent: item.recurrent || '',
        articulo: item.nameArticle || item.description || item.article,
        numeroArticulo: item.numArticle || (index + 1),
        cantidad: item.quantity,
        tipo: item.intorext || item.tipo,
        proveedorInterno: item.proveedorInterno,
        tipoPrioridad: item.typePriority || item.priority,
        observacion: item.observation || item.observaciones || '',
        pedimento: item.pedimento || false, // ✅ Booleano: true = solicitado, false = solo snapshot
        pedimentoNumber: item.pedimentoNum || '',
        numeroPedimento: this.params.data.pedimento // ✅ Número de pedimento (1, 2, 3...)
      };
    });

    // ✅ Ordenar: items solicitados (pedimento: true) primero, luego los de contexto (pedimento: false)
    this.rowData = mappedItems.sort((a, b) => {
      if (a.pedimento === b.pedimento) return 0;
      return a.pedimento ? -1 : 1; // true (-1) viene antes que false (1)
    });

    console.log(`✅ Ordenados: ${this.rowData.filter(i => i.pedimento).length} solicitados, ${this.rowData.filter(i => !i.pedimento).length} de contexto`);

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
  }

  checkPedimentoSelection() {
    // This method can be used to check if any pedimento is selected
    // For now, it's a placeholder to match the requisitions component
  }

  delete() {
    if (this.selectedRow) {
      this.rowData = this.rowData.filter(item => item !== this.selectedRow);
      this.selectedRow = null;
      this.hasUnsavedChanges = true;
    }
  }

  save() {
    console.log('💾 Guardando cambios...', this.rowData);
    // TODO: Implementar lógica de guardado
    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
    this.hasUnsavedChanges = false;
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 120
      },
      {
        field: 'articulo',
        headerName: 'Articulo',
        width: 200
      },
      {
        field: 'numeroArticulo',
        headerName: '# Articulo',
        width: 120
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 130
      },
      {
        field: 'proveedorInterno',
        headerName: 'Proveedor Interno',
        width: 200
      },
      {
        field: 'tipoPrioridad',
        headerName: 'Tipo Prioridad',
        width: 150
      },
      {
        field: 'observacion',
        headerName: 'Observation',
        width: 200
      },
      {
        field: 'pedimento',
        headerName: 'Solicitado',
        width: 120,
        cellRenderer: (params: any) => {
          const isChecked = params.value === true ? 'checked' : '';
          const icon = params.value === true ? '✓' : '○';
          const color = params.value === true ? '#28a745' : '#6c757d';
          return `<div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <input type="checkbox" ${isChecked} disabled style="cursor: not-allowed; width: 13px; height: 13px;" />
                    <span style="color: ${color}; font-weight: bold;">${icon}</span>
                  </div>`;
        },
        cellStyle: (params: any) => {
          return params.value === true
            ? { textAlign: 'center', backgroundColor: '#d4edda' }
            : { textAlign: 'center', backgroundColor: '#f8f9fa' };
        },
        tooltipValueGetter: (params: any) => {
          return params.value === true
            ? 'Item solicitado en este pedimento'
            : 'Item de contexto (no solicitado)';
        }
      },
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onRowClicked: (event: any) => {
      this.selectedRow = event.data;
    }
  };
}
