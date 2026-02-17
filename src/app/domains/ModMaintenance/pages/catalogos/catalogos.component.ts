import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-enterprise';
import { MaintenanceCatalogService } from 'app/services/maintenance-catalog.service';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { concat } from 'rxjs';
import { toArray } from 'rxjs/operators';

interface CatalogType {
  type: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-catalogos-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './catalogos.component.html',
  styleUrl: './catalogos.component.scss'
})
export class CatalogosMaintenanceComponent implements OnInit {

  private catalogService = inject(MaintenanceCatalogService);
  private signalsService = inject(SignalsService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private gridApi!: GridApi;

  idCompany: number = 0;
  loading: boolean = false;
  saving: boolean = false;
  hasUnsavedChanges: boolean = false;

  // Tipos de catálogos disponibles
  catalogTypes: CatalogType[] = [
    { type: 'ASSET_TYPE', label: 'Tipo de Activo', description: 'Clasificación de activos (Operativo, Mantenimiento, etc.)' },
    { type: 'ASSET_STATUS', label: 'Estado de Activo', description: 'Estados de los activos (Activo, En reparación, Baja)' },
    { type: 'FAILURE_TYPE', label: 'Tipo de Falla', description: 'Clasificación de fallas (Mecánica, Eléctrica, etc.)' },
    { type: 'MAINTENANCE_CATEGORY', label: 'Categoría de Mantenimiento', description: 'Categorías para agrupar actividades' },
    { type: 'SPARE_PART_TYPE', label: 'Tipo de Repuesto', description: 'Clasificación de repuestos' },
    { type: 'SPECIALTY', label: 'Especialidad', description: 'Especialidades de equipos de trabajo (Electricidad, Mecánica, etc.)' },
    { type: 'MEASURE', label: 'Unidad de Medida', description: 'Unidades de medida para activos (DIA, HRS, PZA, KG, etc.)' }
  ];

  selectedType: string = 'ASSET_TYPE';
  rowData: any[] = [];
  private tempIdCounter: number = 0;

  colDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 80,
      hide: true
    },
    {
      field: 'description',
      headerName: 'Descripción',
      editable: true,
      flex: 2,
      cellStyle: { cursor: 'text' },
      valueSetter: (params) => {
        const value = params.newValue?.trim().toUpperCase();
        if (!value) {
          alert('La descripción es requerida');
          return false;
        }
        // Check duplicates
        const duplicate = this.rowData.some(
          (row, idx) => idx !== params.node?.rowIndex && row.description?.toUpperCase() === value
        );
        if (duplicate) {
          alert('Ya existe un registro con esa descripción');
          return false;
        }
        params.data.description = value;
        return true;
      }
    },
    {
      field: 'valueAddition',
      headerName: 'Valor Adicional',
      editable: true,
      flex: 1,
      cellStyle: { cursor: 'text' }
    },
    {
      field: 'sortOrder',
      headerName: 'Orden',
      editable: true,
      width: 100,
      cellEditor: 'agNumberCellEditor',
      cellStyle: { textAlign: 'center' }
    }
  ];

  gridOptions = {
    headerHeight: 32,
    rowHeight: 36,
    animateRows: true,
    suppressRowClickSelection: false,
    rowSelection: 'single' as const
  };

  constructor() {
    effect(() => {
      const company = this.signalsService.getRootSelectedBySidebar()();
      if (company !== null && company !== undefined) {
        const newCompany = Number(company);
        if (this.idCompany !== newCompany) {
          this.idCompany = newCompany;
          this.loadData();
        }
      }
    });
  }

  ngOnInit(): void {
    const company = this.signalsService.getRootSelectedBySidebar()();
    this.idCompany = company !== null && company !== undefined ? Number(company) : 0;
    this.loadData();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  onTypeChange(): void {
    if (this.hasUnsavedChanges) {
      if (!confirm('Hay cambios sin guardar. ¿Desea continuar?')) {
        return;
      }
    }
    this.hasUnsavedChanges = false;
    this.loadData();
  }

  loadData(): void {
    if (!this.idCompany || this.idCompany <= 0) {
      this.rowData = [];
      return;
    }

    this.loading = true;
    this.catalogService.getByCompanyAndType(this.idCompany, this.selectedType).subscribe({
      next: (data) => {
        this.rowData = data.map(item => ({ ...item, __original: { ...item } }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading catalogs:', err);
        this.rowData = [];
        this.loading = false;
      }
    });
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  addRow(): void {
    if (this.idCompany <= 0) {
      alert('Debe seleccionar una empresa');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idCompany,
      type: this.selectedType,
      description: '',
      valueAddition: '',
      sortOrder: this.rowData.length + 1,
      active: true,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;

    setTimeout(() => {
      this.gridApi?.ensureIndexVisible(0);
      this.gridApi?.startEditingCell({
        rowIndex: 0,
        colKey: 'description'
      });
    }, 100);
  }

  async saveChanges(): Promise<void> {
    // Validate all rows have description
    const invalid = this.rowData.some(row => !row.description?.trim());
    if (invalid) {
      alert('Todos los registros deben tener una descripción');
      return;
    }

    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      this.hasUnsavedChanges = false;
      return;
    }

    this.saving = true;

    const addOps = newRows.map(row => {
      const cleanData = this.cleanDataForServer(row);
      return this.catalogService.add(cleanData);
    });

    const updateOps = modifiedRows.map(row => {
      const cleanData = this.cleanDataForServer(row);
      return this.catalogService.update(row.id, cleanData);
    });

    try {
      if (addOps.length > 0 || updateOps.length > 0) {
        await concat(...addOps, ...updateOps).pipe(toArray()).toPromise();
      }
      alert('Datos guardados correctamente');
      this.hasUnsavedChanges = false;
      this.loadData();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar los datos');
    } finally {
      this.saving = false;
    }
  }

  revertChanges(): void {
    if (!confirm('¿Desea deshacer todos los cambios?')) {
      return;
    }
    this.hasUnsavedChanges = false;
    this.loadData();
  }

  deleteSelected(): void {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alert('Seleccione un registro para eliminar');
      return;
    }

    const selectedData = selectedNodes[0].data;

    if (!confirm(`¿Está seguro de eliminar "${selectedData.description}"?`)) {
      return;
    }

    // If it's a new row (not saved yet), just remove from array
    if (selectedData.__isNew) {
      this.rowData = this.rowData.filter(row => row.id !== selectedData.id);
      this.hasUnsavedChanges = this.rowData.some(row => row.__isNew || row.__modified);
      return;
    }

    // Otherwise, delete from server
    this.saving = true;
    this.catalogService.delete(selectedData.id).subscribe({
      next: () => {
        alert('Registro eliminado');
        this.loadData();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error deleting:', err);
        alert('Error al eliminar el registro');
        this.saving = false;
      }
    });
  }

  private cleanDataForServer(data: any): any {
    const cleaned = { ...data };
    delete cleaned.__isNew;
    delete cleaned.__modified;
    delete cleaned.__original;
    if (cleaned.id?.toString().startsWith('temp_')) {
      delete cleaned.id;
    }
    return cleaned;
  }

  getSelectedTypeName(): string {
    return this.catalogTypes.find(t => t.type === this.selectedType)?.label || '';
  }

  canSave(): boolean {
    return this.idCompany > 0 && this.hasUnsavedChanges && !this.saving;
  }
}
