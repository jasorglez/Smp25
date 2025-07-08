import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';

interface ServicioData {
  codigo: string;
  descripcion: string;
  plazo: string;
  origen: string;
  prioridad: string;
}

@Component({
  selector: 'app-servicio',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './servicio.component.html',
  styleUrl: './servicio.component.scss'
})
export class ServicioComponent {
  
  // Variables de control
  public notSavedChanges: boolean = false;
  private tempIdCounter: number = 1;

  // Configuración del grid
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 40,
    rowHeight: 35,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 10
  };

  // Definición de columnas
  public columnDefs: ColDef[] = [
    {
      field: 'codigo',
      headerName: 'Código',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 80,
      maxWidth: 120
    },
    {
      field: 'descripcion',
      headerName: 'Descripción del Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 200,
      maxWidth: 300
    },
    {
      field: 'plazo',
      headerName: 'Plazo',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 120,
      maxWidth: 150
    },
    {
      field: 'origen',
      headerName: 'Origen',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 80,
      maxWidth: 120
    },
    {
      field: 'prioridad',
      headerName: 'Prioridad',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 100,
      maxWidth: 140
    }
  ];

  // Datos falsos para el grid
  public rowData: ServicioData[] = [
    {
      codigo: '302',
      descripcion: 'Suspension del Servicio Por ADEUDO',
      plazo: '08/06/2025',
      origen: '0',
      prioridad: 'NORMAL'
    },
    {
      codigo: '301',
      descripcion: 'Instalacion de Nuevo Servicio',
      plazo: '10/06/2025',
      origen: '1',
      prioridad: 'ALTA'
    },
    {
      codigo: '303',
      descripcion: 'Reconexion de Servicio',
      plazo: '12/06/2025',
      origen: '0',
      prioridad: 'NORMAL'
    },
    {
      codigo: '304',
      descripcion: 'Mantenimiento Preventivo',
      plazo: '15/06/2025',
      origen: '2',
      prioridad: 'MEDIA'
    },
    {
      codigo: '305',
      descripcion: 'Reparacion de Falla en Servicio',
      plazo: '09/06/2025',
      origen: '1',
      prioridad: 'ALTA'
    },
    {
      codigo: '306',
      descripcion: 'Cambio de Medidor',
      plazo: '20/06/2025',
      origen: '0',
      prioridad: 'MEDIA'
    },
    {
      codigo: '307',
      descripcion: 'Inspeccion Tecnica de Instalaciones',
      plazo: '25/06/2025',
      origen: '2',
      prioridad: 'NORMAL'
    },
    {
      codigo: '308',
      descripcion: 'Actualizacion de Datos del Cliente',
      plazo: '18/06/2025',
      origen: '1',
      prioridad: 'BAJA'
    }
  ];

  // Métodos del grid
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.autoSizeAllColumns();
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
    const newItem: ServicioData = {
      codigo: '',
      descripcion: '',
      plazo: '',
      origen: '',
      prioridad: ''
    };
    
    // Agregar propiedades de control
    (newItem as any).__isNew = true;
    (newItem as any).id = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    
    // Enfocar en la primera celda editable
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setFocusedCell(0, 'codigo');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'codigo' });
      }
    }, 100);
  }

  saveChanges() {
    // Validar datos requeridos
    const invalidRows = this.rowData.filter(row => 
      !row.codigo?.trim() || !row.descripcion?.trim() || !row.plazo?.trim() || !row.origen?.trim() || !row.prioridad?.trim()
    );
    
    if (invalidRows.length > 0) {
      alert('Por favor complete todos los campos requeridos antes de guardar.');
      return;
    }
    
    // Simular guardado (aquí iría la llamada al API)
    console.log('Guardando cambios:', this.rowData);
    
    // Limpiar flags de control
    this.rowData.forEach(row => {
      delete (row as any).__isNew;
      delete (row as any).__modified;
      if (!(row as any).id || (row as any).id.startsWith('temp_')) {
        (row as any).id = Math.random().toString(36).substr(2, 9);
      }
    });
    
    this.notSavedChanges = false;
    alert('Cambios guardados exitosamente.');
  }

  revert() {
    // Restaurar datos originales (simular recarga desde API)
    this.rowData = [
      { codigo: '302', descripcion: 'Suspension del Servicio Por ADEUDO', plazo: '08/06/2025', origen: '0', prioridad: 'NORMAL' },
      { codigo: '301', descripcion: 'Instalacion de Nuevo Servicio', plazo: '10/06/2025', origen: '1', prioridad: 'ALTA' },
      { codigo: '303', descripcion: 'Reconexion de Servicio', plazo: '12/06/2025', origen: '0', prioridad: 'NORMAL' },
      { codigo: '304', descripcion: 'Mantenimiento Preventivo', plazo: '15/06/2025', origen: '2', prioridad: 'MEDIA' },
      { codigo: '305', descripcion: 'Reparacion de Falla en Servicio', plazo: '09/06/2025', origen: '1', prioridad: 'ALTA' },
      { codigo: '306', descripcion: 'Cambio de Medidor', plazo: '20/06/2025', origen: '0', prioridad: 'MEDIA' },
      { codigo: '307', descripcion: 'Inspeccion Tecnica de Instalaciones', plazo: '25/06/2025', origen: '2', prioridad: 'NORMAL' },
      { codigo: '308', descripcion: 'Actualizacion de Datos del Cliente', plazo: '18/06/2025', origen: '1', prioridad: 'BAJA' }
    ];
    this.notSavedChanges = false;
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