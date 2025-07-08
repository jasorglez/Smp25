import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';

interface OrdenesData {
  id: string;
  registro: string;
  numero: string;
  unidad: string;
  servicio: string;
  catastrales: string;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent {
  
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
      field: 'registro',
      headerName: 'Registro',
      sortable: true,
      filter: true,
      resizable: true,
      width: 88,
    },
    {
      field: 'numero',
      headerName: 'Número',
      sortable: true,
      filter: true,
      resizable: true,
      width: 85,
    },
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
      field: 'servicio',
      headerName: 'Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    },
    {
      field: 'catastrales',
      headerName: 'Catastrales',
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      flex: 2
    }
  ];

  // Datos falsos para el grid
  public rowData: OrdenesData[] = [
    {
      id: '1',
      registro: '02/06/2025',
      numero: '2004756',
      unidad: 'CORTES Y RECONEXION',
      servicio: 'SUSPENSION DEL SERVICIO',
      catastrales: 'GUSTAVO VALERIO CRUZ'
    },
    {
      id: '2',
      registro: '03/06/2025',
      numero: '2004757',
      unidad: 'MANTENIMIENTO PREVENTIVO',
      servicio: 'INSTALACION DE NUEVO SERVICIO',
      catastrales: 'MARIA ELENA TORRES'
    },
    {
      id: '3',
      registro: '04/06/2025',
      numero: '2004758',
      unidad: 'REPARACION DE EQUIPOS',
      servicio: 'RECONEXION DE SERVICIO',
      catastrales: 'CARLOS MENDOZA LOPEZ'
    },
    {
      id: '4',
      registro: '05/06/2025',
      numero: '2004759',
      unidad: 'INSTALACION NUEVA',
      servicio: 'MANTENIMIENTO PREVENTIVO',
      catastrales: 'ANA PATRICIA RUIZ'
    },
    {
      id: '5',
      registro: '06/06/2025',
      numero: '2004760',
      unidad: 'INSPECCION TECNICA',
      servicio: 'REPARACION DE FALLA',
      catastrales: 'LUIS FERNANDO GARCIA'
    },
    {
      id: '6',
      registro: '07/06/2025',
      numero: '2004761',
      unidad: 'CORTES Y RECONEXION',
      servicio: 'CAMBIO DE MEDIDOR',
      catastrales: 'PEDRO ANTONIO SILVA'
    },
    {
      id: '7',
      registro: '08/06/2025',
      numero: '2004762',
      unidad: 'MANTENIMIENTO CORRECTIVO',
      servicio: 'INSPECCION TECNICA',
      catastrales: 'SOFIA MARTINEZ DIAZ'
    },
    {
      id: '8',
      registro: '09/06/2025',
      numero: '2004763',
      unidad: 'VERIFICACION DE SERVICIO',
      servicio: 'ACTUALIZACION DE DATOS',
      catastrales: 'DIEGO ALEJANDRO MORALES'
    }
  ];

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
      registro: '',
      numero: '',
      unidad: '',
      servicio: '',
      catastrales: ''
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
      !row.id?.trim() || !row.registro?.trim() || !row.numero?.trim() || 
      !row.unidad?.trim() || !row.servicio?.trim() || !row.catastrales?.trim()
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
      if (!(row as any).tempId) {
        (row as any).tempId = Math.random().toString(36).substr(2, 9);
      }
    });
    
    this.notSavedChanges = false;
    alert('Cambios guardados exitosamente.');
  }

  revert() {
    // Restaurar datos originales (simular recarga desde API)
    this.rowData = [
      { id: '1', registro: '02/06/2025', numero: '2004756', unidad: 'CORTES Y RECONEXION', servicio: 'SUSPENSION DEL SERVICIO', catastrales: 'GUSTAVO VALERIO CRUZ' },
      { id: '2', registro: '03/06/2025', numero: '2004757', unidad: 'MANTENIMIENTO PREVENTIVO', servicio: 'INSTALACION DE NUEVO SERVICIO', catastrales: 'MARIA ELENA TORRES' },
      { id: '3', registro: '04/06/2025', numero: '2004758', unidad: 'REPARACION DE EQUIPOS', servicio: 'RECONEXION DE SERVICIO', catastrales: 'CARLOS MENDOZA LOPEZ' },
      { id: '4', registro: '05/06/2025', numero: '2004759', unidad: 'INSTALACION NUEVA', servicio: 'MANTENIMIENTO PREVENTIVO', catastrales: 'ANA PATRICIA RUIZ' },
      { id: '5', registro: '06/06/2025', numero: '2004760', unidad: 'INSPECCION TECNICA', servicio: 'REPARACION DE FALLA', catastrales: 'LUIS FERNANDO GARCIA' },
      { id: '6', registro: '07/06/2025', numero: '2004761', unidad: 'CORTES Y RECONEXION', servicio: 'CAMBIO DE MEDIDOR', catastrales: 'PEDRO ANTONIO SILVA' },
      { id: '7', registro: '08/06/2025', numero: '2004762', unidad: 'MANTENIMIENTO CORRECTIVO', servicio: 'INSPECCION TECNICA', catastrales: 'SOFIA MARTINEZ DIAZ' },
      { id: '8', registro: '09/06/2025', numero: '2004763', unidad: 'VERIFICACION DE SERVICIO', servicio: 'ACTUALIZACION DE DATOS', catastrales: 'DIEGO ALEJANDRO MORALES' }
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