import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import {
  ICuentaContable,
  ICuentaContableTree,
  ICuentaContableForm
} from 'app/interface/icuentas-contables';
import { alerts } from '../../../../../helpers/alerts';
import { ModalCuentaContableComponent } from './modal-cuenta-contable/modal-cuenta-contable.component';

@Component({
  selector: 'app-cuentas-contables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cuentas-contables.component.html',
  styleUrls: ['./cuentas-contables.component.scss']
})
export class CuentasContablesComponent implements OnInit {
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
    if (this.idCompany) {
      this.loadData();
    }
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

  openEditModal(cuenta: ICuentaContableTree): void {
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

  async deleteCuenta(cuenta: ICuentaContableTree): Promise<void> {
    // Validar que no tenga hijos
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        'Esta cuenta tiene subcuentas asociadas. Debe eliminar primero las subcuentas.',
        'warning'
      );
      return;
    }

    const confirmed = await alerts.confirmAlert(
      '¿Eliminar cuenta?',
      `¿Está seguro de eliminar la cuenta ${cuenta.codigo} - ${cuenta.nombre}?`,
      'warning'
    );

    if (confirmed) {
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
    if (!this.searchTerm) {
      this.cuentasTree.forEach(cuenta => this.showAllNodes(cuenta));
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.cuentasTree.forEach(cuenta => this.filterNodeRecursive(cuenta, term));
  }

  filterNodeRecursive(cuenta: ICuentaContableTree, term: string): boolean {
    const matches =
      cuenta.codigo.toLowerCase().includes(term) ||
      cuenta.nombre.toLowerCase().includes(term) ||
      (cuenta.descripcion && cuenta.descripcion.toLowerCase().includes(term));

    let childMatches = false;
    if (cuenta.hijos && cuenta.hijos.length > 0) {
      cuenta.hijos.forEach(hijo => {
        if (this.filterNodeRecursive(hijo, term)) {
          childMatches = true;
        }
      });
    }

    cuenta.visible = matches || childMatches;
    if (childMatches) {
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
    // TODO: Implementar exportación a Excel
    alerts.basicAlert('Próximamente', 'Función de exportación en desarrollo', 'info');
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
