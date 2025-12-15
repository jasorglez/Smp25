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
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';

interface ICatalogTree {
  id: number | string;
  idCompany: number;
  description: string;
  type: string;
  parentId: number;
  active: number | boolean;
  children?: ICatalogTree[];
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-cat-ingresos-palacio',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    MultiLineEditorComponent,
  ],
  templateUrl: './cat-ingresos-palacio.component.html',
  styleUrl: './cat-ingresos-palacio.component.scss',
})
export class CatIngresosPalacioComponent implements CanComponentDeactivate {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private catalogadmonService = inject(CatalogadmonService);

  constructor() {
    this.obtenerDatos();
  }

  private trackingService = inject(TrackingService);

  ngOnInit() {
    // Cargar datos cuando cambie el root
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  catalogData: any[] = [];
  treeData: ICatalogTree[] = [];

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;

  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  private modalServiceTable = inject(ModalService);

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
        editable: true,
        minWidth: 500,
        flex: 1,
        cellRenderer: 'agGroupCellRenderer',
        cellRendererParams: {
          suppressCount: true,
        },
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 200,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
      },
      {
        field: 'active',
        headerName: 'Activo',
        editable: true,
        width: 100,
        cellEditor: 'agCheckboxCellEditor',
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
    const map = new Map<number, any>();
    const roots: any[] = [];

    // Primero crear un mapa de todos los nodos
    flatData.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    // Luego construir la jerarquía
    flatData.forEach(item => {
      const node = map.get(item.id)!;

      if (item.parentId && item.parentId !== 0 && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
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
      const currentPath = [...parentPath, node.description];
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

    // Usar el endpoint getCatalogs con el tipo específico para ingresos de palacio
    this.catalogadmonService.getCatalogs(this.idRoot, 'INCOME').subscribe({
      next: (data: any) => {
        this.catalogData = data || [];

        // Construir el árbol desde los datos planos
        const tree = this.buildTreeFromFlat(this.catalogData);

        // Convertir el árbol a formato plano con paths
        this.treeData = this.flattenTreeWithPath(tree);
      },
      error: (error) => {
        console.error('Error fetching catálogo ingresos palacio:', error);
        this.catalogData = [];
        this.treeData = [];
      },
    });
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Mostrar Listado de Catálogo Ingresos Palacio`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      type: 'INCOME',
      description: '',
      parentId: 0,
      active: true,
      __isNew: true,
    };

    // Agregar al array plano
    this.catalogData = [newItem, ...this.catalogData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Reconstruir el árbol
    const tree = this.buildTreeFromFlat(this.catalogData);
    this.treeData = this.flattenTreeWithPath(tree);

    setTimeout(() => {
      // Encontrar la fila agregada y comenzar a editarla
      this.gridApi.forEachNode((node, index) => {
        if (node.data.id === tempId) {
          this.gridApi.startEditingCell({
            rowIndex: node.rowIndex!,
            colKey: 'description',
          });
        }
      });
    }, 100);
  }

  async saveChanges() {
    const isValid = this.catalogData.every((item) => item.description && item.description.trim() !== '');
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar el campo de descripción antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.catalogData.filter((row) => row.__isNew);
    const modifiedRows = this.catalogData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.catalogadmonService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.catalogadmonService.updateCatalog(row.id, cleanedData);
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
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Agregar/Actualizar Catálogo Ingresos Palacio`,
        'Menu Administración - Palacio Municipal',
        this.trackingService.getEmail()
      );

      this.notSavedChanges = false;
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

    // Verificar si tiene hijos
    const hasChildren = this.catalogData.some(item => item.parentId === id);
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
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Cancelación del Registro`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.consecutivo;
    delete cleanedData.path;
    delete cleanedData.children;

    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }

    // Asegurar que tenga los campos correctos
    cleanedData.idCompany = this.idRoot;
    cleanedData.type = 'INCOME';

    return cleanedData;
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
