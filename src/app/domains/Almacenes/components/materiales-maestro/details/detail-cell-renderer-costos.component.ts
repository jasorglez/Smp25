import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { CellFocusedEvent, ColDef, GridApi, GridReadyEvent, ValueGetterParams, ValueSetterParams, CellKeyDownEvent, Column, IRowNode, ValueFormatterParams } from 'ag-grid-community';
import { ICellRendererParams } from 'ag-grid-community';
import { FormulaEditorComponent } from '../formula-editor.component';
import { Parser } from 'expr-eval';

@Component({
  selector: 'app-detail-cell-renderer-costos',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [CommonModule, AgGridModule, FormulaEditorComponent, CurrencyPipe],
  template: `
    <!-- El template permanece igual -->
    <div style="padding: 10px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
       <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Desglose de Costos para: {{ materialName }}</strong>
          <button class="btn btn-sm btn-outline-success" (click)="exportToCsv()">
            <i class="bi bi-file-earmark-excel"></i> Exportar a CSV
          </button>
        </div>
      <!-- Barra de Fórmulas -->
      <div style="display: flex; align-items: center; margin-bottom: 8px; font-family: monospace;">
        <div style="padding: 5px; background-color: #f0f0f0; border: 1px solid #ccc; border-right: none;">fx</div>
        <input #formulaBar type="text" style="flex-grow: 1; padding: 5px; border: 1px solid #ccc;"
               [value]="formulaBarValue"
               (input)="onFormulaBarChange($event)"
               (keydown.enter)="applyFormulaFromBar()"
               [class.is-invalid]="!isFormulaValid" />
      </div>
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="costosColumnDefs"
          [rowData]="costosRowData"
          [gridOptions]="gridOptions"
          (cellValueChanged)="onCellValueChanged($event)"
          (gridReady)="onGridReady($event)"
          (cellFocused)="onCellFocused($event)"
          (cellKeyDown)="onCellKeyDown($event)">
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
  @ViewChild('formulaBar') formulaBar!: ElementRef<HTMLInputElement>;

  public params!: ICellRendererParams;
  public materialName: string = '';
  private gridApi!: GridApi;

  // --- Propiedades para la barra de fórmulas ---
  public formulaBarValue: string = '';
  public isFormulaValid: boolean = true;
  private focusedCell: { rowIndex: number, colId: string } | null = null;
  private highlightedCols: string[] = [];
  // -------------------------------------------
  public pinnedBottomRowData: any[] = [];

  public costosRowData: any[] = [];
  public gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    suppressClickEdit: false,
    singleClickEdit: true,
    enableRangeSelection: true, // Habilita la selección de rangos (como en Excel)
    enableFillHandle: true,     // Habilita el cuadro de arrastre para copiar/rellenar
    // Estilo para la fila de totales
    getRowStyle: (params) => (params.node.rowPinned ? { fontWeight: 'bold', background: '#ddd' } : {}),
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single' as const,
    suppressKeyboardEvent: (params: any) => params.event.key === 'F2', // Prevenir el editor por defecto de AgGrid con F2
    processCellForClipboard: (params: any) => {
      // Asegurarse de que params.column no sea null/undefined antes de llamar a getColId()
      const field = params.column?.getColId();
      const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`;
      return params.node.data[formulaField] || params.value;
    },
    fillOperation: (params: any) => {
      const { event, values, initialValues, sourceRowNode, startRow, endRow, column } = params;
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

      // Si no es una fórmula, devuelve el valor de la celda de origen para que se copie.
      // initialValues[0] contiene el valor de la celda desde la que se inició el arrastre.
      return initialValues[0];
    },
    context: {} // Declarar explícitamente la propiedad context
  };
  public costosColumnDefs: ColDef[] = [];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialName = params.data.articulo || 'N/A';

    // Definir columnas con soporte para fórmulas en todas
    this.costosColumnDefs = [
      { headerName: 'Col 1', field: 'col1', editable: true, cellStyle: { textAlign: 'center' } },
      { headerName: 'Col 2', field: 'col2', editable: true, cellStyle: { textAlign: 'center' } },
      { headerName: 'Col 3', field: 'col3', editable: true, type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      { headerName: 'Col 4', field: 'col4', editable: true, type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      { headerName: 'Col 5', field: 'col5', editable: true, type: 'numericColumn', valueParser: params => Number(params.newValue), cellStyle: { textAlign: 'center' } },
      {
        headerName: 'Cantidad',
        field: 'col6',
        width: 120,
        editable: true,
        type: 'numericColumn',
        valueParser: params => Number(params.newValue),
        cellStyle: { textAlign: 'center' }
      },      
      {
        headerName: 'Precio Unitario',
        field: 'col7',
        width: 150,
        editable: true,
        type: 'numericColumn',
        valueParser: params => Number(params.newValue),
        valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2') || '$0.00',
        cellStyle: { textAlign: 'center' }
      },
      {
        headerName: 'Col 8',
        field: 'col8',
        editable: true,
        type: 'numericColumn',
        valueParser: params => Number(params.newValue),
        cellStyle: { textAlign: 'center' }
      },
      {
        headerName: 'Total (Fórmula)',
        field: 'col9',
        width: 200,
        editable: true,
        cellEditor: FormulaEditorComponent,
        cellEditorPopup: true,
        valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2') || '$0.00',
        cellStyle: { textAlign: 'center' }
      },
      { headerName: 'Col 10', field: 'col10', editable: true, cellStyle: { textAlign: 'center' } },
      { headerName: 'Col 11', field: 'col11', editable: true, cellStyle: { textAlign: 'center' } },
    ].map(col => this.addFormulaSupport(col)).map(col => ({ ...col, flex: 1, minWidth: 100 })); // Aplicar flex y minWidth a todas
    
    // Añadir dinámicamente la lógica de cellClass para el resaltado
    this.costosColumnDefs.forEach(colDef => {
      colDef.cellClass = params => {
        if (!params.data.highlightedColumns) return null;
        const colIndex = parseInt(params.colDef.field!.replace('col', ''));
        const colLetter = String.fromCharCode(65 + colIndex - 1);
        const rowNum = params.node.rowIndex + 1;
        const cellRef = colLetter + rowNum;
        return params.data.highlightedColumns.includes(cellRef) ? 'cell-highlight' : null;
      };
    });
    
    // Generar datos falsos para el grid de costos
    this.costosRowData = this.generateFakeCostData(5); // Generar 5 filas de ejemplo    
    this.gridOptions.context = this.params.context; // Inicializar el contexto del grid
  }

  private addFormulaSupport(col: ColDef): ColDef {
    const field = col.field!;
    const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`; // e.g., formulaCol1
    return {
      ...col,
      cellEditor: FormulaEditorComponent,
      cellEditorPopup: true,
      cellEditorParams: { formulaField },
      valueGetter: (params: ValueGetterParams) => {
        // console.log(`valueGetter for ${field} (row ${params.node.rowIndex}) called. Formula: ${params.data[formulaField]}, Direct: ${params.data[field]}`);
        if (params.data[formulaField]) {
          const result = this.evaluateFormula(params.data[formulaField], params.data, params.node.rowIndex);
          // console.log(`  -> Evaluated result: ${result}`);
          return result;
        }
        return params.data[field];
      },
      valueSetter: (params: ValueSetterParams) => {
        // console.log(`valueSetter for ${field} (row ${params.node.rowIndex}) called. NewValue: ${params.newValue}`);
        const value = params.newValue;
        if (typeof value === 'string' && value.startsWith('=')) {
          params.data[formulaField] = value;
          params.data[field] = this.evaluateFormula(value, params.data, params.node.rowIndex); // Store evaluated result
        } else {
          params.data[formulaField] = undefined;
          params.data[field] = value;
        }
        return true;
      }
    };
  }

  onCellValueChanged(params: any) {
    // Refrescamos todas las celdas para recalcular fórmulas que dependan de esta celda.
    this.calculateTotals(); // Recalcular totales después de cualquier cambio de celda
    setTimeout(() => {
      this.gridApi.refreshCells({ force: true });
    }, 0);
  }

  // --- Lógica para la Barra de Fórmulas ---

  onCellFocused(event: CellFocusedEvent) {
    this.clearCellHighlights(); // Limpiar resaltados anteriores

    if (!event.rowIndex || !event.column) {
      this.focusedCell = null;
      this.formulaBarValue = '';
      return;
    }


    const colId = typeof event.column === 'string' ? event.column : (event.column as Column).getColId();
    if (!colId) {
      return;
    }

    this.focusedCell = { rowIndex: event.rowIndex, colId: colId };
    const rowNode = this.gridApi.getRowNode(event.rowIndex.toString());
    if (!rowNode || !rowNode.data) return;

    const formulaField = `formula${colId.charAt(0).toUpperCase() + colId.slice(1)}`;
    if (rowNode.data[formulaField]) {
        this.formulaBarValue = rowNode.data[formulaField];
        this.updateCellHighlights(this.formulaBarValue, rowNode);
    } else {
        this.formulaBarValue = this.gridApi.getValue(colId, rowNode) ?? '';
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
    const rowNode = this.gridApi.getRowNode(String(this.focusedCell.rowIndex));
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
    this.gridApi.refreshCells({
      rowNodes: [rowNode],
      force: true
    });
  }

  private clearCellHighlights() {
    if (this.highlightedCols.length > 0 && this.focusedCell) {
      // Asegurarse de que la API del grid esté lista
      if (!this.gridApi) return;
      const rowNode = this.gridApi.getRowNode(String(this.focusedCell.rowIndex));
      if (rowNode) {
        delete rowNode.data.highlightedColumns;
        this.gridApi.refreshCells({ rowNodes: [rowNode], force: true });
      }
    }
    this.highlightedCols = [];
  }

  exportToCsv() {
    this.gridApi.exportDataAsCsv({ fileName: `costos-${this.materialName}.csv` });
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
    this.calculateTotals(); // Calcular totales iniciales aquí, cuando gridApi está disponible
  }

  private calculateTotals(): void {
    if (!this.gridApi || !this.costosRowData || this.costosRowData.length === 0) {
      this.pinnedBottomRowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('pinnedBottomRowData', this.pinnedBottomRowData);
      }
      return;
    }

    const totalRow: any = {
      col1: 'TOTAL', // Label for the total row
    };

    // Initialize sums for numeric/formula columns and empty strings for others
    this.costosColumnDefs.forEach(colDef => {
      const field = colDef.field;
      if (!field) return;

      if (colDef.type === 'numericColumn' || field === 'col9') { // Include col9 in sum
        totalRow[field] = 0;
      } else if (field !== 'col1') { // For other non-numeric columns, set to empty string
        totalRow[field] = '';
      }
    });

    // Sum values for each relevant column
    this.costosRowData.forEach((row, rowIndex) => {
      this.costosColumnDefs.forEach(colDef => {
        const field = colDef.field;
        if (!field) return;

        if (colDef.type === 'numericColumn' || field === 'col9') {
          let value;
          const formulaField = `formula${field.charAt(0).toUpperCase() + field.slice(1)}`;

          if (field === 'col9' && row[formulaField]) {
            // For the formula column, evaluate the formula
            value = this.evaluateFormula(row[formulaField], row, rowIndex);
          } else if (colDef.type === 'numericColumn') {
            // For other numeric columns, use the direct value
            value = row[field];
          } else {
            value = 0; // Should not happen for these types, but as a fallback
          }

          value = Number(value);
          if (!isNaN(value) && value !== null) {
            totalRow[field] += value;
          }
        }
      });
    });

    // Apply value formatters to total row if needed (e.g., currency)
    this.costosColumnDefs.forEach(colDef => {
      const field = colDef.field!; // Aseguramos que field no es undefined
      if (field && colDef.valueFormatter && (colDef.type === 'numericColumn' || field === 'col9')) {        
        // Solo aplicar si valueFormatter es una función
        if (typeof colDef.valueFormatter === 'function') {
          const formatterParams: ValueFormatterParams = {
            value: totalRow[field],
            data: totalRow,
            node: { rowPinned: 'bottom' } as IRowNode, // Cast a IRowNode
            colDef: colDef,
            column: this.gridApi.getColumn(field)!, // Obtener el objeto Column
            api: this.gridApi,
            context: this.gridOptions.context // El contexto es requerido por ValueFormatterParams
          };
          totalRow[field] = colDef.valueFormatter(formatterParams);
        }
      }
    });

    this.gridApi.setGridOption('pinnedBottomRowData', [totalRow]); // Usar setGridOption
  }

  private generateFakeCostData(rowCount: number): any[] {
    const data = [];
    for (let i = 0; i < rowCount; i++) {
      const cantidad = Math.floor(Math.random() * 10) + 1;
      const precio = Math.random() * 100 + 20;
      const row: any = {
        col1: `Dato ${i + 1}-1`,
        col2: `Dato ${i + 1}-2`,
        col3: Math.floor(Math.random() * 100) + 1, // Datos numéricos aleatorios
        col4: Math.floor(Math.random() * 100) + 1, // Datos numéricos aleatorios
        col5: Math.floor(Math.random() * 100) + 1, // Datos numéricos aleatorios para col5
        col6: cantidad,
        col7: precio,
        col8: Math.floor(Math.random() * 50) + 1,
        // col9 se calculará con el valueGetter
        col10: `Dato ${i + 1}-10`,
        col11: `Dato ${i + 1}-11`,
        formulaCol1: undefined,
        formulaCol2: undefined,
        formulaCol3: undefined,
        formulaCol4: undefined,
        formulaCol5: undefined,
        formulaCol6: undefined,
        formulaCol7: undefined,
        formulaCol8: undefined,
        formulaCol9: '=col6*col7',
        formulaCol10: undefined,
        formulaCol11: undefined,
        highlightedColumns: [] // Campo para el resaltado de celdas
      };
      data.push(row);
    }
    return data;
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