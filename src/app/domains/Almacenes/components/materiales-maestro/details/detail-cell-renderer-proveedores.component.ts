import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersService } from 'app/services/providers.service';
import { DetailCellRendererProveedorSucursalComponent } from './detail-cell-renderer-proveedor-sucursal.component';

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
        </ag-grid-angular> <!-- (cellClicked)="onCellClicked($event)" -->

      </div>
    </div>
  `
})
export class DetailCellRendererProveedoresComponent implements ICellRendererAngularComp {

  private customersService = inject(CustomersService);
  private branchsService = inject(BranchsService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);

  params: any;
  materialId: number;
  materialName: string;
  materialSubfamilyId: number; // ID de la subfamilia del material
  proveedorRowData: any[] = [];
  proveedorGridApi: any;
  selectedProveedor: any = null;
  hasProveedorChanges: boolean = false;

  // Catálogos
  providers: any[] = []; // Todos los proveedores
  filteredProviders: any[] = []; // Proveedores filtrados por subfamilia
  branches: any[] = [];
  idRoot: number;

  constructor(private currencyPipe: CurrencyPipe) {}

  // Helper para formatear nombre de proveedor sin "undefined"
  private getProviderDisplayName(provider: any): string {
    if (!provider) return '';
    const name = provider.name || '';
    const description = provider.description || '';
    return `${name} ${description}`.trim();
  }

  proveedorGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 300,
    isRowMaster: (dataItem: any) => {
      // Cada fila de proveedor puede tener un detalle de sucursal
      return true;
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'proveedorSucursal') {
        return { component: 'detailCellRendererProveedorSucursal' };
      }
      return undefined;
    },
    onCellClicked: this.onCellClicked.bind(this)
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRendererProveedorSucursal: DetailCellRendererProveedorSucursalComponent
  };

  proveedorColumnDefs = [
      {
        field: 'principal',
        headerName: 'Principal',
        editable: true,
        width: 111,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        onCellValueChanged: (params: any) => {
          // Si se marca como principal, desmarcar todos los demás
          if (params.newValue === true || params.newValue === 1) {
            this.proveedorRowData.forEach((row: any) => {
              if (row !== params.data) {
                row.principal = false;
                // Marcar como modificado si no es nuevo
                if (!row.__isNew) {
                  row.__modified = true;
                }
              }
            });
            // Marcar el actual como modificado si no es nuevo
            if (!params.data.__isNew) {
              params.data.__modified = true;
            }
            // Activar el botón de guardar
            this.hasProveedorChanges = true;
            // Refrescar el grid para mostrar los cambios
            if (this.proveedorGridApi) {
              this.proveedorGridApi.refreshCells({ force: true });
            }
            console.log('✅ Proveedor marcado como principal, los demás desmarcados');
          }
        }
      },

    {
      field: 'providerName',
      headerName: 'Proveedor',
      editable: true,
      width: 200,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        // Usar filteredProviders en lugar de providers
        const values = this.filteredProviders ? this.filteredProviders.map((p: any) => this.getProviderDisplayName(p)) : [];
        return {
          values: values
        };
      },
      valueGetter: (params: any) => {
        if (params.data.providerName) {
          return params.data.providerName;
        }
        if (params.data.idTabla) {
          // Buscar primero en filteredProviders, luego en providers (por si es un dato existente)
          const provider = this.filteredProviders.find((p: any) => p.id === params.data.idTabla)
                        || this.providers.find((p: any) => p.id === params.data.idTabla);
          if (provider) {
            params.data.providerName = this.getProviderDisplayName(provider);
            return params.data.providerName;
          }
        }
        return '';
      },
      valueSetter: (params: any) => {
        // Buscar en filteredProviders
        const provider = this.filteredProviders.find((p: any) => this.getProviderDisplayName(p) === params.newValue);
        if (provider) {
          params.data.idTabla = provider.id;
          params.data.providerName = this.getProviderDisplayName(provider);
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
      flex: 1,
      valueSetter: (params: any) => {
        params.data.campo2 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo3',
      headerName: 'Pieza x Paquete',
      editable: true,
      width: 120,
      valueSetter: (params: any) => {
        params.data.campo3 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo4',
      headerName: 'Medidas',
      editable: true,
      width: 120,
      flex: 1,
      valueSetter: (params: any) => {
        params.data.campo4 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo5',
      headerName: 'Peso/Volumen',
      editable: true,
      width: 140,
      valueSetter: (params: any) => {
        params.data.campo5 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo6',
      headerName: 'Caducidad o Garantía(Meses)',
      editable: true,
      width: 160,
      flex: 1,
      valueSetter: (params: any) => {
        params.data.campo6 = params.newValue ? params.newValue.toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'branchName',
      headerName: 'Sucursal',
      width: 150,
      flex: 1,
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params: any) => {
        // Mostrar siempre "Ver"
        const div = document.createElement('div');
        div.innerText = 'Ver';
        return div;
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.insumo;
    this.materialSubfamilyId = params.data.idSubfamilia; // CORRECTO: usar idSubfamilia, no idFamilia
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    console.log('🔍 Material init - TODOS LOS DATOS:');
    console.log('📋 params.data completo:', JSON.parse(JSON.stringify(params.data)));
    console.log('🔑 Campos extraídos:', {
      materialId: this.materialId,
      materialName: this.materialName,
      categoria: params.data.categoria,
      idCategory: params.data.idCategory,
      familia: params.data.familia,
      idFamilia: params.data.idFamilia,
      subfamilia: params.data.subfamilia,
      idSubfamilia: this.materialSubfamilyId,
      idRoot: this.idRoot
    });

    this.loadProviders();
    this.loadBranches();
    this.loadProveedorData();

    // Pasar el contexto del componente padre (MaterialesMaestroComponent) al siguiente nivel de detalle
    this.proveedorGridOptions.context = {
      ...params.context,
      componentParent: this // Ahora este componente es el padre del detalle de sucursal
    };
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    if (colId === 'branchName') {
      const node = event.node;
      const api = event.api;
      const detailType = 'proveedorSucursal';

      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        node.setExpanded(false);
      } else {
        // Colapsar cualquier otra fila de proveedor expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Asignar el tipo de detalle y expandir
        event.data.detailType = detailType;

        // Simular datos para el siguiente nivel
        event.data.sucursalDetailData = this.generateFakeSucursalData();

        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  refresh(): boolean {
    return false;
  }

  async loadProviders() {
    try {
      // 1. Cargar todos los proveedores vigentes
      const allProviders: any = await this.customersService.getCustomersByCompany(this.idRoot, 'PROVIDERS').toPromise();
      this.providers = allProviders.filter((p: any) => p.vigente === true || p.vigente === 1);

      console.log('📦 Total proveedores vigentes:', this.providers.length);

      // 2. Filtrar proveedores que manejan la subfamilia del material
      if (this.materialSubfamilyId) {
        console.log('🔍 Filtrando proveedores por subfamilyId:', this.materialSubfamilyId);

        try {
          // Obtener todos los proveedores y sus subfamilias asociadas
          const providerSubfamilyPromises = this.providers.map(async (provider: any) => {
            try {
              const subfamilies: any = await this.providersService.getSubfamilyxProviderByProvider(provider.id).toPromise();
              return {
                providerId: provider.id,
                providerName: this.getProviderDisplayName(provider),
                hasSubfamily: subfamilies.some((s: any) => s.idSubfamily === this.materialSubfamilyId)
              };
            } catch (error) {
              console.error(`Error obteniendo subfamilias del proveedor ${provider.id}:`, error);
              return { providerId: provider.id, providerName: this.getProviderDisplayName(provider), hasSubfamily: false };
            }
          });

          const results = await Promise.all(providerSubfamilyPromises);

          console.log('📊 Resultados de búsqueda:', results);

          const providerIdsWithSubfamily = results
            .filter(r => r.hasSubfamily)
            .map(r => r.providerId);

          console.log('🔑 IDs de proveedores que manejan la subfamilia:', providerIdsWithSubfamily);

          // Filtrar solo los proveedores que manejan la subfamilia del material
          this.filteredProviders = this.providers.filter(p => providerIdsWithSubfamily.includes(p.id));

          console.log('✅ Proveedores filtrados por subfamilia:', this.filteredProviders.length);
          console.log('📋 Lista de proveedores filtrados:', this.filteredProviders.map(p => this.getProviderDisplayName(p)));
        } catch (error) {
          console.error('❌ Error filtrando proveedores por subfamilia:', error);
          // Si hay error, mostrar todos los proveedores
          this.filteredProviders = this.providers;
        }
      } else {
        // Si no hay subfamilia, mostrar todos los proveedores
        this.filteredProviders = this.providers;
        console.log('⚠️ Material sin subfamilia, mostrando todos los proveedores');
      }

      // Refrescar el grid para que los combos se actualicen
      if (this.proveedorGridApi) {
        this.proveedorGridApi.refreshCells({ force: true });
      }

    } catch (error) {
      console.error('❌ Error loading providers:', error);
      this.providers = [];
      this.filteredProviders = [];
    }
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

  onGridReady(params: any) {
    this.proveedorGridApi = params.api;
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

    // Verificar si es el primer proveedor (tabla vacía)
    const isFirstProvider = this.proveedorRowData.length === 0;

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
      principal: isFirstProvider, // Si es el primero, marcar como principal
      __isNew: true
    };

    this.proveedorRowData = [newProveedor, ...this.proveedorRowData];
    this.hasProveedorChanges = true;

    if (isFirstProvider) {
      console.log('✅ Primer proveedor marcado automáticamente como principal');
    }

    setTimeout(() => {
      this.proveedorGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'providerName'
      });
    }, 100);
  }

  async saveProveedores() {
    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.save) {
      try {
        // Guardar los cambios
        await this.params.context.MATERIAL.save(this.materialId, this.proveedorRowData, 'MATERIAL');

        console.log('✅ Proveedores guardados, recargando datos...');

        // Esperar un poco para que el servidor procese
        await new Promise(resolve => setTimeout(resolve, 500));

        this.hasProveedorChanges = false;

        // Recargar datos desde el servidor para obtener IDs reales
        this.loadProveedorData();

        // Actualizar el contador de proveedores en el grid padre
        this.updateProviderCountInParent();

      } catch (error) {
        console.error('❌ Error al guardar proveedores:', error);
      }
    }
  }

  // Método para actualizar el contador de proveedores en el grid padre
  updateProviderCountInParent(): void {
    // Acceder al componente padre (MaterialesMaestroComponent) a través del contexto
    if (this.params && this.params.context && this.params.context.componentParent) {
      const parentComponent = this.params.context.componentParent;
      if (typeof parentComponent.updateProviderCount === 'function') {
        parentComponent.updateProviderCount(this.materialId);
        console.log('✅ Solicitada actualización de providerCount para material:', this.materialId);
      } else {
        console.warn('⚠️ El componente padre no tiene el método updateProviderCount');
      }
    } else {
      console.warn('⚠️ No se encontró el componente padre en el contexto');
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
          console.log('✅ Proveedor eliminado, recargando datos...');
          this.loadProveedorData();
          this.selectedProveedor = null;

          // Limpiar la bandera de cambios pendientes
          this.hasProveedorChanges = false;

          // Actualizar el contador de proveedores en el grid padre
          setTimeout(() => {
            this.updateProviderCountInParent();
          }, 500);
        }
      );
    }
  }

  private generateFakeSucursalData(): any[] {
    const sucursalNombres = ['BODEGAS', 'DELI', 'TIENDA 1'];
    const data = [];
    for (let i = 0; i < sucursalNombres.length; i++) {
      data.push({
        id: i + 1,
        sucursal: sucursalNombres[i],
        fechaAlta: new Date(2023, i, 15).toISOString().split('T')[0],
        stockMinimo: Math.floor(Math.random() * 50) + 10,
        resurtido: Math.floor(Math.random() * 100) + 20,
        capacidadMaxAlmacen: Math.floor(Math.random() * 500) + 200,
        tiempoDeEntrega: `${Math.floor(Math.random() * 5) + 1} días`,
        activo: Math.random() > 0.5
      });
    }
    return data;
  }
}
