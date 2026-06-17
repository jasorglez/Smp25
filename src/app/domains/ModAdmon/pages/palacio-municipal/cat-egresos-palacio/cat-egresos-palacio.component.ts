import { Component, HostListener, inject, ChangeDetectorRef} from '@angular/core';
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
  path?: string[];
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-cat-egresos-palacio',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './cat-egresos-palacio.component.html',
  styleUrl: './cat-egresos-palacio.component.scss',
})
export class CatEgresosPalacioComponent {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private catalogadmonService = inject(CatalogadmonService);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);
  invited: boolean = false;

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
    this.invited = this.signalsService.getInvited()();
  }

  catalogData: any[] = [];
  treeData: ICatalogTree[] = [];
  loading: boolean = false;
  newlyAddedRows: string[] = [];

  selectedRowData: any = null;
  selectedItem: ICatalogTree | null = null;

  idRoot: number;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

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
    getDataPath: (data: any) => data.path,
    groupDisplayType: 'groupRows',
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never',
    suppressRowClickSelection: true,
    rowDragManaged: true,
    rowDragEntireRow: true,
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
    onCellValueChanged: this.onCellValueChanged.bind(this),
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
    onRowDragEnd: this.onRowDragEnd.bind(this),
  };

  get colMaster(): ColDef[] {
    return [
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
        rowDrag: true,
        onCellDoubleClicked: (event: any) => {
          if (event.data && !this.invited) {
            this.openEditModal(event.data);
          }
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
  flattenTreeWithPath(nodes: any[], parentPath: string[] = [], level: number = 0): any[] {
    let result: any[] = [];

    nodes.forEach(node => {
      // Usar la descripción como path
      const currentPath = [...parentPath, node.description];

      // Preservar TODOS los campos del nodo original
      const flatNode = {
        id: node.id,
        idCompany: node.idCompany,
        description: node.description,
        type: node.type,
        parentId: node.parentId,
        parent_id: node.parent_id,
        active: node.active,
        path: currentPath,
        children: node.children,
        __isNew: node.__isNew,
        __modified: node.__modified
      };

      result.push(flatNode);

      if (node.children && node.children.length > 0) {
        const childResults = this.flattenTreeWithPath(node.children, currentPath, level + 1);
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

    // Usar el endpoint getCatalogs con el tipo EXPENSE para egresos de palacio
    this.catalogadmonService.getCatalogs(this.idRoot, 'EXPENSE').subscribe({
      next: (data: any) => {
        this.catalogData = data || [];

        // Construir el árbol desde los datos planos
        const tree = this.buildTreeFromFlat(this.catalogData);

        // Convertir el árbol a formato plano con paths
        this.treeData = this.flattenTreeWithPath(tree);
        // Ordenar por id para mantener el orden del backend
        this.treeData.sort((a, b) => {
          const aId = typeof a.id === 'string' ? parseInt(a.id, 10) : a.id;
          const bId = typeof b.id === 'string' ? parseInt(b.id, 10) : b.id;
          return aId - bId;
        });

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
        console.error('Error fetching catálogo egresos palacio:', error);
        this.catalogData = [];
        this.treeData = [];
        this.loading = false;
      },
    });
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Mostrar Listado de Catálogo Egresos Palacio`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedItem = selectedNodes[0].data;
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedItem = null;
      this.selectedRowData = null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
  }

  onCellDoubleClicked(event: CellDoubleClickedEvent) {
    if (event.data) {
      this.openEditModal(event.data);
    }
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      type: 'EXPENSE',
      parentId: 0,
      active: true,
      path: [tempId],
      __isNew: true,
    };

    this.treeData = [newItem, ...this.treeData];
    this.newlyAddedRows.push(tempId);

    // Start editing the new row
    setTimeout(() => {
      if (this.gridApi) {
        const rowNode = this.gridApi.getDisplayedRowAtIndex(0);
        rowNode?.setSelected(true);
        this.gridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'description',
        });
      }
    }, 50);
  }

  openCreateModal(parent?: ICatalogTree): void {
    this.modalMode = 'create';
    this.modalParent = parent || null;
    this.modalEditingItem = null;

    // Resetear formulario con valores por defecto
    this.modalForm.reset({
      description: '',
      active: true
    });

    // Abrir modal
    const modalElement = document.getElementById('modalEgresosPalacio');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  openEditModal(item: ICatalogTree | null): void {
    if (!item) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para editar', 'warning');
      return;
    }

    this.modalMode = 'edit';
    this.modalParent = null;
    this.modalEditingItem = item;

    // Normalizar el valor de active a booleano
    const activeValue = typeof item.active === 'number'
      ? item.active === 1
      : Boolean(item.active);

    // Cargar datos del item al formulario
    this.modalForm.patchValue({
      description: item.description || '',
      active: activeValue
    });

    // Abrir modal
    const modalElement = document.getElementById('modalEgresosPalacio');
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
      type: 'EXPENSE',
      parentId: parentId
    };

    try {
      if (this.modalMode === 'create') {
        // Crear nuevo item
        await lastValueFrom(this.catalogadmonService.addCatalog(formData));

        alerts.basicAlert(
          '¡Creado!',
          'El egreso ha sido creado exitosamente',
          'success'
        );

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Crear Catálogo Egresos Palacio`,
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
          'El egreso ha sido actualizado exitosamente',
          'success'
        );

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Actualizar Catálogo Egresos Palacio`,
          'Menu Administración - Palacio Municipal',
          this.trackingService.getEmail()
        );
      }

      // Cerrar modal
      const modalElement = document.getElementById('modalEgresosPalacio');
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
        'No se pudo guardar el egreso. Por favor intente nuevamente.',
        'error'
      );
    } finally {
      this.saving = false;
    }
  
    this.cdr.detectChanges();}

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
        '¿Está seguro que desea eliminar este catálogo de egreso?',
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
                `Borrar Registro de Catálogo Egresos Palacio`,
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

  async saveChanges() {
    const newRows = this.treeData.filter((row) => row.__isNew);
    const modifiedRows = this.treeData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.catalogadmonService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      const itemId = typeof row.id === 'string' ? parseInt(row.id, 10) : row.id;
      return this.catalogadmonService.updateCatalog(itemId, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  async onRowDragEnd(event: any): Promise<void> {
    const draggedNode = event.node;
    const overNode = event.overNode;

    // Validar que tenemos nodos válidos
    if (!draggedNode || !draggedNode.data || !overNode || !overNode.data) {
      return;
    }

    const draggedItem = draggedNode.data;
    const targetItem = overNode.data;

    // Si ya está en ese padre, no hacer nada
    if (draggedItem.parentId === targetItem.id) {
      return;
    }

    // Validar que no se está arrastrando a sí mismo
    if (draggedItem.id === targetItem.id) {
      alerts.basicAlert(
        'Operación no permitida',
        'No puede arrastrar un elemento sobre sí mismo',
        'warning'
      );
      return;
    }

    // Validar que no se está arrastrando a uno de sus propios hijos
    const isDescendant = this.isDescendantOf(targetItem.id, draggedItem.id);
    if (isDescendant) {
      alerts.basicAlert(
        'Operación no permitida',
        'No puede arrastrar un elemento dentro de uno de sus propios hijos',
        'warning'
      );
      return;
    }

    // Confirmar la operación
    const result = await alerts.confirmAlert(
      '¿Mover egreso?',
      `¿Desea mover "${draggedItem.description}" bajo "${targetItem.description}"?`,
      'question',
      'Sí, mover'
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      // Actualizar el parentId del item arrastrado
      const updateData = {
        description: draggedItem.description,
        type: draggedItem.type || 'EXPEND',
        parentId: targetItem.id, // Nuevo padre
        active: draggedItem.active,
        idCompany: this.idRoot
      };

      await lastValueFrom(
        this.catalogadmonService.updateCatalog(draggedItem.id, updateData)
      );

      alerts.basicAlert(
        '¡Movido!',
        `El egreso "${draggedItem.description}" se ha movido exitosamente bajo "${targetItem.description}"`,
        'success'
      );

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Reordenar Catálogo Egresos Palacio (Drag & Drop)`,
        'Menu Administración - Palacio Municipal',
        this.trackingService.getEmail()
      );

      // Recargar datos para reflejar el cambio
      this.obtenerDatos();

    } catch (error) {
      console.error('❌ Error al mover item:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo mover el egreso. Por favor intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  // Método auxiliar para verificar si targetId es descendiente de itemId
  private isDescendantOf(targetId: number, itemId: number): boolean {
    const findDescendant = (data: any[], id: number): boolean => {
      for (const item of data) {
        if (item.id === id) {
          return true;
        }
        if (item.children && item.children.length > 0) {
          if (findDescendant(item.children, id)) {
            return true;
          }
        }
      }
      return false;
    };

    // Buscar el item arrastrado
    const draggedItem = this.catalogData.find(item => item.id === itemId);
    if (!draggedItem) return false;

    // Construir árbol temporal para buscar descendientes
    const tree = this.buildTreeFromFlat(this.catalogData);

    // Buscar en el árbol si targetId es descendiente de itemId
    const findItemInTree = (nodes: any[], id: number): any => {
      for (const node of nodes) {
        if (node.id === id) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findItemInTree(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const itemNode = findItemInTree(tree, itemId);
    if (!itemNode || !itemNode.children) return false;

    return findDescendant(itemNode.children, targetId);
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

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.path;
    delete cleanedData.children;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}
