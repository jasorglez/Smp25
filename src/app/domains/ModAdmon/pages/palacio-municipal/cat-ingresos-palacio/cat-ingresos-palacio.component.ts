import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { TrackingService } from 'app/services/tracking.service';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  GetDataPath,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface ICatalogTree {
  id: number | string;
  idCompany: number;
  description: string;
  type: string;
  parentId: number | string;
  parent_id?: number | string;  // Soporte para formato alternativo del backend
  active: number | boolean;
  children?: ICatalogTree[];
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-cat-ingresos-palacio',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './cat-ingresos-palacio.component.html',
  styleUrl: './cat-ingresos-palacio.component.scss',
})
export class CatIngresosPalacioComponent {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private catalogadmonService = inject(CatalogadmonService);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);

  // Modal variables
  modalForm: FormGroup;
  modalMode: 'create' | 'edit' = 'create';
  modalParent: ICatalogTree | null = null;
  modalEditingItem: ICatalogTree | null = null;
  saving: boolean = false;

  constructor() {
    this.modalForm = this.fb.group({
      description: ['', Validators.required],
      active: [true]
    });

    this.obtenerDatos();
  }

  ngOnInit() {
    // Cargar datos cuando cambie el root
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
  }

  catalogData: any[] = [];
  treeData: ICatalogTree[] = [];
  loading: boolean = false;

  selectedRowData: any = null;
  selectedItem: ICatalogTree | null = null;

  idRoot: number;
  private gridApi: GridApi;

  // GetDataPath para AG Grid Tree Data
  public getDataPath: GetDataPath = (data: any) => {
    return data.path || [];
  };

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    treeData: true,
    animateRows: true,
    groupDefaultExpanded: -1, // Expandir todos por defecto
    getDataPath: (data: any) => data.path,
    showOpenedGroup: false, // No mostrar grupo abierto
    groupDisplayType: 'custom', // Usar visualización personalizada
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never',
    suppressRowClickSelection: true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'consecutivo',
        headerName: '#',
        editable: false,
        filter: false,
        width: 80,
        valueGetter: (params) => {
          // Generar consecutivo automático basado en el índice de la fila visible
          if (params.node && params.node.rowIndex !== null) {
            return params.node.rowIndex + 1;
          }
          return '';
        },
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: false,
        minWidth: 500,
        flex: 1,
        cellRenderer: 'agGroupCellRenderer',
        cellRendererParams: {
          suppressCount: true,
        },
      },
      {
        field: 'active',
        headerName: 'Activo',
        editable: false,
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          return params.value
            ? '<i class="bi bi-check-circle-fill text-success"></i>'
            : '<i class="bi bi-x-circle-fill text-danger"></i>';
        },
      },
    ];
  }

  // Construir árbol desde datos planos
  buildTreeFromFlat(flatData: any[]): any[] {
    const map = new Map<number | string, any>();
    const roots: any[] = [];

    // Normalizar los datos y crear un mapa de todos los nodos
    flatData.forEach(item => {
      const normalizedItem = {
        ...item,
        parentId: item.parentId || item.parent_id || 0,
        children: []
      };
      map.set(normalizedItem.id, normalizedItem);
    });

    // Construir la jerarquía
    flatData.forEach(item => {
      const parentId = item.parentId || item.parent_id || 0;
      const node = map.get(item.id)!;

      if (parentId && parentId !== 0 && map.has(parentId)) {
        const parent = map.get(parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // Convertir árbol a formato plano con paths para AG Grid Tree Data
  flattenTreeWithPath(nodes: any[], parentPath: string[] = []): any[] {
    let result: any[] = [];

    nodes.forEach(node => {
      // Usar el ID como path único en lugar de la descripción
      const currentPath = [...parentPath, String(node.id)];
      const flatNode = {
        ...node,
        path: currentPath
      };

      result.push(flatNode);

      if (node.children && node.children.length > 0) {
        const childResults = this.flattenTreeWithPath(node.children, currentPath);
        result = result.concat(childResults);
      }
    });

    return result;
  }

  obtenerDatos() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!this.idRoot) {
      console.warn('No hay idRoot disponible');
      return;
    }

    this.loading = true;

    // Usar el endpoint getCatalogs con el tipo específico para ingresos de palacio
    this.catalogadmonService.getCatalogs(this.idRoot, 'INCOME').subscribe({
      next: (data: any) => {
        console.log('📊 Datos recibidos del backend:', data);
        this.catalogData = data || [];

        // Construir el árbol desde los datos planos
        const tree = this.buildTreeFromFlat(this.catalogData);
        console.log('🌲 Árbol construido:', tree);

        // Convertir el árbol a formato plano con paths
        this.treeData = this.flattenTreeWithPath(tree);
        console.log('📋 TreeData con paths:', this.treeData);

        this.loading = false;

        // Expandir el primer nivel después de cargar
        setTimeout(() => {
          if (this.gridApi) {
            this.gridApi.forEachNode(node => {
              if (node.level === 0) {
                node.setExpanded(true);
              }
            });
          }
        }, 100);
      },
      error: (error) => {
        console.error('Error fetching catálogo ingresos palacio:', error);
        this.catalogData = [];
        this.treeData = [];
        this.loading = false;
      },
    });
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Mostrar Listado de Catálogo Ingresos Palacio`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedItem = selectedNodes[0].data;
      this.selectedRowData = selectedNodes[0].data;
      console.log('✅ Item seleccionado:', this.selectedItem);
    } else {
      this.selectedItem = null;
      this.selectedRowData = null;
      console.log('❌ Sin selección');
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  openCreateModal(parent?: ICatalogTree): void {
    console.log('➕ Abriendo modal crear, padre:', parent);
    this.modalMode = 'create';
    this.modalParent = parent || null;
    this.modalEditingItem = null;

    // Resetear formulario con valores por defecto
    this.modalForm.reset({
      description: '',
      active: true
    });

    // Abrir modal
    const modalElement = document.getElementById('modalIngresosPalacio');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    } else {
      console.error('❌ Modal no encontrado: modalIngresosPalacio');
    }
  }

  openEditModal(item: ICatalogTree | null): void {
    console.log('✏️ Abriendo modal editar, item:', item);
    if (!item) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para editar', 'warning');
      return;
    }

    this.modalMode = 'edit';
    this.modalParent = null;
    this.modalEditingItem = item;

    // Cargar datos del item al formulario
    this.modalForm.patchValue({
      description: item.description || '',
      active: item.active
    });

    // Abrir modal
    const modalElement = document.getElementById('modalIngresosPalacio');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    } else {
      console.error('❌ Modal no encontrado: modalIngresosPalacio');
    }
  }

  async saveItem(): Promise<void> {
    if (this.modalForm.invalid) {
      alerts.basicAlert('Formulario inválido', 'Por favor complete todos los campos requeridos', 'warning');
      return;
    }

    this.saving = true;

    // Determinar parentId según el modo
    let parentId: number = 0;
    if (this.modalMode === 'create') {
      // Al crear: usar el padre seleccionado
      if (this.modalParent) {
        parentId = typeof this.modalParent.id === 'string'
          ? parseInt(this.modalParent.id, 10)
          : this.modalParent.id;
      }
    } else if (this.modalEditingItem) {
      // Al editar: mantener el parentId original
      const rawParentId = this.modalEditingItem.parentId || this.modalEditingItem.parent_id || 0;
      parentId = typeof rawParentId === 'string'
        ? parseInt(rawParentId, 10)
        : rawParentId;
    }

    const formData = {
      description: this.modalForm.value.description,
      active: this.modalForm.value.active,
      idCompany: this.idRoot,
      type: 'INCOME',
      parentId: parentId
    };

    console.log('💾 Guardando item:', { mode: this.modalMode, formData });

    try {
      if (this.modalMode === 'create') {
        // Crear nuevo item
        await lastValueFrom(this.catalogadmonService.addCatalog(formData));

        alerts.basicAlert(
          '¡Creado!',
          'El ingreso ha sido creado exitosamente',
          'success'
        );

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Crear Catálogo Ingresos Palacio`,
          'Menu Administración - Palacio Municipal',
          this.trackingService.getEmail()
        );
      } else {
        // Actualizar item existente
        const itemId = typeof this.modalEditingItem!.id === 'string'
          ? parseInt(this.modalEditingItem!.id, 10)
          : this.modalEditingItem!.id;
        await lastValueFrom(
          this.catalogadmonService.updateCatalog(itemId, formData)
        );

        alerts.basicAlert(
          '¡Actualizado!',
          'El ingreso ha sido actualizado exitosamente',
          'success'
        );

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Actualizar Catálogo Ingresos Palacio`,
          'Menu Administración - Palacio Municipal',
          this.trackingService.getEmail()
        );
      }

      // Cerrar modal
      const modalElement = document.getElementById('modalIngresosPalacio');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        modal?.hide();
      }

      // Recargar datos
      this.obtenerDatos();

    } catch (error) {
      console.error('Error al guardar item:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo guardar el ingreso. Por favor intente nuevamente.',
        'error'
      );
    } finally {
      this.saving = false;
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    // Verificar si tiene hijos (soportar parentId y parent_id)
    const hasChildren = this.catalogData.some(item => {
      const itemParentId = item.parentId || item.parent_id;
      return itemParentId === id;
    });

    if (hasChildren) {
      alerts.basicAlert(
        'Eliminar catálogo',
        'No se puede eliminar un elemento que tiene elementos hijos. Elimine primero los elementos hijos.',
        'warning'
      );
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar catálogo',
        '¿Está seguro que desea eliminar este catálogo de ingreso?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.catalogadmonService
            .deleteCatalog(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar catálogo',
                  'Error al eliminar el catálogo.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Catálogo eliminado',
                'El catálogo se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(
                this.trackingService.getnameComp(),
                `Borrar Registro de Catálogo Ingresos Palacio`,
                'Menu Administración - Palacio Municipal',
                this.trackingService.getEmail()
              );
              this.obtenerDatos();
              this.selectedRowData = null;
              this.selectedItem = null;
            });
        }
      });
  }

  revert() {
    this.obtenerDatos();
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Recargar Datos`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }
}
