import { Component, OnInit, inject, effect, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GetDataPath, RowNode } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import {
  ICuentaContable,
  ICuentaContableTree,
  ICuentaContableForm
} from 'app/interface/icuentas-contables';
import { alerts } from 'app/helpers/alerts';
import { ModalCuentaContableComponent } from './modal-cuenta-contable/modal-cuenta-contable.component';

@Component({
  selector: 'app-cuentas-contables',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './cuentas-contables.component.html',
  styleUrls: ['./cuentas-contables.component.scss']
})
export class CuentasContablesComponent implements OnInit {

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.openCreateModal();
    }

    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    }

    if (event.key === 'Delete' && this.selectedCuenta) {
      event.preventDefault();
      this.deleteCuenta(this.selectedCuenta);
    }
  }

  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private modalService = inject(NgbModal);
  private fb = inject(FormBuilder);

  cuentasTree: ICuentaContableTree[] = [];
  cuentasTreeFlat: any[] = []; // Para AG Grid Tree Data Mode
  cuentasFlat: ICuentaContable[] = [];
  cuentasHojas: ICuentaContable[] = [];

  idCompany: number = 0;
  selectedCuenta: ICuentaContableTree | null = null;
  selectedRowData: any = null;
  viewMode: 'tree' | 'list' = 'tree';
  hasUnsavedChanges: boolean = false;
  loading: boolean = false;

  filterForm: FormGroup;

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
    headerName: 'Cuenta Contable',
    minWidth: 400,
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
        minWidth: 200,
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
          const colorClass = nivel === 1 ? 'primary' : nivel === 2 ? 'info' : 'success';
          return `<span class="badge bg-${colorClass}">${nivel}</span>`;
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
            ? '<span class="badge bg-warning text-dark">Hoja</span>'
            : '<span class="badge bg-secondary">Padre</span>';
        }
      },
      {
        headerName: 'Estado',
        field: 'activo',
        width: 100,
        filter: 'agSetColumnFilter',
        editable: true,
        cellRenderer: (params: ICellRendererParams) => {
          const activo = params.value;
          return activo
            ? '<span class="badge bg-success">Activa</span>'
            : '<span class="badge bg-danger">Inactiva</span>';
        }
      }
    ];
  }


  setupAgGridTreeColumns(): void {
    this.columnDefsTree = [
      {
        headerName: 'Descripción',
        field: 'descripcion',
        flex: 1,
        minWidth: 250,
        valueFormatter: (params) => params.value || '-'
      },
      {
        headerName: 'Nivel',
        field: 'nivel',
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return '';
          const nivel = params.value;
          const colorClass = nivel === 1 ? 'primary' : nivel === 2 ? 'info' : 'success';
          return `<span class="badge bg-${colorClass}">Nivel ${nivel}</span>`;
        }
      },
      {
        headerName: 'Estado',
        field: 'activo',
        width: 120,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value === undefined) return '';
          return params.value
            ? '<span class="badge bg-success">Activa</span>'
            : '<span class="badge bg-danger">Inactiva</span>';
        }
      }
    ];

    // Configuración específica para la columna de agrupación en Tree Data Mode
    this.autoGroupColumnDef = {
      headerName: 'Cuenta Contable',
      minWidth: 400,
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
    const iconClass = nivel === 1 ? 'bi-folder-fill text-warning' : 
                     nivel === 2 ? 'bi-folder text-info' : 
                     'bi-file-earmark-text text-success';
    
    // Clases CSS según el nivel para indentación
    const nivelClass = `nivel-${nivel}`;
    
    return `
      <div class="d-flex align-items-center ${nivelClass}">
        <i class="bi ${iconClass} me-2"></i>
        <div>
          <div class="fw-bold">${data.codigo}</div>
          <div class="small text-muted">${data.nombre}</div>
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
        this.selectedCuenta = null;
      } else if (this.viewMode === 'tree') {
        // En modo árbol, mapear los datos seleccionados
        this.selectedCuenta = selectedData;
        this.selectedRowData = null;
      }
    } else {
      this.selectedRowData = null;
      this.selectedCuenta = null;
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
      'Cargar Catálogo de Cuentas Contables',
      'Menu Administración - Cuentas Contables',
      this.trackingService.getEmail()
    );

    this.cuentasService.getTree(this.idCompany).subscribe({
      next: (tree) => {
        // Procesar el árbol para HTML (modo anterior)
        this.cuentasTree = this.buildTreeDataForGrid(tree);

        // Procesar para AG Grid Tree Data Mode
        this.cuentasTreeFlat = this.buildFlatTreeData(tree);

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
        console.error('Error loading cuentas tree:', error);
        alerts.basicAlert('Error', 'No se pudo cargar el catálogo de cuentas', 'error');
        this.loading = false;
      }
    });

    // Cargar lista plana para búsquedas
    this.cuentasService.getAll(this.idCompany).subscribe({
      next: (cuentas) => {
        this.cuentasFlat = cuentas;
      },
      error: (error) => {
        console.error('Error loading cuentas flat:', error);
      }
    });
  }

  // Construir la estructura de árbol para HTML (vista antigua)
  buildTreeDataForGrid(tree: ICuentaContableTree[]): ICuentaContableTree[] {
    const processNode = (node: ICuentaContableTree): ICuentaContableTree => {
      return {
        ...node,
        expanded: false, // Agregar propiedad para controlar expansión
        hijos: node.hijos ? node.hijos.map(child => processNode(child)) : []
      };
    };

    return tree.map(node => processNode(node));
  }

  // Construir estructura plana con dataPath para AG Grid Tree Data Mode
  buildFlatTreeData(tree: ICuentaContableTree[]): any[] {
    const result: any[] = [];

    const processNode = (node: ICuentaContableTree, path: string[] = []) => {
      const currentPath = [...path, node.codigo];

      const flatNode = {
        id: node.id,
        codigo: node.codigo,
        nombre: node.nombre,
        descripcion: node.descripcion || '',
        nivel: node.nivel,
        idPadre: node.idPadre,
        esHoja: node.esHoja,
        activo: node.activo,
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

  // Métodos para manejar el árbol HTML
  selectNode(node: ICuentaContableTree): void {
    this.selectedCuenta = node;
  }

  toggleNode(node: ICuentaContableTree): void {
    node.expanded = !node.expanded;
  }

  getIconClass(node: ICuentaContableTree): string {
    if (node.esHoja) {
      return 'bi-file-earmark-text text-success';
    }

    return node.expanded ? 'bi-chevron-down text-primary' : 'bi-chevron-right text-primary';
  }

  expandAllNodes(): void {
    this.expandCollapseNodes(this.cuentasTree, true);
  }

  collapseAllNodes(): void {
    this.expandCollapseNodes(this.cuentasTree, false);
  }

  private expandCollapseNodes(nodes: ICuentaContableTree[], expand: boolean): void {
    nodes.forEach(node => {
      node.expanded = expand;
      if (node.hijos) {
        this.expandCollapseNodes(node.hijos, expand);
      }
    });
  }

  applyTreeFilters(): void {
    // Implementar filtrado básico para el árbol HTML
    const searchTerm = this.filterForm.value.searchTerm?.toLowerCase() || '';
    const filterNivel = this.filterForm.value.filterNivel;

    if (!searchTerm && !filterNivel) {
      // Si no hay filtros, mostrar todo
      this.expandCollapseNodes(this.cuentasTree, false);
      return;
    }

    // Función recursiva para filtrar nodos
    const filterNodes = (nodes: ICuentaContableTree[]): ICuentaContableTree[] => {
      return nodes.filter(node => {
        const matchesSearch = !searchTerm ||
          node.codigo.toLowerCase().includes(searchTerm) ||
          node.nombre.toLowerCase().includes(searchTerm) ||
          (node.descripcion && node.descripcion.toLowerCase().includes(searchTerm));

        const matchesNivel = !filterNivel || node.nivel === filterNivel;

        if (matchesSearch && matchesNivel) {
          // Si el nodo coincide, expandir su rama
          node.expanded = true;
          return true;
        }

        // Si no coincide directamente, verificar hijos
        if (node.hijos && node.hijos.length > 0) {
          const filteredChildren = filterNodes(node.hijos);
          if (filteredChildren.length > 0) {
            node.expanded = true;
            node.hijos = filteredChildren;
            return true;
          }
        }

        return false;
      });
    };

    // Aplicar filtro y actualizar la vista
    const filteredTree = filterNodes([...this.cuentasTree]);
    this.cuentasTree = [...filteredTree];
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

  filterTree(): void {
    // Implementar filtrado para árbol HTML
    this.applyTreeFilters();
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

  // Métodos existentes (sin cambios)
  addRow(): void {
    // Tu implementación existente
  }

  async saveChanges(): Promise<void> {
    // Tu implementación existente
  }

  saveTreeChanges(): void {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  revert(): void {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  async deleteEntry(): Promise<void> {
    if (!this.selectedRowData) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una cuenta para eliminar', 'warning');
      return;
    }
    await this.deleteCuenta(this.selectedRowData);
  }

  openCreateModal(parent?: ICuentaContableTree): void {
    const modalRef = this.modalService.open(ModalCuentaContableComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    if (parent) {
      modalRef.componentInstance.parentCuenta = parent;
      modalRef.componentInstance.nivelPadre = parent.nivel;
    }
    modalRef.componentInstance.idCompany = this.idCompany;
    modalRef.componentInstance.cuentasExistentes = this.cuentasFlat;

    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadData();
        }
      },
      () => { }
    );
  }

  openEditModal(cuenta: ICuentaContable | ICuentaContableTree): void {
    const modalRef = this.modalService.open(ModalCuentaContableComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.cuenta = { ...cuenta };
    modalRef.componentInstance.isEdit = true;
    modalRef.componentInstance.idCompany = this.idCompany;
    modalRef.componentInstance.cuentasExistentes = this.cuentasFlat;

    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadData();
        }
      },
      () => { }
    );
  }

  async deleteCuenta(cuenta: ICuentaContable | ICuentaContableTree): Promise<void> {
    const cuentaTree = cuenta as ICuentaContableTree;
    if (cuentaTree.hijos && cuentaTree.hijos.length > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        'Esta cuenta tiene subcuentas asociadas. Debe eliminar primero las subcuentas.',
        'warning'
      );
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar cuenta?',
      `¿Está seguro de eliminar la cuenta ${cuenta.codigo} - ${cuenta.nombre}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Eliminar cuenta ${cuenta.codigo}`,
        'Menu Administración - Cuentas Contables',
        this.trackingService.getEmail()
      );

      this.cuentasService.delete(cuenta.id).subscribe({
        next: () => {
          alerts.basicAlert('Eliminado', 'La cuenta ha sido eliminada correctamente', 'success');
          this.loadData();
        },
        error: (error) => {
          console.error('Error deleting cuenta:', error);
          alerts.basicAlert('Error', 'No se pudo eliminar la cuenta', 'error');
        }
      });
    }
  }

  exportToExcel(): void {
    // Tu implementación existente
  }

  private cleanDataForServer(data: any): ICuentaContableForm {
    // Tu implementación existente
    return data;
  }
}