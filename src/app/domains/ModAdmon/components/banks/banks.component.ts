import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { TrackingService } from 'app/services/tracking.service';

import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-banks',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
  ],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss',
})
export class BanksComponent implements CanComponentDeactivate {
  authService = inject(AuthService);
  constructor() {
    this.obtenerDatos();
  }

    private trackingService = inject(TrackingService);

  ngOnInit() {
    // this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  Bankdata: any[] = [];

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  branches: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;

  //  public rowSelection: 'single' | 'multiple' = 'single';
  // public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';

  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  // Inject of new way for Angular 18
  private administrationService = inject(AdministrationService);
  private modalServiceTable = inject(ModalService);
  private imageHandlerService = inject(ImageHandlerService);

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never', // Configuración definitiva
    suppressRowClickSelection: true, // Mejor manejo de selección
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
        field: 'name',
        headerName: 'Banco',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('administration', 'bank','','','', 'update');
        },
        filter: true,
        width: 150,
      },
      {
        field: 'branch',
        headerName: 'Sucursal',
        editable: false,
        width: 170,
        filter: true,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if(event.data.__isNew || this.authService.getCrudPermission('administration', 'bank','','','', 'update')){
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        },
      },

      { field: 'contact', headerName: 'Contacto', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('administration', 'bank','','','', 'update');
        }, width: 150 },

      {
        field: 'phone',
        headerName: 'Telefono',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('administration', 'bank','','','', 'update');
        },
        width: 120,
        cellEditorParams: {
          maxLength: 15,
        },
      },

      {
        field: 'picture',
        headerName: 'Imagen',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(
          this.imageHandlerService
        ),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(
            this.imageHandlerService
          ),
          field: 'picture',
        },
        editable: false,
        width: 150,
      },

      {
        field: 'numBranch',
        headerName: 'Num. Sucursal',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('administration', 'bank','','','', 'update');
        },
        width: 140,
      },

      { field: 'code', headerName: 'Codigo', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('administration', 'bank','','','', 'update');
        }, width: 95 },
    ];
  }

  obtenerDatos() {
    this.administrationService.getBanks().subscribe({
      next: (data: any) => {
        if(this.authService.getCrudPermission('administration', 'bank','','','', 'read')){
        this.Bankdata = data;}
        else{
          this.Bankdata = []
        }
        //console.log('Data Bank:', data);
      },
      error: (error) => {
        console.error('Error fetching banks:', error);
        // Optional: show user-friendly error message
      },
    });
    this.trackingService.addLog(this.trackingService.getnameComp(), `Mostrar Listado de Bancos`, 'Menu Administracion BANCOS ',
          this.trackingService.getEmail() );
  }

  onSelectedRow(event: any) {
    //console.log('es el evento',event)
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    console.log('Viene del OnSelectionChanged', event);
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    //console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    //   console.log('Grid API inicializada:', params.api);
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: 1,
      name: '',
      branch: '',
      numBranch: '',
      contact: '',
      phone: '',
      picture: '',
      code: '',
      active: true,
      __isNew: true,
    };
    this.Bankdata = [newItem, ...this.Bankdata];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.Bankdata.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colMaster.find((col) => col.editable);
    const firstEditableColKey = firstEditableCol
      ? firstEditableCol.field
      : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveChanges() {
    const isValid = this.Bankdata.every((item) => item.name && item.branch);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.Bankdata.filter((row) => row.__isNew);
    const modifiedRows = this.Bankdata.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.addBanks(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateBanks(row.id, cleanedData);
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
        this.trackingService.addLog(this.trackingService.getnameComp(), `Agregar Un Banco`, 'Menu Administracion BANCOS ',
          this.trackingService.getEmail() );

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
    alerts
      .confirmAlert(
        'Eliminar empleado',
        '¿Está seguro que desea eliminar este Banco?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.administrationService
            .deleteBanks(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar empleado',
                  'Error al eliminar el BANCO.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Banco eliminado',
                'El Banco Se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(this.trackingService.getnameComp(), `Borrar Registro de un Banco`, 'Menu Administracion BANCOS ',
               this.trackingService.getEmail() );
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(), `Cancelacion del Registro`, 'Menu Administracion BANCOS ',
          this.trackingService.getEmail() );
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
