import { Component, OnInit, inject, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
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
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './cuentas-contables.component.html',
  styleUrls: ['./cuentas-contables.component.scss']
})
export class CuentasContablesComponent implements OnInit {

  // Atajos de teclado
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ctrl + N: Nueva cuenta
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.openCreateModal();
    }

    // Ctrl + F: Focus en búsqueda
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    }

    // Delete: Eliminar cuenta seleccionada
    if (event.key === 'Delete' && this.selectedCuenta) {
      event.preventDefault();
      this.deleteCuenta(this.selectedCuenta);
    }

    // Enter: Expandir/colapsar cuenta seleccionada
    if (event.key === 'Enter' && this.selectedCuenta && 'expanded' in this.selectedCuenta) {
      event.preventDefault();
      this.toggleNode(this.selectedCuenta as ICuentaContableTree);
    }
  }
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private modalService = inject(NgbModal);

  cuentasTree: ICuentaContableTree[] = [];
  cuentasFlat: ICuentaContable[] = [];
  cuentasHojas: ICuentaContable[] = [];

  idCompany: number = 0;
  searchTerm: string = '';
  selectedCuenta: ICuentaContableTree | null = null;
  viewMode: 'tree' | 'list' = 'tree';
  filterNivel: number | null = null;
  showOnlyActive: boolean = true;

  loading: boolean = false;

  // AG Grid
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private gridApi!: GridApi;
  public columnDefs: ColDef[] = [];
  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (this.idCompany) {
        this.loadData();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.setupAgGridColumns();
    if (this.idCompany) {
      this.loadData();
    }
  }

  setupAgGridColumns(): void {
    this.columnDefs = [
      {
        headerName: 'Código',
        field: 'codigo',
        width: 120,
        cellClass: 'fw-bold'
      },
      {
        headerName: 'Nombre',
        field: 'nombre',
        flex: 1,
        minWidth: 250
      },
      {
        headerName: 'Descripción',
        field: 'descripcion',
        flex: 1,
        minWidth: 200,
        valueFormatter: (params) => params.value || '-'
      },
      {
        headerName: 'Nivel',
        field: 'nivel',
        width: 100,
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
        cellRenderer: (params: ICellRendererParams) => {
          const activo = params.value;
          return activo
            ? '<span class="badge bg-success">Activa</span>'
            : '<span class="badge bg-danger">Inactiva</span>';
        }
      },
      {
        headerName: 'Acciones',
        width: 140,
        cellRenderer: (params: ICellRendererParams) => {
          return `
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-edit" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-delete" title="Eliminar" ${!params.data.activo ? 'disabled' : ''}>
                <i class="bi bi-trash"></i>
              </button>
            </div>
          `;
        },
        onCellClicked: (params) => {
          const target = params.event?.target as HTMLElement;
          if (target.closest('.btn-edit')) {
            this.openEditModal(params.data);
          } else if (target.closest('.btn-delete')) {
            this.deleteCuenta(params.data);
          }
        }
      }
    ];
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
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
        this.cuentasTree = tree.map(cuenta => this.initializeTreeNode(cuenta));
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading cuentas tree:', error);
        alerts.basicAlert('Error', 'No se pudo cargar el catálogo de cuentas', 'error');
        this.loading = false;
      }
    });

    // Cargar también la lista plana para búsquedas
    this.cuentasService.getAll(this.idCompany).subscribe({
      next: (cuentas) => {
        this.cuentasFlat = cuentas;
      },
      error: (error) => {
        console.error('Error loading cuentas flat:', error);
      }
    });

    // Cargar cuentas hoja para selector
    this.cuentasService.getHojas(this.idCompany).subscribe({
      next: (hojas) => {
        this.cuentasHojas = hojas;
      },
      error: (error) => {
        console.error('Error loading cuentas hojas:', error);
      }
    });
  }

  initializeTreeNode(cuenta: ICuentaContableTree): ICuentaContableTree {
    cuenta.expanded = false;
    cuenta.visible = true;
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos = cuenta.hijos.map(hijo => this.initializeTreeNode(hijo));
    }
    return cuenta;
  }

  toggleNode(cuenta: ICuentaContableTree): void {
    cuenta.expanded = !cuenta.expanded;
    this.updateChildrenVisibility(cuenta);
  }

  updateChildrenVisibility(cuenta: ICuentaContableTree): void {
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos.forEach(hijo => {
        hijo.visible = cuenta.expanded;
        if (!cuenta.expanded) {
          hijo.expanded = false;
          this.updateChildrenVisibility(hijo);
        }
      });
    }
  }

  expandAll(): void {
    this.cuentasTree.forEach(cuenta => this.expandNodeRecursive(cuenta, true));
  }

  collapseAll(): void {
    this.cuentasTree.forEach(cuenta => this.expandNodeRecursive(cuenta, false));
  }

  expandNodeRecursive(cuenta: ICuentaContableTree, expand: boolean): void {
    cuenta.expanded = expand;
    cuenta.visible = true;
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos.forEach(hijo => {
        hijo.visible = expand;
        this.expandNodeRecursive(hijo, expand);
      });
    }
  }

  selectCuenta(cuenta: ICuentaContableTree): void {
    this.selectedCuenta = cuenta;
  }

  getNivelClass(nivel: number): string {
    switch (nivel) {
      case 1: return 'nivel-1';
      case 2: return 'nivel-2';
      case 3: return 'nivel-3';
      default: return '';
    }
  }

  getNivelIcon(nivel: number): string {
    switch (nivel) {
      case 1: return 'bi-folder-fill';
      case 2: return 'bi-folder';
      case 3: return 'bi-file-earmark-text';
      default: return 'bi-file';
    }
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
    // Validar que no tenga hijos
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

  filterTree(): void {
    if (!this.searchTerm && this.filterNivel === null) {
      this.cuentasTree.forEach(cuenta => this.showAllNodes(cuenta));
      return;
    }

    const term = this.searchTerm ? this.searchTerm.toLowerCase() : '';
    this.cuentasTree.forEach(cuenta => this.filterNodeRecursive(cuenta, term));
  }

  filterNodeRecursive(cuenta: ICuentaContableTree, term: string): boolean {
    // Filtro por término de búsqueda
    const textMatches = !term ||
      cuenta.codigo.toLowerCase().includes(term) ||
      cuenta.nombre.toLowerCase().includes(term) ||
      (cuenta.descripcion && cuenta.descripcion.toLowerCase().includes(term));

    // Filtro por nivel
    const nivelMatches = this.filterNivel === null || cuenta.nivel === this.filterNivel;

    const matches = textMatches && nivelMatches;

    let childMatches = false;
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos.forEach(hijo => {
        if (this.filterNodeRecursive(hijo, term)) {
          childMatches = true;
        }
      });
    }

    cuenta.visible = matches || childMatches;
    if (childMatches || (matches && term)) {
      cuenta.expanded = true;
    }

    return cuenta.visible;
  }

  showAllNodes(cuenta: ICuentaContableTree): void {
    cuenta.visible = true;
    cuenta.expanded = false;
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos.forEach(hijo => this.showAllNodes(hijo));
    }
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'tree' ? 'list' : 'tree';
  }

  exportToExcel(): void {
    import('xlsx').then(XLSX => {
      // Preparar datos con jerarquía visual
      const exportData: any[] = [];

      const processNode = (cuenta: ICuentaContableTree, level: number) => {
        const indent = '  '.repeat(level); // Sangría visual
        exportData.push({
          'Código': cuenta.codigo,
          'Nombre': indent + cuenta.nombre,
          'Descripción': cuenta.descripcion || '',
          'Nivel': cuenta.nivel,
          'Tipo': cuenta.esHoja ? 'Hoja' : 'Padre',
          'Estado': cuenta.activo ? 'Activa' : 'Inactiva'
        });

        if (cuenta.hijos && cuenta.hijos.length > 0) {
          cuenta.hijos.forEach(hijo => processNode(hijo, level + 1));
        }
      };

      this.cuentasTree.forEach(cuenta => processNode(cuenta, 0));

      // Crear libro de Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cuentas Contables');

      // Ajustar anchos de columna
      const colWidths = [
        { wch: 15 }, // Código
        { wch: 50 }, // Nombre (más ancho para sangría)
        { wch: 40 }, // Descripción
        { wch: 10 }, // Nivel
        { wch: 10 }, // Tipo
        { wch: 10 }  // Estado
      ];
      ws['!cols'] = colWidths;

      // Descargar archivo
      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `cuentas-contables-${fecha}.xlsx`);

      alerts.basicAlert('Exportado', 'Archivo Excel generado correctamente', 'success');
    }).catch(error => {
      console.error('Error al exportar:', error);
      alerts.basicAlert('Error', 'No se pudo exportar a Excel', 'error');
    });
  }

  get filteredFlatCuentas(): ICuentaContable[] {
    let filtered = this.cuentasFlat;

    if (this.showOnlyActive) {
      filtered = filtered.filter(c => c.activo);
    }

    if (this.filterNivel !== null) {
      filtered = filtered.filter(c => c.nivel === this.filterNivel);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.codigo.toLowerCase().includes(term) ||
        c.nombre.toLowerCase().includes(term) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(term))
      );
    }

    return filtered;
  }
}
