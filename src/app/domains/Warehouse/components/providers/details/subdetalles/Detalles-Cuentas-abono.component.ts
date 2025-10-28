import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { concat, lastValueFrom, toArray, forkJoin, concatMap } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { ProvidersService } from 'app/services/providers.service';


@Component({
  selector: 'app-detalles-cuentas',
  standalone: true,
  imports: [AgGridModule, CommonModule, CurrencyPipe],
  template: `
    <div 
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Detalles de cuentas: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addDetallesCuentas()"
              [disabled]="!DetallesCuentasGridApi"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create')">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveDetallesCuentass()"
              [disabled]="!hasDetallesCuentasChanges"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create') || authService.getCrudPermission('shoppingDelison', 'providers', 'update')">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedDetallesCuentas()"
              [disabled]="!selectedDetallesCuentas"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create')">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="DetallesCuentasColumnDefs"
          [rowData]="DetallesCuentasRowData"
          [gridOptions]="DetallesCuentasGridOptions"
          (gridReady)="onDetallesCuentasGridReady($event)"
          (cellValueChanged)="onDetallesCuentasCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetallesComponentCuentasAbono implements ICellRendererAngularComp {
  private customerService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);
  authService = inject(AuthService);

  params: any;
  cuentas: number;
  providerName: string;
  
  DetallesCuentasRowData: any[] = [];
  hasDetallesCuentasChanges: boolean = false;
  DetallesCuentasGridApi: any;
  selectedDetallesCuentas: any = null;
  maximo: number = 0;
  proveedor: number = 0;
  
  DetallesCuentasGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  DetallesCuentasColumnDefs = [
    { 
      field: 'date', 
      headerName: 'Fecha', 
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        }, 
      flex: 1,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: '2020-01-01',
        max: '2030-12-31'
      },
      valueFormatter: (params) => {
        if (!params.value) {
          return '';
        }
        let date: Date;
        if (typeof params.value === 'string') {
          date = new Date(params.value);
        } else if (params.value instanceof Date) {
          date = params.value;
        } else {
          return ''; // Or handle as an error
        }
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = date.getUTCFullYear();
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
    },
    { field: 'total', headerName: 'Abono', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        }, flex: 1, 
      valueSetter: (params) => {
        const nuevoValor = Number(params.newValue);
        const maximo = Number(this.maximo);

        if (isNaN(nuevoValor) || nuevoValor < 0) {
          params.data.total = 0; // Asignar 0 si no es un número válido o es negativo
        } else if (nuevoValor > maximo) {
          alerts.basicAlert('Valor excedido', `El abono no puede ser mayor al restante de ${this.maximo}.`, 'warning');
          params.data.total = maximo; // Asignar el valor máximo permitido
        } else {
          params.data.total = nuevoValor;
        }
        return true; // Indicar que el valor se estableció correctamente
      },
      valueFormatter: params => {
        return new CurrencyPipe('en-US').transform(params.value, 'USD', 'symbol', '1.2-2');
      }
    },
    { field: 'comments', headerName: 'Comentario', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        }, flex: 1 },
  ];

  agInit(params: ICellRendererParams): void {
    console.log(params.data)
    this.params = params;
    this.cuentas = params.data.id; 
    this.proveedor = params.data.idTabla;
    this.maximo = params.data.campo6;
    this.loadDetallesCuentasData();
  }

  refresh(): boolean {
    return false;
  }

  onDetallesCuentasGridReady(params: any) {
    this.DetallesCuentasGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedDetallesCuentas = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onDetallesCuentasCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasDetallesCuentasChanges = true;
  }

  loadDetallesCuentasData() {
    // Cargar los abonos existentes para esta cuenta
    this.customerService.getProveedorCredit(this.proveedor, this.cuentas).subscribe(data => {
      this.DetallesCuentasRowData = data as any[];
      console.log(this.DetallesCuentasRowData)
    });
  }

  addDetallesCuentas() {
    const newDetallesCuentas = {
      //id: `temp_DetallesCuentas_${Date.now()}`,
      customerId: this.proveedor,
      proveedorXTablasId: this.cuentas,
      date: new Date(),
      total: 0,
      comments: '',
      type: "PROVIDERS",
      __isNew: true
    };
    this.DetallesCuentasRowData = [newDetallesCuentas, ...this.DetallesCuentasRowData];
    this.hasDetallesCuentasChanges = true;

    setTimeout(() => {
      this.DetallesCuentasGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'total' // 'Abono'
      });
    }, 100);
  }

  async saveDetallesCuentass() {
    const newRows = this.DetallesCuentasRowData.filter(row => row.__isNew);
    const modifiedRows = this.DetallesCuentasRowData.filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    const addObservables = newRows.map(row => {
      row.date = new Date(row.date).toISOString();
      const cleanRow = { ...row };
      delete cleanRow.__isNew;
      delete cleanRow.__modified;

      // Devolver el observable encadenado para que lastValueFrom lo pueda procesar
      return this.customerService.addProveedorCredit(cleanRow).pipe(
        concatMap(() => this.providersService.updateAbonoProviderXTable(this.proveedor, this.cuentas)),
        concatMap(() => this.customerService.addAbonoCustomer(this.proveedor))
      );
    });

    const updateObservables = modifiedRows.map(row => {
      const dataToSend = {
        customerId: this.proveedor,
        proveedorXTablasId: this.cuentas,
        date: new Date(row.date).toISOString(),
        total: row.total,
        comments: row.comments,
        type: "PROVIDERS",
      };
      console.log(dataToSend)
      return this.customerService.updateAbonoCustomer(row.id, dataToSend).pipe(
        concatMap(() => this.providersService.updateAbonoProviderXTable(this.proveedor, this.cuentas)),
        concatMap(() => this.customerService.addAbonoCustomer(this.proveedor))
      );
    });

    try {
      await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));

      alerts.basicAlert('Guardado', 'Los abonos se han guardado correctamente.', 'success');
      this.hasDetallesCuentasChanges = false;
      this.loadDetallesCuentasData(); // Recargar datos
      
      // Disparar señal para que el grid principal de proveedores se actualice
      this.signalsService.triggerRefreshEmployees();

    } catch (error) {
      console.error('Error al guardar los abonos:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los abonos.', 'error');
    }
  }

  async deleteSelectedDetallesCuentas() {
    if (!this.selectedDetallesCuentas) {
      return;
    }

    const result = await alerts.confirmAlert('Confirmar borrado', '¿Estás seguro de que deseas eliminar este abono?', 'warning', 'Sí, eliminar');

    if (!result.isConfirmed) {
      return;
    }

    try {
      // 1. Elimina el abono
      await lastValueFrom(this.customerService.deleteAbonoCustomer(this.selectedDetallesCuentas.id).pipe(
        // 2. Después de eliminar, actualiza el total en la tabla del proveedor
        concatMap(() => this.providersService.updateAbonoProviderXTable(this.proveedor, this.cuentas)),
        // 3. Finalmente, actualiza el total general del proveedor (cliente)
        concatMap(() => this.customerService.addAbonoCustomer(this.proveedor))
      ));

      alerts.basicAlert('Eliminado', 'El abono ha sido eliminado y los totales actualizados.', 'success');
      
      this.loadDetallesCuentasData(); // Recargar datos del subgrid
      this.selectedDetallesCuentas = null;
      this.signalsService.triggerRefreshEmployees(); // Actualizar el grid principal

    } catch (err) {
      console.error('Error al eliminar el abono:', err);
      alerts.basicAlert('Error', 'No se pudo eliminar el abono. Revisa la consola para más detalles.', 'error');
    }
  }

}