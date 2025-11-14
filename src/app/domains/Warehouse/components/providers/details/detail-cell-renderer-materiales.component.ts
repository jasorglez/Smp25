import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CustomersService } from 'app/services/customers.service';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detail-cell-renderer-materiales',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `<!-- MEJORA: Añadir listeners para evitar que el panel se cierre al pasar el mouse sobre él -->
    <div
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Materiales -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Materiales de: {{ providerName }}</strong>
          <div>
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addMaterial()"
              [disabled]="!materialGridApi"
            >
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2"
              (click)="saveMaterials()"
              [disabled]="!hasMaterialChanges"
            >
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="refreshMaterials()"
            >
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedMaterial()"
              [disabled]="!selectedMaterial"
            >
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="materialColumnDefs"
          [rowData]="materialRowData"
          [gridOptions]="materialGridOptions"
          (gridReady)="onMaterialGridReady($event)"
          (cellValueChanged)="onMaterialCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentMateriales implements ICellRendererAngularComp {
  private customersService = inject(CustomersService);
  authService = inject(AuthService);

  params: any;
  providerId: number;
  providerName: string;

  // Material grid properties
  materialRowData: any[] = [];
  hasMaterialChanges: boolean = false;
  materialGridApi: any;
  selectedMaterial: any = null;

  // Cascading data
  categories: any[] = [];
  subcategories: any[] = [];
  units: any[] = [];

  materialGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
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
      field: 'vigente',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 70,
      onCellValueChanged: (params: any) => {
        params.data.__modified = true;
        this.hasMaterialChanges = true;
      }
    },
    {
      field: 'codigo',
      headerName: 'Num. Material',
      editable: (params) => params.data.__isNew || true,
      width: 100
    },
    {
      field: 'nombre',
      headerName: 'Articulo',
      editable: true,
      width: 150,
      flex: 1
    },
    
    {
      field: 'categoria',
      headerName: 'Categoría',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Electrónica', 'Mecánica', 'Química', 'Textil', 'Construcción', 'Automotriz']
      },
      width: 120,
      onCellValueChanged: (params: any) => {
        // Cascade to subcategory
        this.updateSubcategories(params.newValue);
        params.data.subcategoria = '';
        this.materialGridApi?.refreshCells({
          rowNodes: [params.node],
          columns: ['subcategoria'],
          force: true
        });
        params.data.__modified = true;
        this.hasMaterialChanges = true;
      }
    },
    {
      field: 'familia',
      headerName: 'Familia',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => ({
        values: this.getSubcategoriesForCategory(params.data.categoria)
      }),
      width: 130,
      onCellValueChanged: (params: any) => {
        params.data.__modified = true;
        this.hasMaterialChanges = true;
      }
    },
     
    {
      field: 'familia',
      headerName: 'SubFamilia',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => ({
        values: this.getSubcategoriesForCategory(params.data.categoria)
      }),
      width: 130,
      onCellValueChanged: (params: any) => {
        params.data.__modified = true;
        this.hasMaterialChanges = true;
      }
    },
    {
      field: 'unidad',
      headerName: 'Sucursal',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      width: 100
    },
    {
      field: 'precio',
      headerName: 'Precio Unitario',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      width: 120
    }
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;

    // Load fake data for materials
    this.loadMaterialData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== MATERIAL GRID METHODS ==========
  onMaterialGridReady(params: any) {
    this.materialGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedMaterial = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onMaterialCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasMaterialChanges = true;
  }

  loadMaterialData() {
    // Generate fake data for materials
    const fakeMaterials = this.generateFakeMaterials();
    this.materialRowData = fakeMaterials;

    // Refresh grid if exists
    if (this.materialGridApi) {
      this.materialGridApi.setGridOption('rowData', this.materialRowData);
    }
  }

  private generateFakeMaterials(): any[] {
    const categories = ['Electrónica', 'Mecánica', 'Química', 'Textil', 'Construcción', 'Automotriz'];
    const subcategories = {
      'Electrónica': ['Circuitos', 'Sensores', 'Baterías', 'Cables'],
      'Mecánica': ['Engranajes', 'Ejes', 'Rodamientos', 'Sellos'],
      'Química': ['Ácidos', 'Bases', 'Solventes', 'Catalizadores'],
      'Textil': ['Telas', 'Hilos', 'Tintes', 'Aditivos'],
      'Construcción': ['Cemento', 'Acero', 'Madera', 'Vidrio'],
      'Automotriz': ['Frenos', 'Motor', 'Suspensión', 'Eléctrica']
    };
    const units = ['Pieza', 'Kg', 'Litro', 'Metro', 'Caja', 'Paquete'];
    const names = [
      'Resistor 10K', 'Capacitor 100uF', 'Tornillo M8', 'Acido Sulfúrico', 'Tela Algodón',
      'Cemento Portland', 'Batería 12V', 'Engranaje Helicoidal', 'Solvente Orgánico', 'Cable USB'
    ];

    const materials = [];
    const count = Math.floor(Math.random() * 8) + 3; // 3-10 materials

    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const subcategory = subcategories[category][Math.floor(Math.random() * subcategories[category].length)];
      const unit = units[Math.floor(Math.random() * units.length)];
      const price = Math.floor(Math.random() * 1000) + 10;

      materials.push({
        id: `mat_${this.providerId}_${i + 1}`,
        idTabla: this.providerId,
        codigo: `MAT${String(i + 1).padStart(3, '0')}`,
        nombre: names[Math.floor(Math.random() * names.length)],
        descripcion: `Descripción del material ${i + 1}`,
        categoria: category,
        subcategoria: subcategory,
        unidad: unit,
        precio: price,
        vigente: Math.random() > 0.2, // 80% active
        type: 'MATERIAL',
        active: true
      });
    }

    return materials;
  }

  private getSubcategoriesForCategory(category: string): string[] {
    const subcategories = {
      'Electrónica': ['Circuitos', 'Sensores', 'Baterías', 'Cables'],
      'Mecánica': ['Engranajes', 'Ejes', 'Rodamientos', 'Sellos'],
      'Química': ['Ácidos', 'Bases', 'Solventes', 'Catalizadores'],
      'Textil': ['Telas', 'Hilos', 'Tintes', 'Aditivos'],
      'Construcción': ['Cemento', 'Acero', 'Madera', 'Vidrio'],
      'Automotriz': ['Frenos', 'Motor', 'Suspensión', 'Eléctrica']
    };
    return subcategories[category] || [];
  }

  private updateSubcategories(category: string) {
    // This would be used for dynamic cascading, but for now static
  }

  refreshMaterials() {
    this.loadMaterialData();
    this.hasMaterialChanges = false;
  }

  addMaterial() {
    if (!this.materialGridApi) {
      console.error('Material grid API not ready');
      return;
    }

    const tempId = `temp_material_${Date.now()}`;
    const newMaterial = {
      id: tempId,
      idTabla: this.providerId,
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: '',
      subcategoria: '',
      unidad: '',
      precio: 0,
      vigente: true,
      type: 'MATERIAL',
      active: true,
      __isNew: true
    };

    this.materialRowData = [newMaterial, ...this.materialRowData];
    this.hasMaterialChanges = true;

    // Refresh grid
    if (this.materialGridApi) {
      this.materialGridApi.setGridOption('rowData', this.materialRowData);
    }

    setTimeout(() => {
      this.materialGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'codigo'
      });
    }, 100);
  }

  async saveMaterials() {
    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.save) {
      try {
        await this.params.context.MATERIAL.save(this.providerId, this.materialRowData, 'MATERIAL');

        await new Promise(resolve => setTimeout(resolve, 500));

        this.hasMaterialChanges = false;

        // Reload data
        this.loadMaterialData();

        // Update material count in parent
        await this.updateMaterialCountInParent();

      } catch (error) {
        console.error('Error saving materials:', error);
      }
    }
  }

  deleteSelectedMaterial() {
    if (!this.selectedMaterial || !this.params.context.MATERIAL.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.delete) {
      this.params.context.MATERIAL.delete(
        { data: this.selectedMaterial, api: this.materialGridApi },
        async () => {
          this.loadMaterialData();
          this.selectedMaterial = null;

          // Update count
          await this.updateMaterialCountInParent();
        }
      );
    }
  }

  // Update material count in parent grid
  private async updateMaterialCountInParent(): Promise<void> {
    try {
      console.log('Updating material count in parent grid...');

      await new Promise(resolve => setTimeout(resolve, 300));

      const materialCount = this.materialRowData.length;
      console.log('Total materials in memory:', materialCount);

      this.params.data.fieldMaterial = materialCount;

      if (this.params.api) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: ['fieldMaterial'],
          force: true
        });

        console.log('Material count updated in parent grid:', this.params.data.fieldMaterial);
      }

    } catch (error) {
      console.error('Error updating material count:', error);
    }
  }
}