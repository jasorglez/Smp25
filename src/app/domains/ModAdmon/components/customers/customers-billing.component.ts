import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';
import { AdministrationService } from 'app/services/administration.service';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-customers-billing',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './customers-billing.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersBillingComponent {

  ngOnInit() {
    this.obtenerDatos();
    this.loadFiscalCatalogs();
  }

  constructor() {
    effect(() => {
      this.idCustomer = this.signalsService.getIdClient()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  id: string;
  idCustomer: number;
  idRoot: number;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  // Catálogos SAT
  fiscalRegimes: any[] = [];
  usosFactura: any[] = [];

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  // Inject services
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private facturacionService = inject(FacturacionService);

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'rfc',
        headerName: 'RFC',
        filter: true,
        width: 150,
        editable: true,
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      {
        field: 'nombreFiscal',
        headerName: 'Nombre Fiscal',
        filter: true,
        width: 250,
        editable: true,
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      
      {
        field: 'codigoPostal',
        headerName: 'CP',
        filter: true,
        width: 100,
        editable: true
      },
      
      {
        field: 'regimenFiscal',
        headerName: 'Régimen Fiscal',
        filter: true,
        width: 300,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => ({
          values: this.fiscalRegimes.map(fr => String(fr.id))  // <-- convertir a string
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.fiscalRegimes.find(fr => String(fr.id) === String(params.value));
          return found ? `${found.id} - ${found.description}` : params.value;
        },
        valueSetter: (params) => {  
          params.data[params.colDef.field] = String(params.newValue); // <-- guardar como string
          return true;
        }
      },

      {
        field: 'usoCfdi',
        headerName: 'Uso CFDI',
        filter: true,
        width: 300,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => ({
          values: this.usosFactura.map(uf => uf.cUsoCFDI)
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.usosFactura.find(uf => uf.cUsoCFDI === params.value);
          return found ? `${found.cUsoCFDI} - ${found.descripcion}` : params.value;
        },
        valueSetter: (params) => {
          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      
      {
        field: 'correoFacturacion',
        headerName: 'Correo Facturación',
        filter: true,
        width: 250,
        editable: true
      },
      
      {
        field: 'active',
        headerName: 'Activo',
        width: 100,
        editable: true
      },
      
      {
        field: 'id',
        headerName: 'Id',
        width: 80,
        hide: true
      },
    ];
  }

  loadFiscalCatalogs() {
    // Cargar régimen fiscal
    this.administrationService.getFiscalRegimes().subscribe({
      next: (data: any[]) => {
        this.fiscalRegimes = data;
      },
      error: (err) => console.error('Error cargando regímenes fiscales:', err)
    });

    // Cargar usos CFDI
    this.facturacionService.getUsoCfdi2fields().subscribe({
      next: (data: any[]) => {
        this.usosFactura = data;
      },
      error: (err) => console.error('Error cargando usos CFDI:', err)
    });
  }

  obtenerDatos() {
    if (!this.idCustomer) {
      this.rowData = [];
      return;
    }

    // Obtener registros de CustomersBilling por idCustomer usando endpoint específico
    this.customersService.getCustomersBillingByCustomer(this.idCustomer).subscribe({
      next: (data: any) => {
        this.rowData = data;
      },
      error: (error) => {
        console.error('Error obteniendo datos de facturación:', error);
        this.rowData = [];
      }
    });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    if (!this.idCustomer) {
      alerts.basicAlert(
        'Error',
        'Debe seleccionar un cliente primero.',
        'error'
      );
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCustomer: this.idCustomer,
      idRoot: this.idRoot,
      rfc: 'ELRFC123456XX',
      nombreFiscal: 'NOMBRE FISCAL',
      codigoPostal: '68310',
      regimenFiscal: this.fiscalRegimes.length > 0 ? this.fiscalRegimes[0].id : '',
      usoCfdi: 'G03',
      correoFacturacion: 'info@x.com',
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) =>
      item.rfc && item.nombreFiscal && item.codigoPostal && item.regimenFiscal && item.usoCfdi
    );

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos requeridos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customersService.addCustomerBilling(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.customersService.updateCustomerBilling(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos de facturación correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    this.customersService.deleteCustomerBilling(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }

    // Mapear idCustomer a customer (requerido por el backend)
    if (cleanedData.idCustomer) {
      cleanedData.customer = cleanedData.idCustomer;
    }

    // Asegurar que regimenFiscal sea string
    if (cleanedData.regimenFiscal) {
      cleanedData.regimenFiscal = String(cleanedData.regimenFiscal);
    }

    return cleanedData;
  }
}
