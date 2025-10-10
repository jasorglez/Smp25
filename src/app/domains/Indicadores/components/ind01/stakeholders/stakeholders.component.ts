import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, ICellEditorParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp, ICellEditorAngularComp } from 'ag-grid-angular';
import { SignalsService } from 'app/services/signals.service';
import { catchError, concat, lastValueFrom, of, toArray } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SteakholderService } from 'app/services/steakholder.service';
import { ProvidersService } from 'app/services/providers.service';

@Component({
  selector: 'app-star-cell',
  standalone: true,
  template: `<img [src]="params.value" width="30" height="30" alt="Estrella">`
})
export class StarCellRendererComponent implements ICellRendererAngularComp {
  params: any;

  agInit(params: any): void {
    this.params = params;
  }

  refresh(params: any): boolean {
    this.params = params;
    return true;
  }
}

interface Providers {
  id: number;
  name: string;
}

@Component({
  selector: 'app-custom-select-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select *ngIf="params.enabled" [(ngModel)]="selectedValue" (ngModelChange)="onChange($event)" class="form-select ag-select">
      <option *ngFor="let option of params.values" [value]="option.id">{{option.name}}</option>
    </select>
  `
})
export class CustomSelectEditorComponent implements ICellEditorAngularComp {
  params: ICellEditorParams & { enabled: boolean; values: any[] };
  selectedValue: any;

  agInit(params: ICellEditorParams & { enabled: boolean; values: any[] }): void {
    this.params = params;
    this.selectedValue = this.params.value;
  }

  getValue(): any {
    return Number(this.selectedValue); // Convertir a número antes de devolver
  }

  onChange(newValue: any): void {
    this.params.api.stopEditing();
  }

  isPopup?(): boolean {
    return false;
  }
}

@Component({
  selector: 'app-stakeholders',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, StarCellRendererComponent, CustomSelectEditorComponent],
  templateUrl: './stakeholders.component.html',
  styleUrls: ['./stakeholders.component.scss'],
  providers: [DatePipe]
})

export class StakeholdersComponent {

  private idProject = 0;
  fecha: string;
  proveedores: Providers[] = [];
  companias: Providers[] = [];
  providersAllList: Providers[] = [];
  idRoot: number;

  private steakService = inject(SteakholderService);
  private signalsService = inject(SignalsService);
  private datePipe = inject(DatePipe);
  private providersService = inject(ProvidersService);

  private currentType: string = 'Provider'; // Nuevo: para rastrear el tipo actual

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      console.log(this.idProject);
      if (this.idProject == null) {
        this.rowData = [];
        alerts.basicAlert('Stakeholders', 'Debe elegir un proyecto primero.', 'error');
      }
      else {
        this.obtenerDatos();
        this.fetchProvidersByType('PROVIDER'); // Precargar proveedores
        this.fetchProvidersByType('COMPANY'); // Precargar compañías
        this.fetchAllProviders();
      }
    });
  }

  ngOnInit(): void {
    // Formatear la fecha actual al formato yyyy-MM-dd
    this.fecha = this.datePipe.transform(new Date(), 'yyyy-MM-dd');

  }

  onFechaChange() {
    this.obtenerDatos();
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
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.steakService.get(this.idProject, this.fecha).pipe(
      catchError((error) => {
        console.error('Error al obtener identificaciones:', error);
        this.rowData = [];
        return of([]);
      })
    )
      .subscribe({
        next: (data: any) => {
          this.rowData = data;
          // Inicializar currentType para cada fila cuando se cargan los datos
          if (this.rowData && this.rowData.length > 0) {
            this.gridApi?.forEachNode(node => {
              if (node.data.type) {
                // Actualizar currentType basado en la fila seleccionada o la primera fila
                this.currentType = node.data.type;
                // Forzar actualización de la celda idProvider
                this.gridApi.refreshCells({
                  force: true,
                  columns: ['idProvider'],
                  rowNodes: [node]
                });
              }
            });
          }
        },
        error: () => {
          this.rowData = [];
        }
      });
  }

  fetchProvidersByType(type: string = 'PROVIDER') {
    this.providersService.getProviderByType(type).subscribe(
      (data: Providers[]) => {
        if (type === 'PROVIDER') {
          this.proveedores = data; // Almacenar en proveedores
        } else if (type === 'COMPANY') {
          this.companias = data; // Almacenar en companias
        }
        console.log(type === 'PROVIDER' ? this.proveedores : this.companias);
        // Forzar la actualización de la grid
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.columnDefs);
        }
      },
      (error) => console.error('Error fetching providers:', error)
    );
  }

  fetchAllProviders() {
    this.providersService.getProviders(this.idRoot).subscribe(
      (data: Providers[]) => {
        this.providersAllList = data;
        console.log(this.proveedores);
      },
      (error) => console.error('Error fetching work programs:', error)
    );
  }


  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    flex: 1
  };

  starOptions = [
    {
      value: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      label: 'Estrella vacía'
    },
    {
      value: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20mitad.png?alt=media&token=a4429a63-b6bd-4d3e-802d-a7eb7e0645a4',
      label: 'Estrella mitad'
    },
    {
      value: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0',
      label: 'Estrella llena'
    }
  ];

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowClass: (params) => {
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

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'type',
        headerName: 'Tipo',
        editable: true,
        flex: 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['PROVIDER', 'COMPANY'],
        },
        onCellValueChanged: (params: any) => {
          // Actualizar currentType para la fila específica
          this.currentType = params.newValue;
          // Forzar la actualización solo de la celda idProvider en la fila actual
          this.gridApi.refreshCells({
            force: true,
            columns: ['idProvider'],
            rowNodes: [params.node]
          });
        }
      },
      {
        field: 'idProvider',
        headerName: 'Proveedor',
        editable: true,
        flex: 5,
        cellEditor: CustomSelectEditorComponent,
        cellEditorParams: (params: any) => {
          // Usar el tipo de la fila actual si está disponible, sino usar currentType
          const rowType = params.data.type || this.currentType;
          return {
            values: rowType === 'PROVIDER' ? this.proveedores : this.companias,
            enabled: !!params.data.type
          };
        },
        valueFormatter: (params: any) => {
          const proveedor = this.providersAllList.find(p => p.id === params.value);
          return proveedor ? proveedor.name : '';
        },
        cellRenderer: (params: any) => {
          if (!params.data.type && !params.value) {
            return '';
          }
          const proveedor = this.providersAllList.find(p => p.id === params.value);
          return proveedor ? proveedor.name : '';
        },
        valueParser: (params: any) => {
          return Number(params.newValue); // Asegurarse de que se convierte a número
        }
      },
      {
        field: 'image1',
        headerName: '1',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: StarCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: StarCellRendererComponent,
        width: 80
      },
      {
        field: 'image2',
        headerName: '2',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: StarCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: StarCellRendererComponent,
        width: 80
      },
      {
        field: 'image3',
        headerName: '3',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: StarCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: StarCellRendererComponent,
        width: 80
      },
      {
        field: 'image4',
        headerName: '4',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: StarCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: StarCellRendererComponent,
        width: 80
      },
      {
        field: 'image5',
        headerName: '5',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: StarCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: StarCellRendererComponent,
        width: 80
      },
      {
        field: 'authorizeUser',
        headerName: 'Autoriza',
        editable: false,
        flex: 2
      }
    ];
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
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      date: this.fecha,
      idProject: this.idProject,
      idProvider: 0,
      image1: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      image2: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      image3: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      image4: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      image5: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20vacia.png?alt=media&token=eb079ef0-6b2c-436a-b571-69e02be3921c',
      authorizeUser: localStorage.getItem('mail'),
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

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
    const isValid = this.rowData.every((item) => item.idProvider);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos Nombre y Nombre Corto antes de guardar.',
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

      return this.steakService.add(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.steakService.update(row.id, cleanedData);
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
