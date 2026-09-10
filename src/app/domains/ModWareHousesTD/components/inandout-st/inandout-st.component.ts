import { Component, OnInit, inject, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { InandoutService } from 'app/services/inandout.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { OtService } from 'app/services/ot.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProjectsService } from 'app/services/projects.service';
import { DetailCellRendererEntryItemsComponent } from './detail-cell-renderer-entry-items.component';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererComponent } from '../../../ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';
import { catchError, forkJoin, lastValueFrom, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from 'app/services/users.service';

@Component({
  selector: 'app-inandout-st',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetailCellRendererEntryItemsComponent, PdfButtonCellRendererComponent],
  templateUrl: './inandout-st.component.html',
})
export class InandoutStComponent implements OnInit {

  private gridApi!: GridApi;
  private signalsService = inject(SignalsService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);
  private inandoutService = inject(InandoutService);
  private catalogsService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);
  private otService = inject(OtService);
  private ocService = inject(OcAndReqsService);
  private projectsService = inject(ProjectsService);
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);

  private isGeneratingReport: boolean = false;
  rowData: any[] = [];
  selectedWarehouse: any = null;
  warehouses: any[] = [];
  gridHeight: string = '85vh';
  selectedEntry: any = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  idBranch: number | null = null;
  projectId: number | null = null;
  movementType: 'IN' | 'OUT' = 'IN';
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;

  catalogs: any[] = [];
  selectedCatalog: any = null;
  otList: any[] = [];
  selectedOt: any = null;
  ocList: any[] = [];
  projectList: any[] = [];
  users: any[] = [];

  readonly addNewSentinel = '__ADD_NEW__';
  private previousCatalog: any = null;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      const email = this.trackingService.getEmail();
      if (this.idRoot && email) {
        this.loadCatalogs();
        this.loadUsers();
        this.loadProjectList();
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (this.idBranch) {
        this.loadOcList();
      }
    });

    effect(() => {
      this.projectId = this.signalsService.getProjectSelectedBySidebar()();
      const email = this.trackingService.getEmail();
      if (this.projectId && email) {
        this.loadWarehouses(email);
        this.loadOts();
        this.loadOcList();
      }
    });
  }

  ngOnInit() {
    this.movementType = this.route.snapshot.data['movementType'] || 'IN';
    this.loadUsers();
    const email = this.trackingService.getEmail();
    if (this.idRoot && email) {
      this.loadCatalogs();
      this.loadProjectList();
    }
    if (this.projectId && email) {
      this.loadWarehouses(email);
      this.loadOts();
      this.loadOcList();
    }
  }

  loadWarehouses(email: string) {
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data) => {
        this.warehouses = data;
        if (this.warehouses.length > 0) {
          this.selectedWarehouse = null;
          this.rowData = [];
        }
        this.refreshColumns();
      },
      error: (error) => {
        console.error('Error loading warehouses:', error);
        alerts.basicAlert('Error', 'Error al cargar almacenes', 'error');
      }
    });
  }

  loadCatalogs() {
    if (!this.idRoot) return;
    this.catalogsService.getCatalogs(this.idRoot, this.movementType).subscribe({
      next: (data) => {
        this.catalogs = data;
        if (this.catalogs.length > 0) {
          this.selectedCatalog = this.catalogs[0];
          this.previousCatalog = this.catalogs[0];
        }
        this.refreshColumns();
      },
      error: (error) => {
        if (error?.status !== 404) console.error('Error loading catalogs:', error);
        this.catalogs = [];
      }
    });
  }

  loadOts() {
    if (!this.projectId) return;
    this.otService.get2fieldsByPect(this.projectId).subscribe({
      next: (data) => {
        this.otList = data;
        if (this.otList.length > 0) this.selectedOt = this.otList[0];
        this.refreshColumns();
      },
      error: (error) => {
        if (error?.status !== 404) console.error('Error loading OTs:', error);
        this.otList = [];
      }
    });
  }

  loadOcList() {
    const calls: any[] = [];
    if (this.idBranch) {
      calls.push(this.ocService.getOcAndReqs('branch', this.idBranch, 'OC').pipe(catchError(() => of([]))));
    }
    if (this.projectId) {
      calls.push(this.ocService.getOcAndReqs('project', this.projectId, 'OC').pipe(catchError(() => of([]))));
    }
    if (calls.length === 0) return;

    forkJoin(calls).subscribe({
      next: (results: any[]) => {
        const combined: any[] = (results as any[][]).flat();
        const seen = new Set<number>();
        this.ocList = combined.filter((oc: any) => {
          if (!oc?.id || seen.has(oc.id)) return false;
          seen.add(oc.id);
          return true;
        });
        this.refreshColumns();
      },
      error: () => { this.ocList = []; }
    });
  }

  loadProjectList() {
    if (!this.idRoot) return;
    this.projectsService.getProjectListByCompany(this.idRoot).subscribe({
      next: (data: any) => {
        this.projectList = Array.isArray(data) ? data : (data?.data ?? []);
        this.refreshColumns();
      },
      error: (error) => {
        if (error?.status !== 404) console.error('Error loading projects:', error);
        this.projectList = [];
      }
    });
  }

  loadUsers() {
    if (!this.idRoot) return;
    this.usersService.get2fieldsUsers(this.idRoot).subscribe({
      next: (data) => {
        this.users = data.data || data;
        this.refreshColumns();
      },
      error: (error) => console.error('Error loading users:', error)
    });
  }

  private refreshColumns() {
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colMaster);
    }
  }

  onWarehouseChange(id?: number | string) {
    if (id !== undefined) {
      this.selectedWarehouse = this.warehouses.find(w => String(w.idAlmacen) === String(id)) || null;
      this.rowData = [];
    }
    if (this.selectedWarehouse) this.loadEntries();
  }

  async onCatalogChange(): Promise<void> {
    if (this.selectedCatalog?.id === '__ADD_NEW__') {
      this.selectedCatalog = this.previousCatalog;
      const result = await alerts.inputAlert(
        'Nuevo Tipo de Movimiento',
        `Tipo: ${this.movementType === 'IN' ? 'Entrada' : 'Salida'}`,
        'text', '',
        {
          inputAttributes: { placeholder: 'Descripción del tipo de movimiento...' },
          confirmButtonText: 'Guardar',
          confirmButtonColor: '#28a745'
        }
      );
      if (result.isConfirmed && result.value) {
        await this.saveNewCatalog(result.value);
      }
      return;
    }
    this.previousCatalog = this.selectedCatalog;
    this.loadEntries();
  }

  async saveNewCatalog(description: string): Promise<number | null> {
    if (!this.idRoot) return null;
    try {
      const payload = {
        description: description.trim().toUpperCase(),
        type: this.movementType,
        idCompany: this.idRoot,
        active: 1,
        vigente: true
      };
      const created = await lastValueFrom(this.catalogsService.addCatalog(payload));
      await new Promise<void>(resolve => {
        this.catalogsService.getCatalogs(this.idRoot!, this.movementType).subscribe({
          next: (data) => { this.catalogs = data; this.refreshColumns(); resolve(); },
          error: () => resolve()
        });
      });
      alerts.toastAlert('Tipo de movimiento creado', 'success');
      return created?.id ?? null;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudo crear: ${msg}`, 'error');
      return null;
    }
  }

  onOtChange() {
    this.loadEntries();
  }

  loadEntries() {
    if (!this.selectedWarehouse || !this.projectId) return;
    this.inandoutService.getInAndOuts(this.projectId, this.selectedWarehouse.idAlmacen, this.movementType).subscribe({
      next: (data: any[]) => {
        this.rowData = data.map(entry => ({
          ...entry,
          countrow: entry.countRow || 0,
          detailType: null,
          detailData: []
        }));
      },
      error: (error) => {
        console.error(`Error loading entries:`, error);
        alerts.basicAlert('Error', `Error al cargar ${this.movementType === 'IN' ? 'entradas' : 'salidas'}`, 'error');
      }
    });
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererEntryItemsComponent,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) return 'selected-row';
      if (params.data.__isNew) return 'new-row-highlight';
      if (params.data.__modified) return 'modified-row';
      return '';
    },
    onRowClicked: (event: any) => {
      if (event.column && event.column.getColId() !== 'pdfReport') {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) node.setSelected(false);
        });
      }
    },
    onCellValueChanged: (event: any) => {
      if (event.colDef.field === 'directEntry') {
        event.data.directEntry = event.newValue === true || event.newValue === 1;
      }
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'countrow',
        headerName: 'Items',
        width: 80,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdfReport',
        headerName: 'PDF',
        width: 70,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportDetail(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'idProject',
        headerName: 'Proyecto',
        width: 160,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.projectList.map(p => p.id),
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
            const p = this.projectList.find(x => x.id === value);
            return p ? (p.description || p.name || `#${value}`) : `#${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          const p = this.projectList.find(x => x.id === params.value);
          return p ? (p.description || p.name || `#${params.value}`) : (params.value || '');
        }
      },
      {
        field: 'idWarehouse',
        headerName: 'Almacén',
        width: 140,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.warehouses.map(wh => wh.idAlmacen),
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
            const wh = this.warehouses.find(w => w.idAlmacen === value);
            return wh ? wh.name : value;
          }
        }),
        valueFormatter: (params: any) => {
          const wh = this.warehouses.find(w => w.idAlmacen === params.value);
          return wh ? wh.name : (params.value || '');
        }
      },
      {
        field: 'idType',
        headerName: 'Tipo de Movimiento',
        width: 170,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [...this.catalogs.map(c => c.id), '__ADD_NEW__'],
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
            if (value === '__ADD_NEW__') return '+ Agregar Registro';
            const cat = this.catalogs.find(c => c.id === value);
            return cat ? cat.description : value;
          }
        }),
        valueFormatter: (params: any) => {
          const cat = this.catalogs.find(c => c.id === params.value);
          return cat ? cat.description : (params.value || '');
        }
      },
      {
        field: 'idOt',
        headerName: 'OT',
        width: 160,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [0, ...this.otList.map(ot => ot.id)],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            if (!value) return '(Sin OT)';
            const ot = this.otList.find(o => o.id === value);
            return ot ? (ot.description || ot.folio || ot.num || `OT #${ot.id}`) : `OT #${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          if (!params.value) return '(Sin OT)';
          const ot = this.otList.find(o => o.id === params.value);
          return ot ? (ot.description || ot.folio || ot.num || `OT #${ot.id}`) : `OT #${params.value}`;
        }
      },
      {
        field: 'idOc',
        headerName: 'Orden de Compra',
        width: 160,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [0, ...this.ocList.map(oc => oc.id)],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            if (!value) return '(Sin OC)';
            const oc = this.ocList.find(o => o.id === value);
            return oc ? (oc.folio || `OC #${oc.id}`) : `OC #${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          if (!params.value || params.value === 0) return '(Sin OC)';
          const oc = this.ocList.find(o => o.id === params.value);
          return oc ? (oc.folio || `OC #${oc.id}`) : `OC #${params.value}`;
        }
      },
      {
        field: 'folio',
        headerName: 'Folio',
        width: 110,
        filter: true,
        editable: true,
        valueSetter: (params: any) => {
          params.data.folio = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'date',
        headerName: 'Fecha',
        width: 110,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.date = params.newValue;
          return true;
        }
      },
      {
        field: 'numBill',
        headerName: 'Factura',
        width: 120,
        editable: true,
        valueSetter: (params: any) => {
          params.data.numBill = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'deliverName',
        headerName: 'Entregado Por',
        width: 180,
        editable: true,
        valueSetter: (params: any) => {
          params.data.deliverName = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'idAutoriza',
        headerName: 'Autorizado Por',
        width: 180,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.users.map(u => u.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const user = this.users.find(u => u.id === value);
            return user ? user.displayName : value;
          }
        }),
        valueFormatter: (params: any) => {
          const user = this.users.find(u => u.id === params.value);
          return user ? user.displayName : (params.value || '');
        }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        width: 300,
        editable: true,
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      }
    ];
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    if (colId === 'countrow') {
      const node = event.node;
      const api = event.api;
      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'items';

      if (isCurrentlyExpanded) {
        node.setExpanded(false);
        api.forEachNode((otherNode: any) => otherNode.setRowHeight(undefined));
        api.onRowHeightChanged();
      } else {
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) otherNode.setExpanded(false);
        });
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) otherNode.setRowHeight(0);
        });
        if (node.expanded && event.data.detailType !== 'items') node.setExpanded(false);
        event.data.detailType = 'items';
        api.onRowHeightChanged();
        setTimeout(() => node.setExpanded(true), 0);
      }
    }
  }

  toggleCascade(node: any) {
    const event = {
      node: node,
      api: this.gridApi,
      data: node.data,
      column: { getColId: () => 'countrow' }
    };
    this.onCellClicked(event);
  }

  async toggleReportDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      api.forEachNode((otherNode: any) => otherNode.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    if (this.isGeneratingReport) {
      alerts.basicAlert('Procesando', 'Ya se está generando un reporte. Por favor espere.', 'warning');
      return;
    }

    this.isGeneratingReport = true;
    let progress = 0;
    alerts.showLoadingWithProgress('Generando reporte...', 'Por favor espere mientras se procesa el documento', progress);
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) alerts.updateLoadingProgress('Generando reporte...', 'Por favor espere mientras se procesa el documento', progress);
    }, 100);

    try {
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) otherNode.setExpanded(false);
      });
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) otherNode.setRowHeight(0);
      });
      if (node.expanded && node.data.detailType !== 'report') node.setExpanded(false);
      node.data.detailType = 'report';
      api.onRowHeightChanged();
      await new Promise(resolve => setTimeout(resolve, 1000));
      node.setExpanded(true);
      clearInterval(progressInterval);
      alerts.updateLoadingProgress('Reporte generado', 'El documento se ha procesado correctamente', 100);
      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingReport = false;
      }, 800);
    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingReport = false;
      alerts.basicAlert('Error', 'Ocurrió un error al generar el reporte. Por favor, intente nuevamente.', 'error');
      console.error('Error generando reporte:', error);
    }
  }

  collapseReportDetail(entryId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      this.gridApi.forEachNode((node) => node.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colMaster);
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        movementType: this.movementType,
        idRoot: this.idRoot,
        projectId: this.projectId,
        idWarehouse: this.selectedWarehouse?.idAlmacen,
        inandoutService: this.inandoutService,
        componentParent: this,
        gridApi: this.gridApi,
        ITEMS: {
          load: (entryId: number, callback: (data: any[]) => void) => {
            this.loadEntryItemsData(entryId, callback);
          },
          save: (entryId: number, data: any[]) => {
            this.saveEntryItemsById(entryId, data);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'ITEMS');
          },
          updateCount: (entryId: number, count: number) => {
            this.updateEntryItemsCount(entryId, count);
          },
          importFromOC: (idOc: number, entryId: any, callback: (data: any[]) => void) => {
            this.importItemsFromOC(idOc, entryId, callback);
          }
        },
        materialsService: this.materialsService
      }
    });
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedEntry = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  onCellValueChanged(event: any): void {
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
    this.hasUnsavedChanges = true;
  }

  isDirectEntryMode: boolean = false;

  onCellEditingStopped(event: any): void {
    // Sentinel para Tipo de Movimiento en el grid
    if (event.colDef.field === 'idType' && event.newValue === '__ADD_NEW__') {
      event.node.data.idType = event.oldValue ?? null;
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      this.openAddTipoDialogForNode(event.node);
      return;
    }
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
  }

  async openAddTipoDialogForNode(node: any): Promise<void> {
    const result = await alerts.inputAlert(
      'Nuevo Tipo de Movimiento',
      `Tipo: ${this.movementType === 'IN' ? 'Entrada' : 'Salida'}`,
      'text', '',
      {
        inputAttributes: { placeholder: 'Descripción del tipo de movimiento...' },
        confirmButtonText: 'Guardar',
        confirmButtonColor: '#28a745'
      }
    );
    if (result.isConfirmed && result.value) {
      const newId = await this.saveNewCatalog(result.value);
      if (newId !== null) {
        node.data.idType = newId;
        node.data.__modified = true;
        this.hasUnsavedChanges = true;
        this.gridApi.refreshCells({ rowNodes: [node], force: true });
      }
    }
  }

  onCellDoubleClicked(event: any): void {
    if (event.colDef.editable) {
      this.gridApi.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getColId()
      });
    }
  }

  addEntry(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch,
      idProject: this.projectId,
      idWarehouse: this.selectedWarehouse?.idAlmacen || 0,
      idType: this.selectedCatalog?.id || 0,
      idOt: this.selectedOt?.id || 0,
      idOc: 0,
      folio: '',
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      numBill: 'SIN FACTURA',
      deliverName: 'POR CLIENTE',
      idAutoriza: 0,
      comment: '',
      type: this.movementType,
      active: true,
      directEntry: false,
      countrow: 0,
      detailType: null,
      detailData: [],
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'folio' });
    }, 0);
  }

  async deleteEntry(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó inandout st', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.selectedEntry) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una entrada para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar entrada?',
      `¿Está seguro de eliminar la entrada ${this.selectedEntry.folio}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        const entryId = typeof this.selectedEntry.id === 'string'
          ? parseInt(this.selectedEntry.id.replace('temp_', ''))
          : this.selectedEntry.id;
        await lastValueFrom(this.inandoutService.deleteInAndOut(entryId));
        alerts.basicAlert('Eliminado', 'La entrada ha sido eliminada correctamente', 'success');
        this.selectedEntry = null;
        this.loadEntries();
      } catch (error: any) {
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudo eliminar la entrada: ${errorMsg}`, 'error');
      }
    }
  }

  async saveChanges(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en inandout st', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      this.hasUnsavedChanges = false;
      return;
    }

    try {
      for (const newRow of newRows) {
        const entryData = this.prepareEntryData(newRow);
        await lastValueFrom(this.inandoutService.addInAndOut(entryData));
      }
      for (const modifiedRow of modifiedRows) {
        const entryData = this.prepareEntryData(modifiedRow);
        await lastValueFrom(this.inandoutService.updateInAndOut(modifiedRow.id, entryData));
      }
      alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.loadEntries();
    } catch (error: any) {
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
    }
  }

  private prepareEntryData(row: any): any {
    return {
      idBranch: this.idBranch,
      idProject: row.idProject || this.projectId,
      idWarehouse: row.idWarehouse || this.selectedWarehouse?.idAlmacen || 0,
      idType: row.idType || 0,
      idOt: row.idOt || 0,
      idOc: row.idOc || 0,
      folio: row.folio || '',
      date: row.date || new Date().toISOString(),
      deliveryDate: row.deliveryDate || new Date().toISOString(),
      numBill: row.numBill || '',
      deliverName: row.deliverName || '',
      idAutoriza: row.idAutoriza || 0,
      comment: row.comment || '',
      type: this.movementType,
      active: row.active ?? true,
      directEntry: row.directEntry === true || row.directEntry === 1,
      ocList: row.ocList || '',
      countrow: row.countrow || 0
    };
  }

  refreshData(): void {
    this.loadEntries();
    this.selectedEntry = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }

  // ==================== ITEMS DE ENTRADA ====================

  loadEntryItemsData(entryId: number, successCallback: any) {
    this.inandoutService.getInAndOutItems(entryId).subscribe({
      next: (data: any) => successCallback(data),
      error: (error) => {
        console.error('Error loading entry items:', error);
        successCallback([]);
      }
    });
  }

  importItemsFromOC(idOc: number, entryId: any, callback: (data: any[]) => void) {
    if (!idOc || idOc <= 0) { callback([]); return; }
    this.ocService.getReqItems(idOc).subscribe({
      next: (items: any[]) => {
        if (!items || items.length === 0) { callback([]); return; }
        const activeItems = items.filter((item: any) => item.active !== false && item.active !== 0);
        let tempCounter = Date.now();
        const mapped = activeItems.map((item: any) => ({
          id: `temp_item_${tempCounter++}`,
          idInandout: entryId,
          idProduct: item.idSupplie || item.idProduct || 0,
          code: item.code || '',
          description: item.description || '',
          materialName: item.description || '',
          measure: item.measure || '',
          quantity: 0,
          pending: item.quantity || 0,
          total: item.quantity || 0,
          active: true,
          __isNew: true,
          __modified: false
        }));
        callback(mapped);
      },
      error: () => callback([])
    });
  }

  async saveEntryItemsById(entryId: number, data: any[]) {
    const newItems = data.filter((row: any) => row.__isNew);
    const modifiedItems = data.filter((row: any) => row.__modified && !row.__isNew);

    try {
      for (const item of newItems) {
        await lastValueFrom(this.inandoutService.addInAndOutItem(this.cleanItemData(item)));
      }
      for (const item of modifiedItems) {
        await lastValueFrom(this.inandoutService.updateInAndOutItem(item.id, this.cleanItemData(item)));
      }

      if (newItems.length > 0 || modifiedItems.length > 0) {
        alerts.basicAlert('Detalles guardados', 'Se han guardado los items correctamente.', 'success');
        this.updateEntryItemsCount(entryId, data.length);
        const masterEntry = this.rowData.find(entry => entry.id === entryId);
        if (masterEntry) {
          masterEntry.countrow = data.length;
          await lastValueFrom(this.inandoutService.updateInAndOut(String(entryId), this.prepareEntryData(masterEntry)));
        }
        data.forEach(row => { delete row.__isNew; delete row.__modified; });
      }
    } catch (error) {
      console.error('Error saving entry items:', error);
      alerts.basicAlert('Error', 'Error al guardar los items.', 'error');
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const entryId = params.data.idInandout;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.hasUnsavedChanges = true;
      const currentCount = params.api.getDisplayedRowCount();
      this.updateEntryItemsCount(entryId, currentCount - 1);
      successCallback();
    } else {
      try {
        await lastValueFrom(this.inandoutService.deleteInAndOutItem(detailId));
        alerts.basicAlert('Item eliminado', 'El item se eliminó correctamente.', 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert('Error', 'Error al eliminar el item.', 'error');
      }
    }
  }

  private cleanItemData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.material;
    delete cleanedData.materialName;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_item_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  updateEntryItemsCount(entryId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.data.countrow = count;
          this.gridApi.refreshCells({ rowNodes: [node], columns: ['countrow'], force: true });
        }
      });
    }
  }
}
