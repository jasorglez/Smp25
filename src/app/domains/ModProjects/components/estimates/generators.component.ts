import { Component, inject, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { GeneratorsService } from 'app/services/generators.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-generators',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './generators.component.html',
  styleUrl: './generators.component.scss'
})
export class GeneratorsComponent implements OnChanges {

  @Input() idEstimacion: number = 0;

  private generatorsService = inject(GeneratorsService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  selectedRowData: any = null;
  newlyAddedRows: string[] = [];
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  constructor() { }

  ngOnInit() {
    this.obtenerDatos();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idEstimacion'] && !changes['idEstimacion'].firstChange) {
      this.obtenerDatos();
    }
  }

  obtenerDatos() {
    if (!this.idEstimacion) {
      console.warn('No hay ID de estimación proporcionado');
      this.rowData = [];
      return;
    }

    this.generatorsService
      .getGenerators(this.idEstimacion)
      .subscribe((data: any) => {
        this.rowData = data;
        console.log('Generators data:', data);
      }, (error) => {
        console.error('Error al cargar generators:', error);
        this.rowData = [];
      });
  }

  // Configuración del grid
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowClass: (params) => {
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

  // Definición de columnas
  get columnDefs(): ColDef[] {
    return [
      {
        field: 'numeroGenerador',
        headerName: 'Número Generador',
        editable: true,
        flex: 1
      },
      {
        field: 'fechaInicio',
        headerName: 'Fecha Inicio',
        editable: true,
        flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'fechaFinal',
        headerName: 'Fecha Final',
        editable: true,
        flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'dias',
        headerName: 'Días',
        editable: false,
        flex: 1,
        valueGetter: (params) => {
          return this.calculateDays(params.data.fechaInicio, params.data.fechaFinal);
        }
      }
    ];
  }

  // Función para calcular días
  calculateDays(fechaInicio: string, fechaFinal: string): number {
    if (!fechaInicio || !fechaFinal) {
      return 0;
    }
    
    const inicio = new Date(fechaInicio);
    const final = new Date(fechaFinal);
    
    // Calcular la diferencia en milisegundos
    const diffTime = final.getTime() - inicio.getTime();
    
    // Convertir a días y agregar 1 para incluir ambos días (del 1 al 8 son 8 días)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays > 0 ? diffDays : 0;
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
    
    // Recalcular días si cambió alguna fecha
    if (event.colDef.field === 'fechaInicio' || event.colDef.field === 'fechaFinal') {
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['dias']
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      numeroGenerador: '',
      idEstimacion: this.idEstimacion,
      fechaInicio: '',
      fechaFinal: '',
      dias: 0,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Auto-editar primera celda
    setTimeout(() => {
      const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'numeroGenerador',
      });
    }, 50);
  }

  async saveChanges() {
    // Validar que todos los campos requeridos estén llenos
    const isValid = this.rowData.every((item) => item.numeroGenerador && item.fechaInicio && item.fechaFinal);
    if (!isValid) {
      alerts.basicAlert(
        'Guardar Cambios',
        'Debe llenar todos los campos antes de guardar.',
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
      return this.generatorsService.addGenerator(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.generatorsService.updateGenerator(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Los generadores se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los generadores. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    this.generatorsService.deleteGenerator(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar el generador.',
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
            'Generador eliminado satisfactoriamente.',
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
    delete cleanedData.dias; // Los días se calculan, no se envían al servidor
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

}