import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  imports: [
    CommonModule, 
    FormsModule,
    TranslateModule, 
    AgGridModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './servicio.component.html',
  styleUrl: './servicio.component.scss'
})
export class ServicioComponent implements OnInit {
  
  // Servicios inyectados
  private snackBar = inject(MatSnackBar);
  
  // Variables de control
  public notSavedChanges: boolean = false;
  public isSaving: boolean = false;
  public isLoading: boolean = true; // Cambio: iniciar en true
  public hasSelection: boolean = false;
  public searchTerm: string = '';
  public selectedPriorityFilter: string = '';
  private tempIdCounter: number = 1;
  private originalData: ServicioData[] = [];
  
  // Configuración del grid
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 48,
    rowHeight: 44,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 15,
    paginationPageSizeSelector: [10, 15, 25, 50],
    enableColResize: true,
    enableSorting: true,
    enableFilter: true,
    rowMultiSelectWithClick: false,
    suppressRowDeselection: false,
    suppressCellFocus: false,
    enableRangeSelection: true,
    suppressMenuHide: false,
    rowSelection: 'single',
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    }
  };

  // Definición de columnas
  public columnDefs: ColDef[] = [
    {
      field: 'codigo',
      headerName: 'Código',
      editable: true,
      minWidth: 100,
      maxWidth: 140,
      cellClass: 'text-center font-weight-bold',
      headerClass: 'required-header',
      cellEditor: 'agTextCellEditor',
      cellEditorParams: {
        maxLength: 10
      }
    },
    {
      field: 'descripcion',
      headerName: 'Descripción del Servicio',
      editable: true,
      minWidth: 300,
      flex: 2,
      headerClass: 'required-header',
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: {
        maxLength: 500,
        rows: 3,
        cols: 50
      },
      tooltipField: 'descripcion'
    },
    {
      field: 'plazo',
      headerName: 'Fecha Límite',
      editable: true,
      minWidth: 120,
      maxWidth: 160,
      headerClass: 'required-header',
      cellEditor: 'agDateStringCellEditor',
      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          return date.toLocaleDateString('es-ES');
        }
        return '';
      },
      comparator: (valueA, valueB) => {
        const dateA = new Date(valueA);
        const dateB = new Date(valueB);
        return dateA.getTime() - dateB.getTime();
      }
    },
    {
      field: 'origen',
      headerName: 'Origen',
      editable: true,
      minWidth: 100,
      maxWidth: 130,
      headerClass: 'required-header',
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['0', '1', '2']
      },
      valueFormatter: (params) => {
        const origenMap: {[key: string]: string} = {
          '0': 'Interno',
          '1': 'Externo',
          '2': 'Cliente'
        };
        return origenMap[params.value] || params.value;
      }
    },
    {
      field: 'prioridad',
      headerName: 'Prioridad',
      editable: true,
      minWidth: 110,
      maxWidth: 150,
      headerClass: 'required-header',
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['ALTA', 'MEDIA', 'NORMAL', 'BAJA']
      },
      // Configuración específica para filtros
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true,
        caseSensitive: false,
        debounceMs: 200
      },
      // Tooltip personalizado que muestra todos los tipos disponibles
      tooltipValueGetter: (params: any) => {
        return `Prioridades disponibles:\n🔴 ALTA - Urgente, requiere atención inmediata\n🟡 MEDIA - Importante, atender pronto\n🟢 NORMAL - Rutinario, atender en orden\n🔵 BAJA - Opcional, cuando sea posible\n\nValor actual: ${params.value || 'Sin asignar'}`;
      },
      cellClass: (params) => {
        const priorityClasses: {[key: string]: string} = {
          'ALTA': 'priority-high',
          'MEDIA': 'priority-medium', 
          'NORMAL': 'priority-normal',
          'BAJA': 'priority-low'
        };
        return priorityClasses[params.value] || '';
      },
      cellRenderer: (params: any) => {
        const icons: {[key: string]: string} = {
          'ALTA': '🔴',
          'MEDIA': '🟡',
          'NORMAL': '🟢',
          'BAJA': '🔵'
        };
        const icon = icons[params.value] || '';
        return `<span class="priority-cell">${icon} ${params.value}</span>`;
      }
    }
  ];

  // Cambio: Inicializar como array vacío
  public rowData: ServicioData[] = [];
  
  // Datos de ejemplo separados
  private getMockData(): ServicioData[] {
    return [
      {
        codigo: '302',
        descripcion: 'Suspension del Servicio Por ADEUDO',
        plazo: '2025-06-08',
        origen: '0',
        prioridad: 'NORMAL'
      },
      {
        codigo: '301',
        descripcion: 'Instalacion de Nuevo Servicio',
        plazo: '2025-06-10',
        origen: '1',
        prioridad: 'ALTA'
      },
      {
        codigo: '303',
        descripcion: 'Reconexion de Servicio',
        plazo: '2025-06-12',
        origen: '0',
        prioridad: 'NORMAL'
      },
      {
        codigo: '304',
        descripcion: 'Mantenimiento Preventivo',
        plazo: '2025-06-15',
        origen: '2',
        prioridad: 'MEDIA'
      },
      {
        codigo: '305',
        descripcion: 'Reparacion de Falla en Servicio',
        plazo: '2025-06-09',
        origen: '1',
        prioridad: 'ALTA'
      },
      {
        codigo: '306',
        descripcion: 'Cambio de Medidor',
        plazo: '2025-06-20',
        origen: '0',
        prioridad: 'MEDIA'
      },
      {
        codigo: '307',
        descripcion: 'Inspeccion Tecnica de Instalaciones',
        plazo: '2025-06-25',
        origen: '2',
        prioridad: 'NORMAL'
      },
      {
        codigo: '308',
        descripcion: 'Actualizacion de Datos del Cliente',
        plazo: '2025-06-18',
        origen: '1',
        prioridad: 'BAJA'
      }
    ];
  }

  ngOnInit() {
    this.loadData();
  }

  // CORREGIDO: Método de carga de datos
  private loadData() {
    console.log('🔄 Iniciando carga de datos...');
    this.isLoading = true;
    
    // Simular carga de datos del servidor
    setTimeout(() => {
      console.log('📦 Obteniendo datos mock...');
      const mockData = this.getMockData();
      
      // Asignar los datos
      this.rowData = [...mockData];
      this.originalData = [...mockData];
      
      console.log('✅ Datos cargados exitosamente:', this.rowData.length, 'registros');
      console.log('📊 Datos:', this.rowData);
      
      this.isLoading = false;
      
      // Si el grid ya está inicializado, actualizar
      if (this.gridApi) {
        console.log('🔄 Actualizando grid con nuevos datos...');
        this.updateGridData();
      }
      
    }, 1500); // Simular delay de red
  }
  
  // Nuevo método para actualizar datos del grid
  private updateGridData() {
    if (this.gridApi && this.rowData) {
      this.gridApi.setGridOption('rowData', this.rowData);
      
      // Ajustar columnas después de un pequeño delay
      setTimeout(() => {
        this.gridApi.sizeColumnsToFit();
      }, 100);
    }
  }
  
  // Métodos de estadísticas
  getStatsByPriority(priority: string): number {
    return this.rowData.filter(item => item.prioridad === priority).length;
  }
  
  // Filtrar por prioridad desde las tarjetas de estadísticas
  filterByPriority(priority: string) {
    console.log('🔍 Filtro por prioridad clickeado:', priority);
    this.selectedPriorityFilter = priority;
    
    if (this.gridApi) {
      // Limpiar filtros existentes primero
      this.gridApi.setFilterModel(null);
      
      // Aplicar nuevo filtro después de un pequeño delay
      setTimeout(() => {
        const filterModel = {
          prioridad: {
            filterType: 'text',
            type: 'equals',
            filter: priority
          }
        };
        console.log('🎯 Aplicando filtro:', filterModel);
        this.gridApi.setFilterModel(filterModel);
      }, 100);
    }
  }
  
  // CORREGIDO: Método onGridReady
  onGridReady(params: GridReadyEvent) {
    console.log('🎯 Grid ready event triggered');
    this.gridApi = params.api;
    
    // Si ya tenemos datos cargados, asignarlos
    if (this.rowData && this.rowData.length > 0) {
      console.log('📊 Asignando datos existentes al grid:', this.rowData.length, 'registros');
      this.updateGridData();
    } else {
      console.log('⏳ Esperando carga de datos...');
    }
    
    // Configurar filtro rápido si existe
    if (this.searchTerm) {
      params.api.setGridOption('quickFilterText', this.searchTerm);
    }
  }

  onSelectionChanged(event: any) {
    const selectedRows = this.gridApi.getSelectedRows();
    this.hasSelection = selectedRows.length > 0;
    
    if (selectedRows.length > 0) {
      this.showSnackBar(`Seleccionado: ${selectedRows[0].descripcion}`, 'info');
    }
  }

  onCellValueChanged(event: any) {
    console.log('📝 Celda modificada:', event.colDef.field, '=', event.newValue);
    event.data.__modified = true;
    this.notSavedChanges = true;
    
    // Validación en tiempo real
    this.validateRowData(event.data, event.rowIndex);
    
    this.showSnackBar('Datos modificados. No olvides guardar los cambios.', 'info');
  }
  
  // Métodos de filtrado y búsqueda
  onQuickFilterChanged(event: any) {
    const searchValue = event.target.value;
    console.log('🔍 Búsqueda rápida:', searchValue);
    
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', searchValue);
    }
  }
  
  onPriorityFilterChanged(event: any) {
    const filterValue = event.value;
    console.log('🔍 Dropdown filtro prioridad cambiado a:', filterValue);
    
    if (this.gridApi) {
      if (filterValue && filterValue.trim() !== '') {
        // Aplicar filtro específico de prioridad
        const filterModel = {
          prioridad: {
            filterType: 'text',
            type: 'equals',
            filter: filterValue
          }
        };
        console.log('🎯 Aplicando filtro desde dropdown:', filterModel);
        this.gridApi.setFilterModel(filterModel);
      } else {
        // Limpiar todos los filtros
        console.log('🧹 Limpiando filtros');
        this.gridApi.setFilterModel(null);
      }
    }
  }
  
  // Validación de datos
  private validateRowData(data: ServicioData, rowIndex: number) {
    const errors: string[] = [];
    
    if (!data.codigo?.trim()) errors.push('Código requerido');
    if (!data.descripcion?.trim()) errors.push('Descripción requerida');
    if (!data.plazo?.trim()) errors.push('Fecha límite requerida');
    if (!data.origen?.trim()) errors.push('Origen requerido');
    if (!data.prioridad?.trim()) errors.push('Prioridad requerida');
    
    if (errors.length > 0) {
      (data as any).__hasErrors = true;
      (data as any).__errors = errors;
    } else {
      delete (data as any).__hasErrors;
      delete (data as any).__errors;
    }
    
    // Actualizar el grid para mostrar errores
    if (this.gridApi) {
      const rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);
      if (rowNode) {
        this.gridApi.refreshCells({ rowNodes: [rowNode] });
      }
    }
  }

  // Métodos CRUD
  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem: ServicioData = {
      codigo: '',
      descripcion: '',
      plazo: new Date().toISOString().split('T')[0],
      origen: '1',
      prioridad: 'NORMAL'
    };
    
    (newItem as any).__isNew = true;
    (newItem as any).id = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    
    setTimeout(() => {
      if (this.gridApi) {
        this.updateGridData();
        this.gridApi.setFocusedCell(0, 'codigo');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'codigo' });
      }
    }, 100);
    
    this.showSnackBar('Nuevo registro agregado. Complete los datos requeridos.', 'success');
  }

  saveChanges() {
    const invalidRows = this.rowData.filter(row => 
      !row.codigo?.trim() || !row.descripcion?.trim() || !row.plazo?.trim() || 
      !row.origen?.trim() || !row.prioridad?.trim()
    );
    
    if (invalidRows.length > 0) {
      this.showSnackBar(
        `${invalidRows.length} registro(s) tienen campos incompletos. Por favor complete todos los campos requeridos.`,
        'error'
      );
      return;
    }
    
    this.isSaving = true;
    
    setTimeout(() => {
      console.log('💾 Guardando cambios:', this.rowData);
      
      this.rowData.forEach(row => {
        delete (row as any).__isNew;
        delete (row as any).__modified;
        delete (row as any).__hasErrors;
        delete (row as any).__errors;
        if (!(row as any).id || (row as any).id.startsWith('temp_')) {
          (row as any).id = Math.random().toString(36).substr(2, 9);
        }
      });
      
      this.originalData = [...this.rowData];
      this.notSavedChanges = false;
      this.isSaving = false;
      
      this.showSnackBar('Cambios guardados exitosamente', 'success');
    }, 2000);
  }

  revert() {
    if (!this.notSavedChanges) {
      this.showSnackBar('No hay cambios para revertir', 'info');
      return;
    }
    
    if (!confirm('¿Está seguro de que desea revertir todos los cambios? Esta acción no se puede deshacer.')) {
      return;
    }
    
    this.rowData = [...this.originalData];
    this.notSavedChanges = false;
    
    if (this.gridApi) {
      this.updateGridData();
    }
    
    this.showSnackBar('Cambios revertidos exitosamente', 'info');
  }

  deleteEntry() {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    
    if (!selectedNodes || selectedNodes.length === 0) {
      this.showSnackBar('Por favor seleccione una fila para eliminar', 'warning');
      return;
    }
    
    const selectedData = selectedNodes[0].data;
    const description = selectedData.descripcion || 'Sin descripción';
    
    if (confirm(`¿Está seguro de que desea eliminar el servicio "${description}"?\n\nEsta acción no se puede deshacer.`)) {
      this.rowData = this.rowData.filter(row => row !== selectedData);
      this.notSavedChanges = true;
      this.hasSelection = false;
      
      if (this.gridApi) {
        this.updateGridData();
      }
      
      this.showSnackBar('Registro eliminado exitosamente', 'success');
    }
  }
  
  // Método para mostrar notificaciones
  private showSnackBar(message: string, type: 'success' | 'error' | 'warning' | 'info') {
    const config = {
      duration: 4000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'right' as const,
      verticalPosition: 'top' as const
    };
    
    this.snackBar.open(message, 'Cerrar', config);
  }
}

// Estilos dinámicos para las celdas de prioridad
declare global {
  interface Window {
    addPriorityCellStyles: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.addPriorityCellStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .priority-high { background-color: #fee2e2 !important; color: #991b1b; }
      .priority-medium { background-color: #fef3c7 !important; color: #92400e; }
      .priority-normal { background-color: #dcfce7 !important; color: #166534; }
      .priority-low { background-color: #dbeafe !important; color: #1e40af; }
      .priority-cell { display: flex; align-items: center; gap: 0.25rem; }
    `;
    document.head.appendChild(style);
  };
  window.addPriorityCellStyles();
}