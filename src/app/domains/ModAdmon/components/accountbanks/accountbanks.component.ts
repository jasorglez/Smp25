import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';

import { catchError, concat, EMPTY, lastValueFrom, of, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';


interface Bank {
  id: number;
  name: string;
}

@Component({
  selector: 'app-accountbanks',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './accountbanks.component.html',
  styleUrl: './accountbanks.component.scss'
})
export class AccountbanksComponent {

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerBanks();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  private lastSelectedId: string | null = null;
  notSavedChanges: boolean = false;
  rowMaster  : any;
  rowDetails : any ;
  accounts: { [key: string]: string } = {};
  errorMessage: string = '';
  isLoading: boolean = false

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
    
  banks: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi!: GridApi;

  currentIndex = 0;

  private detailsGridApi!: GridApi<any>;
  
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  // Inject of new way for Angular 18
  private administrationService = inject(AdministrationService);  
  private modalServiceTable = inject(ModalService);  
  private imageHandlerService = inject(ImageHandlerService);

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  rowClass: (params) => {
    // Verificar si la fila está seleccionada
    if (params.node.isSelected()) {
      return 'selected-row';
    }
    return '';
  },
  onRowClicked: (event) => {
    // Seleccionar la fila al hacer clic en cualquier celda
    event.node.setSelected(true);
  },
  onRowSelected: (event) => {
    // Deseleccionar otras filas cuando se selecciona una nueva
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  },
};

// Column Definitions: Defines the columns to be displayed.
get colMaster(): ColDef[] {
  return [
    { field: 'idBanco', headerName: 'Banco', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.banks ? this.banks.map(item => item.id) : [],
      },
      valueFormatter: (params) => {
        const foundItem = this.banks ? this.banks.find(item => item.id === params.value) : null;
        return foundItem ? `${foundItem.name}` : params.value;
      }
    },    
    { field: 'numberAccount', headerName: 'Numero Cuenta', editable: true, filter: true, width: 200 },

    { field: 'nameAccount', headerName: 'Nombre Cuenta', editable: true, width: 200, filter: true },
            
    { field: 'interbancaria', headerName: 'Interbancaria', editable: true, width: 160 },
            
    { field: 'folioCheque', headerName: 'Inicio Cheque', editable: true, width: 129, cellEditorParams: {
        maxLength: 5  } },
    
    { field: 'folioSinCheque', headerName: 'Termino Cheque', editable: true, width: 140 }, 

    { field: 'gasto', headerName: 'Gastos', editable: true, width: 105,
      valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
    { field: 'depositoPagado', headerName: 'Ingresos', editable: true, width: 105,
      valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
     },
    { field: 'saldo', headerName: 'Saldo', editable: true, width: 110,
      valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
     },
    
  ]
};


// Column Definitions: Defines the columns to be displayed.
get colDetails(): ColDef[] {
  return [
    { 
      field: 'numeroDocumento', 
      headerName: 'Numero Documento', 
      editable: false, 
      filter: true, 
      width: 200,
      cellStyle: params => {
        const deposito = typeof params.data.deposito === 'string' ? 
          parseFloat(params.data.deposito.replace(/,/g, '')) : 
          (params.data.deposito || 0);
        const gasto = typeof params.data.gasto === 'string' ? 
          parseFloat(params.data.gasto.replace(/,/g, '')) : 
          (params.data.gasto || 0);
        return {
          backgroundColor: deposito > 0 ? '#e6ffe6' : gasto > 0 ? '#ffe6e6' : null
        };
      }
    },
    { 
      field: 'fecha', 
      headerName: 'Fecha', 
      editable: false, 
      width: 200, 
      filter: true
    },
    { 
      field: 'descripcion', 
      headerName: 'Descripcion', 
      editable: false, 
      width: 285
    },
    { 
      field: 'tipo', 
      headerName: 'Tipo', 
      editable: false, 
      width: 160
    },
    { 
      field: 'deposito', 
      headerName: 'Deposito', 
      editable: false, 
      width: 160,
      valueFormatter: params => {
        const value = params.value || 0;
        return `$ ${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
      cellStyle: params => {
        const value = typeof params.value === 'string' ? 
          parseFloat(params.value.replace(/,/g, '')) : 
          (params.value || 0);
        return {
          color: value > 0 ? '#008000' : null,
          backgroundColor: value > 0 ? '#e6ffe6' : null,
          fontWeight: value > 0 ? 'bold' : 'normal'
        };
      }
    },
    { 
      field: 'gasto', 
      headerName: 'Gasto', 
      editable: false, 
      width: 160,
      valueFormatter: params => {
        const value = params.value || 0;
        return `$ ${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
      cellStyle: params => {
        const value = typeof params.value === 'string' ? 
          parseFloat(params.value.replace(/,/g, '')) : 
          (params.value || 0);
        return {
          color: value > 0 ? '#FF0000' : null,
          backgroundColor: value > 0 ? '#ffe6e6' : null,
          fontWeight: value > 0 ? 'bold' : 'normal'
        };
      }
    },
    { 
      field: 'saldo', 
      headerName: 'SALDO', 
      editable: false, 
      width: 160,
      valueFormatter: params => {
        const value = params.value || 0;
        return `$ ${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
      cellStyle: { 
        color: '#000080',
        fontWeight: 'bold'
      }
    }
  ];
}

obtenerBanks() {
  this.administrationService.get2fieldsBanks().
  subscribe((data: any) => { 
     this.banks = data
  })
}

obtenerDatos() {    
  this.administrationService.getAccountBanks(parseInt(localStorage.getItem('company'))).
  subscribe((response: any) => {    
      this.rowMaster = response;
      if (!response || response.length === 0) {
        alerts.basicAlert('Aviso',
          'No hay datos disponibles',
          'info'
        );
      }
   })
}

private loadBalanceData(id: string) {
  if (!id || id === this.lastSelectedId) return;
  
  this.lastSelectedId = id;
  this.rowDetails = [];
  this.isLoading = true;
  
  this.administrationService.getBalance(parseInt(id))
    .subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          this.rowDetails = [];
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
}


 
onSelectionChanged(event: any) {
  const selectedNodes = event.api.getSelectedNodes();
  if (selectedNodes.length > 0) {
    const selectedData = selectedNodes[0].data;
    this.selectedRowData = selectedData;
    this.loadBalanceData(selectedData.id);
  } else {
    this.selectedRowData = null;
  }
}

  onCellValueChanged(event: any) {
  //  console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
  
  onDetailGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBussines     : parseInt(localStorage.getItem('company')),
      numberAccount  : '',
      nameAccount    : '',
      signAccount    : '',
      interbancaria  : '',
      folioCheque    : '',      
      folioSinCheque : '',
      idBanco        : 0,
      eAplicaFiscal  : 'Si', 
      active: true,      
      __isNew: true,
    };
    this.rowMaster = [newItem, ...this.rowMaster];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {

    //console.log('RowData', this.rowData)
    
    const isValid = this.rowMaster.every((item) => item.numberAccount && item.nameAccount);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowMaster.filter((row) => row.__isNew);
    const modifiedRows = this.rowMaster.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.addAccountBanks(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateAccountBanks(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
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
    selectedData.active = 0;
    this.administrationService.deleteBanks(id).pipe(
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

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
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
    return cleanedData;
  }

}
