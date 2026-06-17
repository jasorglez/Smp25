import { Component, inject, OnDestroy, Renderer2, RendererFactory2, ChangeDetectorRef} from '@angular/core';
import { Subscription } from 'rxjs';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { BranchsService } from 'app/services/branchs.service';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersService } from 'app/services/providers.service';
import { MaterialsService } from 'app/services/materials.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { DetallesSucursalesProveedorComponent } from './detalles-sucursalesproveedor.component';
import { DetalleEmpaqueProveedorComponent } from './detalle-empaque-proveedor.component';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { firstValueFrom } from 'rxjs';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { EmpaqueMedidaService } from 'app/services/empaque-medida.service';
import { EmpaquePesoVolumenService } from 'app/services/empaque-peso-volumen.service';
import { EmpaqueDescripcionService } from 'app/services/empaque-descripcion.service';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { PendingChangesService } from 'app/services/pending-changes.service';
import { CurrencyService } from 'app/services/currency.service';
import { PrecioMonedaEditorComponent, MonedaOpt } from '../editors/precio-moneda-editor.component';

@Component({
  selector: 'app-detalle-asignproveeds-matmaestro',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule, AutocompleteEditorComponent, PrecioMonedaEditorComponent],
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
            <!-- Guardar centralizado en Nivel 1 (materiales-maestro). Ver PendingChangesService. -->
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
          (cellEditingStopped)="onProveedorCellEditingStopped($event)"
          (selectionChanged)="onProveedorSelectionChanged($event)">
        </ag-grid-angular> <!-- (cellClicked)="onCellClicked($event)" -->

      </div>
    </div>
  `,
  styles: [`
    /* Min. Compras: sin icono de filtro; menú de columna (⋯) alineado a la derecha */
    :host ::ng-deep .ag-header-cell[col-id="minCompra"] .ag-header-cell-comp-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
    }
    :host ::ng-deep .ag-header-cell[col-id="minCompra"] .ag-cell-label-container {
      flex: 1;
      min-width: 0;
    }
    :host ::ng-deep .ag-header-cell[col-id="minCompra"] .ag-header-cell-menu-button {
      margin-left: auto;
    }
  `]
})
export class DetalleAsignProveedsMaestroComponent implements ICellRendererAngularComp, OnDestroy {

  private customersService = inject(CustomersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private branchsService = inject(BranchsService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);
  private materialsService = inject(MaterialsService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);
  private ocAndReqsService = inject(OcAndReqsService);
  private empaqueMedidaService = inject(EmpaqueMedidaService);
  private empaquePesoVolumenService = inject(EmpaquePesoVolumenService);
  private empaqueDescripcionService = inject(EmpaqueDescripcionService);
  private pendingChangesService = inject(PendingChangesService);
  private currencyService = inject(CurrencyService);

  /** Catálogo de monedas (type='CURRENCY') para el editor/formatter de Precio Unitario. */
  monedas: MonedaOpt[] = [];
  private monedasMap = new Map<number, MonedaOpt>();
  /** Id de la moneda default (MXN) para filas nuevas / precios sin moneda. */
  defaultCurrencyId: number | null = null;

  private _sucursalSub: Subscription;
  private saverId: string = '';

  params: any;
  materialId: number;
  materialName: string;
  materialSubfamilyId: number; // ID de la subfamilia del material
  proveedorRowData: any[] = [];
  proveedorGridApi: any;
  gridApi: any; // Alias for backward compatibility
  selectedProveedor: any = null;

  /** Detalle (Nivel 3/4) que estaba abierto antes de un reload, para reabrirlo tras guardar. */
  private _pendingExpandRestore: { idTabla: any; detailType: string; empaqueDetailType: string } | null = null;

  /** Cambios pendientes del Nivel 2. El setter notifica al servicio central
   *  para que el botón Guardar del Nivel 1 encienda su badge rojo y sincroniza
   *  el flag al cache de `params.data` (sobrevive al desmonte). */
  private _hasProveedorChanges: boolean = false;
  get hasProveedorChanges(): boolean { return this._hasProveedorChanges; }
  set hasProveedorChanges(value: boolean) {
    this._hasProveedorChanges = value;
    if (this.saverId) {
      this.pendingChangesService.notifyChanges(this.saverId, value);
    }
    if (this.params?.data) {
      (this.params.data as any).__pendingProveedoresDirty = value;
    }
  }

  /** Persiste las filas en `params.data` para que sobrevivan al desmonte del componente
   *  (cuando AG Grid colapsa el detail row). Sin esto, los proveedores no guardados se pierden. */
  private syncCacheToParams(): void {
    if (!this.params?.data) return;
    (this.params.data as any).__pendingProveedores = this.proveedorRowData;
    (this.params.data as any).__pendingProveedoresDirty = this._hasProveedorChanges;
  }

  // Catálogos
  providers: any[] = []; // Todos los proveedores
  filteredProviders: any[] = []; // Proveedores filtrados por subfamilia
  branches: any[] = [];
  idRoot: number;

  // Tooltip
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  constructor(private currencyPipe: CurrencyPipe, rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  private showProviderTooltip(provider: any, optionRect: DOMRect): void {
    this.hideProviderTooltip();

    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');

    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.tooltipElement, arrow);

    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-person-badge');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const name = this.getProviderDisplayName(provider);
    const headerTextNode = this.renderer.createText(name);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Fila de Tipo
    const typeRow = this.renderer.createElement('div');
    this.renderer.setStyle(typeRow, 'display', 'flex');
    this.renderer.setStyle(typeRow, 'align-items', 'center');
    this.renderer.setStyle(typeRow, 'gap', '8px');
    this.renderer.setStyle(typeRow, 'margin-bottom', '8px');

    const typeLabel = this.renderer.createElement('span');
    this.renderer.setStyle(typeLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(typeLabel, 'font-weight', '600');
    const typeLabelText = this.renderer.createText('Tipo:');
    this.renderer.appendChild(typeLabel, typeLabelText);
    this.renderer.appendChild(typeRow, typeLabel);

    const typeValue = this.renderer.createElement('span');
    this.renderer.setStyle(typeValue, 'color', '#ffffff');
    const typeText = provider.typeIntOrExt || provider.typework || 'No especificado';
    const typeValueText = this.renderer.createText(typeText);
    this.renderer.appendChild(typeValue, typeValueText);
    this.renderer.appendChild(typeRow, typeValue);
    this.renderer.appendChild(body, typeRow);

    // Fila de Contacto
    const contactRow = this.renderer.createElement('div');
    this.renderer.setStyle(contactRow, 'display', 'flex');
    this.renderer.setStyle(contactRow, 'align-items', 'center');
    this.renderer.setStyle(contactRow, 'gap', '8px');

    const contactLabel = this.renderer.createElement('span');
    this.renderer.setStyle(contactLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(contactLabel, 'font-weight', '600');
    const contactLabelText = this.renderer.createText('Contacto:');
    this.renderer.appendChild(contactLabel, contactLabelText);
    this.renderer.appendChild(contactRow, contactLabel);

    const contactValue = this.renderer.createElement('span');
    this.renderer.setStyle(contactValue, 'color', '#ffffff');
    const contact = provider.description || provider.nameContact || 'Sin contacto';
    const contactValueText = this.renderer.createText(contact);
    this.renderer.appendChild(contactValue, contactValueText);
    this.renderer.appendChild(contactRow, contactValue);
    this.renderer.appendChild(body, contactRow);

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);
    this.renderer.appendChild(document.body, this.tooltipElement);

    const top = optionRect.top;
    const left = optionRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private hideProviderTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  // Helper para formatear nombre de proveedor sin "undefined"
  getProviderDisplayName(provider: any): string {
    if (!provider) return '';
    return provider.name || provider.description || provider.nameContact || provider.company || '';
  }

  /** True cuando el proveedor fue desactivado globalmente desde providers.component (customers.vigente=false). */
  private isBlockedByProviderDeactivation(idTabla: number): boolean {
    if (!idTabla) return false;
    const provider = this.providers?.find((p: any) => p.id === idTabla);
    if (!provider) return false;
    return !(
      provider.vigente === true || provider.vigente === 1 ||
      provider.Vigente === true || provider.Vigente === 1 ||
      provider.active === true  || provider.active === 1  ||
      provider.Active === true  || provider.Active === 1
    );
  }

  /** Min. Compras: solo enteros ≥ 0; sin letras ni decimales. */
  private parseMinComprasInteger(raw: unknown): { valid: boolean; value: number } {
    if (raw === null || raw === undefined || raw === '') {
      return { valid: true, value: 0 };
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return { valid: false, value: 0 };
      if (!Number.isInteger(raw)) return { valid: false, value: 0 };
      if (raw < 0) return { valid: false, value: 0 };
      return { valid: true, value: raw };
    }
    const s = String(raw).trim();
    if (s === '') return { valid: true, value: 0 };
    if (!/^\d+$/.test(s)) return { valid: false, value: 0 };
    return { valid: true, value: parseInt(s, 10) };
  }

  proveedorGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 300,
    getRowStyle: (params: any) => {
      if (this.isBlockedByProviderDeactivation(params.data?.idTabla)) {
        return { background: '#fce4ec', color: '#c62828', fontStyle: 'italic' };
      }
      return null;
    },
    isRowMaster: (dataItem: any) => {
      // Cada fila de proveedor puede tener un detalle de sucursal
      return true;
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'proveedorSucursal') {
        return { component: 'detailCellRendererProveedorSucursal' };
      }
      if (params.data.detailType === 'proveedorEmpaque') {
        return { component: 'detailCellRendererProveedorEmpaque' };
      }
      return undefined;
    },
    onCellClicked: this.onCellClicked.bind(this),
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRendererProveedorSucursal: DetallesSucursalesProveedorComponent,
    detailCellRendererProveedorEmpaque: DetalleEmpaqueProveedorComponent
  };

  proveedorColumnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      editable: false,
      width: 70,
      hide: false,
      filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
      filterParams: {
        filterOptions: ['equals'], // Opciones de filtro
      },
    },
    {
      field: 'active',
      headerName: 'Activo',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
      width: 80,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      onCellValueChanged: (params: any) => {
        params.data.__modified = true;
        this.hasProveedorChanges = true;
      }
    },
    {
      field: 'principal',
      headerName: 'Principal',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
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
        }
      }
    },

    {
      field: 'campo7',
      headerName: 'Por autorizar',
      editable: false,
      width: 110,
      cellRenderer: 'agCheckboxCellRenderer',
      valueGetter: (params: any) => {
        const v = params.data?.campo7;
        if (v === true || v === 1) {
          return true;
        }
        if (typeof v === 'string') {
          return v === '1' || v.toLowerCase() === 'true';
        }
        return false;
      },
    },

    {
      field: 'idTabla',
      headerName: 'Proveedor',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
      width: 200,
      flex: 1,
      cellStyle: (params: any) => {
        if (params.data?.__isNew) return null;
        if (params.data?._hasSucursales === false) {
          return { backgroundColor: '#fce4ec', borderLeft: '3px solid #e91e63' };
        }
        return null;
      },
      tooltipValueGetter: (params: any) => {
        if (params.data?._hasSucursales === false) return 'Sin sucursales asignadas';
        return null;
      },
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        const providerId = params.value;
        const provider = this.filteredProviders?.find((p: any) => p.id === providerId)
          || this.providers?.find((p: any) => p.id === providerId);

        div.textContent = provider ? this.getProviderDisplayName(provider) : (params.value || '');
        div.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';

        div.addEventListener('mouseenter', () => {
          if (provider) {
            const rect = div.getBoundingClientRect();
            this.showProviderTooltip(provider, rect);
          }
        });

        div.addEventListener('mouseleave', () => {
          this.hideProviderTooltip();
        });

        return div;
      },
      // Nuevo editor
      cellEditor: SelectWithTooltipEditorV2Component,

      cellEditorParams: (params: any) => {
        const currentIdTabla = params.data.idTabla;
        const usedIds = new Set(
          (this.proveedorRowData || [])
            .map((row: any) => row.idTabla)
            .filter((id: any) => id && id !== 0 && id !== currentIdTabla)
        );
        const options = (this.filteredProviders || [])
          .filter((p: any) => !usedIds.has(p.id))
          .map((p: any) => {
            const company = (p.name ?? p.company ?? '').trim();
            const contact = (p.description ?? p.nameContact ?? '').trim();
            const isCompany = !!company;
            return {
              id: p.id,
              description: isCompany ? company : (contact || `Proveedor ${p.id}`),
              group: isCompany ? 'Compañía' : 'Contacto',
              sortKey: isCompany ? company : contact,
              valueAddition2: p.typeIntOrExt || p.typework || 'Sin tipo',
              label2: 'Tipo de proveedor:'
            };
          })
          .sort((a: any, b: any) => {
            if (a.group !== b.group) return a.group === 'Compañía' ? -1 : 1;
            return a.sortKey.localeCompare(b.sortKey, 'es', { sensitivity: 'base' });
          });
        return { options };
      },

      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const provider = this.filteredProviders?.find?.(p => p.id === params.value)
          || this.providers?.find?.(p => p.id === params.value);
        return provider ? this.getProviderDisplayName(provider) : params.value;
      },

      onCellValueChanged: (params: any) => {
        // refresca la fila
        params.api.refreshCells({
          rowNodes: [params.node],
          force: true
        });
      },

      valueSetter: (params: any) => {
        const editorValue = params.newValue;

        // Si el editor devuelve {id, description}
        const newId = (editorValue && typeof editorValue === 'object' && 'id' in editorValue)
          ? editorValue.id
          : editorValue;

        // Validar requerido
        if (!newId && newId !== 0) {
          alerts.basicAlert(
            'Campo requerido',
            'El proveedor es obligatorio',
            'error'
          );
          return false;
        }

        // Evitar duplicados
        const duplicateExists = (this.proveedorRowData || []).some((row, index) =>
          index !== params.node.rowIndex && row.idTabla === newId
        );

        if (duplicateExists) {
          alerts.basicAlert(
            'Proveedor duplicado',
            'Ya existe una fila con ese proveedor.',
            'error'
          );
          return false;
        }

        // Asignar valores
        params.data.idTabla = newId;

        const provider = this.filteredProviders.find((p: any) => p.id === newId)
          || this.providers.find((p: any) => p.id === newId);

        if (provider) {
          params.data.providerName = this.getProviderDisplayName(provider);
        } else {
          params.data.providerName = newId;
        }

        return true;
      }
    },

    //Agrego Soriano esta columna por que pedro se le olvido
    {
      field: 'campo11',
      headerName: 'Codigo Externo',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
      width: 140
    },

    /** Compra mínima por proveedor-material; se persiste en proveedorxtablas.minima_compra (type MATERIAL). */
    {
      field: 'minCompra',
      headerName: 'Min. Compras',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
      width: 130,
      filter: false,
      suppressHeaderFilterButton: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 },
      valueFormatter: (params: any) => {
        const v = params.value;
        if (v === null || v === undefined || v === '') return '';
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : '';
      },
      valueParser: (params: any) => {
        const parsed = this.parseMinComprasInteger(params.newValue);
        if (!parsed.valid) {
          return params.oldValue ?? params.data?.minCompra ?? 0;
        }
        return parsed.value;
      },
      valueSetter: (params: any) => {
        const parsed = this.parseMinComprasInteger(params.newValue);
        if (!parsed.valid) {
          alerts.basicAlert(
            'Min. Compras',
            'Solo se permiten números enteros (sin letras ni decimales).',
            'warning'
          );
          return false;
        }
        params.data.minCompra = parsed.value;
        return true;
      },
    },

    {
      field: 'campo9',
      headerName: 'Precio Unitario',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
      width: 150,
      // Editor compuesto: número + dropdown de moneda en la misma celda (Opción C).
      cellEditor: PrecioMonedaEditorComponent,
      cellEditorParams: () => ({ monedas: this.monedas, defaultCurrencyId: this.defaultCurrencyId }),
      // Al cerrar: concatena valor + abreviatura de la moneda → "2.87 MXN".
      valueFormatter: (params: any) => {
        const n = Number(params.value) || 0;
        return `${n.toFixed(2)} ${this.currencyAbbr(params.data?.idCurrency)}`;
      },
      valueSetter: (params: any) => {
        const n = parseFloat(String(params.newValue));
        params.data.campo9 = isNaN(n) || n < 0 ? 0 : n;
        return true;
      }
    },

    {
      // Disparador para abrir el sub-grid Nivel 4 (Empaque). El nombre que ve el usuario
      // es "Descripción Artículo"; al hacer click se expande la cascada con los 4 campos
      // antes inline (campo2..campo5). No es editable inline — se edita en el sub-grid.
      // Bloqueo por `__isNew` removido: PendingChangesService permite editar antes de guardar
      // y los 4 campos (campo2..5) ya viven en `params.data` del proveedor.
      field: 'campo2',
      colId: 'empaqueTrigger',
      headerName: 'Descripción Artículo',
      editable: false,
      width: 170,
      flex: 1,
      cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params: any) => {
        const div = document.createElement('div');
        div.innerText = 'Ver';
        return div;
      }
    },
    {
      field: 'campo6',
      headerName: 'Caducidad o Garantía(Meses)',
      editable: (params: any) => !this.isBlockedByProviderDeactivation(params.data?.idTabla),
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
      // Bloqueo por `__isNew` removido: PendingChangesService permite agregar sucursales antes
      // de guardar el proveedor; el remapeo idMap (temp→real) actualiza idMaterialByProveedor.
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params: any) => {
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

    // Cache de filas pendientes en `params.data` (sobrevive al desmonte del componente
    // cuando AG Grid colapsa el detail row). Sin este cache, los proveedores no guardados
    // se pierden al cerrar y reabrir la cascada del Nivel 2.
    const cached = (params.data as any).__pendingProveedores;
    const hasPendingChanges = !!(params.data as any).__pendingProveedoresDirty;

    // Registro en el bus central para que el Guardar único del Nivel 1 invoque saveProveedores().
    // Si el material aún es nuevo (id temporal), el callback recibirá un `idMap` con el ID real
    // tras el guardado del Nivel 1, para remapear `materialId` y `campo1` antes de POSTear.
    this.saverId = `proveedores-${this.materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.pendingChangesService.register(this.saverId, {
      hasChanges: hasPendingChanges,
      save: (idMap?: Map<string, number>) => this.saveProveedores(idMap)
    });

    this.loadProviders();
    this.loadBranches();
    this.loadMonedas();
    if (Array.isArray(cached)) {
      // Restaurar filas previas (incluye no guardadas con __isNew/__modified).
      this.proveedorRowData = cached;
      this._hasProveedorChanges = hasPendingChanges;
    } else {
      this.loadProveedorData();
    }

    // Suscribirse al evento de sucursal guardada para quitar color rosa
    this._sucursalSub = this.sucursalByMaterialProveedorService.sucursalSaved$.subscribe(
      (idProveedor: number) => {
        const row = this.proveedorRowData.find((r: any) => r.id === idProveedor);
        if (row) {
          row._hasSucursales = true;
          if (this.proveedorGridApi) {
            let targetNode: any = null;
            this.proveedorGridApi.forEachNode((node: any) => {
              if (node.data?.id === idProveedor) targetNode = node;
            });
            if (targetNode) {
              this.proveedorGridApi.redrawRows({ rowNodes: [targetNode] });
            }
          }
        }
      }
    );

    // Pasar el contexto del componente padre (MaterialesMaestroComponent) al siguiente nivel de detalle
    this.proveedorGridOptions.context = {
      ...params.context,
      componentParent: this, // Ahora este componente es el padre del detalle de sucursal
      providers: this.providers, // Pasar lista de proveedores para resolver nombres en detalles-sucursalesproveedor
      filteredProviders: this.filteredProviders // Pasar proveedores filtrados también
    };
  
    this.cdr.detectChanges();}

  /** Carga el catálogo de monedas (type='CURRENCY') y resuelve la moneda default (MXN). */
  private loadMonedas(): void {
    const idCompany = this.idRoot || this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    this.currencyService.getCurrencies(idCompany).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.catalog ?? []);
        this.monedas = (list || []).map((c: any) => ({
          id: Number(c.id),
          abreviatura: (c.valueAddition || '').toString().trim(),
          nombre: c.description || ''
        }));
        this.monedasMap = new Map(this.monedas.map(m => [m.id, m]));
        // Default MXN: por abreviatura 'MXN', o nombre con "peso"/"mexic"; si no, la primera.
        const mxn = this.monedas.find(m => m.abreviatura.toUpperCase() === 'MXN')
          || this.monedas.find(m => /peso|mexic/i.test(m.nombre))
          || this.monedas[0];
        this.defaultCurrencyId = mxn ? mxn.id : null;
        this.proveedorGridApi?.refreshCells({ columns: ['campo9'], force: true });
      },
      error: () => { this.monedas = []; this.monedasMap = new Map(); this.defaultCurrencyId = null; }
    });
  }

  /** Abreviatura de la moneda de una fila (o 'MXN' si no resuelve). */
  private currencyAbbr(idCurrency: any): string {
    const id = (idCurrency !== undefined && idCurrency !== null) ? Number(idCurrency) : this.defaultCurrencyId;
    const m = id != null ? this.monedasMap.get(Number(id)) : undefined;
    return (m?.abreviatura || m?.nombre || 'MXN');
  }

  /** Notificación desde el sub-grid de Empaque (Nivel 4) para encender el botón Guardar. */
  notifyChildChanged(): void {
    this.hasProveedorChanges = true;
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    // Nivel 4 — Empaque (Descripción Artículo): abre/colapsa el detalle con los 4 campos.
    if (colId === 'empaqueTrigger') {
      // Bloqueo `__isNew` removido: el sub-grid edita campo2..5 directamente sobre params.data
      // del proveedor, que se persiste junto con el proveedor cuando se ejecuta el Guardar único.
      if (this.isBlockedByProviderDeactivation(event.data?.idTabla)) {
        return;
      }
      const node = event.node;
      const api = event.api;
      const detailType = 'proveedorEmpaque';
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Colapsar: cerrar el detalle y restaurar la altura de todas las filas (igual que Nivel 1/2).
        node.setExpanded(false);
        api.forEachNode((n: any) => n.setRowHeight(undefined));
        api.onRowHeightChanged();
      } else {
        // Acordeón: ocultar las demás filas (altura 0) y mostrar sólo ésta + su detalle.
        api.forEachNode((otherNode: any) => {
          if (otherNode.id === node.id) {
            otherNode.setRowHeight(undefined);
          } else {
            if (otherNode.expanded) otherNode.setExpanded(false);
            otherNode.setRowHeight(0);
          }
        });
        api.onRowHeightChanged();
        event.data.detailType = detailType;
        setTimeout(() => node.setExpanded(true), 0);
      }
      return;
    }

    if (colId === 'branchName') {
      // Bloqueo `__isNew` removido: el sub-grid de sucursales se puede editar antes del Guardar
      // único; el remapeo idMap actualiza idMaterialByProveedor al ID real del proveedor.
      if (this.isBlockedByProviderDeactivation(event.data?.idTabla)) {
        return;
      }
      const node = event.node;
      const api = event.api;
      const detailType = 'proveedorSucursal';
      if (this.gridApi) {
        const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
        const selectedId = selectedRowData.id;
        const filterModel = {
          id: {
            type: 'equals',
            filter: selectedId,
          },
        };
        this.gridApi.setFilterModel(filterModel);
        this.gridApi.onFilterChanged();
      }

      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Collapsing: clear any filters
        node.setExpanded(false);
        this.gridApi.setFilterModel(null); // quitar filtro
        this.gridApi.onFilterChanged();

      } else {
        // Expanding: collapse other expanded rows
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Set detail type and expand
        event.data.detailType = detailType;

        // Generate fake data for the next level
        event.data.sucursalDetailData = this.generateFakeSucursalData();

        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  ngOnDestroy() {
    this._sucursalSub?.unsubscribe();
    if (this.saverId) {
      this.pendingChangesService.unregister(this.saverId);
    }
  }

  refresh(): boolean {
    return false;
  }

  async loadProviders() {
    try {
      // 1. Cargar TODOS los proveedores (activos e inactivos) + tipos del Warehouse en paralelo
      // getProvidersForGrid devuelve todos sin filtrar por vigente, necesario para resolver nombres
      const [allProviders, warehouseProviders]: any = await Promise.all([
        firstValueFrom(this.customersService.getProvidersForGrid(this.idRoot)).catch(() => []),
        firstValueFrom(this.materialsService.getProvidersxmaterials(this.idRoot)).catch(() => [])
      ]);

      // Enriquecer proveedores con typeIntOrExt del Warehouse
      const typeMap = new Map<number, string>();
      (warehouseProviders || []).forEach((wp: any) => {
        if (wp.id && wp.typeIntOrExt) typeMap.set(wp.id, wp.typeIntOrExt);
      });
      // this.providers contiene TODOS (activos e inactivos) para resolución de nombres en el grid
      this.providers = (Array.isArray(allProviders) ? allProviders : []).map((p: any) => ({
        ...p,
        typeIntOrExt: typeMap.get(p.id) || null
      }));

      // Mismo criterio visual que la tabla de Proveedores:
      // el checkbox "Activo" en esa pantalla pinta `vigente`, y `getProvidersForGrid`
      // lo mapea desde Customer.Active del backend.
      const activeProviders = this.providers.filter((p: any) =>
        p.vigente === true || p.vigente === 1 ||
        p.Vigente === true || p.Vigente === 1 ||
        p.active === true || p.active === 1 ||
        p.Active === true || p.Active === 1
      );

      // 2. Filtrar proveedores que manejan la subfamilia del material usando getSubfamilyxVigentes
      if (this.materialSubfamilyId) {

        try {
          // Obtener todos los proveedores y sus subfamilias VIGENTES asociadas
          const providerSubfamilyPromises = activeProviders.map(async (provider: any) => {
            try {
              // Usar el endpoint de subfamilias vigentes
              const subfamilies: any = await this.providersService.getSubfamilyxVigentes(provider.id).toPromise();

              // Buscar si alguna subfamilia coincide con la subfamilia del material
              const matchingSubfamily = subfamilies?.find((s: any) => s.idSubfamily === this.materialSubfamilyId);

              return {
                providerId: provider.id,
                providerName: this.getProviderDisplayName(provider),
                hasSubfamily: matchingSubfamily !== undefined,
                subfamilyDescription: matchingSubfamily?.description || null
              };
            } catch (error) {
              console.error(`Error obteniendo subfamilias vigentes del proveedor ${provider.id}:`, error);
              return { providerId: provider.id, providerName: this.getProviderDisplayName(provider), hasSubfamily: false, subfamilyDescription: null };
            }
          });

          const results = await Promise.all(providerSubfamilyPromises);


          // Filtrar solo los proveedores que tienen la subfamilia del material vigente
          const providersWithMatchingSubfamily = results
            .filter(r => r.hasSubfamily);


          // Crear el arreglo filtrado con la información del proveedor y la subfamilia
          this.filteredProviders = activeProviders.filter(p =>
            providersWithMatchingSubfamily.some(pm => pm.providerId === p.id)
          );

        } catch (error) {
          console.error('❌ Error filtrando proveedores por subfamilia:', error);
          this.filteredProviders = activeProviders;
        }
      } else {
        // Si no hay subfamilia, mostrar solo los vigentes en el dropdown
        this.filteredProviders = activeProviders;
      }

      // Ordenar filas por nombre de proveedor A-Z (ahora que filteredProviders ya está listo)
      if (this.proveedorRowData.length > 0) {
        this.sortProveedorRowData();
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
  
    this.cdr.detectChanges();}

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

  /** True si el materialId todavía es temporal (material aún no guardado en BD). */
  private isTempMaterialId(): boolean {
    return typeof this.materialId === 'string' && String(this.materialId).startsWith('temp_');
  }

  loadProveedorData() {
    // Captura el detalle abierto (Nivel 3/4) antes del reload para reabrirlo después.
    this._pendingExpandRestore = this.captureExpandedState();

    // Si el material aún no fue guardado en BD (id temporal), no hay datos que cargar:
    // el usuario puede agregar proveedores en memoria y se persistirán cuando el Guardar
    // del Nivel 1 primero cree el material y luego propague el ID real vía idMap.
    if (this.isTempMaterialId()) {
      this.proveedorRowData = [];
      this.syncCacheToParams();
      return;
    }
    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.load) {
      this.params.context.MATERIAL.load(this.materialId, 'MATERIAL', async (data: any) => {
        this.proveedorRowData = data;
        await this.fetchMissingProviders();

        // Enriquecer con nombres de proveedores (para mostrar en detalles-sucursalesproveedor)
        this.proveedorRowData = this.proveedorRowData.map((row: any) => {
          if (!row.providerName && row.idTabla) {
            const provider = this.filteredProviders?.find((p: any) => p.id === row.idTabla)
              || this.providers?.find((p: any) => p.id === row.idTabla);
            if (provider) {
              row.providerName = this.getProviderDisplayName(provider);
            }
          }
          return row;
        });

        this.sortProveedorRowData();
        this.syncCacheToParams();
        this.restoreExpandedState();
        void this.loadSucursalCounts().then(() => {
          setTimeout(() => this.autosizeProveedorColumns(), 0);
        });
      });
    }
  }

  /** Devuelve el proveedor (idTabla) con detalle abierto y su tipo, o null. */
  private captureExpandedState(): { idTabla: any; detailType: string; empaqueDetailType: string } | null {
    if (!this.proveedorGridApi) return null;
    let result: { idTabla: any; detailType: string; empaqueDetailType: string } | null = null;
    this.proveedorGridApi.forEachNode((n: any) => {
      if (n.expanded && n.data?.detailType) {
        result = {
          idTabla: n.data.idTabla,
          detailType: n.data.detailType,
          empaqueDetailType: n.data.__empaqueDetailType || '',  // medidas | pesovolumen (sub-detalle)
        };
      }
    });
    return result;
  }

  /** Reabre el detalle que estaba abierto antes del reload (mejora UX tras guardar). */
  private restoreExpandedState(): void {
    const target = this._pendingExpandRestore;
    this._pendingExpandRestore = null;
    if (!target || !this.proveedorGridApi) return;
    setTimeout(() => {
      let node: any = null;
      this.proveedorGridApi.forEachNode((n: any) => {
        if (n.data?.idTabla === target.idTabla) node = n;
      });
      if (!node) return;
      node.data.detailType = target.detailType;
      // Propaga qué sub-detalle (medidas|pesovolumen) estaba abierto a la fila nueva.
      if (target.empaqueDetailType) node.data.__empaqueDetailType = target.empaqueDetailType;
      // Acordeón sólo para el detalle de empaque (igual que su handler).
      if (target.detailType === 'proveedorEmpaque') {
        this.proveedorGridApi.forEachNode((n: any) => {
          n.setRowHeight(n.id === node.id ? undefined : 0);
        });
        this.proveedorGridApi.onRowHeightChanged();
      }
      node.setExpanded(true);
    }, 50);
  }

  private async fetchMissingProviders() {
    const missingIds = (this.proveedorRowData || [])
      .map((row: any) => row.idTabla)
      .filter((id: any) => id && id > 0 && !this.providers?.some((p: any) => p.id === id));

    if (missingIds.length === 0) return;

    const fetched = await Promise.all(
      missingIds.map((id: number) =>
        firstValueFrom(this.customersService.getCustomerById(id)).catch(() => null)
      )
    );

    const valid = fetched.filter((p: any) => p != null);
    if (valid.length > 0) {
      this.providers = [...(this.providers || []), ...valid];
      if (this.proveedorGridApi) {
        this.proveedorGridApi.refreshCells({ force: true });
      }
    }
  
    this.cdr.detectChanges();}

  private autosizeProveedorColumns(): void {
    if (!this.proveedorGridApi) return;
    runAutosizeAllColumns(this.proveedorGridApi);
  }

  async loadSucursalCounts() {
    const savedRows = this.proveedorRowData.filter(
      (row: any) => row.id && !String(row.id).startsWith('temp_')
    );
    await Promise.all(
      savedRows.map(async (row: any) => {
        try {
          const sucursales = await firstValueFrom(
            this.sucursalByMaterialProveedorService.getSucursalByMaterial(row.id)
          );
          row._hasSucursales = sucursales && sucursales.length > 0;
        } catch {
          row._hasSucursales = false;
        }
      })
    );
    if (this.proveedorGridApi) {
      this.proveedorGridApi.refreshCells({ force: true });
    }
  
    this.cdr.detectChanges();}

  private sortProveedorRowData() {
    if (!this.providers?.length && !this.filteredProviders?.length) return;
    this.proveedorRowData = [...this.proveedorRowData].sort((a: any, b: any) => {
      const pA = this.filteredProviders?.find((x: any) => x.id === a.idTabla) || this.providers?.find((x: any) => x.id === a.idTabla);
      const pB = this.filteredProviders?.find((x: any) => x.id === b.idTabla) || this.providers?.find((x: any) => x.id === b.idTabla);
      const nameA = pA ? this.getProviderDisplayName(pA) : '';
      const nameB = pB ? this.getProviderDisplayName(pB) : '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
    if (this.proveedorGridApi) {
      this.proveedorGridApi.setGridOption('rowData', this.proveedorRowData);
    }
  }

  onGridReady(params: any) {
    this.proveedorGridApi = params.api;
  }

  onProveedorGridReady(params: any) {
    this.proveedorGridApi = params.api;
    this.gridApi = params.api; // Set alias

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedProveedor = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onProveedorCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasProveedorChanges = true;
    this.syncCacheToParams();
  }

  /** El editor compuesto de Precio Unitario puede cambiar SOLO la moneda (campo9 igual) → no
   *  dispara cellValueChanged. Aquí capturamos el __modified que dejó el editor para marcar cambios
   *  y refrescar la celda (re-concatenar la abreviatura). */
  onProveedorCellEditingStopped(event: any) {
    if (event?.column?.getColId?.() === 'campo9') {
      if (event.data?.__modified) {
        this.hasProveedorChanges = true;
        this.syncCacheToParams();
      }
      this.proveedorGridApi?.refreshCells({ rowNodes: [event.node], columns: ['campo9'], force: true });
    }
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

    const branchId = this.signalsService.getBranchSelectedBySidebar()() || 0;
    const branchName = this.signalsService.getBranchNameSelectedBySidebar()() || '';

    const tempId = `temp_proveedor_${Date.now()}`;
    const newProveedor = {
      id: tempId,
      campo1: this.materialId,  // ID del material
      idTabla: 0,              // ID del proveedor (se seleccionará)
      providerName: '',        // Nombre del proveedor (para mostrar en combo)
      minCompra: 1,            // Min. compras (proveedorxtablas.minima_compra)
      campo2: '',              // Descripción empaque
      campo3: '',              // Pieza x paquete
      campo11: '',             // Codigo externo
      campo4: '',              // Medidas
      campo5: '',              // Peso/Volumen
      campo6: '',              // Caducidad/Garantía
      campo7: false,           // Por autorizar
      campo9: 0,               // Precio unitario
      idCurrency: this.defaultCurrencyId,  // Moneda default (MXN)
      campo10: branchId,       // ID sucursal (del sidebar)
      branchName,              // Nombre de sucursal (del sidebar)
      type: 'MATERIAL',
      active: true,
      principal: isFirstProvider, // Si es el primero, marcar como principal
      __isNew: true
    };

    this.proveedorRowData = [newProveedor, ...this.proveedorRowData];
    this.hasProveedorChanges = true;
    this.syncCacheToParams();

    if (isFirstProvider) {
    }

    setTimeout(() => {
      this.proveedorGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'idTabla'
      });
      this.autosizeProveedorColumns();
    }, 100);
  }

  async saveProveedores(idMap?: Map<string, number>) {
    console.log('[saveProveedores] inicio. materialId:', this.materialId,
      'idMap:', idMap ? Array.from(idMap.entries()) : 'undefined',
      'rows campo1:', this.proveedorRowData.map(r => ({ id: r.id, campo1: r.campo1, __isNew: r.__isNew })));
    // Remapeo de ID temporal → real. CRÍTICO: el remapeo de `row.campo1` se hace SIEMPRE
    // que el campo sea string temporal y esté en el mapa, independiente de si
    // `this.materialId` ya no es temporal (porque pudo haberse mutado externamente).
    if (idMap) {
      // 1) materialId del componente: remapear si sigue siendo temporal.
      if (this.isTempMaterialId()) {
        const realId = idMap.get(String(this.materialId));
        if (realId) this.materialId = realId;
      }
      // 2) campo1 (FK al material) de cada fila: remapear cualquier valor temporal.
      this.proveedorRowData.forEach((row: any) => {
        const c1 = row.campo1;
        if (c1 != null && typeof c1 === 'string' && c1.startsWith('temp_')) {
          const realId = idMap.get(c1);
          if (realId) row.campo1 = realId;
        }
      });
    }

    // Sanity check defensivo: ninguna fila a guardar debe tener campo1 temporal.
    const rowsWithTempCampo1 = this.proveedorRowData.filter(
      (row: any) => (row.__isNew || row.__modified) && typeof row.campo1 === 'string' && String(row.campo1).startsWith('temp_')
    );
    if (rowsWithTempCampo1.length > 0) {
      console.error('[saveProveedores] ABORTADO: filas con campo1 temporal sin remapear:', rowsWithTempCampo1, 'idMap:', idMap);
      alerts.basicAlert(
        'Error de sincronización',
        'No se pudo vincular el material recién creado con los proveedores. Recarga la página e intenta de nuevo.',
        'error'
      );
      return;
    }

    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.save) {
      // Confirmar cualquier celda que esté en edición antes de guardar
      this.proveedorGridApi?.stopEditing();
      // Capturar filas a sincronizar ANTES del save (el save limpia los flags __modified/__isNew)
      const rowsToSync = this.proveedorRowData.filter(
        (row: any) => (row.__modified || row.__isNew) && row.idTabla > 0 && row.campo1 > 0
      ).map((row: any) => ({ campo1: row.campo1, idTabla: row.idTabla, campo11: row.campo11 || '' }));

      // Capturar filas nuevas para marcar como "por autorizar"
      const newProvidersToAuthorize = this.proveedorRowData.filter(
        (row: any) => row.__isNew && row.idTabla > 0 && row.campo1 > 0
      ).map((row: any) => ({ idSupplie: row.campo1, idProveedor: row.idTabla }));

      // Capturar filas modificadas cuyo active cambió, con ID real
      const rowsToSyncSucursales = this.proveedorRowData.filter(
        (row: any) => row.__modified &&
                      row.id && !String(row.id).startsWith('temp_')
      ).map((row: any) => ({ id: row.id as number, active: row.active === true || row.active === 1 }));

      // Capturar medidas de empaque (Nivel 4) ANTES del reload. El id real del proveedor
      // se resuelve con newProveedorIdMap (temp→real) tras MATERIAL.save.
      // Presentaciones de empaque (Nivel 4) por proveedor. Solo filas con datos (la vacía final no).
      const empaqueToSave = this.proveedorRowData
        .filter((row: any) => row.__empaqueDirty)
        .map((row: any) => ({
          rowIdRaw: row.id,
          presentaciones: (Array.isArray(row.__empaqueRows) ? row.__empaqueRows : [])
            .filter((p: any) => !!p.idDescripcionEmpaque || (p.piezaXPaquete != null && p.piezaXPaquete !== '')
              || (Array.isArray(p.__medidas) && p.__medidas.length > 0)
              || (Array.isArray(p.__pesoVolumen) && p.__pesoVolumen.length > 0)),
        }));

      try {
        // Guardar los cambios. MATERIAL.save devuelve Map<tempProveedorId, realProveedorId>
        // que propagamos al idMap compartido para que el Nivel 3 (sucursales) pueda remapear
        // su FK `idMaterialByProveedor` al ID real del proveedor recién creado.
        const newProveedorIdMap: Map<string, number> = await this.params.context.MATERIAL.save(
          this.materialId,
          this.proveedorRowData,
          'MATERIAL'
        );
        if (idMap && newProveedorIdMap && newProveedorIdMap.size > 0) {
          newProveedorIdMap.forEach((realId, tempId) => idMap.set(tempId, realId));
        }

        // Esperar un poco para que el servidor procese
        await new Promise(resolve => setTimeout(resolve, 500));

        // Persistir presentaciones (cascada de 2 niveles): proveedor → presentaciones → medidas/peso.
        for (const emp of empaqueToSave) {
          let realId = (typeof emp.rowIdRaw === 'number') ? emp.rowIdRaw : Number(emp.rowIdRaw);
          if (!realId || String(emp.rowIdRaw).startsWith('temp_')) {
            const mapped = newProveedorIdMap?.get(String(emp.rowIdRaw));
            if (mapped) realId = mapped;
          }
          if (!realId || realId <= 0) continue;
          try {
            // 1) Guardar presentaciones; devuelve filas con ids en el MISMO orden enviado.
            const items = emp.presentaciones.map((p: any) => ({
              idDescripcionEmpaque: p.idDescripcionEmpaque ?? null,
              piezaXPaquete: (p.piezaXPaquete === '' || p.piezaXPaquete === undefined) ? null : (p.piezaXPaquete ?? null),
            }));
            const saved = await firstValueFrom(this.empaqueDescripcionService.saveByProveedor(realId, items));
            // 2) Por cada presentación (mismo índice), guardar sus medidas y peso/volumen con el id real.
            for (let i = 0; i < (saved?.length ?? 0); i++) {
              const empId = saved[i].id!;
              const pres = emp.presentaciones[i];
              const meds = Array.isArray(pres?.__medidas) ? pres.__medidas : [];
              const pvs  = Array.isArray(pres?.__pesoVolumen) ? pres.__pesoVolumen : [];
              await firstValueFrom(this.empaqueMedidaService.saveByEmpaque(empId, meds))
                .catch(e => console.warn(`⚠️ medidas presentación ${empId}:`, e));
              await firstValueFrom(this.empaquePesoVolumenService.saveByEmpaque(empId, pvs))
                .catch(e => console.warn(`⚠️ peso/volumen presentación ${empId}:`, e));
            }
          } catch (e) {
            console.warn(`⚠️ No se pudieron guardar presentaciones del proveedor ${realId}:`, e);
          }
        }

        // Sincronizar campo11 → detailsreqoc.observation para cotizaciones existentes
        for (const row of rowsToSync) {
          firstValueFrom(
            this.ocAndReqsService.syncObservationBySupplieAndProvider(row.campo1, row.idTabla, row.campo11)
          ).catch(e => console.warn(`⚠️ No se pudo sincronizar observation para ${row.campo1}:`, e));
        }

        // DESHABILITADO (2026-05-12): En esta tabla, proveedores nuevos NO deben marcarse como "por autorizar"
        // Solo deben quedar con campo7 = false al guardar. Esta funcionalidad se usa en otros contextos.
        // for (const prov of newProvidersToAuthorize) {
        //   firstValueFrom(
        //     this.ocAndReqsService.patchProveedorXTablaCampo7(prov.idSupplie, prov.idProveedor, true)
        //   ).catch(e => console.warn(`⚠️ No se pudo marcar "Por autorizar" para material ${prov.idSupplie} proveedor ${prov.idProveedor}:`, e));
        // }

        // Sincronizar vigente de sucursales al mismo estado que el proveedor-material
        for (const { id: rowId, active: newActive } of rowsToSyncSucursales) {
          try {
            const sucursales: any[] = await firstValueFrom(
              this.sucursalByMaterialProveedorService.getSucursalByMaterial(rowId)
            );
            if (sucursales?.length > 0) {
              await Promise.all(
                sucursales.map((suc: any) =>
                  firstValueFrom(
                    this.sucursalByMaterialProveedorService.updateSucursalByMaterial(suc.id, { ...suc, vigente: newActive })
                  ).catch(e => console.warn(`⚠️ No se pudo sincronizar sucursal ${suc.id}:`, e))
                )
              );
            }
          } catch (e) {
            console.warn(`⚠️ No se pudieron sincronizar sucursales del proveedor-material ${rowId}:`, e);
          }
        }

        this.hasProveedorChanges = false;
        // Limpiar cache: los datos ya están persistidos en BD.
        if (this.params?.data) {
          delete (this.params.data as any).__pendingProveedores;
          delete (this.params.data as any).__pendingProveedoresDirty;
        }

        // Recargar datos desde el servidor para obtener IDs reales
        this.loadProveedorData();

        // Actualizar el contador de proveedores en el grid padre
        this.updateProviderCountInParent();
        this.loadSucursalCounts();

      } catch (error) {
        console.error('❌ Error al guardar proveedores:', error);
      }
    }
  
    this.cdr.detectChanges();}

  // Método para actualizar el contador de proveedores en el grid padre
  updateProviderCountInParent(): void {
    // Acceder al componente padre (MaterialesMaestroComponent) a través del contexto
    if (this.params && this.params.context && this.params.context.componentParent) {
      const parentComponent = this.params.context.componentParent;
      if (typeof parentComponent.updateProviderCount === 'function') {
        parentComponent.updateProviderCount(this.materialId);
      } else {
        console.warn('⚠️ El componente padre no tiene el método updateProviderCount');
      }
    } else {
      console.warn('⚠️ No se encontró el componente padre en el contexto');
    }
  }

  revertChanges() {
    // Limpiar cache: ya no hay cambios pendientes.
    if (this.params?.data) {
      delete (this.params.data as any).__pendingProveedores;
      delete (this.params.data as any).__pendingProveedoresDirty;
    }
    this.loadProveedorData();
    this.hasProveedorChanges = false;
    this.selectedProveedor = null;
  }

  async deleteSelectedProveedor(): Promise<void> {
    if (!this.selectedProveedor || !this.params.context.MATERIAL.delete) {
      return;
    }

    // Validar si el proveedor tiene sucursales asociadas antes de borrar
    if (this.selectedProveedor.id && !String(this.selectedProveedor.id).startsWith('temp_')) {
      try {
        const sucursales = await firstValueFrom(
          this.sucursalByMaterialProveedorService.getSucursalByMaterial(this.selectedProveedor.id)
        );
        if (sucursales && sucursales.length > 0) {
          alerts.basicAlert(
            'No se puede eliminar',
            `Este proveedor tiene ${sucursales.length} sucursal(es) asignada(s). Elimine primero las sucursales antes de borrar el proveedor.`,
            'warning'
          );
          return;
        }
      } catch (error) {
        console.error('Error verificando sucursales del proveedor:', error);
      }
    }

    if (this.params && this.params.context && this.params.context.MATERIAL && this.params.context.MATERIAL.delete) {
      const providerName = this.getProviderDisplayName(
        this.filteredProviders?.find((p: any) => p.id === this.selectedProveedor.idTabla)
        || this.providers?.find((p: any) => p.id === this.selectedProveedor.idTabla)
      ) || `ID ${this.selectedProveedor.idTabla}`;

      const confirm = await alerts.confirmAlert(
        'Eliminar proveedor',
        `Se eliminará permanentemente la asignación de "${providerName}" a este material. ¿Continuar?`,
        'warning',
        'Sí, eliminar'
      );
      if (!confirm.isConfirmed) return;

      this.params.context.MATERIAL.delete(
        { data: this.selectedProveedor, api: this.proveedorGridApi },
        () => {
          // Limpiar cache: estado consistente con el backend tras delete.
          if (this.params?.data) {
            delete (this.params.data as any).__pendingProveedores;
            delete (this.params.data as any).__pendingProveedoresDirty;
          }
          this.loadProveedorData();
          this.selectedProveedor = null;
          this.hasProveedorChanges = false;
          setTimeout(() => {
            this.updateProviderCountInParent();
          }, 500);
        }
      );
    }
  
    this.cdr.detectChanges();}

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
