import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { MaterialsService } from 'app/services/materials.service';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MaterialesMaestroComponent } from 'app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';

@Component({
  selector: 'app-detalles-materialexprov',
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
export class DetallesMaterialexprovComponent implements ICellRendererAngularComp {
  private materialsService = inject(MaterialsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private modalService = inject(NgbModal);
  private signalsService = inject(SignalsService);
  private branchsService = inject(BranchsService);
  authService = inject(AuthService);

  params: any;
  providerId: number;
  providerName: string;
  idRoot: number | null = null;

  branchMap: Map<number, string> = new Map();

  // Material grid properties (Read-only)
  materialRowData: any[] = [];
  materialGridApi: any;

  materialGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressClickEdit: true,
    rowSelection: 'single',
    onCellDoubleClicked: (event: any) => {
      this.openMaterialModal(event.data);
    },
    onFirstDataRendered: (params) => {

      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      params.api.autoSizeColumns(allColumnIds, false);
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
      field: 'sucursal',
      headerName: 'Sucursal',
      editable: false,
      width: 120
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
  
    this.cdr.detectChanges();}

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
      // Cargar branches primero
      if (this.idRoot) {
        const branches = await lastValueFrom(
          this.branchsService.getBranches(this.idRoot)
        );
        branches.forEach((b: any) => {
          this.branchMap.set(b.id, b.name);
        });
      }

      // Cargar materiales reales desde el endpoint
      const materials = await lastValueFrom(
        this.materialsService.getMaterialsByProvider(this.providerId)
      );

      // Mapear los datos del endpoint al formato del grid
      this.materialRowData = materials.map((m: any) => ({
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
        idSucursal: m.idSucursal,
        sucursal: m.idSucursal ? (this.branchMap.get(Number(m.idSucursal)) || 'Sucursal ' + m.idSucursal) : '',
        unidad: 'Pieza',
        precio: m.precio,
        vigente: m.vigente,
        type: 'MATERIAL',
        active: m.active,
        picture: m.picture
      }));


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

  // ✅ Método para abrir el modal con MaterialesMaestroComponent
  openMaterialModal(materialData: any) {

    // ✅ Intentar obtener idRoot de múltiples fuentes
    let rootId = this.params.context?.idRoot || this.idRoot;

    // Si aún no hay idRoot, intentar obtenerlo de la señal
    if (!rootId) {
      rootId = this.signalsService.getRootSelectedBySidebar()();
    }

    if (!rootId) {
      console.error('❌ No se puede abrir el modal: idRoot no está disponible');
      console.error('   Intentado desde: params.context, this.idRoot, y señal');
      return;
    }

    // ✅ Usar idMaterial si existe, si no usar id
    const materialId = materialData.idMaterial || materialData.id;

    const modalRef = this.modalService.open(MaterialesMaestroComponent, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false
    });

    // Pasar los inputs al componente del modal
    modalRef.componentInstance.isModalMode = true;
    modalRef.componentInstance.filterMaterialId = materialId;
    modalRef.componentInstance.idRootInput = rootId;


    // Suscribirse al evento de guardado completo
    modalRef.componentInstance.onSaveComplete.subscribe(() => {
      this.loadMaterialData();
    });
  }
}
