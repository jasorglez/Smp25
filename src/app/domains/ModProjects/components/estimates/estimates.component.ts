import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstimatesService } from 'app/services/estimates.service';
import { SignalsService } from 'app/services/signals.service';
import { PdfEstimatesService } from 'app/services/pdf-estimates.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { EstimateDetailRendererComponent } from './estimate-detail-renderer.component';

@Component({
  selector: 'app-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, EstimateDetailRendererComponent],
  templateUrl: './estimates.component.html',
})
export class EstimatesComponent {

  private estimatesService     = inject(EstimatesService);
  private signalsService       = inject(SignalsService);
  private pdfEstimatesService  = inject(PdfEstimatesService);
  private trackingService      = inject(TrackingService);
  private workprogramsService  = inject(WorkprogramsService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges = false;
  rowData: any[] = [];
  selectedEstimate: any = null;
  private gridApi!: GridApi;
  private tempIdCounter = 0;
  private contract = this.signalsService.getContractSelectedBySidebar()();
  private hasShownContractWarning = false;

  // ── Enter-key navigation ──────────────────────────────────────────────────
  private editableColumnOrder = ['number', 'typeMoney', 'dateStart', 'dateEnd', 'amountMX', 'amountDLL', 'type', 'comment'];
  private enterPressed = false;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  onCellEditingStopped(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  // ── Grid Options ──────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 660,
    isRowMaster: () => true,
    detailCellRenderer: EstimateDetailRendererComponent,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) this.selectedEstimate = event.data;
    },
    onRowDoubleClicked: (event: any) => {
      const node = event.node;
      // Cierra otros expandidos
      this.gridApi?.forEachNode((n: any) => {
        if (n.id !== node.id && n.expanded) n.setExpanded(false);
      });
      // Toggle propio
      node.setExpanded(!node.expanded);
    },
  };

  // ── Column Defs ───────────────────────────────────────────────────────────

  get columnDefs(): ColDef[] {
    return [
      { field: 'number',      headerName: 'Estimación',     editable: true,  flex: 1.2 },
      {
        field: 'typeMoney',   headerName: 'Moneda',          editable: true,  width: 100,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['MX', 'USD'] },
        cellRenderer: (p: any) => p.value === 'USD'
          ? `<span class="badge bg-success">${p.value}</span>`
          : `<span class="badge bg-primary">${p.value ?? ''}</span>`,
      },
      {
        field: 'dateStart', headerName: 'Fecha inicio', editable: true, flex: 1.2,
        cellEditor: 'agDateCellEditor',
        valueGetter:    (p) => p.data?.dateStart ? String(p.data.dateStart).substring(0, 10) : '',
        valueSetter:    (p) => { p.data.dateStart = p.newValue; return true; },
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d ? `${d}/${m}/${y}` : p.value;
        },
      },
      {
        field: 'dateEnd', headerName: 'Fecha final', editable: true, flex: 1.2,
        cellEditor: 'agDateCellEditor',
        valueGetter:    (p) => p.data?.dateEnd ? String(p.data.dateEnd).substring(0, 10) : '',
        valueSetter:    (p) => { p.data.dateEnd = p.newValue; return true; },
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d ? `${d}/${m}/${y}` : p.value;
        },
      },
      { field: 'dias', headerName: 'Días', editable: false, width: 70, type: 'numericColumn' },
      {
        field: 'amountMX', headerName: 'MXN', editable: true, flex: 1.2, type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '',
      },
      {
        field: 'amountDLL', headerName: 'DLL', editable: true, flex: 1.1, type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.value)
          : '',
      },
      {
        field: 'acumulateMX', headerName: 'Acum. MXN', editable: false, flex: 1.4, type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '',
        cellStyle: { color: '#555', backgroundColor: '#f5f5f5' },
      },
      {
        field: 'acumulateDLL', headerName: 'Acum. DLL', editable: false, flex: 1.3, type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.value)
          : '',
        cellStyle: { color: '#555', backgroundColor: '#f5f5f5' },
      },
      {
        field: 'type', headerName: 'Tipo', editable: true, width: 110,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['NORMAL', 'ADICIONAL', 'EXTRAORDIN'] },
      },
      { field: 'authorizeUser', headerName: 'Autoriza',     editable: false, flex: 1.2 },
      { field: 'comment',       headerName: 'Comentarios',  editable: true,  flex: 1.5 },
    ];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      this.contract = this.signalsService.getContractSelectedBySidebar()();
      if (this.validateContractSelected()) {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    if (!this.validateContractSelected()) return;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Estimaciones',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
    this.obtenerDatos();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  obtenerDatos() {
    if (!this.validateContractSelected()) { this.rowData = []; return; }
    this.estimatesService.getEstimates(this.contract).subscribe(
      (data: any[]) => { this.rowData = data ?? []; },
      (error) => { console.error(error); this.rowData = []; }
    );
  }

  private validateContractSelected(): boolean {
    const c = this.signalsService.getContractSelectedBySidebar()();
    if (c && Number(c) > 0) {
      this.contract = c;
      this.hasShownContractWarning = false;
      return true;
    }
    if (!this.hasShownContractWarning) {
      alerts.basicAlert('Contrato requerido', 'Hey debes de tener siempre un Contrato para una estimacion', 'warning');
      this.hasShownContractWarning = true;
    }
    return false;
  }

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // ── CRUD maestro ──────────────────────────────────────────────────────────

  addRow() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(), 'Agregar Estimación',
      'Modulo Proyectos - Estimaciones', this.trackingService.getEmail()
    );

    const tempId  = `temp_${this.tempIdCounter++}`;
    const nums    = (this.rowData || []).map((r: any) => parseInt(r.number, 10)).filter(n => !isNaN(n));
    const next    = nums.length ? Math.max(...nums) + 1 : 1;
    const now     = new Date();
    const first   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    const last    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);

    const newItem = {
      id: tempId, number: String(next).padStart(3, '0'),
      idRoot: this.signalsService.getRootSelectedBySidebar()(),
      idContract: this.contract,
      typeMoney: 'MX', dateStart: first, dateEnd: last,
      amountMX: 0, amountDLL: 0, acumulateMX: 0, acumulateDLL: 0,
      type: 'NORMAL', authorizeUser: localStorage.getItem('mail'),
      comment: '', active: true, __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    setTimeout(() => {
      if (this.gridApi) this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'number' });
    }, 50);
  }

  async saveChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(), 'Guardar Cambios Estimaciones',
      'Modulo Proyectos - Estimaciones', this.trackingService.getEmail()
    );

    if (!this.rowData.every(r => r.number)) {
      alerts.basicAlert('Guardar', 'Debe llenar todos los campos antes de guardar.', 'error');
      return;
    }

    const newRows  = this.rowData.filter(r => r.__isNew);
    const modRows  = this.rowData.filter(r => r.__modified && !r.__isNew);
    const addObs   = newRows.map(r => this.estimatesService.addEstimate(this.cleanData(r)));
    const updObs   = modRows.map(r => this.estimatesService.updateEstimate(r.id, this.cleanData(r)));

    try {
      await lastValueFrom(concat(...addObs, ...updObs).pipe(toArray()));
      alerts.basicAlert('Guardado', 'Se han guardado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  }

  async deleteEntry() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(), 'Eliminar Estimación',
      'Modulo Proyectos - Estimaciones', this.trackingService.getEmail()
    );

    const nodes = this.gridApi?.getSelectedNodes() ?? [];
    if (!nodes.length) {
      alerts.basicAlert('Eliminar', 'Por favor, seleccione una estimación para eliminar.', 'error');
      return;
    }

    const data   = nodes[0].data;
    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar la estimación "${data.number}"? Esta acción no se puede deshacer.`,
      'warning', 'Sí, eliminar'
    );
    if (!result.isConfirmed) return;

    this.estimatesService.deleteEstimate(data.id).pipe(
      catchError((err) => {
        alerts.basicAlert('Error', 'Error al eliminar la estimación.', 'error');
        console.error(err);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert('Eliminado', 'Estimación eliminada satisfactoriamente.', 'success');
      this.obtenerDatos();
      this.notSavedChanges = false;
      this.selectedEstimate = null;
    });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  generateSamplePdf() {
    if (!this.selectedEstimate) {
      alerts.basicAlert('Generar PDF', 'Por favor, seleccione una estimación.', 'warning');
      return;
    }
    this.generatePdfWithRealData(this.selectedEstimate.id, false);
  }

  private async generatePdfWithRealData(estimateId: number, download: boolean) {
    try {
      const estimateData  = await lastValueFrom(this.estimatesService.getEstimateById(estimateId));
      const estimateItems = await lastValueFrom(this.estimatesService.getItemsFromEstimate(estimateId));
      const conceptsRes   = await Promise.all(
        estimateItems.map(item => lastValueFrom(this.workprogramsService.getWorkProgramsWithoutType(item.idResource)))
      );
      const pdfData = await this.createEstimateDataFromServices(estimateData, estimateItems, conceptsRes);
      if (download) {
        this.pdfEstimatesService.downloadEstimatePdf(pdfData, `Estimacion_${estimateData.number}.pdf`);
      } else {
        this.pdfEstimatesService.generateEstimatePdf(pdfData);
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      alerts.basicAlert('Error', 'Error al generar el PDF.', 'error');
    }
  }

  private async createEstimateDataFromServices(estimateData: any, estimateItems: any[], conceptsResults: any[][]) {
    const items = estimateItems.map((item, i) => {
      const concept = conceptsResults[i]?.[0] ?? null;
      return {
        clave:             concept?.id       || item.idResource,
        concepto:          concept?.text     || `Concepto ${item.idResource}`,
        unidad:            concept?.measure  || 'PZA',
        cantidad:          concept?.quantity || item.quantity || 0,
        precioUnitario:    concept?.costMX   || 0,
        importe:           (concept?.quantity || item.quantity || 0) * (concept?.costMX || 0),
        cantidadEjecutada: item.accumulate   || 0,
        importeEjecutado:  (item.accumulate  || 0) * (concept?.costMX || 0),
        comment:           item.comment,
      };
    });
    const categorias    = this.groupItemsByCategory(items, conceptsResults);
    const totalGeneral  = categorias.reduce((s, c) => s + c.total, 0);
    const totalEjecutado = categorias.reduce((s, c) =>
      s + c.items.reduce((cs: number, it: any) => cs + (it.importeEjecutado || 0), 0), 0);

    return {
      proyecto:      conceptsResults[0]?.[0]?.text || 'PROYECTO',
      estimacion:    estimateData.number,
      fechaInicio:   this.formatDateForPdf(estimateData.dateStart),
      fechaFin:      this.formatDateForPdf(estimateData.dateEnd),
      totalGeneral, totalEjecutado, pagina: 1, totalPaginas: 1, categorias,
    };
  }

  private groupItemsByCategory(items: any[], conceptsResults: any[][]) {
    const map = new Map<string, any>();
    items.forEach((item, i) => {
      const concept = conceptsResults[i]?.[0] ?? null;
      if (concept?.typeActivity === 'Parent') {
        const name = concept.text || item.concepto;
        if (!map.has(name)) map.set(name, { nombre: name, total: item.importe || 0, items: [] });
      }
    });
    items.forEach((item, i) => {
      const concept = conceptsResults[i]?.[0] ?? null;
      if (concept?.typeActivity === 'Parent') return;
      const name = concept?.phase;
      if (name) {
        if (!map.has(name)) map.set(name, { nombre: name, total: 0, items: [] });
        const cat = map.get(name);
        cat.items.push(item);
        cat.total += item.importe;
      }
    });
    return Array.from(map.values());
  }

  private formatDateForPdf(dateString: string): string {
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d = new Date(dateString);
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  }

  private cleanData(data: any): any {
    const c = { ...data };
    delete c.__isNew; delete c.__modified;
    if (c.id && String(c.id).startsWith('temp_')) delete c.id;
    return c;
  }
}
