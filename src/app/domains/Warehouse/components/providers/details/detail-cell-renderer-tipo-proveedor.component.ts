import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorComponent } from 'app/domains/Almacenes/components/materiales-maestro/editors/select-with-tooltip-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-tipo-proveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule, SelectWithTooltipEditorComponent],
  template: `
    <div style="padding: 10px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column;">
      <!-- Título y botones -->
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Configurar Tipo de Proveedor (Cascada)</strong>
        <div class="d-flex gap-2">
          <button
            class="btn btn-sm btn-success"
            (click)="addRow()"
            [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button
            class="btn btn-sm btn-primary position-relative"
            (click)="saveChanges()"
            [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button
            class="btn btn-sm btn-warning"
            (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button
            class="btn btn-sm btn-danger"
            (click)="deleteSelected()"
            [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <!-- Grid único con 3 columnas -->
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; flex-grow: 1;"
        [rowData]="rowData"
        [columnDefs]="columnDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (selectionChanged)="onSelectionChanged($event)">
      </ag-grid-angular>

      <!-- Previsualización de la cadena concatenada -->
      <div class="mt-2" *ngIf="getPreviewString()">
        <div class="alert alert-info py-2 mb-0">
          <small>
            <strong>Vista previa:</strong> {{ getPreviewString() }}
          </small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class DetailCellRendererTipoProveedorComponent implements ICellRendererAngularComp {

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private customersService = inject(CustomersService);

  params: any;
  gridApi!: GridApi;
  rowData: any[] = [];
  selectedRow: any = null;
  hasChanges: boolean = false;
  private tempIdCounter: number = 0;
  private idRoot: number;

  // Datos reales desde endpoints
  categorias: any[] = [];      // Desde getCatalogs(idRoot, 'CATEGORY')
  familias: any[] = [];         // Desde getCatalogs(idRoot, 'FAM-CAT')
  subfamilias: any[] = [];      // Desde getCatalogs(idRoot, 'SUB-FAM')

  // Column Defs con combo boxes en cascada
  columnDefs: any[] = [
    {
      field: 'categoria',
      headerName: 'Categoría',
      editable: true,
      cellEditor: SelectWithTooltipEditorComponent,
      cellEditorParams: () => {
        return {
          options: this.categorias.map(c => ({
            id: c.description,
            description: c.description,
            valueAddition: c.valueAddition,
            valueAddition2: c.valueAddition2
          }))
        };
      },
      cellEditorPopup: true,
      width: 180
    },
    {
      field: 'familia',
      headerName: 'Familia',
      editable: true,
      cellEditor: SelectWithTooltipEditorComponent,
      cellEditorParams: (params: any) => {
        // Filtrar familias según la categoría seleccionada en la fila
        const categoriaSeleccionada = params.data.categoria;
        const categoriaObj = this.categorias.find(c => c.description === categoriaSeleccionada);

        if (categoriaObj) {
          const familiasFiltradas = this.familias
            .filter(f => f.parentId === categoriaObj.id)
            .map(f => ({
              id: f.description,
              description: f.description,
              valueAddition: f.valueAddition,
              valueAddition2: f.valueAddition2
            }));

          return { options: familiasFiltradas };
        }

        return { options: [] };
      },
      cellEditorPopup: true,
      width: 180
    },
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      editable: true,
      cellEditor: SelectWithTooltipEditorComponent,
      cellEditorParams: (params: any) => {
        // Filtrar subfamilias según la familia seleccionada en la fila
        const familiaSeleccionada = params.data.familia;
        const familiaObj = this.familias.find(f => f.description === familiaSeleccionada);

        if (familiaObj) {
          const subfamiliasFiltradas = this.subfamilias
            .filter(s => s.subParentId === familiaObj.id)
            .map(s => ({
              id: s.description,
              description: s.description,
              valueAddition: s.valueAddition,
              valueAddition2: s.valueAddition2
            }));

          return { options: subfamiliasFiltradas };
        }

        return { options: [] };
      },
      cellEditorPopup: true,
      width: 200
    }
  ];

  // Grid Options
  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowSelection: 'single',
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true,
    // Agregar soporte para componentes Angular como editores
    frameworkComponents: {
      selectWithTooltipEditor: SelectWithTooltipEditorComponent
    }
  };

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    // Cargar catálogos desde el API
    this.loadCatalogs();

    // Cargar datos existentes si hay (desde tipoProveedorRows o parsear typework)
    if (params.data.tipoProveedorRows) {
      this.rowData = JSON.parse(JSON.stringify(params.data.tipoProveedorRows));
    } else if (params.data.typework && params.data.typework.trim() !== '') {
      // Si viene typework desde la BD, parsearlo para reconstruir las filas
      this.parseTypeworkToRows(params.data.typework);
    }
  }

  // Método para parsear el campo typework y reconstruir las filas del grid
  parseTypeworkToRows(typework: string): void {
    if (!typework) return;

    // Split por " | " para obtener cada combinación
    const combinations = typework.split(' | ');

    this.rowData = combinations.map((combo, index) => {
      // Split por "/" para obtener categoria/familia/subfamilia
      const parts = combo.split('/');
      return {
        id: `parsed_${index}`,
        categoria: parts[0] || '',
        familia: parts[1] || '',
        subfamilia: parts[2] || ''
      };
    });
  }

  async loadCatalogs(): Promise<void> {
    try {
      // Cargar en paralelo las 3 tablas
      const [categorias, familias, subfamilias] = await Promise.all([
        this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY').toPromise(),
        this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT').toPromise(),
        this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM').toPromise()
      ]);

      this.categorias = categorias || [];
      this.familias = familias || [];
      this.subfamilias = subfamilias || [];

      console.log('Catálogos cargados:', {
        categorias: this.categorias.length,
        familias: this.familias.length,
        subfamilias: this.subfamilias.length
      });

      // Verificar si tienen valueAddition y valueAddition2
      console.log('Ejemplo de categoría:', this.categorias[0]);
      console.log('Ejemplo de familia:', this.familias[0]);
      console.log('Ejemplo de subfamilia:', this.subfamilias[0]);

    } catch (error) {
      console.error('Error al cargar catálogos:', error);
      this.categorias = [];
      this.familias = [];
      this.subfamilias = [];
    }
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: any): void {
    // Cuando cambia la categoría, limpiar familia y subfamilia
    if (event.colDef.field === 'categoria') {
      event.data.familia = '';
      event.data.subfamilia = '';
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }

    // Cuando cambia la familia, limpiar subfamilia
    if (event.colDef.field === 'familia') {
      event.data.subfamilia = '';
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }

    event.data.__modified = true;
    this.hasChanges = true;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedRow = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addRow(): void {
    if (!this.gridApi) {
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newRow = {
      id: tempId,
      categoria: '',
      familia: '',
      subfamilia: '',
      __isNew: true
    };

    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'categoria'
      });
    }, 100);
  }

  deleteSelected(): void {
    if (!this.selectedRow) {
      return;
    }

    this.rowData = this.rowData.filter(row => row.id !== this.selectedRow.id);
    this.selectedRow = null;
    this.hasChanges = true;
  }

  async saveChanges(): Promise<void> {
    // Validar que todas las filas tengan las 3 columnas llenas
    const incompleteRows = this.rowData.filter(
      row => !row.categoria || !row.familia || !row.subfamilia
    );

    if (incompleteRows.length > 0) {
      alert('Por favor complete todas las filas antes de guardar.');
      return;
    }

    // Concatenar todas las filas con "/"
    const concatenatedString = this.rowData
      .map(row => `${row.categoria}/${row.familia}/${row.subfamilia}`)
      .join(' | ');

    // Actualizar en memoria
    this.params.data.typeProvider = concatenatedString;
    this.params.data.typework = concatenatedString;  // Campo real en la BD
    this.params.data.tipoProveedorRows = JSON.parse(JSON.stringify(this.rowData));

    // Preparar datos para enviar a BD (solo campos necesarios)
    const dataToSave = this.cleanDataForServer(this.params.data);

    console.log('Guardando typework en BD:', dataToSave.typework);

    try {
      // Guardar directamente en BD
      await this.customersService.updateCustomer(this.params.data.id, dataToSave).toPromise();

      alerts.basicAlert(
        'Tipo de Proveedor Guardado',
        'Se ha guardado correctamente el tipo de proveedor.',
        'success'
      );

      // Notificar al grid padre para actualizar visualización
      if (this.params.api) {
        this.params.api.applyTransaction({ update: [this.params.data] });
      }

      // Colapsar la fila
      if (this.params.node) {
        this.params.node.setExpanded(false);
      }

      this.hasChanges = false;

    } catch (error) {
      console.error('Error al guardar typework:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo guardar el tipo de proveedor. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  // Método para limpiar datos antes de enviar a servidor
  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.typeProvider; // Solo para visualización
    delete cleanedData.tipoProveedorRows; // Solo para reconstruir grid
    delete cleanedData.detailType; // Propiedad interna del grid
    return cleanedData;
  }

  revertChanges(): void {
    // Recargar datos originales
    if (this.params.data.tipoProveedorRows) {
      this.rowData = JSON.parse(JSON.stringify(this.params.data.tipoProveedorRows));
    } else {
      this.rowData = [];
    }

    this.hasChanges = false;
    this.selectedRow = null;
  }

  getPreviewString(): string {
    const validRows = this.rowData.filter(
      row => row.categoria && row.familia && row.subfamilia
    );

    if (validRows.length === 0) {
      return '';
    }

    return validRows
      .map(row => `${row.categoria}/${row.familia}/${row.subfamilia}`)
      .join(' | ');
  }
}
