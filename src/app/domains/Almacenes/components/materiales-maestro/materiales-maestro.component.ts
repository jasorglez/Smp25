import { Component, OnInit, OnDestroy, inject, effect, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { DetalleAsignProveedsMaestroComponent } from './details/detalle-asignproveeds-matmaestro.component';
import { DetailCellRendererFamiliaComponent } from './details/detail-cell-renderer-familia.component';
import { DetailCellRendererSucursalComponent } from './details/detail-cell-renderer-sucursal.component';
import { DetallesCostosxmaterialesComponent } from './details/detalles-costosxmateriales.component';
import { DetailCellRendererSubfamiliaComponent } from './details/detail-cell-renderer-subfamilia.component';
import { DetallesSucursalesProveedorComponent } from './details/detalles-sucursalesproveedor.component';
import { DetailCellRendererParametrosComponent } from './details/detail-cell-renderer-parametros.component';
import { DetailCellRendererHistoricoComponent } from './details/detail-cell-renderer-historico.component';
import { DetailCellRendererJarabeComponent } from './details/detail-cell-renderer-jarabe.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { ImageCellRendererComponent } from './renderers/image-cell-renderer.component';
import { MaterialsService } from 'app/services/materials.service';
import { MaterialsResponse } from 'app/interface/materials.interface';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { lastValueFrom, Subscription } from 'rxjs';
import { SubfamiliaModalService, ModalData } from './services/subfamilia-modal.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PendingChangesService } from 'app/services/pending-changes.service';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DetalleAsignProveedsMaestroComponent,
    DetailCellRendererFamiliaComponent,
    DetailCellRendererSucursalComponent,
    DetallesCostosxmaterialesComponent,
    DetailCellRendererSubfamiliaComponent,
    DetallesSucursalesProveedorComponent,
    DetailCellRendererParametrosComponent,
    DetailCellRendererHistoricoComponent,
    DetailCellRendererJarabeComponent,
    SelectWithTooltipEditorV2Component,
    ImageCellRendererComponent,
    AutocompleteEditorComponent
  ],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements OnInit, OnDestroy {

  // ========== INPUTS/OUTPUTS PARA MODO MODAL ==========
  @Input() isModalMode: boolean = false;
  @Input() filterMaterialId: number | null = null;
  @Input() idRootInput: number | null = null;
  @Output() onSaveComplete = new EventEmitter<void>();

  private gridApi!: GridApi;
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private providersService = inject(ProvidersService);
  private customersService = inject(CustomersService);
  private branchsService = inject(BranchsService);
  private subfamiliaModalService = inject(SubfamiliaModalService);
  private route = inject(ActivatedRoute);
  public activeModal = inject(NgbActiveModal, { optional: true });
  /** Bus central de cambios pendientes para Niveles 2 (proveedores) y 3 (sucursales).
   *  El botón Guardar único persiste también esos cambios además de los del Nivel 1. */
  public pendingChangesService = inject(PendingChangesService);

  // ✅ Cuando la ruta lo indica (secciones "Bienes y servicios no productivos" y
  // "Articulos y servicios nuevos"), se ocultan columnas: Merma, Fecha Cambio,
  // Materiales, Parametros, Donde Usa.
  private hideNonProductiveColumns: boolean = false;

  // ✅ Bit de catalogo por el que filtra la sección actual:
  // 'MATERIAL' (Materia Prima), 'BIENESYSERVICIOS', 'ARTICULOSNUEVOS'.
  private sectionBitFilter: string = 'MATERIAL';

  rowData: any[] | null = null;
  allMaterialsData: MaterialsResponse[] = []; // Guarda todos los datos
  gridHeight: string = '80vh';
  selectedMaterial: MaterialsResponse | null = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;
  private pendingScrollTarget: { id?: number | string; articulo?: string } | null = null;
  data: any[] = [];
  // Catálogos para los combos
  categories: any[] = [];
  families: any[] = [];
  subfamilies: any[] = [];
  idSelect:number = 0;

  // Modal de subfamilias
  private modalSubscription?: Subscription;
  showModal = false;
  modalType: 'subfamilia' | 'flavor' | 'presentation' = 'subfamilia';
  modalMode: 'add' | 'edit' = 'add';
  modalData: ModalData | null = null;
  modalForm = {
    description: '',
    active: true
  };

  // Modal de imagen
  showImageModal = false;
  selectedImageUrl = '';

  // Cache para evitar re-renderizado
  private _colMaster: ColDef[] | null = null;
  private _gridOptions: any = null;
  private _detailParams: any = null; // Cache del objeto detailCellRendererParams
  private _isOpeningDetail = false; // Flag para evitar re-renders durante apertura de detalle

  // Modal de agregar/editar material
  showMaterialModal = false;
  materialModalMode: 'add' | 'edit' = 'add';
  materialForm = {
    insumo: '',
    articulo: '',
    idCategory: 0,
    idFamilia: 0,
    picture: '',
    active: true
  };
  selectedImageFile: File | null = null;
  previewImageUrl: string = '';


  // Datos de proveedores por material
  materialsXTableData: { [key: number]: any[] } = {};

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      // ✅ Solo ejecutar este effect si NO estamos en modo modal
      if (this.isModalMode) {
        return;
      }

      const newIdRoot = this.signalsService.getRootSelectedBySidebar()();
      if (newIdRoot && newIdRoot !== this.idRoot) {
        this.idRoot = newIdRoot;
        this.loadMaterials();
      }
    });
  }

  ngOnInit() {
    // ✅ Detectar si la ruta pide ocultar columnas (sección "Vienes y servicios no productivos").
    // En modo modal no aplica: siempre se muestran todas las columnas.
    this.hideNonProductiveColumns =
      !this.isModalMode && !!this.route.snapshot.data?.['hideNonProductive'];

    this.sectionBitFilter =
      (!this.isModalMode && this.route.snapshot.data?.['bitFilter']) || 'MATERIAL';

    // ✅ Si estamos en modo modal, usar idRootInput en lugar de signal
    if (this.isModalMode && this.idRootInput) {
      this.idRoot = this.idRootInput;
      this.loadCatalogs();
      this.loadMaterialByIdFilter();
    } else if (this.idRoot) {
      this.loadMaterials();
    }

    // Suscribirse a las solicitudes de modal del servicio
    this.modalSubscription = this.subfamiliaModalService.modalRequest$.subscribe(data => {
      this.handleModalRequest(data);
    });
  }

  ngOnDestroy() {
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }
  }

  async loadCatalogs() {
    if (!this.idRoot) return;

    try {
      // Cargar categorías, familias y subfamilias en paralelo
      [this.categories, this.families, this.subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'CATEGORY', this.sectionBitFilter)),
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'FAM-CAT', this.sectionBitFilter)),
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'SUB-FAM', this.sectionBitFilter))
      ]);

    } catch (error) {
      console.error('Error loading catalogs:', error);
    }
  }
  
  // Obtener familias de una categoría específica
  getFamiliesByCategory(categoryId: number): any[] {
    return this.families.filter(f => f.parentId === categoryId );
  }

  // Obtener subfamilias de una familia específica
  getSubfamiliesByFamily(familyId: number): any[] {
    if (!familyId) return [];
    return this.subfamilies.filter(sf => sf.subParentId === familyId);
  }

  async loadMaterials() {
    if (!this.idRoot) {
      console.warn('No idRoot available');
      return;
    }

    this.rowData = null;

    // Cargar los catálogos (filtrados por el bit de la sección) antes de
    // filtrar la tabla: un material solo se muestra si su categoría, familia
    // y subfamilia están las 3 marcadas con el bit de la sección actual.
    await this.loadCatalogs();

        this.materialsService.getMaterialsxview(this.idRoot).subscribe({
          next: (data) => {
            this.allMaterialsData = data; // snapshot del estado original en BD
            this.rowData = this.filterMaterialsByCatalogBit(data)
              .slice()
              .sort((a, b) => {
                const activeA = a.active ? 1 : 0;
                const activeB = b.active ? 1 : 0;
                return activeB - activeA;
              })
              .map(material => ({
                ...material,
              }));
            if (this.pendingScrollTarget) {
              setTimeout(() => this.scrollToTarget(), 150);
            }
          },
          error: (error) => {
            console.error('Error loading materials:', error);
            alerts.basicAlert('Error', 'Error al cargar materiales', 'error');
          }
        });
  }

  // Filtra materiales: solo los que tienen su categoría, familia y subfamilia
  // presentes en los catálogos de la sección (los 3 niveles con el bit en true).
  private filterMaterialsByCatalogBit(materials: any[]): any[] {
    const catIds = new Set(this.categories.map(c => c.id));
    const famIds = new Set(this.families.map(f => f.id));
    const subIds = new Set(this.subfamilies.map(s => s.id));
    return materials.filter(m =>
      catIds.has(m.idCategory) && famIds.has(m.idFamilia) && subIds.has(m.idSubfamilia)
    );
  }

  // ✅ Método para cargar un material específico (modo modal)
  async loadMaterialByIdFilter() {
    if (!this.idRoot || !this.filterMaterialId) {
      console.warn('⚠️ No idRoot o filterMaterialId disponible');
      console.warn('   idRoot:', this.idRoot);
      console.warn('   filterMaterialId:', this.filterMaterialId);
      return;
    }

    try {

      const allMaterials = await lastValueFrom(
        this.materialsService.getMaterialsxview(this.idRoot)
      );


      // Filtrar el material específico por ID (comparar como números)
      const filteredMaterial = allMaterials.find(m => {
        const match = Number(m.id) === Number(this.filterMaterialId);
        if (match) {
        }
        return match;
      });

      if (filteredMaterial) {
        this.rowData = [{
          ...filteredMaterial,
        }];
      } else {
        console.warn('⚠️ No se encontró material con ID:', this.filterMaterialId);
        console.warn('   IDs disponibles (primeros 10):', allMaterials.slice(0, 10).map(m => m.id));
        this.rowData = [];
      }
    } catch (error) {
      console.error('❌ Error cargando material filtrado:', error);
      alerts.basicAlert('Error', 'Error al cargar el material', 'error');
    }
  }


  components = {
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRendererProveedores: DetalleAsignProveedsMaestroComponent,
    detailCellRendererFamilia: DetailCellRendererFamiliaComponent,
    detailCellRendererSucursal: DetailCellRendererSucursalComponent,
    detailCellRendererCostos: DetallesCostosxmaterialesComponent,
    detailCellRendererSubfamilia: DetailCellRendererSubfamiliaComponent,
    detailCellRendererProveedorSucursal: DetallesSucursalesProveedorComponent,
    detailCellRendererParametros: DetailCellRendererParametrosComponent,
    detailCellRendererHistorico: DetailCellRendererHistoricoComponent,
    detailCellRendererJarabe: DetailCellRendererJarabeComponent
  };

  public get gridOptions(): any {
    if (this._gridOptions) {
      return this._gridOptions;
    }

    this._gridOptions = {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      suppressClickEdit: false,
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: false,
      masterDetail: true,
      detailRowHeight: 600, // Altura del detail row para subfamilias (ajustable)
      isRowMaster: (dataItem: any) => {
        return true; // Todas las filas son maestras
      },
      detailCellRendererSelector: (params: any) => {
        if (params.data.detailType === 'proveedores') {
          return { component: 'detailCellRendererProveedores' };
        } else if (params.data.detailType === 'familia') {
          return { component: 'detailCellRendererFamilia' };
        } else if (params.data.detailType === 'sucursal') {
          return { component: 'detailCellRendererSucursal' };
        } else if (params.data.detailType === 'subfamilia') {
          return { component: 'detailCellRendererSubfamilia' };
        } else if (params.data.detailType === 'costos') {
          return { component: 'detailCellRendererCostos' };
        } else if (params.data.detailType === 'parametros') {
          return { component: 'detailCellRendererParametros' };
        } else if (params.data.detailType === 'historico') {
          return { component: 'detailCellRendererHistorico' };
        }
        return undefined;
      },
      getRowClass: (params: any) => {
        if (params.node.isSelected()) {
          return 'selected-row';
        }
        if (params.data.__isNew) {
          return 'new-row-highlight';
        }
        if (params.data.__modified) {
          return 'modified-row';
        }
        if (params.data.active === false || params.data.active === 0) {
          return 'inactive-row-highlight';
        }
        return '';
      },
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.gridApi.forEachNode((node) => {
            if (node.id !== event.node.id) {
              node.setSelected(false);
            }
          });
        }
      },
      onCellValueChanged: (event: any) => {

        // Convertir active a true/false (nunca NULL)
        if (event.colDef.field === 'active') {
          event.data.active = event.newValue === true || event.newValue === 1 ? true : false;
        }

        event.data.__modified = true;
        this.hasUnsavedChanges = true;

        // ✅ No hacer refreshCells para columnas de texto editables (insumo, articulo)
        // porque cierra el editor mientras el usuario está escribiendo
        const editableTextColumns = ['insumo', 'articulo', 'fecha'];
        if (!editableTextColumns.includes(event.colDef.field)) {
          // Envolver en setTimeout para evitar conflictos de renderizado
          setTimeout(() => {
            this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
          }, 0);
        }
      },
      onColumnPinned: (event: any) => {
        this.saveColumnState();
      },
      onColumnVisible: (event: any) => {
        this.saveColumnState();
      },
      onColumnMoved: (event: any) => {
        this.saveColumnState();
      },
      onColumnResized: (event: any) => {
        this.saveColumnState();
      },
      onFirstDataRendered: (params: any) => {
        runAutosizeAllColumns(params.api);
      },
    };

    return this._gridOptions;
  }

  get colMaster(): ColDef[] {
    if (this._colMaster) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'active',
        headerName: 'Activo',
        width: 100,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor'
      },
      {
        colId: 'porAutorizar',
        headerName: 'Por autorizar',
        width: 130,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params: any) => {
          // En algunos endpoints el flag puede venir con nombres distintos.
          // Si no existe, por defecto mostramos "false".
          return !!(params?.data?.autorizacion ?? params?.data?.porAutorizar ?? params?.data?.pendingAuthorization);
        },
        cellRenderer: (params: any) => {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.disabled = true;
          input.checked = !!params.value;
          input.title = 'Por autorizar (solo lectura)';
          input.style.margin = '0 auto';
          return input;
        },
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
      {
        field: 'insumo',
        headerName: 'Num Mat',
        width: 130,
        filter: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
        editable: false,
        cellEditor: 'agTextCellEditor',
        valueParser: (params: any) => {
          return params.newValue ? params.newValue.toUpperCase() : '';
        }
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 350,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true,
        },
        editable: true,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: () => ({
          filterList: this.rowData
            .filter((row: any) => !row.__isNew)
            .map((row: any) => (row.articulo || '').toUpperCase())
            .filter((v: string) => v.length > 0),
          toUpperCase: true,
          placeholder: 'Buscar artículo...'
        }),
        valueSetter: (params: any) => {
          const newValue = (params.newValue || '').toUpperCase().trim();
          if (!newValue) return false;

          const duplicate = this.rowData.some((row: any, idx: number) =>
            !row.__isNew &&
            (row.articulo || '').toUpperCase().trim() === newValue
          );

          if (duplicate) {
            alerts.basicAlert(
              'Artículo duplicado',
              `El artículo "${newValue}" ya existe en el catálogo.`,
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = newValue;
          return true;
        },
        cellStyle: (params: any) => {
          if ((params.data.providerCount ?? 0) === 0) {
            return { backgroundColor: '#ffe4ec' };
          }
          return null;
        }
      },
      {
        field: 'idCategory',
        headerName: 'Categoria',
        width: 250,
        editable: true,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: this.categories.map(c => ({
            id: c.id,
            description: c.description,
            valueAddition: c.valueAddition,
            valueAddition2: c.valueAddition2,
            valueAdditionBit: c.valueAdditionBit
          }))
        }),
        valueFormatter: (params: any) => {
          const cat = this.categories.find(c => c.id === params.value);
          return cat ? cat.description : params.data.categoria || '';
        },
        onCellValueChanged: (params: any) => {
          // Cuando cambia la categoría, resetear familia y subfamilia
          params.data.idFamilia = null;
          params.data.familia = '';
          params.data.idSubfamilia = null;
          params.data.subfamilia = '';
          this.hasUnsavedChanges = true;
          // Refrescar la fila para actualizar el combo de familia usando setTimeout
          //setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          //}, 0);
        }
      },
      {
        field: 'idFamilia',
        headerName: 'Familia',
        width: 200,
        editable: (params: any) => {
          // Solo editable si hay una categoría seleccionada
          return params.data.idCategory != null;
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => {
          // Obtener familias filtradas por la categoría seleccionada
          const familiesFiltered = this.getFamiliesByCategory(params.data.idCategory);
          return {
            options: familiesFiltered.map(f => ({
              id: f.id,
              description: f.description,
              valueAddition: f.valueAddition,
              valueAddition2: f.valueAddition2
            }))
          };
        },
        valueFormatter: (params: any) => {
          const fam = this.families.find(f => f.id === params.value);
          return fam ? fam.description : params.data.familia || '';
        },
        onCellValueChanged: (params: any) => {
          // Cuando cambia la familia, resetear subfamilia
          params.data.idSubfamilia = null;
          params.data.subfamilia = '';
          this.hasUnsavedChanges = true;
          //setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          //}, 0);
        },
        cellStyle: (params: any) => {
          if (!params.data.idCategory) {
            return { backgroundColor: '#f0f0f0', color: '#999' };
          }
          return null;
        }
      },
      {
        field: 'idSubfamilia',
        headerName: 'Subfamilia',
        filter: true,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },
        width: 200,
        editable: (params: any) => {
          // Solo editable si hay una familia seleccionada
          return params.data.idFamilia != null;
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => {
          // Obtener subfamilias filtradas por la familia seleccionada
          const subfamiliesFiltered = this.getSubfamiliesByFamily(params.data.idFamilia);
          return {
            options: subfamiliesFiltered.map(sf => ({
              id: sf.id,
              description: sf.description,
              valueAddition: sf.valueAddition,
              valueAddition2: sf.valueAddition2
            }))
          };
        },
        valueFormatter: (params: any) => {
          const sf = this.subfamilies.find(sf => sf.id === params.value);
          return sf ? sf.description : params.data.subfamilia || '';
        },
        onCellValueChanged: (params: any) => {
          this.hasUnsavedChanges = true;
          //setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          //}, 0);
        },
        cellStyle: (params: any) => {
          if (!params.data.idFamilia) {
            return { backgroundColor: '#f0f0f0', color: '#999' };
          }
          return null;
        }
      },
      {
        field: 'validaPresentaciones',
        headerName: 'Valida Presentaciones',
        width: 160,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        headerTooltip: 'Si está activo, la requisición valida que la cantidad sea combinación de presentaciones (además del mínimo de compra).',
      },
      {
        field: 'providerCount',
        headerName: 'Proveedor',
        width: 120,
        cellRenderer: (params: any) => {
          return params.value || 0;
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'costo',
        headerName: 'Materiales',
        width: 150,
        hide: this.hideNonProductiveColumns,
        valueFormatter: (params: any) => {
          return `$${params.value}`;
        },
        cellRenderer: (params: any) => {
          return `$${params.value}`;
        },
        cellStyle: (params: any) => {
          // Bloqueo por `__isNew` removido: el Guardar centralizado del Nivel 1
          // remapea ID temporal → real antes de persistir cascadas.
          const familia = this.families?.find((f: any) => f.id === params.data.idFamilia);
          const familiaDesc = familia?.description || params.data.familia || '';
          if (familiaDesc.toUpperCase().includes('BASICA')) {
            return { backgroundColor: '#e8f5e9', cursor: 'not-allowed', color: '#aaa', textDecoration: 'none' };
          }
          return { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' };
        }
      },
      {
        field: 'parametros',
        headerName: 'Parametros',
        width: 150,
        hide: this.hideNonProductiveColumns,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          return count;
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      
      
 
     {
        field: 'historico',
        headerName: 'Historico',
        width: 150,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          return count;
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },


      {
        field: 'picture',
        headerName: 'Imagen',
        width: 150,
        cellRenderer: ImageCellRendererComponent,
        cellRendererParams: {
          context: {
            componentParent: this
          }
        }
      },
      {
        headerName: 'Fecha Cambio',
        field: 'fecha',
        editable: true,
        hide: this.hideNonProductiveColumns,
        filter: 'agDateColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 150,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          // Si no hay fecha, usar fecha actual
          if (!params.data.fecha) {
            return new Date().toISOString();
          }
          return params.data.fecha;
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.fecha = new Date().toISOString();
            return true;
          }

          const date = new Date(params.newValue);
          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha inválida', 'error');
            return false;
          }

          params.data.fecha = date.toISOString();
          return true;
        },
        valueFormatter: (params) => {
          try {
            // Si no hay valor, usar fecha actual
            const dateValue = params.value || new Date().toISOString();
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';
            return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          } catch {
            return '';
          }
        },
      },
      { headerName: 'Merma', field: 'merma', editable: true, hide: this.hideNonProductiveColumns },
      {
        field: 'subfamilyCount',
        headerName: 'Donde Usa',
        width: 150,
        hide: this.hideNonProductiveColumns,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          return count;
        },
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
      },
    ];

    return this._colMaster;
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'providerCount') return 'proveedores';
    if (colId === 'subfamilyCount') return 'subfamilia';
    if (colId === 'parametros') return 'parametros';
    if (colId === 'costo') return 'costos';
    if (colId === 'historico') return 'historico';
    return null;
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');

      switch (detailType) {
        case 'proveedores':
          div.innerText = params.value || '';
          break;
        case 'subfamilia':
          div.innerText = params.value || '';
          break;
      }

      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';

      return div;
    };
  }

  onCellClicked(event: any): void {
    // ✅ Si estamos editando una celda, no hacer nada para evitar cerrar el editor
    const editableColumns = ['insumo', 'articulo', 'fecha'];
    const currentColId = event.column.getColId();
    if (editableColumns.includes(currentColId) && this.gridApi.getEditingCells().length > 0) {
      return;
    }

    event.node.setSelected(true);
    this.data = event.data;
    this.idSelect = event.data.id; // Asignar el ID seleccionado

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'providerCount' || colId === 'subfamilyCount' || colId === 'parametros' || colId === 'costo' || colId === 'historico';

    if (isDetailColumn) {
      // Bloqueo previo por `__isNew` removido: con el Guardar centralizado del Nivel 1
      // (PendingChangesService) ahora se puede capturar datos en cascadas antes de guardar
      // el material; el saveChanges() remapea el ID temporal al real antes de persistir hijos.

      // Si la columna es "Materiales" y la Familia es "Básica", bloquear el clic
      if (colId === 'costo') {
        const familia = this.families?.find((f: any) => f.id === event.data.idFamilia);
        const familiaDesc = familia?.description || event.data.familia || '';
        if (familiaDesc.toUpperCase().includes('BASICA')) {
          return;
        }
      }
      
      // Marcar que se está abriendo un detalle para evitar re-renders
      this._isOpeningDetail = true;

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

        // Regresar el scroll al registro que estaba seleccionado
        setTimeout(() => {
          api.ensureNodeVisible(node, 'middle');
        }, 50);
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

    // Cargar estado de columnas desde localStorage
    this.loadColumnState();

    // ✅ En la sección "Vienes y servicios no productivos" forzar que estas columnas
    // queden ocultas, aunque un estado guardado intente mostrarlas.
    if (this.hideNonProductiveColumns) {
      this.gridApi.setColumnsVisible(
        ['merma', 'fecha', 'costo', 'parametros', 'subfamilyCount'],
        false
      );
    }

    // Configurar master-detail SOLO la primera vez
    if (!this._detailParams) {
      this.updateGridContext();
    }
  }

  // ✅ Clave de localStorage del estado de columnas. Distinta por sección para que
  // "Materiales Maestro" y "Vienes y servicios no productivos" no se contaminen entre sí
  // (de lo contrario, el estado de una sección reaparecería las columnas ocultas de la otra).
  private getColumnStateKey(): string {
    const suffix = this.sectionBitFilter === 'MATERIAL' ? '' : `_${this.sectionBitFilter.toLowerCase()}`;
    return `materiales_column_state${suffix}_${this.idRoot}`;
  }

  // Guardar estado de columnas (pin, orden, visibilidades) en localStorage
  private saveColumnState() {
    if (!this.gridApi) return;

    try {
      const columnState = this.gridApi.getColumnState();
      const localStorageKey = this.getColumnStateKey();
      localStorage.setItem(localStorageKey, JSON.stringify(columnState));
    } catch (error) {
      console.error('Error guardando estado de columnas:', error);
    }
  }

  // Cargar estado de columnas desde localStorage
  private loadColumnState() {
    if (!this.gridApi) return;

    try {
      const localStorageKey = this.getColumnStateKey();
      const savedState = localStorage.getItem(localStorageKey);

      if (savedState) {
        const columnState = JSON.parse(savedState);

        // Verificar si el estado guardado incluye "Por autorizar"
        // Si no lo incluye, es un estado antiguo y debe borrarse
        const hasPorAutorizarColumn = columnState.some((col: any) =>
          col.colId === 'porAutorizar'
        );

        if (!hasPorAutorizarColumn) {
          localStorage.removeItem(localStorageKey);
          return;
        }

        this.gridApi.applyColumnState({
          state: columnState,
          applyOrder: true
        });
      }
    } catch (error) {
      console.error('Error cargando estado de columnas:', error);
      // Si hay error, borrar el estado corrupto
      try {
        const localStorageKey = this.getColumnStateKey();
        localStorage.removeItem(localStorageKey);
      } catch (e) {}
    }
  }

  // Actualizar el contexto del grid (llamado cuando cambia idRoot o al inicializar el grid)
  updateGridContext() {
    if (!this.gridApi) return;

    if (!this._detailParams) {
      // Primera vez: crear el objeto y registrarlo en AG Grid
      this._detailParams = {
        getDetailRowData: (params: any) => {
          params.successCallback(params.data.detailData);
        },
        context: {
          idRoot: this.idRoot,
          data: this.data,
          select: this.idSelect,
          componentParent: this,
          mainGridApi: this.gridApi,
          MATERIAL: {
            load: (materialId: number, type: string, callback: (data: any[]) => void) => {
              this.loadMaterialXTableData(materialId, type, callback);
            },
            // Devuelve un Map<tempProveedorId, realProveedorId> para que el Nivel 2
            // pueda propagarlo a Nivel 3 (sucursales) vía el idMap del PendingChangesService.
            save: (materialId: number, data: any[], type: string): Promise<Map<string, number>> => {
              return this.saveMaterialDetailsById(materialId, data, type);
            },
            delete: (params: any, callback: () => void) => {
              this.deleteDetailRow(params, callback, 'MATERIAL');
            }
          }
        }
      };
      this.gridApi.setGridOption('detailCellRendererParams', this._detailParams);
    } else {
      // Solo actualizar si hay cambios reales
      const hasChanges = 
        this._detailParams.context.idRoot !== this.idRoot ||
        this._detailParams.context.select !== this.idSelect ||
        this._detailParams.context.data !== this.data;
      
      if (hasChanges) {
        this._detailParams.context.idRoot = this.idRoot;
        this._detailParams.context.data = this.data;
        this._detailParams.context.select = this.idSelect;
        this._detailParams.context.mainGridApi = this.gridApi;
      }
    }
  }

  // Método para actualizar el subfamilyCount de un material específico
  updateSubfamilyCount(materialId: number) {
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Buscar solo el material actualizado
        const updatedMaterial = data.find(m => m.id === materialId);
        if (updatedMaterial && this.gridApi) {
          // Actualizar solo la fila específica
          this.gridApi.forEachNode((node) => {
            if (node.data && node.data.id === materialId) {
              node.data.subfamilyCount = updatedMaterial.subfamilyCount;
              this.gridApi.refreshCells({
                rowNodes: [node],
                columns: ['subfamilyCount'],
                force: true
              });
            }
          });
        }
      },
      error: (error) => {
        console.error('❌ Error al actualizar subfamilyCount:', error);
      }
    });
  }

  // Método para actualizar el providerCount de un material específico
  updateProviderCount(materialId: number) {
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Buscar solo el material actualizado
        const updatedMaterial = data.find(m => m.id === materialId);
        if (updatedMaterial && this.gridApi) {
          // Actualizar solo la fila específica
          this.gridApi.forEachNode((node) => {
            if (node.data && node.data.id === materialId) {
              node.data.providerCount = updatedMaterial.providerCount;
              this.gridApi.refreshCells({
                rowNodes: [node],
                columns: ['providerCount'],
                force: true
              });
            }
          });
        }
      },
      error: (error) => {
        console.error('❌ Error al actualizar providerCount:', error);
      }
    });
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedMaterial = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addMaterial(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      insumo: '',
      articulo: '',
      idCategory: null,
      idFamilia: null,
      idSubfamilia: null,
      idMedida: null,
      idUbication: null,
      description: '',
      date: new Date().toISOString(),
      aplicaResg: false,
      picture: '',
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      vigente: true,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'articulo'
      });
    }, 0);
  }

  editMaterial(): void {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para editar', 'warning');
      return;
    }

    // Iniciar edición en la primera celda editable
    const selectedNode = this.gridApi.getSelectedNodes()[0];
    if (selectedNode) {
      this.gridApi.startEditingCell({
        rowIndex: selectedNode.rowIndex!,
        colKey: 'insumo'
      });
    }
  }

  async deleteMaterial(): Promise<void> {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para eliminar', 'warning');
      return;
    }

    const material: any = this.selectedMaterial;
    const referencias: string[] = [];

    if (material.providerCount > 0) {
      referencias.push(`${material.providerCount} Proveedor(es)`);
    }
    if (material.subfamilyCount > 0) {
      referencias.push(`${material.subfamilyCount} Registro(s) en "Donde Usa"`);
    }
    if (material.parametros > 0) {
      referencias.push(`${material.parametros} Parametro(s)`);
    }
    if (material.historico > 0) {
      referencias.push(`${material.historico} Historico(s)`);
    }

    if (referencias.length > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        `El material "${material.insumo} - ${material.articulo}" tiene las siguientes referencias:\n\n${referencias.join('\n')}\n\nElimine las referencias primero antes de borrar el material.`,
        'warning'
      );
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar material?',
      `¿Está seguro de eliminar el material ${material.insumo} - ${material.articulo}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        const materialId = typeof this.selectedMaterial.id === 'string' ?
          parseInt(this.selectedMaterial.id.replace('temp_', '')) :
          this.selectedMaterial.id;

        await lastValueFrom(this.materialsService.deleteMaterial(materialId));
        alerts.basicAlert('Eliminado', 'El material ha sido eliminado correctamente', 'success');
        this.selectedMaterial = null;
        this.loadMaterials(); // Recargar datos
      } catch (error: any) {
        console.error('Error al eliminar material:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudo eliminar el material: ${errorMsg}`, 'error');
      }
    }
  }

  async saveChanges(): Promise<void> {
    const hasChildChanges = this.pendingChangesService.hasAnyChanges();
    // Capturar los saverIds con cambios ANTES de cualquier saveAll (saveAll resetea hasChanges).
    const changedSaverIds = this.pendingChangesService.getChangedSaverIds();
    if (!this.hasUnsavedChanges && !hasChildChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Si SÓLO hay cambios de hijos (Nivel 2/3/4) y nada en Nivel 1, persistimos los hijos y salimos.
    if (!this.hasUnsavedChanges && hasChildChanges) {
      try {
        // Sin Nivel 1 nuevo, no hay idMap; los hijos guardan con IDs ya conocidos.
        await this.pendingChangesService.saveAll();
        await this.bumpFechaForCascadeMaterials(changedSaverIds, new Set<number>());
        alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      } catch (error: any) {
        console.error('Error al guardar cambios de hijos:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
      }
      return;
    }

    // Buscar filas nuevas y modificadas
    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      // Nivel 1 no tiene cambios reales, pero podría haber cambios en hijos.
      if (hasChildChanges) {
        try {
          await this.pendingChangesService.saveAll();
          await this.bumpFechaForCascadeMaterials(changedSaverIds, new Set<number>());
          alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
        } catch (error: any) {
          console.error('Error al guardar cambios de hijos:', error);
          const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
          alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
        }
        this.hasUnsavedChanges = false;
        return;
      }
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      this.hasUnsavedChanges = false;
      return;
    }

    // Validar campos requeridos en filas nuevas
    for (const row of newRows) {
      const faltantes: string[] = [];
      if (!row.idCategory)   faltantes.push('Categoría');
      if (!row.idFamilia)    faltantes.push('Familia');
      if (!row.idSubfamilia) faltantes.push('Subfamilia');

      if (faltantes.length > 0) {
        alerts.basicAlert(
          'Campos requeridos',
          `El registro "${row.articulo || row.insumo || 'nuevo'}" requiere completar: ${faltantes.join(', ')}.`,
          'warning'
        );
        return;
      }
    }

    // Mapa tempId → realId para que las cascadas (PendingChangesService) remapeen
    // su referencia al material padre (campo1 en proveedores, etc.) antes de persistir.
    const idMap = new Map<string, number>();

    try {
      // Guardar nuevos registros
      for (const newRow of newRows) {
        const tempId = newRow.id; // ej. 'temp_1'
        const materialData = this.prepareMaterialData(newRow);
        const response: any = await lastValueFrom(this.materialsService.addMaterial(materialData));
        console.log('[saveChanges] addMaterial response:', response, 'tempId:', tempId);
        // Capturar ID real probando todos los shapes comunes del backend C#.
        let realId = Number(
          response?.id ??
          response?.Id ??
          response?.ID ??
          response?.data?.id ??
          response?.data?.Id ??
          response?.Data?.id ??
          response?.Data?.Id ??
          response?.result?.id ??
          0
        );
        // Fallback: recargar lista de materiales y buscar por `insumo` único.
        if (!realId && newRow.insumo) {
          try {
            const all: any = await lastValueFrom(this.materialsService.getMaterialsxview(this.idRoot));
            const found = (all || []).find((m: any) => m.insumo === newRow.insumo);
            if (found?.id) {
              realId = Number(found.id);
              console.log('[saveChanges] realId obtenido vía fallback insumo:', realId);
            } else {
              console.warn('[saveChanges] fallback: insumo no encontrado en getMaterialsxview', newRow.insumo);
            }
          } catch (e) {
            console.warn('[saveChanges] fallback getMaterialsxview falló:', e);
          }
        }
        if (realId && typeof tempId === 'string' && tempId.startsWith('temp_')) {
          idMap.set(tempId, realId);
          newRow.id = realId; // Actualiza la fila para que próximas operaciones usen el ID real.
          console.log('[saveChanges] idMap actualizado:', tempId, '→', realId);
        } else if (!realId) {
          console.error('[saveChanges] ⚠️ No se pudo extraer el ID real del material recién creado. Respuesta:', response);
          // ABORTAR el guardado de hijos: sin idMap, los POSTs de cascadas fallarán con 400.
          alerts.basicAlert(
            'Error',
            'No se pudo obtener el ID del material recién creado. Las cascadas (proveedores, etc.) no se guardarán automáticamente. Recarga la página.',
            'error'
          );
          return;
        }
      }
      console.log('[saveChanges] idMap final antes de saveAll:', Array.from(idMap.entries()));

      // Detectar materiales que dejaron de ser PRODUCTO NUEVO (para auto-llenado de cascada)
      const PRODUCTO_NUEVO_FAM_ID = 1316;
      const PRODUCTO_NUEVO_SUB_ID = 1317;
      const materialsThatLeftProductoNuevo: any[] = [];

      // Tracker de consecutivos asignados en este saveChanges (para no duplicar entre materiales del mismo lote)
      const lastConsecutivoByPrefix = new Map<string, number>();

      // Actualizar registros modificados
      for (const modifiedRow of modifiedRows) {
        const snapshot = this.allMaterialsData.find((m: any) => m.id === modifiedRow.id);
        const previousActive = snapshot?.active;
        const activeChanged = previousActive !== undefined && !!previousActive !== !!modifiedRow.active;
        console.log(`🔍 cascade check id=${modifiedRow.id} previousActive=${previousActive} newActive=${modifiedRow.active} activeChanged=${activeChanged}`);

        // Capturar si este material dejó de ser PRODUCTO NUEVO
        if (snapshot) {
          const wasProductoNuevo =
            Number(snapshot.idFamilia) === PRODUCTO_NUEVO_FAM_ID ||
            Number(snapshot.idSubfamilia) === PRODUCTO_NUEVO_SUB_ID;
          const isStillProductoNuevo =
            Number(modifiedRow.idFamilia) === PRODUCTO_NUEVO_FAM_ID ||
            Number(modifiedRow.idSubfamilia) === PRODUCTO_NUEVO_SUB_ID;
          if (wasProductoNuevo && !isStillProductoNuevo) {
            materialsThatLeftProductoNuevo.push({ ...modifiedRow });
          }
        }

        // Regenerar Num Mat (insumo) si cambió categoría, familia o subfamilia
        if (snapshot) {
          const categoryChanged = Number(snapshot.idCategory) !== Number(modifiedRow.idCategory);
          const familiaChanged = Number(snapshot.idFamilia) !== Number(modifiedRow.idFamilia);
          const subfamiliaChanged = Number(snapshot.idSubfamilia) !== Number(modifiedRow.idSubfamilia);

          if (categoryChanged || familiaChanged || subfamiliaChanged) {
            const newInsumo = this.generateInsumoCode(
              Number(modifiedRow.idCategory),
              Number(modifiedRow.idFamilia),
              Number(modifiedRow.idSubfamilia),
              lastConsecutivoByPrefix
            );
            if (newInsumo) {
              modifiedRow.insumo = newInsumo;
              // Reflejar el cambio inmediatamente en el grid
              const gridRow = this.rowData.find((r: any) => r.id === modifiedRow.id);
              if (gridRow) {
                gridRow.insumo = newInsumo;
              }
            }
          }
        }

        // Al guardar cambios del artículo, su "Fecha Cambio" se actualiza a hoy.
        modifiedRow.fecha = new Date().toISOString();
        const materialData = this.prepareMaterialData(modifiedRow);
        await lastValueFrom(this.materialsService.updateMaterial(modifiedRow.id.toString(), materialData));
        if (activeChanged) {
          console.log(`🚀 Llamando cascadeMaterialActive id=${modifiedRow.id} activate=${!!modifiedRow.active}`);
          await lastValueFrom(this.providersService.cascadeMaterialActive(modifiedRow.id, !!modifiedRow.active))
            .catch(e => console.warn(`⚠️ No se pudo propagar active al nivel 2/3 para material ${modifiedRow.id}:`, e));
        }
      }

      // Auto-llenado de cascada para materiales que dejaron de ser PRODUCTO NUEVO (no bloqueante)
      if (materialsThatLeftProductoNuevo.length > 0) {
        await this.autoFillCascadeOnMaterialFamilyChange(materialsThatLeftProductoNuevo)
          .catch(e => console.warn('⚠️ Error en auto-llenado de cascada (PRODUCTO NUEVO → real):', e));
      }

      // Persistir cambios de Niveles 2 (proveedores), 3 (sucursales) y 4 (empaque) en paralelo.
      // Se pasa el `idMap` para que las cascadas que apuntaban a un material recién creado
      // (con id temporal) actualicen su referencia al ID real antes de POSTear al backend.
      // Si fallan, el Nivel 1 ya quedó guardado; reportamos el error sin bloquear el flujo principal.
      try {
        await this.pendingChangesService.saveAll(idMap);
        // Materiales ya guardados en Nivel 1: su fecha ya se actualizó (modificados) o nació hoy (nuevos).
        const savedIds = new Set<number>([
          ...newRows.map((r: any) => Number(r.id)),
          ...modifiedRows.map((r: any) => Number(r.id)),
        ]);
        await this.bumpFechaForCascadeMaterials(changedSaverIds, savedIds);
      } catch (childError: any) {
        console.error('Error al guardar cambios de sub-grids:', childError);
        const childMsg = childError?.error?.message || childError?.message || 'Error desconocido';
        alerts.basicAlert('Aviso', `Material guardado pero algunos sub-grids fallaron: ${childMsg}`, 'warning');
      }

      alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      this.hasUnsavedChanges = false;

      // ✅ Si estamos en modo modal, emitir evento y cerrar
      if (this.isModalMode) {
        this.onSaveComplete.emit();
        if (this.activeModal) {
          this.activeModal.close();
        }
      } else {
        // En modo standalone, recargar y posicionarse en el registro guardado
        if (modifiedRows.length > 0) {
          this.pendingScrollTarget = { id: modifiedRows[0].id };
        } else if (newRows.length > 0) {
          this.pendingScrollTarget = { articulo: newRows[0].articulo };
        }
        this.loadMaterials();
      }
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
    }
  }

  /**
   * Actualiza la columna "Fecha Cambio" (campo `fecha`) a hoy para los materiales que
   * tuvieron cambios en una cascada nivel-2 (proveedor, parámetros, subfamilia, costos).
   * - Omite materiales ya guardados en Nivel 1 (su fecha ya se actualizó / nació hoy).
   * - Omite ids temporales (material nuevo): su fecha ya nace con la de hoy.
   * Usa un payload mínimo { fecha }: el backend hace partial-merge y no toca otros campos.
   */
  private async bumpFechaForCascadeMaterials(changedSaverIds: string[], alreadySavedIds: Set<number>): Promise<void> {
    const NIVEL2_PREFIXES = ['proveedores', 'parametros', 'subfamilia', 'costos'];
    const matIds = new Set<number>();
    for (const sid of changedSaverIds) {
      const parts = String(sid).split('-');
      if (parts.length >= 2 && NIVEL2_PREFIXES.includes(parts[0])) {
        const id = Number(parts[1]);
        if (Number.isFinite(id) && id > 0 && !alreadySavedIds.has(id)) {
          matIds.add(id);
        }
      }
    }
    if (matIds.size === 0) return;

    const nowIso = new Date().toISOString();
    for (const id of matIds) {
      await lastValueFrom(this.materialsService.updateMaterial(String(id), { fecha: nowIso }))
        .catch(e => console.warn(`No se pudo actualizar Fecha Cambio del material ${id}:`, e));
      const gridRow = this.rowData.find((r: any) => Number(r.id) === id);
      if (gridRow) gridRow.fecha = nowIso;
    }
    // Forzar el re-render de la columna para que el cambio se vea al instante,
    // sin necesidad de cerrar/reabrir la cascada o el grid.
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true, columns: ['fecha'] });
    }
  }

  private prepareMaterialData(row: any): any {
    return {
      idCompany: this.idRoot,
      idBranch: null,
      typeOcorReq: '',
      idCustomer: null,
      insumo: row.insumo || '',
      barCode: '',
      barcode: '',
      company: '',
      articulo: '',
      idCategory: row.idCategory || 0,
      idFamilia: row.idFamilia || 0,
      idSubfamilia: row.idSubfamilia || 0,
      idMedida: 0,
      idUbication: 0,
      description: row.articulo || '',
      folio: '',
      price: row.price || 0,
      quantity: 0,
      date: new Date().toISOString(),
      merma: row.merma || 0,
      fecha: row.fecha || new Date().toISOString(),
      aplicaResg: false,
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      picture: row.picture || '',
      typeMaterial: 'CONSUMABLE',
      folioOcorReq: '',
      vigente: row.vigente === true || row.vigente === 1 ? true : false,
      active: row.active ?? true,
      porAutorizar: !!(row.porAutorizar ?? row.autorizacion ?? row.pendingAuthorization ?? false),
      validaPresentaciones: !!(row.validaPresentaciones ?? false)
    };
  }

  refreshData(): void {
    this.loadMaterials();
    this.selectedMaterial = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }

  // ✅ Método para cerrar el modal con confirmación
  closeMainModal(): void {
    if (this.hasUnsavedChanges) {
      if (!confirm('¿Deseas cerrar sin guardar los cambios?')) {
        return;
      }
    }
    if (this.activeModal) {
      this.activeModal.dismiss();
    }
  }

  // ==================== MÉTODOS CRUD PARA PROVEEDORES DEL MATERIAL ====================

  loadMaterialXTableData(materialId: number, type: string, successCallback: any) {
    this.providersService.getMaterXTable(materialId, type).subscribe({
      next: (data: any) => {
        this.materialsXTableData[materialId] = data;
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading material details:', error);
        successCallback([]);
      }
    });
  }

  /**
   * Guarda proveedores nuevos/modificados de un material.
   * Devuelve un mapa `tempProveedorId → realProveedorId` con los IDs generados
   * por el backend para que el Nivel 3 (sucursales) pueda remapear su FK.
   */
  async saveMaterialDetailsById(materialId: number, data: any[], type: string): Promise<Map<string, number>> {
    const newDetails = data.filter((row: any) => row.__isNew);
    const modifiedDetails = data.filter((row: any) => row.__modified && !row.__isNew);
    const newIdMap = new Map<string, number>();

    try {
      for (const row of newDetails) {
        const tempId = row.id;
        const payload = this.cleanDataForServer(row);
        console.log('[saveMaterialDetailsById] POST ProveedorXTabla payload:', payload);
        const resp: any = await lastValueFrom(this.providersService.addProviderXTable(payload));
        // Extraer id real probando shapes comunes del backend.
        const realId = Number(
          resp?.id ?? resp?.Id ?? resp?.ID ??
          resp?.data?.id ?? resp?.data?.Id ??
          resp?.Data?.id ?? resp?.Data?.Id ?? 0
        );
        if (realId && typeof tempId === 'string' && tempId.startsWith('temp_')) {
          newIdMap.set(tempId, realId);
          row.id = realId; // Reemplazar id temporal por real en la fila.
        }
      }

      for (const row of modifiedDetails) {
        await lastValueFrom(this.providersService.updateProviderXTable(row.id, this.cleanDataForServer(row)));
      }

      if (newDetails.length > 0 || modifiedDetails.length > 0) {
        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los proveedores correctamente.',
          'success'
        );

        // Limpiar los flags
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
      }

    } catch (error: any) {
      console.error('Error saving provider details:', error);
      console.error('[saveMaterialDetailsById] backend error body:', error?.error);
      console.error('[saveMaterialDetailsById] backend error status:', error?.status, 'statusText:', error?.statusText);
      if (error?.error?.errors) {
        console.error('[saveMaterialDetailsById] validation errors:', JSON.stringify(error.error.errors, null, 2));
      }
      alerts.basicAlert(
        'Error',
        'Error al guardar los proveedores.',
        'error'
      );
    }
    return newIdMap;
  }

  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const materialId = params.data.campo1;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      // Si es una fila nueva, solo removerla del array local
      this.materialsXTableData[materialId] = (this.materialsXTableData[materialId] || []).filter(
        item => item.id !== detailId
      ) || [];
      params.api.applyTransaction({ remove: [params.data] });
      this.hasUnsavedChanges = true;
    } else {
      // Si es una fila existente, eliminarla del servidor
      try {
        await lastValueFrom(this.providersService.deleteProviderXTable(detailId));
        alerts.basicAlert('Proveedor eliminado', 'El proveedor se eliminó correctamente.', 'success');
        successCallback(); // Llama al callback para recargar los datos en el componente hijo
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el proveedor.',
          'error'
        );
      }
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    // El backend C# espera el nombre del proveedor en `proveedor` (campo requerido del modelo),
    // pero en el frontend lo guardamos como `providerName` para la UI. Mapeamos antes de borrar.
    if (cleanedData.providerName && !cleanedData.proveedor) {
      cleanedData.proveedor = cleanedData.providerName;
    }
    // Campos auxiliares de UI que no existen en el modelo del backend C#.
    delete cleanedData.providerName;
    delete cleanedData.branchName;
    delete cleanedData._hasSucursales;
    delete cleanedData.detailType;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ========== MÉTODOS PARA MODAL DE SUBFAMILIAS ==========

  handleModalRequest(data: ModalData) {
    this.modalData = data;
    this.modalType = data.type;
    this.modalMode = data.mode;

    // Si es edición, cargar datos existentes
    if (data.mode === 'edit' && data.data) {
      this.modalForm.description = data.data.description || '';
      this.modalForm.active = data.data.active === 1;
    } else {
      // Resetear form para modo agregar
      this.modalForm = {
        description: '',
        active: true
      };
    }

    this.showModal = true;
  }

  saveModal() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }


    // Preparar datos para enviar al servicio
    const saveData = {
      type: this.modalType,
      mode: this.modalMode,
      description: this.modalForm.description,
      active: this.modalForm.active,
      parentData: this.modalData?.parentData,
      data: this.modalData?.data // ⭐ Incluir datos originales para modo edición
    };

    // Enviar confirmación de guardado al servicio
    this.subfamiliaModalService.confirmSave(saveData);

    // Cerrar modal
    this.closeModal();
  }

  closeModal() {
    this.showModal = false;
    this.modalData = null;
    this.modalForm = {
      description: '',
      active: true
    };
  }

  // ========== MÉTODOS PARA MODAL DE IMAGEN ==========
  openImageModal(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.showImageModal = true;
  }

  closeImageModal() {
    this.showImageModal = false;
    this.selectedImageUrl = '';
  }

  // ========== MÉTODOS PARA MODAL DE MATERIAL ==========
  onImageFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedImageFile = file;

      // Crear preview de la imagen
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImageUrl = e.target.result;
        this.materialForm.picture = e.target.result; // Guardar como base64
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedImageFile = null;
    this.previewImageUrl = '';
    this.materialForm.picture = '';
  }

  async saveMaterialFromModal() {
    // Validar campos requeridos
    if (!this.materialForm.insumo.trim()) {
      alerts.basicAlert('Error', 'El número de material es obligatorio', 'warning');
      return;
    }
    if (!this.materialForm.articulo.trim()) {
      alerts.basicAlert('Error', 'El nombre del artículo es obligatorio', 'warning');
      return;
    }

    try {
      const materialData = this.prepareMaterialData({
        ...this.materialForm,
        active: this.materialForm.active
      });

      await lastValueFrom(this.materialsService.addMaterial(materialData));
      alerts.basicAlert('Guardado', 'Material creado correctamente', 'success');
      this.closeMaterialModal();
      this.loadMaterials();
    } catch (error: any) {
      console.error('Error al guardar material:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudo guardar el material: ${errorMsg}`, 'error');
    }
  }

  closeMaterialModal() {
    this.showMaterialModal = false;
    this.materialForm = {
      insumo: '',
      articulo: '',
      idCategory: 0,
      idFamilia: 0,
      picture: '',
      active: true
    };
    this.selectedImageFile = null;
    this.previewImageUrl = '';
  }

  getModalTitle(): string {
    const typeLabels = {
      subfamilia: 'Subfamilia',
      flavor: 'Sabor',
      presentation: 'Presentación'
    };
    const modeLabel = this.modalMode === 'add' ? 'Nueva' : 'Editar';
    return `${modeLabel} ${typeLabels[this.modalType]}`;
  }

  getModalColor(): string {
    const colors = {
      subfamilia: 'primary',
      flavor: 'info',
      presentation: 'secondary'
    };
    return colors[this.modalType];
  }

  private scrollToTarget(): void {
    if (!this.pendingScrollTarget || !this.gridApi) return;
    const target = this.pendingScrollTarget;
    this.pendingScrollTarget = null;

    this.gridApi.forEachNode((node: any) => {
      const matchById = target.id !== undefined && node.data.id === target.id;
      const matchByArticulo = target.articulo &&
        (node.data.articulo || '').toUpperCase() === target.articulo.toUpperCase();

      if (matchById || matchByArticulo) {
        this.gridApi.ensureNodeVisible(node, 'middle');
        node.setSelected(true);
      }
    });
  }

  /**
   * Cuando un material cambia su familia/subfamilia desde "PRODUCTO NUEVO" a valores reales,
   * busca los proveedores asignados a ese material con por_autorizar=0 (autorizacion=false)
   * e inserta el material en la tabla "Configurar Tipo Proveedor (cascada)" de cada uno.
   *
   * - vigente = true
   * - idSubfamily = nueva subfamilia del material
   * - principal = true si es el primer registro del proveedor, false si ya tenía registros
   * - No duplica si ya existe esa subfamilia para ese proveedor
   * - Si fue insert como principal=true, actualiza customer.typework con la cadena
   *   CATEGORIA/FAMILIA/SUBFAMILIA del registro recién creado.
   */
  private async autoFillCascadeOnMaterialFamilyChange(materialsThatLeftProductoNuevo: any[]): Promise<void> {
    if (!materialsThatLeftProductoNuevo || materialsThatLeftProductoNuevo.length === 0) return;

    for (const material of materialsThatLeftProductoNuevo) {
      const idMaterial = Number(material?.id);
      const idSubfamilia = Number(material?.idSubfamilia);
      if (!idMaterial || !idSubfamilia || idSubfamilia <= 0) continue;

      // 1. Obtener proveedores asignados a este material
      let materialProviders: any[] = [];
      try {
        const res: any = await lastValueFrom(this.providersService.getMaterXTable(idMaterial, 'MATERIAL'));
        materialProviders = Array.isArray(res) ? res : [];
      } catch (e) {
        console.warn(`⚠️ No se pudo obtener proveedores del material ${idMaterial}:`, e);
        continue;
      }

      // 2. Para cada proveedor, verificar por_autorizar=0 y procesar
      for (const matProv of materialProviders) {
        const idProvider = Number(matProv?.idTabla ?? matProv?.idProvider ?? 0);
        if (!idProvider) continue;

        // Cargar customer para verificar por_autorizar
        let customer: any = null;
        try {
          customer = await lastValueFrom(this.customersService.getCustomerById(idProvider));
        } catch (e) {
          console.warn(`⚠️ No se pudo cargar customer ${idProvider}:`, e);
          continue;
        }
        if (!customer) continue;

        // por_autorizar=0 → autorizacion === false / 0
        const isPorAutorizar =
          customer?.autorizacion === true || customer?.autorizacion === 1 ||
          customer?.porAutorizar === true || customer?.porAutorizar === 1 ||
          customer?.por_autorizar === true || customer?.por_autorizar === 1;
        if (isPorAutorizar) continue; // Solo procesar los que YA están autorizados (por_autorizar=0)

        // 3. Obtener subfamilias ya asignadas a este proveedor
        let existing: any[] = [];
        try {
          const res: any = await lastValueFrom(this.providersService.getSubfamilyxProviderByProvider(idProvider));
          existing = Array.isArray(res) ? res : [];
        } catch (e) {
          console.warn(`⚠️ No se pudo cargar subfamilyxprovider para ${idProvider}:`, e);
          continue;
        }

        const existingSubIds = new Set<number>(
          existing
            .map((r: any) => Number(r?.idSubfamily ?? r?.idSubFamily ?? 0))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        );

        // 4. No duplicar si ya existe esa subfamilia para ese proveedor
        if (existingSubIds.has(idSubfamilia)) continue;

        // 5. principal=true sólo si es el primer registro del proveedor
        const shouldBePrincipal = existing.length === 0;

        // 6. INSERT en subfamilyxprovider
        try {
          await lastValueFrom(
            this.providersService.addSubfamilyxProvider({
              idSubfamily: idSubfamilia,
              idProvider: idProvider,
              vigente: true,
              principal: shouldBePrincipal
            })
          );
        } catch (e) {
          console.warn(`⚠️ No se pudo crear subfamilyxprovider (prov=${idProvider}, subfam=${idSubfamilia}):`, e);
          continue;
        }

        // 7. Si fue insert como principal=true, actualizar customer.typework
        if (shouldBePrincipal) {
          try {
            const providerTypes: any = await lastValueFrom(this.providersService.getProviderType(idProvider));
            if (Array.isArray(providerTypes) && providerTypes.length > 0) {
              const principalRow = providerTypes.find((pt: any) =>
                Number(pt?.idSubfamily ?? pt?.idSubFamily ?? 0) === idSubfamilia
              ) || providerTypes.find((pt: any) => pt?.principal === true);

              if (principalRow) {
                const tipoProveedorConcatenado = `${principalRow.nameParent || ''}/${principalRow.nameSubparent || ''}/${principalRow.nameProduct || ''}`;
                customer.typework = tipoProveedorConcatenado;
                await lastValueFrom(this.customersService.updateCustomer(idProvider, customer));
              }
            }
          } catch (eTw) {
            console.warn(`⚠️ No se pudo actualizar typework para proveedor ${idProvider}:`, eTw);
          }
        }
      }
    }
  }

  /**
   * Genera el código "Num Mat" (campo insumo) para un material a partir de sus IDs de
   * categoría, familia y subfamilia. Formato: {abrCateg}{abrFam}{abrSubfam}-{consecutivo 4 dígitos}
   *
   * El consecutivo se calcula buscando el mayor número usado en allMaterialsData para ese
   * prefijo y sumando 1. También considera consecutivos asignados en la misma sesión de save
   * (via el Map lastConsecutivoByPrefix) para evitar duplicados entre múltiples materiales del
   * mismo lote.
   *
   * Retorna cadena vacía si no se pueden resolver las 3 abreviaciones.
   */
  private generateInsumoCode(
    idCategory: number,
    idFamilia: number,
    idSubfamilia: number,
    lastConsecutivoByPrefix: Map<string, number>
  ): string {
    if (!idCategory || !idFamilia || !idSubfamilia) return '';

    const cat = this.categories.find((c: any) => Number(c.id) === Number(idCategory));
    const fam = this.families.find((f: any) => Number(f.id) === Number(idFamilia));
    const sub = this.subfamilies.find((s: any) => Number(s.id) === Number(idSubfamilia));

    if (!cat || !fam || !sub) return '';

    const abrCat = String(cat.valueAddition2 || '').trim().toUpperCase();
    const abrFam = String(fam.valueAddition2 || '').trim().toUpperCase();
    const abrSub = String(sub.valueAddition2 || '').trim().toUpperCase();

    if (!abrCat || !abrFam || !abrSub) return '';

    const prefix = `${abrCat}${abrFam}${abrSub}`;

    // Si ya asignamos consecutivos para este prefijo en esta sesión, usar ese +1
    let maxConsec = lastConsecutivoByPrefix.get(prefix);
    if (maxConsec === undefined) {
      // Primera vez para este prefijo: buscar en allMaterialsData
      maxConsec = 0;
      const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
      for (const m of this.allMaterialsData) {
        const ins = String((m as any).insumo || '');
        const match = ins.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (Number.isFinite(num) && num > maxConsec) {
            maxConsec = num;
          }
        }
      }
    }

    const nextConsec = maxConsec + 1;
    lastConsecutivoByPrefix.set(prefix, nextConsec);

    return `${prefix}-${nextConsec.toString().padStart(4, '0')}`;
  }
}
