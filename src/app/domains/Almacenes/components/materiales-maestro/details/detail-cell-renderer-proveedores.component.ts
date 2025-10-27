import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-detail-cell-renderer-proveedores',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule, AutocompleteEditorComponent],
  template: `
    <div
      style="padding: 10px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Proveedores de: {{ materialName }}</strong>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addProveedor()"
              [disabled]="!proveedorGridApi">
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveProveedores()"
              [disabled]="!hasProveedorChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasProveedorChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedProveedor()"
              [disabled]="!selectedProveedor">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="proveedorColumnDefs"
          [rowData]="proveedorRowData"
          [gridOptions]="proveedorGridOptions"
          [components]="components"
          (gridReady)="onProveedorGridReady($event)"
          (cellValueChanged)="onProveedorCellValueChanged($event)"
          (selectionChanged)="onProveedorSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererProveedoresComponent implements ICellRendererAngularComp {

  private customersService = inject(CustomersService);
  private branchsService = inject(BranchsService);
  private signalsService = inject(SignalsService);

  params: any;
  materialId: number;
  materialName: string;
  proveedorRowData: any[] = [];
  proveedorGridApi: any;
  selectedProveedor: any = null;
  hasProveedorChanges: boolean = false;

  // Catálogos
  providers: any[] = [];
  branches: any[] = [];
  idRoot: number;

  constructor(private currencyPipe: CurrencyPipe) {}

  proveedorGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single'
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent
  };

  proveedorColumnDefs = [
      {
        field: 'active',
        headerName: 'Principal',
        editable: true,
        width: 111,
      },

    {
      field: 'providerName',
      headerName: 'Proveedor',
      editable: true,
      width: 200,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        const values = this.providers ? this.providers.map((p: any) => `${p.name} ${p.description}`.trim()) : [];
        return {
          values: values
        };
      },
      valueGetter: (params: any) => {
        if (params.data.providerName) {
          return params.data.providerName;
        }
        if (params.data.idTabla) {
          const provider = this.providers.find((p: any) => p.id === params.data.idTabla);
          if (provider) {
            params.data.providerName = `${provider.name} ${provider.description}`.trim();
            return params.data.providerName;
          }
        }
        return '';
      },
      valueSetter: (params: any) => {
        const provider = this.providers.find((p: any) => `${p.name} ${p.description}`.trim() === params.newValue);
        if (provider) {
          params.data.idTabla = provider.id;
          params.data.providerName = `${provider.name} ${provider.description}`.trim();
        } else {
          params.data.providerName = params.newValue;
        }
        return true;
      }
    },
    {
      field: 'campo9',
      headerName: 'Precio Unitario',
      editable: true,
      width: 130,
      valueFormatter: (params: any) => {
        const isNumeric = params.value !== null && params.value !== '' && !isNaN(Number(params.value));
        return isNumeric ? this.currencyPipe.transform(params.value, '', 'symbol', '1.2-2') : '$0.00';
      },
      valueParser: (params: any) => {
        return Number(params.newValue) || 0;
      }
    },
    {
      field: 'campo2',
      headerName: 'Descripción Empaque',
      editable: true,
      width: 180,
      flex: 1
    },
    {
      field: 'campo3',
      headerName: 'Pieza x Paquete',
      editable: true,
      width: 120,
      valueParser: (params: any) => {
        return params.newValue || '';
      }
    },
    {
      field: 'campo4',
      headerName: 'Medidas',
      editable: true,
      width: 120,
      flex: 1
    },
    {
      field: 'campo5',
      headerName: 'Peso/Volumen',
      editable: true,
      width: 140
    },
    {
      field: 'campo6',
      headerName: 'Caducidad o Garantía(Meses)',
      editable: true,
      width: 160,
      flex: 1,
      valueParser: (params: any) => {
        return params.newValue || '';
      }
    },
    {
      field: 'branchName',
      headerName: 'Sucursal',
      editable: true,
      width: 150,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        const values = this.branches ? this.branches.map((b: any) => b.name) : [];
        return {
          values: values
        };
      },
      valueGetter: (params: any) => {
        if (params.data.branchName) {
          return params.data.branchName;
        }
        if (params.data.campo10) {
          const branch = this.branches.find((b: any) => b.id === params.data.campo10);
          if (branch) {
            params.data.branchName = branch.name;
            return params.data.branchName;
          }
        }
        return '';
      },
      valueSetter: (params: any) => {
        const branch = this.branches.find((b: any) => b.name === params.newValue);
        if (branch) {
          params.data.campo10 = branch.id;
          params.data.branchName = branch.name;
        } else {
          params.data.branchName = params.newValue;
        }
        return true;
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.insumo;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    this.loadProviders();
    this.loadBranches();
    this.loadProveedorData();
  }

  refresh(): boolean {
    return false;
  }

  loadProviders() {
    this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').subscribe({
      next: (data: any) => {
        this.providers = data;
        // Refrescar el grid para que los combos se actualicen con los proveedores
        if (this.proveedorGridApi) {
          this.proveedorGridApi.refreshCells({ force: true });
        }
      },
      error: (error) => {
        console.error('Error loading providers:', error);
        this.providers = [];
      }
    });
  }

  loadBranches() {
    this.branchsService.getBranches2fields(this.idRoot).subscribe({
      next: (data: any) => {
        this.branches = data;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.branches = [];
      }
    });
  }

  loadProveedorData() {
    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.load) {
      this.params.context.MATERIAL.load(this.materialId, 'MATERIAL', (data: any) => {
        this.proveedorRowData = data;
      });
    }
  }

  onProveedorGridReady(params: any) {
    this.proveedorGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedProveedor = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onProveedorCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasProveedorChanges = true;
  }

  onProveedorSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedProveedor = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addProveedor(): void {
    if (!this.proveedorGridApi) {
      console.error('Proveedor grid API not ready');
      return;
    }

    const tempId = `temp_proveedor_${Date.now()}`;
    const newProveedor = {
      id: tempId,
      campo1: this.materialId,  // ID del material
      idTabla: 0,              // ID del proveedor (se seleccionará)
      providerName: '',        // Nombre del proveedor (para mostrar en combo)
      campo2: '',              // Descripción empaque
      campo3: '',              // Pieza x paquete
      campo4: '',              // Medidas
      campo5: '',              // Peso/Volumen
      campo6: '',              // Caducidad/Garantía
      campo7: false,           // Campo oculto
      campo9: 0,               // Precio unitario
      campo10: 0,              // ID sucursal
      branchName: '',          // Nombre de sucursal (para mostrar en combo)
      type: 'MATERIAL',
      active: true,
      __isNew: true
    };

    this.proveedorRowData = [newProveedor, ...this.proveedorRowData];
    this.hasProveedorChanges = true;

    setTimeout(() => {
      this.proveedorGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'providerName'
      });
    }, 100);
  }

  saveProveedores() {
    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.save) {
      this.params.context.MATERIAL.save(this.materialId, this.proveedorRowData, 'MATERIAL');
      this.hasProveedorChanges = false;
    }
  }

  revertChanges() {
    this.loadProveedorData();
    this.hasProveedorChanges = false;
    this.selectedProveedor = null;
  }

  deleteSelectedProveedor(): void {
    if (!this.selectedProveedor || !this.params.context.MATERIAL.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.delete) {
      this.params.context.MATERIAL.delete(
        { data: this.selectedProveedor, api: this.proveedorGridApi },
        () => {
          this.loadProveedorData();
          this.selectedProveedor = null;
        }
      );
    }
  }
}
