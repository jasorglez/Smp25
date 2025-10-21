import { Component, OnInit, inject } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { alerts } from 'app/helpers/alerts';
import { DetailCellRendererProveedoresComponent } from './details/detail-cell-renderer-proveedores.component';
import { DetailCellRendererFamiliaComponent } from './details/detail-cell-renderer-familia.component';
import { DetailCellRendererSucursalComponent } from './details/detail-cell-renderer-sucursal.component';
import { ModalMaterialComponent } from './modal-material/modal-material.component';
import { MaterialsService } from 'app/services/materials.service';
import { MaterialsResponse } from 'app/interface/materials.interface';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DetailCellRendererProveedoresComponent,
    DetailCellRendererFamiliaComponent,
    DetailCellRendererSucursalComponent
  ],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements OnInit {

  private gridApi!: GridApi;
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);

  rowData: MaterialsResponse[] = [];
  gridHeight: string = '80vh';
  selectedMaterial: MaterialsResponse | null = null;
  hasUnsavedChanges: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor(private modalService: NgbModal) {}

  ngOnInit() {
    this.loadMaterials();
  }

  loadMaterials() {
    const idRoot = this.signalsService.company().id;
    this.materialsService.getMaterialsxview(idRoot).subscribe({
      next: (data) => {
        this.rowData = data;
        console.log('Materials loaded:', data);
      },
      error: (error) => {
        console.error('Error loading materials:', error);
        alerts.basicAlert('Error', 'Error al cargar materiales', 'error');
      }
    });
  }


  components = {
    detailCellRendererProveedores: DetailCellRendererProveedoresComponent,
    detailCellRendererFamilia: DetailCellRendererFamiliaComponent,
    detailCellRendererSucursal: DetailCellRendererSucursalComponent
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    suppressClickEdit: true,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true; // Todas las filas son maestras
    },
    detailCellRendererSelector: (params) => {
      if (params.data.detailType === 'proveedores') {
        return { component: 'detailCellRendererProveedores' };
      } else if (params.data.detailType === 'familia') {
        return { component: 'detailCellRendererFamilia' };
      } else if (params.data.detailType === 'sucursal') {
        return { component: 'detailCellRendererSucursal' };
      }
      return undefined;
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'active',
        headerName: 'Activo',
        width: 100,
        cellRenderer: (params: any) => {
          const checked = params.data.active ? 'checked' : '';
          return `<input type="checkbox" ${checked} disabled style="cursor: pointer;">`;
        }
      },
      {
        field: 'insumo',
        headerName: 'Num Mat',
        width: 130,
        filter: true
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 250,
        filter: true
      },
      {
        field: 'categoria',
        headerName: 'Categoria',
        width: 250,
        filter: true
      },
      {
        field: 'familia',
        headerName: 'Familia',
        width: 150,
        filter: true
      },
      {
        field: 'subfamilyCount',
        headerName: 'Subfamilia',
        width: 150,
        filter: true,
        cellRenderer: (params: any) => {
          return `${params.data.subfamilia} (${params.value})`;
        },
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'providerCount',
        headerName: 'Proveedor',
        width: 200,
        filter: true,
        cellRenderer: (params: any) => {
          return `${params.value} proveedor${params.value !== 1 ? 'es' : ''}`;
        },
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'picture',
        headerName: 'Imagen',
        width: 100,
        cellRenderer: (params: any) => {
          return params.value ? '📷 Ver' : '📷 Subir';
        }
      }
    ];
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'providerCount') return 'proveedores';
    if (colId === 'subfamilyCount') return 'familia';
    return null;
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');

      switch (detailType) {
        case 'proveedores':
          div.innerText = params.value || '';
          break;
        case 'familia':
          div.innerText = params.value || '';
          break;
      }

      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';

      return div;
    };
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'providerCount' || colId === 'subfamilyCount';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;
      const detailType = this.getDetailTypeFromColId(colId);

      // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        // Mostrar todas las filas de nuevo
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== detailType) {
          node.setExpanded(false);
        }

        // Cambiar el tipo de detalle
        event.data.detailType = detailType;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedMaterial = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addMaterial(): void {
    const modalRef = this.modalService.open(ModalMaterialComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.isEdit = false;

    modalRef.result.then(
      (newMaterial) => {
        if (newMaterial) {
          this.rowData = [...this.rowData, newMaterial];
          this.hasUnsavedChanges = true;
        }
      },
      () => { }
    );
  }

  editMaterial(): void {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para editar', 'warning');
      return;
    }

    const modalRef = this.modalService.open(ModalMaterialComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.material = { ...this.selectedMaterial };
    modalRef.componentInstance.isEdit = true;

    modalRef.result.then(
      (updatedMaterial) => {
        if (updatedMaterial) {
          const index = this.rowData.findIndex(m => m.id === updatedMaterial.id);
          if (index !== -1) {
            this.rowData[index] = updatedMaterial;
            this.rowData = [...this.rowData]; // Trigger change detection
            this.hasUnsavedChanges = true;
          }
        }
      },
      () => { }
    );
  }

  async deleteMaterial(): Promise<void> {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar material?',
      `¿Está seguro de eliminar el material ${this.selectedMaterial.numMat} - ${this.selectedMaterial.articulo}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      // Eliminar del array de datos
      this.rowData = this.rowData.filter(m => m.id !== this.selectedMaterial.id);
      this.selectedMaterial = null;
      this.hasUnsavedChanges = true;
      alerts.basicAlert('Eliminado', 'El material ha sido eliminado', 'success');
    }
  }

  saveChanges(): void {
    if (!this.hasUnsavedChanges) {
      return;
    }
    // TODO: Guardar cambios en el servidor
    alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
    this.hasUnsavedChanges = false;
  }

  refreshData(): void {
    this.loadMaterials();
    this.selectedMaterial = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }
}
