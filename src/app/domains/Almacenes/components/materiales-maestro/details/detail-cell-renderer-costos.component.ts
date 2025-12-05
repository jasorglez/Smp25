import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { CellFocusedEvent, CellClickedEvent, ColDef, GridApi, GridReadyEvent, ValueGetterParams, ValueSetterParams, CellKeyDownEvent, Column, IRowNode, ValueFormatterParams } from 'ag-grid-community';
import { ICellRendererParams } from 'ag-grid-community';
import { FamilySubFamily } from 'app/services/familySubFamily.service';
import { FormulaEditorComponent } from '../formula-editor.component';
import { Parser } from 'expr-eval';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { DetailCellRendererParametrosComponent } from './detail-cell-renderer-parametros.component';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from '../editors/select-with-tooltip-editor-v2.component';
import { RawMaterialsService } from 'app/services/raw-materials.service';
import { MateriaByCatalogService } from 'app/services/MateriaByCatalog.service';

@Component({
  selector: 'app-detail-cell-renderer-costos',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [CommonModule, AgGridModule, FormulaEditorComponent, CurrencyPipe, DetailCellRendererParametrosComponent],
  template: `
    <!-- El template permanece igual -->
    <div style="padding: 10px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
       <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Desglose de Costos para: {{ materialName }}</strong>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-success me-2"
              (click)="onAddRow()"
              >
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="onStartEditing()"
              >
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="onUndo()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="onRemoveSelected()">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
      <!-- Barra de Fórmulas -->
      <div style="display: flex; align-items: center; margin-bottom: 8px; font-family: monospace;">
        <div style="padding: 5px; background-color: #f0f0f0; border: 1px solid #ccc; border-right: none;">fx</div>
        <input #formulaBar type="text" style="flex-grow: 1; padding: 5px; border: 1px solid #ccc;"
               [value]="formulaBarValue"
               (input)="onFormulaBarChange($event)"
               (keydown.enter)="applyFormulaFromBar()"
               [class.is-invalid]="!isFormulaValid"/>
      </div>
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="costosColumnDefs"
          [rowData]="costosRowData"
          [gridOptions]="gridOptions"
          [components]="components"
          (cellValueChanged)="onCellValueChanged($event)"
          (gridReady)="onGridReady($event)"
          (cellFocused)="onCellFocused($event)"
          (cellKeyDown)="onCellKeyDown($event)"
          (cellClicked)="onCellClicked($event)"
          (fillEnd)="onFillEnd($event)"
          >
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    /* Estilo para resaltar las celdas referenciadas en la fórmula */
    ::ng-deep .ag-theme-quartz .cell-highlight {
      background-color: #bde0fe !important;
      border: 1px solid #007bff !important;
      transition: background-color 0.2s ease-in-out, border 0.2s ease-in-out;
    }
  `]
})
export class DetailCellRendererCostosComponent implements ICellRendererAngularComp {
  private currencyPipe = inject(CurrencyPipe);
  private rawMaterialsService = inject(RawMaterialsService);
  private materiaByCatalogService = inject(MateriaByCatalogService);
  @ViewChild('formulaBar') formulaBar!: ElementRef<HTMLInputElement>;

  public params!: ICellRendererParams;
  public materialName: string = '';
  private familySubFamily = inject(FamilySubFamily);
  private gridApi!: GridApi;
  

  // --- Propiedades para la barra de fórmulas ---
  public formulaBarValue: string = '';
  families:any[];
  idRoot: number;
  idSelect:number;
  familiasVigente: any[];
  data: any;
  public isFormulaValid: boolean = true;
  private focusedCell: { rowIndex: number, colId: string } | null = null;
  private highlightedCols: string[] = [];
  private collapseTimer: any = null;
  // -------------------------------------------

  public costosRowData: any[] = [];
  components = {
      DetailCellRendererParametros: DetailCellRendererParametrosComponent,
    };
  public gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    suppressClickEdit: false,
    
