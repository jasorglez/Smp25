import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

interface OrdenesData {
  id: string;
  registerDate: string;
  otNumber: string;
  assignedTo: string;
  description: string;
  nameConsumer: string;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent implements OnInit {
  
  private otService = inject(OtService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  
  // Variables de control
  public notSavedChanges: boolean = false;
  private tempIdCounter: number = 2;

  // Configuración del grid
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 10
  };

  // Definición de columnas
  public columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      resizable: true,
      width: 77,      
    },
    {
      field: 'registerDate',
      headerName: 'Registro',
      sortable: true,
      filter: true,
      resizable: true,
      width: 88,
    },
    {
      field: 'otNumber',
      headerName: 'Número',
      sortable: true,
      filter: true,
      resizable: true,
      width: 85,
    },
    {
      field: 'assignedTo',
      headerName: 'Unidad',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    },
    {
      field: 'description',
      headerName: 'Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    },
    {
      field: 'nameConsumer',
      headerName: 'Catastrales',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    }
  ];

  // Datos del grid obtenidos del servicio
  public rowData: OrdenesData[] = [];

  ngOnInit() {
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.otService.getOtList().subscribe({
      next: (data: any) => {
        console.log('Datos obtenidos del servicio OT:', data);
        this.rowData = data;
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Lista de OT',
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al obtener datos de OT:', error);
        this.rowData = [];
      }
    });
  }

  // Métodos del grid
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: any) {
    const selectedRows = this.gridApi.getSelectedRows();
    console.log('Fila seleccionada:', selectedRows);
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Métodos CRUD
  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem: OrdenesData = {
      id: '',
      registerDate: '',
      otNumber: '',
      assignedTo: '',
      description: '',
      nameConsumer: ''
    };
    
    // Agregar propiedades de control
    (newItem as any).__isNew = true;
    (newItem as any).tempId = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    
    // Enfocar en la primera celda editable
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setFocusedCell(0, 'id');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'id' });
      }
    }, 100);
  }

  saveChanges() {
    // Validar datos requeridos
    const invalidRows = this.rowData.filter(row => 
      !row.id?.trim() || !row.registerDate?.trim() || !row.otNumber?.trim() || 
      !row.assignedTo?.trim() || !row.description?.trim() || !row.nameConsumer?.trim()
    );
    
    if (invalidRows.length > 0) {
      alert('Por favor complete todos los campos requeridos antes de guardar.');
      return;
    }
    
    // Filtrar filas nuevas y modificadas
    const newRows = this.rowData.filter(row => (row as any).__isNew);
    const modifiedRows = this.rowData.filter(row => (row as any).__modified && !(row as any).__isNew);
    
    console.log('Guardando cambios - Nuevas:', newRows, 'Modificadas:', modifiedRows);
    
    // Procesar filas nuevas
    const addPromises = newRows.map(row => {
      const cleanData = this.cleanDataForServer(row);
      return this.otService.addOt(cleanData).toPromise();
    });
    
    // Procesar filas modificadas (aquí necesitarías un método updateOt en el servicio)
    // Por ahora solo mostramos en consola
    modifiedRows.forEach(row => {
      console.log('Fila modificada que requiere actualización:', row);
    });
    
    // Ejecutar todas las promesas
    Promise.all(addPromises).then(() => {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Save Cambios en Lista de OT',
        'Menu Proyectos Ordenes de Trabajo',
        this.trackingService.getEmail()
      );
      
      // Limpiar flags de control
      this.rowData.forEach(row => {
        delete (row as any).__isNew;
        delete (row as any).__modified;
      });
      
      this.notSavedChanges = false;
      alert('Cambios guardados exitosamente.');
      
      // Recargar datos
      this.obtenerDatos();
    }).catch(error => {
      console.error('Error al guardar cambios:', error);
      alert('Error al guardar los cambios. Por favor, intente nuevamente.');
    });
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.tempId;
    return cleanedData;
  }

  revert() {
    // Recargar datos originales desde el servicio
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Revertir Cambios en Lista de OT',
      'Menu Proyectos Ordenes de Trabajo',
      this.trackingService.getEmail()
    );
  }

  deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    
    if (selectedNodes.length === 0) {
      alert('Por favor seleccione una fila para eliminar.');
      return;
    }
    
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
      const selectedData = selectedNodes[0].data;
      this.rowData = this.rowData.filter(row => row !== selectedData);
      this.notSavedChanges = true;
    }
  }

}