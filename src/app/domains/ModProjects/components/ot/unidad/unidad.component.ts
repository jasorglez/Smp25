import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';

interface UnidadData {
  unidad: string;
  empleado: string;
  fecha: string;
}

@Component({
  selector: 'app-unidad',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './unidad.component.html',
  styleUrl: './unidad.component.scss'
})
export class UnidadComponent {
  
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
      field: 'unidad',
      headerName: 'Unidad',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    },
    {
      field: 'empleado',
      headerName: 'Empleado',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 1
    }
  ];

  // Datos falsos para el grid
  public rowData: UnidadData[] = [
    {
      unidad: 'CORTES Y RECONEXION',
      empleado: 'JUAN DE JESUS',
      fecha: '29/05/2025 00:00'
    },
    {
      unidad: 'MANTENIMIENTO PREVENTIVO',
      empleado: 'MARIA GONZALEZ',
      fecha: '30/05/2025 08:00'
    },
    {
      unidad: 'REPARACION DE EQUIPOS',
      empleado: 'CARLOS RODRIGUEZ',
      fecha: '31/05/2025 10:30'
    },
    {
      unidad: 'INSTALACION NUEVA',
      empleado: 'ANA MARTINEZ',
      fecha: '01/06/2025 14:15'
    },
    {
      unidad: 'INSPECCION TECNICA',
      empleado: 'LUIS HERRERA',
      fecha: '02/06/2025 09:45'
    },
    {
      unidad: 'CORTES Y RECONEXION',
      empleado: 'PEDRO SANCHEZ',
      fecha: '03/06/2025 16:20'
    },
    {
      unidad: 'MANTENIMIENTO CORRECTIVO',
      empleado: 'SOFIA TORRES',
      fecha: '04/06/2025 11:00'
    },
    {
      unidad: 'VERIFICACION DE SERVICIO',
      empleado: 'DIEGO MORALES',
      fecha: '05/06/2025 13:30'
    }
  ];
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
    const newItem: UnidadData = {
      unidad: '',
      empleado: '',
      fecha: ''
    };
    
    // Agregar propiedades de control
    (newItem as any).__isNew = true;
    (newItem as any).id = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    
    // Enfocar en la primera celda editable
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setFocusedCell(0, 'unidad');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'unidad' });
      }
    }, 100);
  }

  saveChanges() {
    // Validar datos requeridos
    const invalidRows = this.rowData.filter(row => 
      !row.unidad?.trim() || !row.empleado?.trim() || !row.fecha?.trim()
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
      { unidad: 'CORTES Y RECONEXION', empleado: 'JUAN DE JESUS', fecha: '29/05/2025 00:00' },
      { unidad: 'MANTENIMIENTO PREVENTIVO', empleado: 'MARIA GONZALEZ', fecha: '30/05/2025 08:00' },
      { unidad: 'REPARACION DE EQUIPOS', empleado: 'CARLOS RODRIGUEZ', fecha: '31/05/2025 10:30' },
      { unidad: 'INSTALACION NUEVA', empleado: 'ANA MARTINEZ', fecha: '01/06/2025 14:15' },
      { unidad: 'INSPECCION TECNICA', empleado: 'LUIS HERRERA', fecha: '02/06/2025 09:45' },
      { unidad: 'CORTES Y RECONEXION', empleado: 'PEDRO SANCHEZ', fecha: '03/06/2025 16:20' },
      { unidad: 'MANTENIMIENTO CORRECTIVO', empleado: 'SOFIA TORRES', fecha: '04/06/2025 11:00' },
      { unidad: 'VERIFICACION DE SERVICIO', empleado: 'DIEGO MORALES', fecha: '05/06/2025 13:30' }
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