import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DetallesComponentCuentas } from './subdetalles/Detalles-Cuentas.component';
import { DetallesComponentCuentasAbono } from './subdetalles/Detalles-Cuentas-abono.component';

@Component({
  selector: 'app-detail-cell-renderer-cuentas',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule, DetallesComponentCuentas, DetallesComponentCuentasAbono],
  template: `
    <div 
      style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Cuenta -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Abonos de: {{ providerName }}</strong>
          <!--<div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addCuenta()"
              [disabled]="!cuentaGridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveCuentas()"
              [disabled]="!hasCuentaChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedCuenta()"
              [disabled]="!selectedCuenta">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>-->
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="cuentaColumnDefs"
          [rowData]="cuentaRowData"
          [gridOptions]="cuentaGridOptions"
          (gridReady)="onCuentaGridReady($event)"
          (cellValueChanged)="onCuentaCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentCuentas implements ICellRendererAngularComp {

  params: any;
  providerId: number;
  providerName: string;
  cuentaRowData: any[] = [];
  hasCuentaChanges: boolean = false;
  cuentaGridApi: any;
  selectedCuenta: any = null;
  private collapseTimer: any = null;

  components = {
    detallesCuentasRenderer: DetallesComponentCuentas,
    DetallesComponentCuentasAbono: DetallesComponentCuentasAbono
  };
  
  cuentaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
     isRowMaster: (dataItem) => {
    // Asignar un detailType por defecto si no existe para evitar errores en el selector
    if (!dataItem.detailType) dataItem.detailType = 'campo11';
    return true; // Todas las filas de proveedores son maestras
  },
    //detailCellRenderer: 'detallesCuentasRenderer',
    detailCellRendererSelector: (params) => {

    // Decide qué renderizador usar basado en la propiedad 'detailType'
    if (params.data.detailType === 'campo5') {
      params.node.setRowHeight(800);
      return {
        component: 'DetallesComponentCuentasAbono',
        params: {
          onMouseEnter: () => {clearTimeout(this.collapseTimer)},
          onMouseLeave: () => {
            this.collapseTimer = setTimeout(() => {
              params.node.setExpanded(false);
            }, 300); // Un retardo de 300ms
          },
        }
      };
    } else if (params.data.detailType === 'campo11') {
      params.node.setRowHeight(800);
      return {
        component: 'detallesCuentasRenderer',
        params: {
          onMouseEnter: () => {clearTimeout(this.collapseTimer)},
          onMouseLeave: () => {
            this.collapseTimer = setTimeout(() => params.node.setExpanded(false), 300);
          },
        }
      };
    }else
    return undefined; // No mostrar detalle si no hay tipo
  },
  detailCellRendererParams: {
    // Se inicializa vacío, se llenará en agInit
  },
  onFirstDataRendered: (params) => {

    // Obtener todas las columnas
    const allColumnIds: string[] = [];
    params.api.getColumns()?.forEach((column: any) => {
      allColumnIds.push(column.getId());
    });


    // Autoajustar todas las columnas al contenido (skipHeader=false incluye header en el cálculo)
    params.api.autoSizeColumns(allColumnIds, false);

  }
  };

  private readonly cdr = inject(ChangeDetectorRef);

  constructor(private currencyPipe: CurrencyPipe) {}

  cuentaColumnDefs = [
    {
      field: 'campo3',
      headerName: 'Fecha Requisicion',
      editable: false,
      flex: 1
    },
    {
      field: 'id',
      headerName: 'Requisicion',

    },

    {
      field: 'campo8',
      headerName: 'Fecha OC',
      editable: true,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: '2020-01-01',
        max: '2030-12-31'
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
        const dateValue = params.value.split('T')[0];
        const [year, month, day] = dateValue.split('-');
        return `${day}/${month}/${year}`;
      },
      valueParser: (params) => {
        // Convertir DD/MM/YYYY a YYYY-MM-DD para guardar
        if (!params.newValue) return '';

        // Si ya viene en formato YYYY-MM-DD (del date picker), usar así
        if (params.newValue.includes('-')) {
          return params.newValue.split('T')[0];
        }

        // Si viene en formato DD/MM/YYYY, convertir
        const [day, month, year] = params.newValue.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      },
      valueSetter: (params) => {
        if (params.newValue) {
          let dateValue;

          // Si es un objeto Date (del date picker)
          if (params.newValue instanceof Date) {
            const year = params.newValue.getFullYear();
            const month = String(params.newValue.getMonth() + 1).padStart(2, '0');
            const day = String(params.newValue.getDate()).padStart(2, '0');
            dateValue = `${year}-${month}-${day}`;
          }
          // Si es string y contiene guiones (formato YYYY-MM-DD)
          else if (typeof params.newValue === 'string' && params.newValue.includes('-')) {
            dateValue = params.newValue.split('T')[0];
          }
          // Si es string y contiene barras (formato DD/MM/YYYY)
          else if (typeof params.newValue === 'string' && params.newValue.includes('/')) {
            const [day, month, year] = params.newValue.split('/');
            dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          // Si es otro tipo de string, intentar parsearlo
          else if (typeof params.newValue === 'string') {
            dateValue = params.newValue;
          }

          params.data[params.colDef.field] = dateValue;
        } else {
          params.data[params.colDef.field] = '';
        }
        return true;
      },
      flex: 1
    },
    {
      field: 'campo2',
      headerName: 'Tipo Factura/Nota',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['FACTURA', 'NOTA'] // Opciones del selector
      },
      flex: 1
    },
    {
      field: 'campo11',
      headerName: 'Numero Factura/Nota',
      editable: false,
      // Este cellRenderer muestra el ícono y el valor, y permite expandir/colapsar el detalle al hacer clic
      cellRenderer: this.createDetailToggleCellRenderer('campo11'),
      flex: 1,
      cellStyle: { backgroundColor: '#d4edda' }
    },
    { 
      field: 'campo4', 
      headerName: 'Total por nota', 
      editable: false, 
      flex: 1,
      
      valueFormatter: params => {
        const isNumeric = params.value !== null && params.value !== '' && !isNaN(Number(params.value));
        return isNumeric ? this.currencyPipe.transform(params.value, '', 'symbol', '1.2-2') : '$0.00';
      }
    },

    {
      field: 'campo5',
      headerName: 'Abono a Cuenta',
      editable: false,
      // Este cellRenderer muestra el ícono y el valor, y permite expandir/colapsar el detalle al hacer clic
      cellRenderer: this.createDetailToggleCellRenderer('campo5'),
      flex: 1,
      cellStyle: { backgroundColor: '#d4edda' },
    },
    { 
      field: 'campo6', 
      headerName: 'Restante', 
      editable: false, 
      flex: 1,
      valueFormatter: params => {
        const isNumeric = params.value !== null && params.value !== '' && !isNaN(Number(params.value));
        return isNumeric ? this.currencyPipe.transform(params.value, 'MXN', 'symbol-narrow', '1.2-2') : '$0.00';
      }
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    
    // Asegurarse de que el contexto se pase al gridOptions del detalle
    this.cuentaGridOptions.detailCellRendererParams.context = params.context;
    this.loadCuentaData();
    this.cdr.detectChanges();
  }

  refresh(): boolean {
    return false;
  }
  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');
      // Validar que el valor sea numérico antes de pasarlo al pipe
      switch
      (detailType) {
        case 'campo5':
          const isNumeric = params.value !== null && params.value !== '' && !isNaN(Number(params.value));
          const value = isNumeric ? this.currencyPipe.transform(params.value, '', 'symbol', '1.2-2') : '$0.00';
          div.innerHTML = `${value}`;
        break;
        case 'campo11':
          div.innerHTML = `${params.value}`;
        break;
      }


      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';
      div.style.color = '#0d6efd';

      div.addEventListener('click', () => {
        const node = params.node;
        const api = params.api;
        const isCurrentlyExpanded = node.expanded && params.data.detailType === detailType;

        if (isCurrentlyExpanded) {
          // Si ya está expandido con el mismo detalle, simplemente colapsar y limpiar el filtro.
          node.setExpanded(false);
          api.setFilterModel(null);
          api.onFilterChanged(); // Aplicar el filtro nulo
        } else {
          // Si no está expandido, o se cambia de detalle (Articulo -> Abono)
          // 1. Colapsar cualquier otra fila que pudiera estar abierta.
          api.forEachNode(otherNode => {
            if (otherNode.expanded && otherNode.id !== node.id) {
              otherNode.setExpanded(false);
            }
          });

          // 2. Establecer el filtro para mostrar solo la fila actual y aplicarlo.
          api.setFilterModel({ id: { type: 'equals', filter: params.data.id } });
          api.onFilterChanged();

          // 3. Establecer el tipo de detalle y expandir
          params.data.detailType = detailType;
          node.setExpanded(true);
        }
      });

      return div;
    };
  }

  onCellMouseOver(event: any) {
    if (event.column.getColId() === 'campo5') {
      if (this.collapseTimer) clearTimeout(this.collapseTimer);
      this.cuentaGridApi.forEachNode(node => node.setExpanded(false));
      event.node.setExpanded(true);
    }
  }

  onCellMouseOut(event: any) {
    if (event.column.getColId() === 'campo5') {
      this.collapseTimer = setTimeout(() => {
        event.node.setExpanded(false);
      }, 300);
    }
  }

  onCuentaGridReady(params: any) {
    this.cuentaGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedCuenta = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onCuentaCellValueChanged(event: any) {
    if (event.newValue !== event.oldValue) {
      event.data.__modified = true;
      this.hasCuentaChanges = true;
    }
  }

  loadCuentaData(onComplete?: () => void) {
    if (this.params && this.params.context && this.params.context.CUENTA && this.params.context.CUENTA.load) {
      this.params.context.CUENTA.load(this.providerId, 'CUENTA', (data: any) => {
        this.cuentaRowData = data;

        // Ejecutar callback si existe
        if (onComplete) {
          setTimeout(() => onComplete(), 100);
        }
      });
    }
  }

  addCuenta() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Los meses son base 0
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const newCuenta = {
      id: `temp_cuenta_${Date.now()}`,
      idTabla: this.providerId,
      type: 'CUENTA',
      campo4: '',
      campo5: '',
      campo6: '0',
      campo3: '0',
      campo8: formattedDate, // Asignar la fecha de hoy
      __isNew: true
    };
    this.cuentaRowData = [newCuenta, ...this.cuentaRowData];
    this.hasCuentaChanges = true;
  }

  async saveCuentas() {
    if (this.params && this.params.context && this.params.context.CUENTA.save) {
      try {
        // Guardar la fila seleccionada actual para restaurarla después
        const selectedRow = this.selectedCuenta;
        const selectedCuentaId = selectedRow?.id;
        const selectedCuentaFecha = selectedRow?.campo3; // Fecha requisicion como respaldo
        const selectedCuentaNumero = selectedRow?.campo11; // Numero factura/nota como respaldo

        // Guardar (ESPERA a que el usuario cierre el alert)
        await this.params.context.CUENTA.save(this.providerId, this.cuentaRowData, 'CUENTA');

        this.hasCuentaChanges = false;

        // Limpiar los flags de las filas guardadas SIN recargar desde el servidor
        this.cuentaRowData.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });

        // NO recargar datos - mantener el grid intacto y restaurar inmediatamente
        // Esperar solo un ciclo de renderizado para asegurar que los cambios se reflejen
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        if (this.cuentaGridApi && selectedRow) {
          let rowToSelect = null;


          // Intentar encontrar por ID original (si no era temporal)
          if (selectedCuentaId && !String(selectedCuentaId).startsWith('temp_')) {
            rowToSelect = this.cuentaRowData.find(r => r.id === selectedCuentaId);
          }

          // Si no se encontró, buscar por fecha y número
          if (!rowToSelect && selectedCuentaNumero) {
            rowToSelect = this.cuentaRowData.find(r =>
              r.campo3 === selectedCuentaFecha &&
              r.campo11 === selectedCuentaNumero
            );
          }

          // Si se encontró la fila, seleccionarla y hacer scroll
          if (rowToSelect) {
            const rowIndex = this.cuentaRowData.indexOf(rowToSelect);

            const rowNode = this.cuentaGridApi.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
              this.cuentaGridApi.ensureIndexVisible(rowIndex, 'middle');
            } else {
              console.error('❌ No se pudo obtener el rowNode en el índice:', rowIndex);
            }
          } else {
            console.error('❌ No se encontró la fila para restaurar');
          }
        }

      } catch (error) {
        console.error('❌ Error al guardar cuentas:', error);
      }
    }
  
    this.cdr.detectChanges();}

  deleteSelectedCuenta() {
    if (!this.selectedCuenta) return;
    if (this.params && this.params.context && this.params.context.CUENTA.delete) {
      this.params.context.CUENTA.delete({ data: this.selectedCuenta, api: this.cuentaGridApi }, () => {
        this.loadCuentaData();
        this.selectedCuenta = null;
      });
    }
  }

}