    singleClickEdit: true,
    enableRangeSelection: true, // Habilita la selección de rangos (como en Excel)
    enableFillHandle: true,     // Habilita el cuadro de arrastre para copiar/rellenar
    stopEditingWhenCellsLoseFocus: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 10,
    rowSelection: 'single' as const,
    pinnedBottomRowData: [],
    masterDetail: true,
    detailRowHeight: 250,
    detailCellRendererSelector: (params) => {
    // Decide qué renderizador usar basado en la propiedad 'detailType'
    if (params.data.detailType === 'parametros') {
      params.node.setRowHeight(1000);
      return {
        component: 'DetailCellRendererParametros',
        params: {
          masterData: params.data, // Pass the master row data
          onMouseEnter: () => {clearTimeout(this.collapseTimer)},
          onMouseLeave: () => {
            this.collapseTimer = setTimeout(() => {
              params.node.setExpanded(false);
            }, 300); // Un retardo de 300ms
          },
        }
      };
    } else
    return undefined;
  },
    detailCellRendererParams: {
      getDetailRowData: (params: any) => {
        // Aquí le decimos a AG Grid cómo obtener los datos para el detalle.
        // `params.successCallback` es la función que AG Grid nos da para entregarle los datos.
        params.successCallback(params.data.detailRowData);
      },
    },
    processCellForClipboard: (params: any) => {
      // Asegurarse de que params.column no sea null/undefined antes de llamar a getColId()
      const field = params.column?.getColId();
      const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`;
      return params.node.data[formulaField] || params.value;
    },
    fillOperation: (params: any) => {
      const { event, values, initialValues, sourceRowNode, startRow, endRow, column } = params;

      // --- DEFENSA CONTRA EL ERROR ---
      // Si sourceRowNode no está definido, no podemos continuar.
      if (!sourceRowNode) {
        // Devolver el valor de la celda de origen, que está en initialValues[0].
        // Esto asegura que se copie el valor incluso si el nodo de origen no está disponible.
        return initialValues[0];
      }
      const field = column.getColId();
      const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`;
      const sourceFormula = sourceRowNode.data[formulaField];

      if (sourceFormula && typeof sourceFormula === 'string' && sourceFormula.startsWith('=')) {
        const { node: targetRowNode } = params; // Obtener el nodo de la fila de destino
        const sourceRowIndex = sourceRowNode.rowIndex; // Índice de fila base 0 de la celda de origen
        const targetRowIndex = params.rowIndex; // Índice de fila base 0 de la celda de destino

        const rowOffset = targetRowIndex - sourceRowIndex;

        let adjustedFormula = sourceFormula.substring(1); // Quitar el '=' inicial

        // Expresión regular para encontrar referencias de celda estilo Excel (ej. A1, B10, K5)
        // Actualmente, el grid usa columnas col1-col11, que se mapean a A-K.
        // Si se añaden más columnas (más allá de 'Z'), la regex necesitará ser más robusta (ej. [A-Z]{1,2})
        const cellReferenceRegex = /([A-K])(\d+)/g;

        adjustedFormula = adjustedFormula.replace(cellReferenceRegex, (match, colLetter, rowNumberStr) => {
          const originalColZeroBasedIndex = this.colLetterToZeroBasedIndex(colLetter);
          const originalRowZeroBasedIndex = parseInt(rowNumberStr, 10) - 1; // Convertir a índice de fila base 0

          const newRowZeroBasedIndex = originalRowZeroBasedIndex + rowOffset;
          // Para el "fill handle" vertical, la columna no cambia.
          const newColZeroBasedIndex = originalColZeroBasedIndex;

          // Convertir de nuevo a la referencia estilo Excel
          const newColLetter = this.zeroBasedIndexToColLetter(newColZeroBasedIndex);
          const newRowNumber = newRowZeroBasedIndex + 1; // Convertir de nuevo a número de fila base 1

          return `${newColLetter}${newRowNumber}`;
        });

        return `=${adjustedFormula}`; // Añadir el '=' de nuevo a la fórmula ajustada
      }

      // Si la celda de origen tiene una fórmula (incluso sin referencias A1), la copiamos.
      // Si no tiene fórmula, copiamos el valor simple (initialValues[0]).
      return sourceFormula || initialValues[0];
     },
    context: {}, // Declarar explícitamente la propiedad context
    
  };
  public costosColumnDefs: ColDef[] = [];
  constructor() {
    effect(() => {
       this.onUndo()
       setTimeout(() => {
        this.updatePinnedRowTotals();
      }, 1200); 
    });
  }
  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialName = params.data.articulo || 'N/A';
    this.idRoot = params.context.idRoot;
    this.data = params.data;
    this.idSelect = params.context.select;
    console.log('ID Root en Costos:', params.context);
    this.obtenerDatos();
    this.familias(this.data);
    this.familiasVigentes(this.data);
    this.updatePinnedRowTotals()


    // Definir columnas con soporte para fórmulas en todas
    this.costosColumnDefs = [
      {
        headerName: 'id',
        field: 'id',
        hide: true,
        filter: 'agNumberColumnFilter',
      },
      { 
        headerName: 'Check', 
        field: 'check', 
        editable: true, 
        cellRenderer: 'agCheckboxCellRenderer', 
        cellStyle: { textAlign: 'center', paddingTop: '0px', paddingBottom: '0px' },        
        showDisabledCheckboxes: true,
      },
      {
  headerName: 'Artículos',
  field: 'idCatalog',
  editable: true,

  cellEditor: SelectWithTooltipEditorV2Component,

  cellEditorParams: () => {
    // Estructura esperada por el componente: { id, description }
    const opts = (this.families || []).map(f => ({
      id: f.id,
      description: f.articulo,
      valueAddition: f.familia ?? '',
      valueAddition2: f.subfamilia ?? ''
    }));

    console.log("OPCIONES EN EL EDITOR:", opts);
    return { options: opts };
  },

  valueFormatter: (params) => {
    const raw = params.value;

    // Normalizar a valor "id"
    const val = (raw && typeof raw === 'object')
      ? (raw.value ?? raw.id)
      : raw;

    console.log('Valor en valueFormatter:', val);

    // Buscar usando la misma lista que el editor
    const fam = this.familiasVigente?.find(f => f.id === val);

    if (fam) return fam.articulo;

    // Fallback si el editor devolvió objeto {label}
    if (raw && typeof raw === 'object') return raw.label ?? '';

    return '';
  },

  valueSetter: (params) => {
    const editorValue = params.newValue;

    // Normalizar cualquier forma devuelta por el editor
    let value = editorValue;
    if (editorValue && typeof editorValue === 'object') {
      value = editorValue.id ?? editorValue.value;
    }

    // Validación de requerido
    if (!value) {
      alerts.basicAlert('Campo requerido', 'El artículo es obligatorio', 'error');
      return false;
    }

    // Validación de duplicados
    const duplicateExists = this.costosRowData.some((row, i) =>
      i !== params.node.rowIndex && row.idCatalog === value
    );

    if (duplicateExists) {
      alerts.basicAlert('Valor duplicado', 'Ese artículo ya fue seleccionado.', 'error');
      return false;
    }

    // Asignar ID
    params.data.idCatalog = value;

    // Obtener artículo desde families (coherente con editor)
    const fam = this.families.find(f => f.id === value);

    // Asignar nombre del artículo
    params.data.articulo = fam?.articulo
      || (editorValue && editorValue.label)
      || '';

    return true;
  }
},
      {
        headerName: 'Costo Unitario',
        field: 'costoUni',
        editable: params => params.data.idCatalog !== 'Totales',
        type: 'numericColumn',
        valueParser: params => Number(params.newValue),
        valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2') || '$0.00',
        cellStyle: { textAlign: 'center' }
      },
      { headerName: 'Cantidad a Utilizar', field: 'cantidad',editable: params => params.data.idCatalog !== 'Totales', type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      { headerName: 'Proporcion', field: 'proporcion',editable: params => params.data.idCatalog !== 'Totales', type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      {
        headerName: 'Costo Total',
        field: 'costoTot',
        width: 120,
        editable: params => params.data.idCatalog !== 'Totales',
        type: 'numericColumn',
        valueGetter: params => {
          if (params.data.idCatalog === 'Totales') {
            return params.data.costoTot;
          }
          const u = Number(params.data.costoUni);
          const q = Number(params.data.cantidad);
          return u * q;
        },
        valueParser: params => Number(params.newValue),
        valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2') || '$0.00',
        cellStyle: { textAlign: 'center' }
      },
      { headerName: 'Merma', field: 'merma', editable: true, type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      {
        headerName: 'Costo Final',
        field: 'costoFin',
        width: 150,
        editable: false,
        type: 'numericColumn',
        valueGetter: params => {
          if (params.data.idCatalog === 'Totales') {
            return params.data.costoFin;
          }
          const u = Number(params.data.costoUni);
          const q = Number(params.data.cantidad);
          const z = u * q;
          const x = Number(params.data.merma);
          return z - x;
        },
        valueFormatter: params =>
          this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2'),
        cellStyle: { textAlign: 'center' }
      },
      {
        headerName: 'Fecha Cambio',
        field: 'fechaCambio',
        editable: true,
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (!params.value) return '';
          try {
            return new Date(params.value).toLocaleDateString();
          } catch (e) { return params.value; }
        },
        cellStyle: { textAlign: 'center' }
      },
      {
        headerName: 'Parametros',
        field: 'parametros',
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' },
        cellRenderer: (params: any) => {
          // Mostrar siempre "Ver"
          const div = document.createElement('div');
          div.innerText = 'Ver';
          return div;
        }
      },
      {
        headerName: 'Total (Fórmula)',
        field: 'total',
        hide : true,
        width: 200,
        editable: params => params.data.idCatalog !== 'Totales',
        cellEditor: FormulaEditorComponent,
        cellEditorPopup: true,
        valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2') || '$0.00',
        cellStyle: { textAlign: 'center' }
      },
    ].map(col => this.addFormulaSupport(col)).map(col => ({ ...col, flex: 1, minWidth: 100 })); // Aplicar flex y minWidth a todas
    const checkboxCol = this.costosColumnDefs.find(c => c.field === 'check');
    if (checkboxCol) {
      checkboxCol.flex = 0.5; // Hacer la columna de checkbox más pequeña
    }
    
    // Añadir dinámicamente la lógica de cellClass para el resaltado
    this.costosColumnDefs.forEach(colDef => {
      colDef.cellClass = params => {
        if (!params.data || !params.data.highlightedColumns) return null;
        const field = params.colDef.field || '';
        // Only handle fields that follow the 'colN' pattern (e.g., 'col1', 'col2')
        const match = field.match(/^col(\d+)$/);
        if (!match) return null;
        const colIndex = parseInt(match[1], 10);
        if (isNaN(colIndex)) return null;
        const colLetter = String.fromCharCode(65 + colIndex - 1);
        const rowNum = params.node.rowIndex + 1;
        const cellRef = colLetter + rowNum;
        return params.data.highlightedColumns.includes(cellRef) ? 'cell-highlight' : null;
      };
    });
    
    // Generar datos falsos para el grid de costos 
    this.gridOptions.context = this.params.context; // Inicializar el contexto del grid
  }

  private addFormulaSupport(col: ColDef): ColDef {
    const field = col.field!;
    const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`; // e.g., formulaCol1

    // Preserve any existing handlers/editors so we don't inadvertently remove custom
    // behavior (like the SelectWithTooltipEditorV2Component and its valueSetter).
    const originalValueGetter = col.valueGetter as ((params: ValueGetterParams) => any) | undefined;
    const originalValueSetter = col.valueSetter as ((params: ValueSetterParams) => boolean) | undefined;
    const originalCellEditor = col.cellEditor;

    return {
      ...col,
      // If a custom editor already exists (e.g. select editor), keep it. Otherwise use the formula editor.
      cellEditor: originalCellEditor ?? FormulaEditorComponent,
      // Only enable popup if not already defined by the original column
      cellEditorPopup: (col.cellEditorPopup !== undefined) ? col.cellEditorPopup : true,
      // Preserve original behavior: if the original cellEditorParams is a function,
      // call it (AG Grid expects either an object or a function). Merge its result
      // with `formulaField`. This ensures any console.log inside the original
      // function (like the options builder) still runs.
      cellEditorParams: (paramsInner: any) => {
        let baseParams: any = {};
        try {
          if (typeof col.cellEditorParams === 'function') {
            // Call the original function with the params AG Grid provides
            baseParams = (col.cellEditorParams as Function)(paramsInner) || {};
          } else {
            baseParams = col.cellEditorParams || {};
          }
        } catch (e) {
          // If the original function throws, fallback to empty base params
          console.error('Error calling original cellEditorParams function:', e);
          baseParams = {};
        }
        return { ...baseParams, formulaField };
      },
      valueGetter: (params: ValueGetterParams) => {
        // If this row has a formula for this field, evaluate it and return the result.
        if (params.data && params.data[formulaField]) {
          const result = this.evaluateFormula(params.data[formulaField], params.data, params.node.rowIndex);
          return result;
        }

        // Otherwise delegate to the original valueGetter if present, or return the raw data value.
        if (typeof originalValueGetter === 'function') {
          return originalValueGetter(params);
        }
        return params.data ? params.data[field] : undefined;
      },
      valueSetter: (params: ValueSetterParams) => {
        const value = params.newValue;

        // If the user entered a formula (starts with '='), store it in the formula field and
        // evaluate immediately to update the visible value.
        if (typeof value === 'string' && value.startsWith('=')) {
          params.data[formulaField] = value;
          params.data[field] = this.evaluateFormula(value, params.data, params.node.rowIndex);
          return true;
        }

        // If there was an original valueSetter (like the custom one for the select), call it.
        if (typeof originalValueSetter === 'function') {
          return originalValueSetter(params);
        }

        // Default fallback behavior: clear any formula and set the raw value.
        params.data[formulaField] = undefined;
        params.data[field] = value;
        return true;
      }
    };
  }
  obtenerDatos() {
    return new Promise((resolve) => {
      this.materiaByCatalogService.getMateriaByCatalog(this.idRoot, this.idSelect).subscribe(
        (data: any) => {
            this.costosRowData = data;
          console.log('Datos obtenidos del servidor:', this.costosRowData);

          // Calcular y almacenar los valores calculados para cada fila
          this.costosRowData.forEach(row => {
            const u = Number(row.costoUni);
            const q = Number(row.cantidad);
            const z = u * q;
            const x = Number(row.merma);
            row.costoTot = z;
            row.costoFin = z - x;
          });

          // Actualizar el grid y esperar a que termine
          this.gridApi.setGridOption('rowData', this.costosRowData);

          // Dar tiempo al grid para actualizar los datos
          setTimeout(() => {
            resolve(true);
          }, 100);
        },
        (error) => {
          console.error('Error fetching data:', error);
          resolve(false);
        }
      );
    });
  }

    familias(idFamilia:any){
      console.log(idFamilia);
    this.familySubFamily.getArticulosCatalogsMasterByFamily(this.idRoot).subscribe(
      (data: any) => {
        this.familiasVigente = data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  familiasVigentes(idFamilia:any){
    console.log("data",this.idRoot,this.idSelect,idFamilia);
    this.familySubFamily.getArticulosCatalogsMasterByFamilyVigentes(this.idRoot, this.idSelect, idFamilia.idFamilia).subscribe(
      (data: any) => {
        this.families= data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  private toggleFilterForParametros(rowData: any) {
    if (!this.gridApi) return;
    const selectedId = rowData.id;
    const currentFilterModel = this.gridApi.getFilterModel();
    const currentIdFilter = currentFilterModel?.['id']?.filter;
    if (String(currentIdFilter) === String(selectedId)) {
      // Already filtering by this id, remove filter
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
      console.log('Filtro quitado para id:', selectedId);
    } else {
      // Apply filter
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
      console.log('Filtro aplicado para id:', selectedId);
    }
  }


  onCellClicked(event: CellClickedEvent) {

    this.updatePinnedRowTotals();
    // Este evento ahora solo es necesario si queremos hacer algo ADICIONAL al clic.
    // La expansión/colapso del detalle ya es manejada automáticamente por AG Grid
    // al hacer clic en la celda con 'agGroupCellRenderer' (la columna 'Parametros').
    // Dejamos este método por si se necesita en el futuro, pero por ahora no hace nada.

    const colIdClicked = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro
    console.log('Celda clickeada en columna:', colIdClicked, 'ID seleccionado:', selectedId);

    if (colIdClicked === 'parametros') {
      selectedRowData.detailType = 'parametros';
      selectedRowData.detailRowData = [];
      this.toggleFilterForParametros(selectedRowData);
      event.node.setExpanded(!event.node.expanded);
    } else {
      // Remove filter when clicking other columns
      if (this.gridApi) {
        this.gridApi.setFilterModel(null);
        this.gridApi.onFilterChanged();
        console.log('Filtro quitado al clickear otra columna');
      }
    }
  }
    

  onAddRow() {
    const newRow = {
    idCompany: this.idRoot,
    check: false,
    idConcep: this.idSelect,
    idCatalog: 0,
    costoUni: 0,
    cantidad: 0,
    proporcion: 0,
    costoTot: 0,
    merma: 0,
    costoFin: 0,
    parametros: 0,
    total: 0,
    active: true,
    fechaCambio: new Date().toISOString().split('T')[0], // Default to today's date
      __isNew: true // Marcar la fila como nueva
    };
    this.gridApi.applyTransaction({ add: [newRow] });
    this.costosRowData = [...this.costosRowData, newRow];
    this.updatePinnedRowTotals();

    // Defer collecting data until after the transaction / render cycle completes
  }

  onRemoveSelected() {
    // Asegurarnos de que la API del grid esté lista
    if (!this.gridApi) {
      alerts.basicAlert('Error', 'Grid no inicializado.', 'error');
      return;
    }

    const selectedNodes = this.gridApi.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const node = selectedNodes[0];
    const selectedData = node?.data;
    console.log('Datos seleccionados para eliminar:', selectedData);
    if (!selectedData) {
      alerts.basicAlert('Eliminar entrada', 'No se encontró la fila seleccionada.', 'error');
      return;
    }

    // Confirmación antes de eliminar
    alerts
      .confirmAlert(
        'Eliminar entrada',
        '¿Está seguro que desea eliminar esta entrada?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        // Determinar el id real (puede venir como 'id' o 'Id' según el backend)
        const realId = selectedData.id ?? selectedData.Id ?? null;

        // Si la fila es nueva (no guardada en servidor) o no tiene id, la eliminamos localmente
        if (selectedData.__isNew || !realId) {
          this.gridApi.applyTransaction({ remove: [selectedData] });
          // Mantener costosRowData sincronizado
          this.costosRowData = this.costosRowData.filter((r) => r !== selectedData);
          this.updatePinnedRowTotals();
          alerts.basicAlert('Entrada eliminada', 'La entrada se eliminó localmente.', 'success');
          return;
        }

        // Si la fila existe en servidor, llamamos al servicio para eliminarla
        const id = realId;
        this.materiaByCatalogService
          .deleteMateriaByCatalog(id)
          .pipe(
            catchError((error) => {
              alerts.basicAlert(
                'Eliminar entrada',
                'Error al eliminar la entrada.',
                'error'
              );
              console.error(error);
              return EMPTY;
            })
          )
          .subscribe(() => {
            alerts.basicAlert(
              'Entrada eliminada',
              'La entrada se eliminó correctamente.',
              'success'
            );
            // Recargar datos desde el servidor para mantener consistencia
            this.obtenerDatos().then(() => {
              // Deseleccionar para evitar estados raros
              setTimeout(() => {
                if (this.gridApi && !this.gridApi.isDestroyed()) {
                  try { this.gridApi.deselectAll(); } catch (e) { /* noop */ }
                }
              }, 50);
            });
          });
      });
  }

  async onStartEditing() {
        const newRows = this.costosRowData.filter((row) => row.__isNew);
        const modifiedRows = this.costosRowData.filter(
          (row) => row.__modified && !row.__isNew
        );
    
        const addObservables = newRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          return this.materiaByCatalogService.addMateriaByCatalog(cleanedData);
        });
    
        const updateObservables = modifiedRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          return this.materiaByCatalogService.updateMateriaByCatalog(row.id, cleanedData);
        });
    
        try {
          await lastValueFrom(
            concat(...addObservables, ...updateObservables).pipe(toArray())
          );
          /*
          // Determinar qué ID vamos a seleccionar después de recargar
          if (modifiedRows.length > 0) {
            // Si hay filas modificadas, guardamos el ID de la última modificada
            this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
          } else if (newRows.length > 0) {
            // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
            this.lastEditedRowId = 'SELECT_MAX_ID';
          }
          */
          alerts.basicAlert(
            'Datos actualizados',
            'Se han actualizado los datos correctamente.',
            'success'
          );

          await this.obtenerDatos(); // Esperar a que se actualicen los datos
          this.updatePinnedRowTotals();
          /*
          // Seleccionar la fila apropiada después de recargar
          if (this.lastEditedRowId) {
            if (this.lastEditedRowId === 'SELECT_MAX_ID') {
              // Encontrar el ID máximo en los datos actuales
              const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
              this.selectRowById(maxId);
            } else {
              this.selectRowById(this.lastEditedRowId);
            }
            this.lastEditedRowId = null; // Resetear el ID
          }*/
        } catch (error) {
          console.error(error);
          alerts.basicAlert(
            'Error',
            'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
            'error'
          );
        }
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

  onUndo() { 
    this.familias(this.data);
    this.familiasVigentes(this.data);
    this.obtenerDatos();
    this.updatePinnedRowTotals();
  }

  onCellValueChanged(params: any) {
    // Refrescamos todas las celdas para recalcular fórmulas que dependan de esta celda.
    params.data.__modified = true;

    // Actualizar campos calculados cuando cambian sus dependencias
    if (['costoUni', 'cantidad', 'merma'].includes(params.colDef.field)) {
      const u = Number(params.data.costoUni);
      const q = Number(params.data.cantidad);
      const z = u * q;
      const x = Number(params.data.merma);
      params.data.costoTot = z;
      params.data.costoFin = z - x;
    }

    setTimeout(() => {
      this.updatePinnedRowTotals();
      this.gridApi.refreshCells({ force: true });
    }, 0);
  }

  onFillEnd(event: any) {
    alert('Relleno completado');
    // Forzar un refresco completo para asegurar que las fórmulas copiadas se re-evalúen.
    setTimeout(() => {
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.updatePinnedRowTotals();
        this.gridApi.refreshCells({ force: true });
      }
    }, 0);
  }

  // --- Lógica para la Barra de Fórmulas ---

  onCellFocused(event: CellFocusedEvent) {
    console.log('Celda enfocada:', event);
    this.clearCellHighlights(); // Limpiar resaltados anteriores

    if (!event.rowIndex || !event.column) {
      this.focusedCell = null;
      this.formulaBarValue = '';
      return;
    }

    const rowNode = this.gridApi.getRowNode(event.rowIndex.toString());
    const colId = (event.column as Column).getColId();
    if (!colId) {
      return;
    }


    this.focusedCell = { rowIndex: event.rowIndex, colId: colId };

    const formulaField = `formula${colId.charAt(0).toUpperCase() + colId.slice(1)}`;    if (!rowNode) return;
    if (rowNode.data[formulaField]) {
        this.formulaBarValue = rowNode.data[formulaField];
        this.updateCellHighlights(this.formulaBarValue, rowNode);
    } else {
        this.formulaBarValue = this.gridApi.getCellValue({ rowNode, colKey: colId }) ?? '';
        this.clearCellHighlights();
    }
    this.isFormulaValid = true;
  }

  onCellKeyDown(event: any) { // Usamos 'any' para aceptar CellKeyDownEvent y FullWidthCellKeyDownEvent
    
    const keyboardEvent = event.event as KeyboardEvent;
    if (keyboardEvent && keyboardEvent.key === 'F2') {
      event.event.preventDefault(); // Prevenir cualquier comportamiento por defecto
      this.formulaBar.nativeElement.focus();
      this.formulaBar.nativeElement.select();
    }

    console.log('Evento de tecla en celda:', event);
    if (event.column) {
      const colIdClicked = event.column.getColId();
      const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
      const selectedId = selectedRowData.id; // Obtener el ID del registro
      console.log('Celda clickeada en columna:', colIdClicked, 'ID seleccionado:', selectedId);

      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      if (colIdClicked === 'parametros') {
        if (this.gridApi) {
          const filterModel = {
            id: {
              type: 'equals',
              filter: selectedId,
            },
          };
          this.gridApi.setFilterModel(filterModel);
          this.gridApi.onFilterChanged();
          console.log('Filtro aplicado al enfocar parametros para id:', selectedId);
        }
      } else {
        // Quitar filtro si se enfoca otra columna
        if (this.gridApi) {
          this.gridApi.setFilterModel(null);
          this.gridApi.onFilterChanged();
          console.log('Filtro quitado al enfocar otra columna');
        }
      }
    }
    
  }

  onFormulaBarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.formulaBarValue = input.value;
    this.validateFormulaSyntax(this.formulaBarValue);

    if (this.focusedCell) {
      // Asegurarse de que la API del grid esté lista
      if (!this.gridApi) return;
      const rowNode = this.gridApi.getRowNode(String(this.focusedCell.rowIndex));
      this.updateCellHighlights(this.formulaBarValue, rowNode);
    }
  }

  validateFormulaSyntax(formula: string) {
    if (formula && typeof formula === 'string' && formula.startsWith('=')) {
      try {
        const expression = formula.substring(1);
        // Usamos evaluate con un contexto de prueba para validar también las variables.
        const parser = new Parser({
          operators: {
            add: true, subtract: true, multiply: true, divide: true,
            remainder: true, power: true, factorial: true, comparison: true,
            logical: true, concatenate: true
          }
        });
        parser.evaluate(expression); // Solo valida la sintaxis, no las variables.
        this.isFormulaValid = true;
      } catch (e) {
        this.isFormulaValid = false;
      }
    } else {
      this.isFormulaValid = true; // No es una fórmula, es un valor válido
    }
  }

  applyFormulaFromBar() {
    if (!this.focusedCell || !this.isFormulaValid) return;

    // Asegurarse de que la API del grid esté lista
    if (!this.gridApi) return;
    const rowNode = this.gridApi.getRowNode(String(this.focusedCell.rowIndex))!;
    if (!rowNode) return;

    rowNode.setDataValue(this.focusedCell.colId, this.formulaBarValue);
    this.gridApi.stopEditing();

    this.clearCellHighlights();
  }

  private updateCellHighlights(formula: string, rowNode: IRowNode | null) {
    this.clearCellHighlights();
    if (!rowNode || !formula || typeof formula !== 'string' || !formula.startsWith('=')) {
      return;
    }

    // Extraer referencias de celdas (ej. "A1", "B2") de la fórmula
    const referencedCells = formula.match(/[A-Z]\d+/g) || [];
    this.highlightedCols = [...new Set(referencedCells)]; // Eliminar duplicados

    // Guardar las columnas a resaltar en los datos de la fila y refrescar
    rowNode.data.highlightedColumns = this.highlightedCols;
    // Defer the refresh to avoid calling grid API during AG Grid's render cycle
    setTimeout(() => {
      if (!this.gridApi || this.gridApi.isDestroyed()) return;
      this.gridApi.refreshCells({ rowNodes: [rowNode], force: true });
    }, 0);
  }

  private clearCellHighlights() {
    if (this.highlightedCols.length > 0 && this.focusedCell) {
      // Asegurarse de que la API del grid esté lista
      if (!this.gridApi) return;
      const rowNode = this.gridApi.getRowNode(String(this.focusedCell.rowIndex))!;
      if (rowNode) {
        delete rowNode.data.highlightedColumns;
        // Defer the refresh to avoid calling grid API during AG Grid's render cycle
        setTimeout(() => {
          if (!this.gridApi || this.gridApi.isDestroyed()) return;
          this.gridApi.refreshCells({ rowNodes: [rowNode], force: true });
        }, 0);
      }
    }
    this.highlightedCols = [];
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Defer sizing and totals update until after AG Grid finishes the initial render
    setTimeout(() => {
      if (!this.gridApi || this.gridApi.isDestroyed()) return;
      this.gridApi.sizeColumnsToFit();
      this.updatePinnedRowTotals();
    }, 0);
  }

  private updatePinnedRowTotals() {
    if (!this.gridApi) return;

    const totals: any = {
      idCatalog: 'Totales', // Etiqueta para la fila de totales
    };
    // Columnas que deben ser sumadas. Se excluyen las que no son numéricas como fechas o checkboxes.
    const fieldsToSum = ['costoUni','cantidad', 'proporcion', 'costoTot', 'costoFin'];

    fieldsToSum.forEach(field => {
      let sum = 0;
      this.gridApi.forEachNode(node => {
        // Usamos getValue para asegurarnos de obtener el valor calculado (ej. de una fórmula)

        const value = this.gridApi.getValue(field, node);
        console.log(`Valor para suma en ${field} de fila ${node.rowIndex}:`, value);
        if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
          sum += value;
        } else if (node.data && typeof node.data[field] === 'number' && !isNaN(node.data[field]) && isFinite(node.data[field])) {
          // Fallback al valor directo si getValue falla
          sum += node.data[field];
        }
      });
      totals[field] = sum;
    });

    // Use setPinnedBottomRowData and defer the call slightly to avoid interfering with AG Grid's draw
    setTimeout(() => {
      if (!this.gridApi || this.gridApi.isDestroyed()) return;
      // Prefer the API method for pinned rows when available
      if ((this.gridApi as any).setPinnedBottomRowData) {
        (this.gridApi as any).setPinnedBottomRowData([totals]);
      } else {
        // Fallback to setGridOption for older AG Grid versions
        this.gridApi.setGridOption('pinnedBottomRowData', [totals]);
      }
    }, 0);
  }
  private evaluateFormula(formula: string, data: any, rowIndex: number): number | string {
    try {
      const expression = formula.substring(1); // Quitamos el '='
      const parser = new Parser({
        operators: {
          // Habilitamos todos los operadores por defecto
          add: true, subtract: true, multiply: true, divide: true,
          remainder: true, power: true, factorial: true, comparison: true,
          logical: true, concatenate: true
        }
      });

      parser.functions.sum = (...args: any[]) => {
        let sum = 0;
        for (const arg of args) {
          if (typeof arg === 'number') {
            sum += arg;
          }
        }
        return sum;
      };


      // Función para obtener el valor de una celda (ej: "A1")
      parser.functions.cell = (cellRef: string) => {
        const match = cellRef.match(/([A-K])(\d+)/i);
        if (!match) return 0;
        const colLetter = match[1].toUpperCase();
        const rowNum = parseInt(match[2], 10);
        const colIndex = colLetter.charCodeAt(0) - 65; // A=0, B=1, ...
        const field = `col${colIndex + 1}`;
        return this.costosRowData[rowNum - 1]?.[field] || 0;
      };

      // Reemplazamos las referencias de celda (A1) por cell("A1") para que el parser las entienda
      const expressionWithCellFunc = expression.replace(/([A-K]\d+)/g, 'cell("$1")');
      return parser.evaluate(expressionWithCellFunc, data); // <-- Pasamos 'data' como contexto
    } catch (e) {
      // Si la fórmula es inválida, lanzamos un error que el valueSetter puede atrapar.
      console.error('Error al evaluar la fórmula:', e);
      return null;
    }
  }

  // Convierte la letra de columna (A, B, C) a un índice base 0 (0, 1, 2)
  private colLetterToZeroBasedIndex(colLetter: string): number {
    return colLetter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  }

  // Convierte un índice base 0 (0, 1, 2) a una letra de columna (A, B, C)
  private zeroBasedIndexToColLetter(index: number): string {
    return String.fromCharCode('A'.charCodeAt(0) + index);
  }
}