import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, lastValueFrom } from 'rxjs';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent,
  IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { EquipmentService } from 'app/services/equipment.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { TypeEquipmentModalService } from './services/type-equipment-modal.service';
import { EquipmentDetailRendererComponent } from './equipment-detail-renderer.component';
import { PdfDistributionComponent } from './pdf-distribution.component';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, EquipmentDetailRendererComponent, PdfDistributionComponent],
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss'],
})
export class EquipmentComponent implements CanComponentDeactivate {
  idcompany: number = null;
  rowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  gridHeight: string = '85vh';
  id: number = null;
  idBranch: number;
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass: boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];
  typeEquipmentCatalog: any[] = [];
  measureCatalog: any[] = [];
  showTypeEquipmentModal: boolean = false;
  showMeasureModal: boolean = false;
  newTypeEquipment: { description: string } = { description: '' };
  newMeasure: { description: string } = { description: '' };

  private editableColumnOrder = ['description', 'idTypeEquipment', 'quantity', 'measure', 'costMN', 'priceMN', 'print'];
  private readonly NEW_MEASURE_OPTION = '__NEW_MEASURE__';
  private readonly defaultMeasures = ['DIA', 'HRS', 'MES', 'SEM'];
  private _colMaster: ColDef[] = [];

  showPdfReport: boolean = false;
  showPdfMoneyReport: boolean = false;
  private savedRowData: any[] | null = null;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService        = inject(SignalsService);
  private trackingService       = inject(TrackingService);
  private catalogsService       = inject(CatalogsService);
  private equipmentService      = inject(EquipmentService);
  private typeEquipmentModalService = inject(TypeEquipmentModalService);
  private isOpen: boolean = false;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    flex: 1,
    cellClassRules: {
      'editing-cell': (params: any) => params.editing === true
    },
  };
  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    // totalMN es columna computada en BD — no enviar al servidor
    delete cleanedData.totalMN;
    // Para filas nuevas, eliminar el id temporal (string) para que el backend lo genere
    if (typeof cleanedData.id === 'string' && cleanedData.id.startsWith('temp_')) {
      delete cleanedData.id;
    }
    // idBranch: si es 0 o falsy enviar null para no violar FK
    if (!cleanedData.idBranch) {
      cleanedData.idBranch = null;
    }
    // quantity como decimal
    if (cleanedData.quantity != null) {
      cleanedData.quantity = Number(cleanedData.quantity);
    }
    // Trim de campos string
    if (cleanedData.description) {
      cleanedData.description = cleanedData.description.trim();
    }
    return cleanedData;
  }

  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerUnidades();
      this.obtenerMedidas();
    });

    this.typeEquipmentModalService.modalRequest$.subscribe(() => {
      this.openTypeEquipmentModal();
    });

    this.typeEquipmentModalService.saveConfirmed$.subscribe((data) => {
      this.onTypeEquipmentCreated(data);
    });
  }
  obtenerDatos(): void {
    if (!this.idcompany) return;
    this.equipmentService.getEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.savedRowData = null;
        this.rowData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerUnidades(): void {
    if (!this.idcompany) return;
    this.catalogsService.getTypeEquipment(this.idcompany, 'TYPEEQUIPMENT').subscribe(
      (data: any) => { this.typeEquipmentCatalog = data; },
      (error) => console.error('Error fetching typeEquipment:', error)
    );
  }

  obtenerMedidas(): void {
    if (!this.idcompany) return;
    this.catalogsService.getUnits(this.idcompany).subscribe(
      (data: any) => { this.measureCatalog = Array.isArray(data) ? data : []; },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  private getMeasureOptions() {
    const catalogDescriptions = this.measureCatalog
      .map((m: any) => (m?.description || '').toString().trim())
      .filter((d: string) => !!d);

    const uniqueMeasures = [...new Set([...this.defaultMeasures, ...catalogDescriptions])];
    return uniqueMeasures.map((description) => ({
      id: description,
      description,
      valueAddition: '',
      valueAddition2: ''
    }));
  }

  private getDefaultTypeEquipmentId(): number | null {
    if (!Array.isArray(this.typeEquipmentCatalog) || this.typeEquipmentCatalog.length === 0) {
      return null;
    }
    const first = this.typeEquipmentCatalog[0];
    return this.normalizeCatalogId(first?.id);
  }

  private getDefaultMeasureValue(): string {
    const options = this.getMeasureOptions();
    if (!Array.isArray(options) || options.length === 0) {
      return 'DIA';
    }
    const firstValid = options.find((opt: any) => opt?.id && opt.id !== this.NEW_MEASURE_OPTION);
    return (firstValid?.id || 'DIA').toString();
  }

  private normalizeCatalogId(value: any): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private resolveCatalogId(payload: any): number | null {
    const candidates = [payload?.id, payload?.Id, payload?.idCatalog, payload?.catalogId];
    for (const candidate of candidates) {
      const normalized = this.normalizeCatalogId(candidate);
      if (normalized !== null) return normalized;
    }
    return null;
  }

  private resolveCatalogDescription(payload: any, fallback: string = ''): string {
    const description = payload?.description ?? payload?.Description ?? payload?.name ?? fallback;
    return (description || '').toString().trim();
  }
  

 
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1,
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
    // Full-width row para distribución (sin masterDetail, sin altura extra)
    isFullWidthRow: (params: any) => !!params.rowNode.data?.__isDistDetail,
    fullWidthCellRenderer: EquipmentDetailRendererComponent,
    getRowHeight: (params: any) => params.node.data?.__isDistDetail ? 420 : 20,
    context: { componentParent: this },
    getRowClass: (params) => {
      if (params.node.isSelected()) return 'selected-row';
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) node.setSelected(false);
        });
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };
  onMasterSelectionChanged(event: any) {}

  onMasterCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
    if (event.node.isSelected()) {
      this.selectedRowData = event.data;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.selectedRowData = event?.data ?? null;
  }
  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) return this._colMaster;
    this._colMaster = [
      {
        headerName: '#',
        width: 50,
        editable: false,
        suppressMenu: true,
        valueGetter: (params) => params.node.rowIndex + 1,
        cellStyle: { textAlign: 'center', fontWeight: 'bold' }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        width: 750,
      },
      /*{
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        filter: 'agDateColumnFilter',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        width: 150,
        cellRenderer: 'agDateCellRenderer',
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          // Si no hay fecha, usar fecha actual
          if (!params.data.date) {
            return new Date().toISOString();
          }
          return params.data.date;
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.date = new Date().toISOString();
            return true;
          }
        
          let date;
          // Si viene en formato "2025-07-29T00:00:00" del agDateCellEditor
          if (typeof params.newValue === 'string' && params.newValue.includes('T') && !params.newValue.includes('Z')) {
            // Agregar 'Z' para que sea UTC y crear la fecha
            date = new Date(params.newValue + 'Z');
          } else {
            date = new Date(params.newValue);
          }
          
          if (isNaN(date.getTime())) {
            alerts.basicAlert('Error', 'Fecha inválida', 'error');
            return false;
          } 
        
          // Asegurar que la fecha se guarde en el formato ISO correcto
          params.data.date = date.toISOString();
          // Marcar como modificado para que se incluya en el save
          params.data.__modified = true;
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


      },*/
      {
        field: 'idTypeEquipment',
        headerName: 'Tipo de equipo',
        editable: true,
        width: 150,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: [
            ...this.typeEquipmentCatalog.map(t => ({
              id: t.id,
              description: t.description,
              valueAddition: '',
              valueAddition2: ''
            })),
            { id: -998, description: '➕ Nuevo tipo de equipo...', valueAddition: '-998', valueAddition2: '➕ Nuevo tipo de equipo...' }
          ],
          specialValues: [-998],
          onSpecialValue: (_value: any, _params: any) => {
            this.typeEquipmentModalService.openModal({ idCompany: this.idcompany });
          }
        }),
        cellRenderer: (params: any) => {
          if (!params.value || params.value === -998) return '';
          const selectedValue = this.normalizeCatalogId(params.value);
          const found = this.typeEquipmentCatalog.find((t: any) => this.normalizeCatalogId(t?.id) === selectedValue);
          if (found?.description) return found.description;
          return params.data?.typeEquipmentDescription || '';
        },
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        width: 100,
        type: 'numericColumn',
        valueParser: (params) => {
          const val = parseFloat(String(params.newValue).replace(',', '.'));
          return isNaN(val) ? 0 : val;
        },
        valueFormatter: (params) => params.value != null ? Number(params.value).toFixed(3) : '0.000',
      },
      {
        field: 'measure',
        headerName: 'Medida',
        editable: true,
        width: 110,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => ({
          options: [
            ...this.getMeasureOptions(),
            {
              id: this.NEW_MEASURE_OPTION,
              description: '➕ Agregar nueva medida...',
              valueAddition: this.NEW_MEASURE_OPTION,
              valueAddition2: '➕ Agregar nueva medida...'
            }
          ],
          specialValues: [this.NEW_MEASURE_OPTION],
          onSpecialValue: (_value: any, _params: any) => {
            this.openMeasureModal();
          }
        }),
        cellRenderer: (params: any) =>
          params.value === this.NEW_MEASURE_OPTION ? '' : (params.value || ''),
      },
      {
        field: 'costMN',
        headerName: 'Costo MN',
        editable: true,
        width: 130,
        type: 'numericColumn',
        valueFormatter: (params) => params.value != null ? Number(params.value).toFixed(2) : '0.00',
      },
      {
        field: 'priceMN',
        headerName: 'Precio MN',
        editable: true,
        width: 130,
        type: 'numericColumn',
        valueFormatter: (params) => params.value != null ? Number(params.value).toFixed(2) : '0.00',
      },
      {
        field: 'totalMN',
        headerName: 'Total',
        editable: false,
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          // Usa el valor computado del servidor; si es fila nueva calcula localmente
          if (params.data?.__isNew) {
            return Number(params.data?.quantity ?? 0) * Number(params.data?.priceMN ?? 0);
          }
          return params.data?.totalMN ?? 0;
        },
        valueFormatter: (params) => params.value != null ? Number(params.value).toFixed(2) : '0.00',
      },

       {
        headerName: 'Dist.',
        width: 60,
        editable: false,
        cellStyle: { textAlign: 'center', cursor: 'pointer' },
        cellRenderer: (params: any) => {
          const isNew = typeof params.data?.id === 'string';
          return isNew
            ? `<span style="color:#ccc;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`
            : `<span title="Distribución" style="color:#0d6efd;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`;
        },
        onCellClicked: (params: any) => {
          if (typeof params.data?.id === 'string') return;
          this.toggleDetail(params.node);
        },
      },

      {
        field: 'print',
        headerName: 'Imprimir en OT',
        editable: true,
        width: 130,
      },
     
    ];
    return this._colMaster;
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showLoansTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  addMasterRow() {
  // Si hay una distribución abierta, cerrarla primero para restaurar todos los datos
  if (this.savedRowData) {
    this.rowData = [...this.savedRowData];
    this.savedRowData = null;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }
  const tempId = `temp_${this.tempIdCounter++}`;
    const defaultTypeEquipmentId = this.getDefaultTypeEquipmentId();
    const defaultMeasure = this.getDefaultMeasureValue();
    const newItem = {
      id: tempId,
      idCompany: this.idcompany,
      description: '',
      //date: new Date().toISOString(), // Formato completo DateTime
      aplicaResg: false,
      costoMN: 0.00,
      costoDLL: 0.00,
      ventaMN: 0.00,
      ventaDLL: 0.00,
      stockMin: 0,
      stockMax: 0,
      idTypeEquipment: defaultTypeEquipmentId,
      quantity: 1,
      measure: defaultMeasure,
      costMN: 0.00,
      priceMN: 0.00,
      print: true,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 100);
  
  }

  async saveMasterChanges() {
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter((row) => row.__modified && !row.__isNew);

    const rowsToValidate = [...newRows, ...modifiedRows];
    if (rowsToValidate.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar.', 'info');
      return;
    }

    const isValid = rowsToValidate.every((item) => item.description?.trim() && item.idTypeEquipment);
    if (!isValid) {
      alerts.basicAlert(
        'Campos obligatorios',
        'Descripción y Tipo de equipo son obligatorios.',
        'error'
      );
      return;
    }

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Save Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.equipmentService.addEquipment(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      //this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Tiendas', 'Menu Administracion Tiendas',  this.trackingService.getEmail());
      return lastValueFrom(this.equipmentService.updateEquipment(row.id, cleanedData));
    });

    try {
      const allResponses = await Promise.all([
        ...addObservables,
        ...updateObservables,
      ]);

      //console.log('Promise.all completado. Respuestas:', allResponses);
      for (const response of allResponses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );

       /* if (response && response.id && correspondingNewRow) {
          //console.log(response)

          try {
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }*/
      }
      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(); // Esperar a que se actualicen los datos

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
      }
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  deleteMasterEntry() {
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

    // Validar que el préstamo sea 0 o no exista
    /*if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }*/

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar un Equipo',
        '¿Está seguro que desea eliminar este equipo?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.equipmentService
            .deleteEquipment(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar equipo',
                  'Error al eliminar el equipo.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Equipo eliminado',
                'El equipo se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Equipos', 'Menu Administracion Equipos',  this.trackingService.getEmail());
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro en Equipos', 'Menu Administracion Equipos',  this.trackingService.getEmail());
  }

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }

  // ==================== MODAL TIPO DE EQUIPO ====================

  openTypeEquipmentModal() {
    this.newTypeEquipment = { description: '' };
    this.showTypeEquipmentModal = true;
  }

  closeTypeEquipmentModal() {
    this.showTypeEquipmentModal = false;
    this.newTypeEquipment = { description: '' };
  }

  saveNewTypeEquipment() {
    if (!this.newTypeEquipment.description?.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'error');
      return;
    }

    const catalogToSave = {
      idCompany: this.idcompany,
      description: this.newTypeEquipment.description.trim(),
      type: 'TYPEEQUIPMENT',
      active: 1,
      vigente: true,
    };

    this.catalogsService.addCatalogToSmp(catalogToSave).subscribe({
      next: (saved: any) => {
        const createdId = this.resolveCatalogId(saved);
        const createdDescription = this.resolveCatalogDescription(saved, catalogToSave.description);
        this.typeEquipmentModalService.confirmSave({ id: createdId || 0, description: createdDescription });
        this.closeTypeEquipmentModal();
      },
      error: (err) => {
        console.error('Error guardando tipo de equipo:', err);
        alerts.basicAlert('Error', 'No se pudo guardar el tipo de equipo.', 'error');
      }
    });
  }

  onTypeEquipmentCreated(data: { id: number; description: string }) {
    const normalizedId = this.normalizeCatalogId(data?.id);
    const normalizedDescription = (data?.description || '').toString().trim();
    if (!normalizedDescription) return;

    // Add immediately to local catalog so cellRenderer can find it right away.
    const existing = this.typeEquipmentCatalog.find(
      (t: any) =>
        (normalizedId !== null && this.normalizeCatalogId(t?.id) === normalizedId) ||
        ((t?.description || '').toString().trim().toUpperCase() === normalizedDescription.toUpperCase())
    );
    if (!existing) {
      this.typeEquipmentCatalog = [...this.typeEquipmentCatalog, { id: normalizedId ?? 0, description: normalizedDescription }];
    }

    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (selectedNodes && selectedNodes.length > 0) {
      const idToUse = normalizedId ?? this.normalizeCatalogId(existing?.id) ?? 0;
      selectedNodes[0].setDataValue('idTypeEquipment', idToUse);
      selectedNodes[0].setDataValue('typeEquipmentDescription', normalizedDescription);
      this.notSavedChanges = true;
    }
    if (this.gridApi) this.gridApi.refreshCells({ columns: ['idTypeEquipment'], force: true });

    // Reload catalog in background
    this.obtenerUnidades();
  }

  // ==================== MODAL MEDIDA ====================

  openMeasureModal() {
    this.newMeasure = { description: '' };
    this.showMeasureModal = true;
  }

  closeMeasureModal() {
    this.showMeasureModal = false;
    this.newMeasure = { description: '' };
  }

  saveNewMeasure() {
    const description = this.newMeasure.description?.trim();
    if (!description) {
      alerts.basicAlert('Error', 'La descripción de la medida es obligatoria.', 'error');
      return;
    }

    const catalogToSave = {
      idCompany: this.idcompany,
      description: description.toUpperCase(),
      type: 'MEASURE',
      active: 1,
      vigente: true,
    };

    this.catalogsService.addCatalog(catalogToSave).subscribe({
      next: (saved: any) => {
        this.onMeasureCreated({ id: saved?.id, description: saved?.description || catalogToSave.description });
        this.closeMeasureModal();
      },
      error: (err) => {
        console.error('Error guardando medida:', err);
        alerts.basicAlert('Error', 'No se pudo guardar la medida.', 'error');
      }
    });
  }

  onMeasureCreated(data: { id?: number; description: string }) {
    if (!data?.description) return;

    const normalized = data.description.trim().toUpperCase();
    const exists = this.measureCatalog.some((m: any) => (m?.description || '').toString().trim().toUpperCase() === normalized);
    if (!exists) {
      this.measureCatalog = [...this.measureCatalog, { id: data.id || 0, description: normalized }];
    }

    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (selectedNodes && selectedNodes.length > 0) {
      selectedNodes[0].setDataValue('measure', normalized);
      this.notSavedChanges = true;
    }
    if (this.gridApi) this.gridApi.refreshCells({ columns: ['measure'], force: true });

    this.obtenerMedidas();
  }

  // ==================== CASCADA DISTRIBUCIÓN (full-width row) ====================

  toggleDetail(node: any) {
    if (!this.gridApi) return;

    // Si ya hay una distribución abierta para esta misma fila → cerrar
    const existing = this.rowData.find(r => r.__isDistDetail);
    if (existing && existing.__equipmentId === node.data.id) {
      this.collapseDetail();
      return;
    }

    // Si hay distribución de otra fila abierta → primero restaurar datos
    if (this.savedRowData) {
      this.rowData = [...this.savedRowData];
      this.savedRowData = null;
    }

    // Guardar estado actual y construir vista: solo fila seleccionada + detalle
    this.savedRowData = [...this.rowData];

    const distRow = {
      __isDistDetail: true,
      __equipmentId: node.data.id,
      idCompany:     node.data.idCompany ?? this.idcompany,
      description:   node.data.description,
      quantity:      node.data.quantity,
      id:            `__dist_${node.data.id}`,
    };

    const idx = this.rowData.findIndex(r => r.id === node.data.id);
    this.rowData = [
      this.rowData[idx],   // solo la fila seleccionada
      distRow,             // detalle debajo
    ];
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  collapseDetail() {
    if (!this.savedRowData || !this.gridApi) return;
    this.rowData = this.savedRowData;
    this.savedRowData = null;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  // ==================== PDF REPORTE GENERAL ====================

  togglePdfReport() {
    this.showPdfReport = !this.showPdfReport;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}


