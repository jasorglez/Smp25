import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, GridReadyEvent, ColDef, GridOptions } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { MaterialsService } from 'app/services/materials.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-prodterminado',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './prodterminado.component.html',
  styleUrl: './prodterminado.component.scss'
})
export class ProdterminadoComponent {

  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private materialsService = inject(MaterialsService);

  gridApi!: GridApi;
  rowData: any[] = [];
  originalRowData: any[] = [];
  selectedRowData: any = null;
  hasUnsavedChanges: boolean = false;

  private idRoot: number = 0;
  private tempIdCounter: number = 0;

  // Column Definitions
  columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 80,
      editable: false,
      hide: true
    },
    {
      field: 'code',
      headerName: 'Código',
      width: 150,
      editable: true,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'description',
      headerName: 'Descripción',
      width: 300,
      editable: true,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'unit',
      headerName: 'Unidad',
      width: 120,
      editable: true,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'price',
      headerName: 'Precio',
      width: 130,
      editable: true,
      valueFormatter: (params) => {
        if (params.value != null) {
          return '$ ' + Number(params.value).toFixed(2);
        }
        return '';
      }
    },
    {
      field: 'stock',
      headerName: 'Stock',
      width: 120,
      editable: true,
      valueFormatter: (params) => {
        if (params.value != null) {
          return Number(params.value).toFixed(2);
        }
        return '';
      }
    },
    {
      field: 'active',
      headerName: 'Activo',
      width: 100,
      editable: true,
      cellRenderer: (params: any) => {
        return params.value ? '✓' : '';
      }
    }
  ];

  // Grid Options
  gridOptions: GridOptions = {
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true
    },
    rowSelection: 'single',
    animateRows: true,
    pagination: true,
    paginationPageSize: 50,
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true,
    onCellValueChanged: (event) => this.onCellValueChanged(event),
    onSelectionChanged: (event) => this.onSelectionChanged(event)
  };

  constructor() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
  }

  ngOnInit(): void {
    this.loadData();

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso al componente Producto Terminado',
      'Almacenes - Materia Prima',
      this.trackingService.getEmail()
    );
  }

  async loadData(): Promise<void> {
    try {
      // Aquí cargarías los datos desde tu servicio
      // Por ahora lo dejo como ejemplo vacío
      this.rowData = [];
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));

      console.log('Datos cargados para Producto Terminado');
    } catch (error) {
      console.error('Error al cargar datos:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los datos', 'error');
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: any): void {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedRowData = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  add(): void {
    if (!this.gridApi) {
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newRow = {
      id: tempId,
      code: '',
      description: '',
      unit: '',
      price: 0,
      stock: 0,
      active: true,
      __isNew: true
    };

    this.rowData = [newRow, ...this.rowData];
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = true;

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'code'
      });
    }, 100);
  }

  async saveChanges(): Promise<void> {
    if (!this.hasUnsavedChanges) {
      return;
    }

    const itemsToSave = this.rowData.filter(item => item.__isNew || item.__modified);

    if (itemsToSave.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    try {
      // Aquí implementarías la lógica para guardar en el backend
      console.log('Guardando items:', itemsToSave);

      alerts.basicAlert(
        'Éxito',
        `Se guardaron ${itemsToSave.length} registro(s) correctamente`,
        'success'
      );

      // Recargar datos
      await this.loadData();
      this.hasUnsavedChanges = false;

    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = false;
    this.selectedRowData = null;
  }

  delete(): void {
    if (!this.selectedRowData) {
      alerts.basicAlert('Info', 'Por favor selecciona un registro para eliminar', 'info');
      return;
    }

    alerts.confirmAlert(
      '¿Estás seguro?',
      `¿Deseas eliminar el producto "${this.selectedRowData.description}"?`,
      'warning',
      'Sí, eliminar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.rowData = this.rowData.filter(row => row.id !== this.selectedRowData.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.selectedRowData = null;
        this.hasUnsavedChanges = true;

        alerts.basicAlert('Eliminado', 'El registro ha sido eliminado', 'success');
      }
    });
  }
}
