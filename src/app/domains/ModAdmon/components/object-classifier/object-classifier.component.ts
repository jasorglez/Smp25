import { Component, OnInit, inject, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GetDataPath } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';
import {
  IObjectClassifier,
  IObjectClassifierTree
} from 'app/interface/iobject-classifier';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-object-classifier',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './object-classifier.component.html',
  styleUrl: './object-classifier.component.scss'
})
export class ObjectClassifierComponent implements OnInit {

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    }

    if (event.key === 'Delete' && this.selectedItem) {
      event.preventDefault();
      this.deleteItem(this.selectedItem);
    }
  }

  private adminService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);
  private fb = inject(FormBuilder);

  classifierTree: IObjectClassifierTree[] = [];
  classifierTreeFlat: any[] = []; // Para AG Grid Tree Data Mode
  classifierFlat: IObjectClassifier[] = [];

  idCompany: number = 0;
  selectedItem: IObjectClassifierTree | null = null;
  selectedRowData: any = null;
  viewMode: 'tree' | 'list' = 'tree';
  hasUnsavedChanges: boolean = false;
  loading: boolean = false;

  filterForm: FormGroup;
  modalForm: FormGroup;
  modalMode: 'create' | 'edit' = 'create';
  modalParent: IObjectClassifierTree | null = null;
  modalEditingItem: IObjectClassifier | null = null;
  saving: boolean = false;

  // AG Grid
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private gridApi!: GridApi;

  // Configuración para vista lista
  public columnDefs: ColDef[] = [];

  // Configuración para vista árbol
  public columnDefsTree: ColDef[] = [];

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    editable: false
  };

  // Configuración específica para Tree Data
  public autoGroupColumnDef: ColDef = {
    headerName: 'Clasificador por Objeto del Gasto',
    minWidth: 500,
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: this.customTreeCellRenderer.bind(this)
    },
  };

  public getDataPath: GetDataPath = (data: any) => {
    return data.dataPath || [data.codigo];
  };

  constructor() {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      filterNivel: [null],
      showOnlyActive: [true]
    });

    this.modalForm = this.fb.group({
      codigo: ['', Validators.required],
      nombre: ['', Validators.required],
      descripcion: [''],
      nivel: [1],
      idPadre: [null],
      esHoja: [false],
      active: [true]
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (this.idCompany) {
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.setupAgGridColumns();
    this.setupAgGridTreeColumns();
    if (this.idCompany) {
      this.loadData();
    }
  }

  setupAgGridColumns(): void {
    this.columnDefs = [
      {
        headerName: 'Código',
        field: 'codigo',
        width: 150,
        cellClass: 'fw-bold',
        editable: true
      },
      {
        headerName: 'Nombre',
        field: 'nombre',
        flex: 1,
        minWidth: 250,
        editable: true
      },
      {
        headerName: 'Descripción',
        field: 'descripcion',
        flex: 1,
        minWidth: 300,
        editable: true,
        valueFormatter: (params) => params.value || '-'
      },
      {
        headerName: 'Nivel',
        field: 'nivel',
        width: 100,
        filter: 'agNumberColumnFilter',
        editable: false,
        cellRenderer: (params: ICellRendererParams) => {
          const nivel = params.value;
          const labelNivel = nivel === 1 ? 'Capítulo' :
                           nivel === 2 ? 'Concepto' :
                           nivel === 3 ? 'P. Genérica' :
                           'P. Específica';
          const colorClass = nivel === 1 ? 'warning' :
                           nivel === 2 ? 'info' :
                           nivel === 3 ? 'primary' :
                           'success';
          return `<span class="badge bg-${colorClass}" style="font-size: 0.75rem;">${labelNivel}</span>`;
        }
      },
      {
        headerName: 'Tipo',
        field: 'esHoja',
        width: 100,
        editable: false,
        cellRenderer: (params: ICellRendererParams) => {
          const esHoja = params.value;
          return esHoja
            ? '<span class="badge bg-success text-dark">Hoja</span>'
            : '<span class="badge bg-secondary">Padre</span>';
        }
      },
      {
        headerName: 'Estado',
        field: 'active',
        width: 100,
        filter: 'agSetColumnFilter',
        editable: true,
        cellRenderer: (params: ICellRendererParams) => {
          const activo = params.value;
          return activo
            ? '<span class="badge bg-success">Activo</span>'
            : '<span class="badge bg-danger">Inactivo</span>';
        }
      }
    ];
  }

  setupAgGridTreeColumns(): void {
    this.columnDefsTree = [
      {
        headerName: 'Descripción',
        field: 'descripcion',
        flex: 3,
        minWidth: 500,
        wrapText: true,
        autoHeight: true,
        cellStyle: { 'white-space': 'normal', 'line-height': '1.4' },
        valueFormatter: (params) => params.value || '-'
      },
      {
        headerName: 'Nivel',
        field: 'nivel',
        width: 140,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return '';
          const nivel = params.value;
          const labelNivel = nivel === 1 ? 'Capítulo' :
                           nivel === 2 ? 'Concepto' :
                           nivel === 3 ? 'P. Genérica' :
                           'P. Específica';
          const colorClass = nivel === 1 ? 'warning' :
                           nivel === 2 ? 'info' :
                           nivel === 3 ? 'primary' :
                           'success';
          return `<span class="badge bg-${colorClass}" style="font-size: 0.75rem;">${labelNivel}</span>`;
        }
      },
      {
        headerName: 'Estado',
        field: 'active',
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value === undefined) return '';
          return params.value
            ? '<span class="badge bg-success">Activo</span>'
            : '<span class="badge bg-danger">Inactivo</span>';
        }
      }
    ];

    // Configuración específica para la columna de agrupación en Tree Data Mode
    this.autoGroupColumnDef = {
      headerName: 'Clasificador por Objeto del Gasto',
      minWidth: 400,
      width: 400,
      wrapText: true,
      autoHeight: true,
      cellRendererParams: {
        suppressCount: true,
        innerRenderer: this.customTreeCellRenderer.bind(this)
      }
    };
  }

  // Renderizador personalizado para celdas del árbol
  customTreeCellRenderer(params: any) {
    const data = params.data;
    const nivel = data.nivel;

    // Iconos según el nivel
    // Nivel 1: Capítulo - Carpeta grande amarilla
    // Nivel 2: Concepto - Carpeta azul
    // Nivel 3: Partida Genérica - Archivo naranja
    // Nivel 4: Partida Específica - Archivo verde
    const iconClass = nivel === 1 ? 'bi-folder-fill text-warning' :
                     nivel === 2 ? 'bi-folder text-info' :
                     nivel === 3 ? 'bi-file-earmark text-primary' :
                     'bi-file-earmark-text text-success';

    return `
      <div class="d-flex align-items-start gap-2" style="padding: 4px 0; width: 100%;">
        <i class="bi ${iconClass}" style="font-size: 1rem; flex-shrink: 0; margin-top: 2px;"></i>
        <div style="min-width: 0; flex: 1;">
          <div class="fw-bold" style="font-size: 11px; line-height: 1.3; word-wrap: break-word;">${data.codigo}</div>
          <div class="text-muted" style="font-size: 10px; line-height: 1.3; white-space: normal; word-wrap: break-word;">${data.nombre}</div>
        </div>
      </div>
    `;
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;

    // Expandir primer nivel en modo árbol
    if (this.viewMode === 'tree') {
      setTimeout(() => {
        this.gridApi.forEachNode(node => {
          if (node.level === 0) {
            node.setExpanded(true);
          }
        });
      }, 100);
    }

    this.applyGridFilters();
  }

  onSelectionChanged(event: any): void {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      const selectedData = selectedNodes[0].data;

      if (this.viewMode === 'list') {
        this.selectedRowData = selectedData;
        this.selectedItem = null;
      } else if (this.viewMode === 'tree') {
        this.selectedItem = selectedData;
        this.selectedRowData = null;
      }
    } else {
      this.selectedRowData = null;
      this.selectedItem = null;
    }
  }

  onCellValueChanged(event: any): void {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  loadData(): void {
    this.loading = true;

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Cargar Clasificador por Objeto del Gasto',
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );

    this.adminService.getObjectclassifications(this.idCompany).subscribe({
      next: (data: any) => {
        // Verificar si los datos vienen en formato árbol o plano
        let tree: IObjectClassifierTree[];

        if (Array.isArray(data) && data.length > 0) {
          // Si los datos tienen propiedad 'hijos', ya están en formato árbol
          if (data[0].hijos !== undefined) {
            tree = data;
          } else {
            // Si no, construir el árbol desde datos planos
            tree = this.buildTreeFromFlat(data);
          }
        } else {
          tree = [];
        }

        // Procesar el árbol para HTML (modo anterior)
        this.classifierTree = this.buildTreeDataForGrid(tree);

        // Procesar para AG Grid Tree Data Mode
        this.classifierTreeFlat = this.buildFlatTreeData(tree);

        this.loading = false;

        // Si estamos en vista árbol, expandir el primer nivel
        setTimeout(() => {
          if (this.viewMode === 'tree' && this.gridApi) {
            this.gridApi.forEachNode(node => {
              if (node.level === 0) {
                node.setExpanded(true);
              }
            });
          }
        }, 100);
      },
      error: (error) => {
        console.error('Error loading object classifier:', error);
        alerts.basicAlert('Error', 'No se pudo cargar el clasificador', 'error');
        this.loading = false;
      }
    });
  }

  // Construir árbol desde datos planos (si el backend no lo hace)
  buildTreeFromFlat(flatData: IObjectClassifier[]): IObjectClassifierTree[] {
    const map = new Map<number, IObjectClassifierTree>();
    const roots: IObjectClassifierTree[] = [];

    // Crear nodos con propiedad hijos
    flatData.forEach(item => {
      map.set(item.id, { ...item, hijos: [], expanded: false });
    });

    // Construir relaciones padre-hijo
    flatData.forEach(item => {
      const node = map.get(item.id)!;

      // Si tiene idPadre Y el padre existe en el mapa
      if (item.idPadre !== null && item.idPadre !== undefined && map.has(item.idPadre)) {
        const parent = map.get(item.idPadre)!;
        parent.hijos.push(node);
      } else {
        // Es nodo raíz (nivel 1 sin padre)
        roots.push(node);
      }
    });

    return roots;
  }

  // Construir la estructura de árbol para HTML (vista antigua)
  buildTreeDataForGrid(tree: IObjectClassifierTree[]): IObjectClassifierTree[] {
    const processNode = (node: IObjectClassifierTree): IObjectClassifierTree => {
      return {
        ...node,
        expanded: false,
        hijos: node.hijos ? node.hijos.map(child => processNode(child)) : []
      };
    };

    return tree.map(node => processNode(node));
  }

  // Construir estructura plana con dataPath para AG Grid Tree Data Mode
  buildFlatTreeData(tree: IObjectClassifierTree[]): any[] {
    const result: any[] = [];

    const processNode = (node: IObjectClassifierTree, path: string[] = []) => {
      const currentPath = [...path, node.codigo];

      const flatNode = {
        id: node.id,
        codigo: node.codigo,
        nombre: node.nombre,
        descripcion: node.descripcion || '',
        nivel: node.nivel,
        idPadre: node.idPadre,
        esHoja: node.esHoja,
        active: node.active,
        idCompany: node.idCompany,
        dataPath: currentPath, // Propiedad crítica para AG Grid Tree Data
        hasChildren: node.hijos && node.hijos.length > 0
      };

      result.push(flatNode);

      // Procesar hijos recursivamente
      if (node.hijos && node.hijos.length > 0) {
        node.hijos.forEach(hijo => processNode(hijo, currentPath));
      }
    };

    tree.forEach(node => processNode(node));
    return result;
  }

  // Métodos para manejar el árbol
  selectNode(node: IObjectClassifierTree): void {
    this.selectedItem = node;
  }

  toggleNode(node: IObjectClassifierTree): void {
    node.expanded = !node.expanded;
  }

  expandAll(): void {
    if (this.viewMode === 'tree' && this.gridApi) {
      this.gridApi.expandAll();
    } else {
      this.expandAllNodes();
    }
  }

  collapseAll(): void {
    if (this.viewMode === 'tree' && this.gridApi) {
      this.gridApi.collapseAll();
    } else {
      this.collapseAllNodes();
    }
  }

  expandAllNodes(): void {
    this.expandCollapseNodes(this.classifierTree, true);
  }

  collapseAllNodes(): void {
    this.expandCollapseNodes(this.classifierTree, false);
  }

  private expandCollapseNodes(nodes: IObjectClassifierTree[], expand: boolean): void {
    nodes.forEach(node => {
      node.expanded = expand;
      if (node.hijos) {
        this.expandCollapseNodes(node.hijos, expand);
      }
    });
  }

  applyGridFilters(): void {
    if (!this.gridApi) return;

    // Aplicar QuickFilter para búsqueda de texto
    this.gridApi.setGridOption('quickFilterText', this.filterForm.value.searchTerm);

    // Aplicar filtro de nivel si existe
    const nivelFilter = this.gridApi.getFilterInstance('nivel');
    if (nivelFilter) {
      const nivel = this.filterForm.value.filterNivel;
      const nivelFilterModel = nivel ? { type: 'equals', filter: nivel } : null;
      (nivelFilter as any).setModel(nivelFilterModel);
      this.gridApi.onFilterChanged();
    }
  }

  revert(): void {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  async deleteItem(item: IObjectClassifier | IObjectClassifierTree | null): Promise<void> {
    if (!item) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const itemTree = item as IObjectClassifierTree;
    if (itemTree.hijos && itemTree.hijos.length > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        'Este item tiene sub-items asociados. Debe eliminar primero los sub-items.',
        'warning'
      );
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar item?',
      `¿Está seguro de eliminar el item ${item.codigo} - ${item.nombre}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        await this.adminService.deleteObjectClassification(item.id).toPromise();

        alerts.basicAlert(
          '¡Eliminado!',
          `El ${this.getNombreNivel(item.nivel)} ha sido eliminado exitosamente`,
          'success'
        );

        // Recargar datos
        this.loadData();
        this.selectedItem = null;
        this.selectedRowData = null;

      } catch (error) {
        console.error('Error al eliminar item:', error);
        alerts.basicAlert(
          'Error',
          'No se pudo eliminar el item. Puede que tenga dependencias o el servidor no esté disponible.',
          'error'
        );
      }
    }
  }

  openCreateModal(parent?: IObjectClassifierTree): void {
    const nivelPadre = parent ? parent.nivel : 0;
    const nivelNuevo = nivelPadre + 1;

    if (nivelNuevo > 4) {
      alerts.basicAlert(
        'Nivel máximo alcanzado',
        'No se pueden crear más niveles. El máximo es nivel 4 (Partida Específica).',
        'warning'
      );
      return;
    }

    this.modalMode = 'create';
    this.modalParent = parent || null;
    this.modalEditingItem = null;

    // Resetear formulario con valores por defecto
    this.modalForm.reset({
      codigo: '',
      nombre: '',
      descripcion: '',
      nivel: nivelNuevo,
      idPadre: parent ? parent.id : null,
      esHoja: nivelNuevo === 4, // Por defecto, nivel 4 es hoja
      active: true
    });

    // Abrir modal
    const modalElement = document.getElementById('modalObjectClassifier');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  openEditModal(item: IObjectClassifier | IObjectClassifierTree | null): void {
    if (!item) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para editar', 'warning');
      return;
    }

    this.modalMode = 'edit';
    this.modalParent = null;
    this.modalEditingItem = item;

    // Cargar datos del item al formulario
    this.modalForm.patchValue({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      nivel: item.nivel,
      idPadre: item.idPadre || null,
      esHoja: item.esHoja,
      active: item.active
    });

    // Abrir modal
    const modalElement = document.getElementById('modalObjectClassifier');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  async saveItem(): Promise<void> {
    if (this.modalForm.invalid) {
      alerts.basicAlert('Formulario inválido', 'Por favor complete todos los campos requeridos', 'warning');
      return;
    }

    this.saving = true;

    const formData = {
      ...this.modalForm.value,
      idCompany: this.idCompany
    };

    try {
      if (this.modalMode === 'create') {
        // Crear nuevo item
        await this.adminService.addObjectClassification(formData).toPromise();

        alerts.basicAlert(
          '¡Creado!',
          `El ${this.getNombreNivel(formData.nivel)} ha sido creado exitosamente`,
          'success'
        );
      } else {
        // Actualizar item existente
        console.log('=== EDITANDO OBJETO DE GASTO ===');
        console.log('ID a actualizar:', this.modalEditingItem!.id);
        console.log('Datos del formulario (formData):', formData);
        console.log('Item original (modalEditingItem):', this.modalEditingItem);

        await this.adminService.updateObjectClassification(this.modalEditingItem!.id, formData).toPromise();

        alerts.basicAlert(
          '¡Actualizado!',
          `El ${this.getNombreNivel(formData.nivel)} ha sido actualizado exitosamente`,
          'success'
        );
      }

      // Cerrar modal
      const modalElement = document.getElementById('modalObjectClassifier');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        modal?.hide();
      }

      // Recargar datos
      this.loadData();

    } catch (error) {
      console.error('Error al guardar item:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo guardar el item. Por favor intente nuevamente.',
        'error'
      );
    } finally {
      this.saving = false;
    }
  }

  getNombreNivel(nivel: number): string {
    switch (nivel) {
      case 1: return 'Capítulo';
      case 2: return 'Concepto';
      case 3: return 'Partida Genérica';
      case 4: return 'Partida Específica';
      default: return 'Item';
    }
  }

  exportToExcel(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `clasificador-objeto-gasto-${new Date().getTime()}.xlsx`,
        sheetName: 'Clasificador'
      });
    }
  }
}
