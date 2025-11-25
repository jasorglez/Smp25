import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { MaterialsService } from 'app/services/materials.service';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-materiales',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `<!-- MEJORA: Añadir listeners para evitar que el panel se cierre al pasar el mouse sobre él -->
    <div
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Materiales (Solo Lectura) -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Materiales de: {{ providerName }}</strong>
          <div>
            <button
              class="btn btn-sm btn-primary me-2"
              (click)="refreshMaterials()"
            >
              <i class="bi bi-arrow-clockwise"></i> Actualizar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="materialColumnDefs"
          [rowData]="materialRowData"
          [gridOptions]="materialGridOptions"
          (gridReady)="onMaterialGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentMateriales implements ICellRendererAngularComp {
  private materialsService = inject(MaterialsService);
  authService = inject(AuthService);

  params: any;
  providerId: number;
  providerName: string;
  idRoot: number | null = null;

  // Material grid properties (Read-only)
  materialRowData: any[] = [];
  materialGridApi: any;

  materialGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressClickEdit: true,
    rowSelection: 'single',
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);
      params.api.autoSizeColumns(allColumnIds, false);
      console.log('Autosize completed');
    }
  };

  materialColumnDefs = [
    {
      field: 'codigo',
      headerName: 'Num. Material',
      editable: false,
      width: 100
    },
    {
      field: 'nombre',
      headerName: 'Articulo',
      editable: false,
      width: 150,
      flex: 1
    },
    {
      field: 'categoria',
      headerName: 'Categoría',
      width: 180,
      editable: false
    },
    {
      field: 'familia',
      headerName: 'Familia',
      width: 180,
      editable: false
    },
    {
      field: 'subfamilia',
      headerName: 'SubFamilia',
      width: 180,
      editable: false
    },
    {
      field: 'unidad',
      headerName: 'Sucursal',
      editable: false,
      width: 100
    },
    {
      field: 'precio',
      headerName: 'Precio Unitario',
      editable: false,
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      width: 120
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;

    // Obtener idRoot del contexto
    this.idRoot = this.params.context?.idRoot;

    // Cargar materiales directamente (no se necesitan catálogos en modo solo lectura)
    this.loadMaterialData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== MATERIAL GRID METHODS ==========
  onMaterialGridReady(params: any) {
    this.materialGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  async loadMaterialData(onComplete?: () => void) {
    try {
      // Cargar materiales reales desde el endpoint
      const materials = await lastValueFrom(
        this.materialsService.getMaterialsByProvider(this.providerId)
      );

      // Mapear los datos del endpoint al formato del grid
      this.materialRowData = materials.map(m => ({
        id: m.id,
        idTabla: m.idProvider,
        idMaterial: m.idMaterial,
        codigo: m.codigo,
        nombre: m.nombre,
        descripcion: m.nombre,
        idCategory: m.idCategory,
        categoria: m.categoria,
        idFamilia: m.idFamilia,
        familia: m.familia,
        idSubfamilia: m.idSubfamilia,
        subfamilia: m.subfamilia,
        unidad: 'Pieza', // TODO: Agregar a la vista cuando esté disponible
        precio: m.precio,
        vigente: m.vigente,
        type: 'MATERIAL',
        active: m.active,
        picture: m.picture
      }));

      console.log('✅ Materiales cargados desde endpoint:', this.materialRowData);

      // Refresh grid if exists
      if (this.materialGridApi) {
        this.materialGridApi.setGridOption('rowData', this.materialRowData);
      }

      // Ejecutar callback si existe
      if (onComplete) {
        setTimeout(() => onComplete(), 100);
      }
    } catch (error) {
      console.error('❌ Error cargando materiales:', error);
      this.materialRowData = [];
      if (this.materialGridApi) {
        this.materialGridApi.setGridOption('rowData', this.materialRowData);
      }
    }
  }

  refreshMaterials() {
    this.loadMaterialData();
  }
}