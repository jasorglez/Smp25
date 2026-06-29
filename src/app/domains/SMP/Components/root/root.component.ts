import { Component, HostListener, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { InegiService } from 'app/services/inegi.service';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { BranchsService } from 'app/services/branchs.service';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { ProjectsService } from 'app/services/projects.service';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
import { AdministrationService } from 'app/services/administration.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { RolesService } from 'app/services/roles.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { MaterialsService } from 'app/services/materials.service';
import { EquipmentService } from 'app/services/equipment.service';
import { TrackingService } from 'app/services/tracking.service';
import { ConventionsService } from 'app/services/conventions.service';
import { WorkprogramsService } from 'app/services/workprograms.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './root.component.html',
  styleUrls: ['./root.component.css']
})
export class RootComponent {


  private rootService = inject(RootService);
  private inegiService = inject(InegiService);
  private imageHandlerService = inject(ImageHandlerService);
  private branchesService = inject(BranchsService);
  private followprojectsService = inject(FollowprojectsService);
  private projectsService = inject(ProjectsService);
  private customersService = inject(CustomersService);
  private providersService = inject(ProvidersService);
  private administrationService = inject(AdministrationService);
  private catalogsService = inject(CatalogsService);
  private catalogadmonService = inject(CatalogadmonService);
  private cuentasContablesService = inject(CuentasContablesService);
  private rolesService = inject(RolesService);
  private posicionesService = inject(PosicionesService);
  private materialsService = inject(MaterialsService);
  private equipmentService = inject(EquipmentService);
  private trackingService = inject(TrackingService);
  private conventionsService = inject(ConventionsService);
  private workprogramsService = inject(WorkprogramsService);

  private signalsService = inject(SignalsService);

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  corporativos: any[] = [];
  creatingPeripherals: boolean = false;
  peripheralStep: string = '';
  peripheralProgress: number = 0;
  private peripheralCurrentStep: number = 0;
  private peripheralTotalSteps: number = 15;
  estados: { [key: string]: string } = {};
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  idUser: number = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerEstados();
    this.obtenerCorporativos();
  }

  obtenerCorporativos() {
    this.rootService.getCorporativos().subscribe({
      next: (data: any) => {
        this.corporativos = data || [];
        this.refreshColumnDefs();
      },
      error: (error) => {
        console.error('Error obteniendo corporativos:', error);
        this.corporativos = [];
      }
    });
  }

  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (response: any) => {
        if (response?.datos) {
          this.estados = response.datos.reduce((acc: any, estado: any) => {
            acc[estado.nom_agee] = estado.nom_agee;
            return acc;
          }, {});
        }
        this.refreshColumnDefs();
      },
      error: (error) => {
        console.error('Error obteniendo estados:', error);
        // Estados de México por defecto si falla el API
        //los Estados de México por defecto si falla el API
        this.estados = {
          'Aguascalientes': 'Aguascalientes',
          'Baja California': 'Baja California',
          'Baja California Sur': 'Baja California Sur',
          'Campeche': 'Campeche',
          'Chiapas': 'Chiapas',
          'Chihuahua': 'Chihuahua',
          'Ciudad de México': 'Ciudad de México',
          'Coahuila': 'Coahuila',
          'Colima': 'Colima',
          'Durango': 'Durango',
          'Estado de México': 'Estado de México',
          'Guanajuato': 'Guanajuato',
          'Guerrero': 'Guerrero',
          'Hidalgo': 'Hidalgo',
          'Jalisco': 'Jalisco',
          'Michoacán': 'Michoacán',
          'Morelos': 'Morelos',
          'Nayarit': 'Nayarit',
          'Nuevo León': 'Nuevo León',
          'Oaxaca': 'Oaxaca',
          'Puebla': 'Puebla',
          'Querétaro': 'Querétaro',
          'Quintana Roo': 'Quintana Roo',
          'San Luis Potosí': 'San Luis Potosí',
          'Sinaloa': 'Sinaloa',
          'Sonora': 'Sonora',
          'Tabasco': 'Tabasco',
          'Tamaulipas': 'Tamaulipas',
          'Tlaxcala': 'Tlaxcala',
          'Veracruz': 'Veracruz',
          'Yucatán': 'Yucatán',
          'Zacatecas': 'Zacatecas'
        };
        this.refreshColumnDefs();
      }
    });
  }

  refreshColumnDefs() {
    this._columnDefs = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }
  }
  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.obtenerDatos();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }



  obtenerDatos() {
    this.rootService
      .getRoot()
      .subscribe((data: any) => {
        this.rowData = data;
        //   console.log(data)
      });
  }

  // Orden de columnas para navegación con Enter
  private editableColumnOrder = [
    'orden', 'name', 'nameSmall', 'formatRep', 'email', 'web', 'personType', 'phone',
    'address', 'city', 'state', 'country', 'rfc', 'cp', 'idCorporativo', 'advanced', 'esRestaurante'
  ];

  // Flags de validación y navegación
  private validationFailed: boolean = false;
  private failedCellInfo: { rowIndex: number; colKey: string } | null = null;
  private enterPressed: boolean = false;

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        // Forzar cierre del editor para que cellEditingStopped se dispare
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true; // evitar que AG Grid baje de fila
      }
      return false;
    }
  };

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 60,
  stopEditingWhenCellsLoseFocus: true,
  enableBrowserTooltips: true,
  getRowClass: (params) => {
    // Verificar si la fila está seleccionada
    if (params.node.isSelected()) {
      return 'selected-row';
    }
    return '';
  },
  onRowClicked: (event) => {
    // Seleccionar la fila al hacer clic en cualquier celda
    event.node.setSelected(true);
  },
  onRowSelected: (event) => {
    // Deseleccionar otras filas cuando se selecciona una nueva
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  }
};

  onCellEditingStopped(event: any) {
    // Si validación falló: retener foco en la misma celda
    if (this.validationFailed && this.failedCellInfo) {
      const cellInfo = this.failedCellInfo;
      this.enterPressed = false;
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: cellInfo.rowIndex,
          colKey: cellInfo.colKey
        });
      }, 100);
      return;
    }

    this.validationFailed = false;
    this.failedCellInfo = null;

    // Solo avanzar si fue Enter (Tab lo maneja AG Grid de forma nativa)
    if (this.enterPressed) {
      this.enterPressed = false;
      const currentColId = event.column.getColId();
      const currentIndex = this.editableColumnOrder.indexOf(currentColId);
      if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
        setTimeout(() => {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: this.editableColumnOrder[currentIndex + 1]
          });
        }, 100);
      }
    }
  }
  
  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
      {
        headerName: '#',
        valueGetter: (params) => {
          if (params.node && params.node.rowIndex !== null) {
            return params.node.rowIndex + 1;
          }
          return '';
        },
        editable: false,
        flex: 0.5,
        maxWidth: 70,
        pinned: 'left',
        cellStyle: {
          fontWeight: 'bold',
          textAlign: 'center',
          backgroundColor: '#f8f9fa'
        }
      },
      {
        field: 'orden',
        headerName: 'Orden',
        editable: true,
        minWidth: 70,
        width: 80,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          precision: 0
        },
        valueParser: (params) => Number(params.newValue),
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        width: 250,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre.',
              'error'
            );
            this.validationFailed = true;
            this.failedCellInfo = { rowIndex: params.node.rowIndex, colKey: 'name' };
            return false;
          }

          this.validationFailed = false;
          this.failedCellInfo = null;
          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'nameSmall',
        headerName: 'Nombre Corto',
        editable: true,
         width: 150,
        cellEditor: 'agTextCellEditor',
        valueSetter: (params) => {
          if (params.newValue.length > 10) {
            alerts.basicAlert(
              'Error de validación',
              'El nombre corto no puede tener más de 10 caracteres.',
              'error'
            );
            this.validationFailed = true;
            this.failedCellInfo = { rowIndex: params.node.rowIndex, colKey: 'nameSmall' };
            return false;
          }

          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.nameSmall === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre',
              'error'
            );
            this.validationFailed = true;
            this.failedCellInfo = { rowIndex: params.node.rowIndex, colKey: 'nameSmall' };
            return false;
          }

          this.validationFailed = false;
          this.failedCellInfo = null;
          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'formatRep',
        headerName: 'Formato de reporte',
        editable: true,
        flex: 1
      },
      {
        field: 'email',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: (params) => params.data.__isNew,
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          // Si está vacío, permitir salir (es opcional)
          if (!params.newValue || params.newValue.trim() === '') {
            this.validationFailed = false;
            this.failedCellInfo = null;
            params.data[params.colDef.field] = '';
            return true;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            // Verificar si el email ya existe
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Añadir usuario',
                'Ya existe un usuario con ese correo electrónico.',
                'error'
              );
              this.validationFailed = true;
              this.failedCellInfo = { rowIndex: params.node.rowIndex, colKey: 'email' };
              return false;
            }

            this.validationFailed = false;
            this.failedCellInfo = null;
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Editar usuario',
              'Correo electrónico no válido.',
              'error'
            );
            this.validationFailed = true;
            this.failedCellInfo = { rowIndex: params.node.rowIndex, colKey: 'email' };
            return false;
          }
        },
        filter: true,
        flex: 1.5,
        minWidth: 180
      },
      {
        field: 'web',
        headerName: 'Web',
        editable: true,
        flex: 1
      },
      {
        field: 'personType',
        headerName: 'Tipo de persona',
        editable: true,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['MORAL', 'FISICA']
        }
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        flex: 1
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: true,
        flex: 2
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
        flex: 1
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        flex: 1,
        minWidth: 150,
        tooltipField: 'state',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.estados)
        }
      },
      {
        field: 'country',
        headerName: 'País',
        editable: true,
        flex: 1
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        flex: 1
      },
      {
        field: 'cp',
        headerName: 'Código Postal',
        editable: true,
        flex: 1
      },
      {
        field: 'idCorporativo',
        headerName: 'Corporativo',
        editable: true,
        flex: 1.5,
        minWidth: 251,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [0, ...this.corporativos.map(c => c.id)]
        },
        valueFormatter: (params) => {
          if (!params.value || params.value === 0) return '(Ninguno)';
          const corp = this.corporativos.find(c => c.id === params.value);
          return corp ? corp.name : '';
        }
      },
      {
        field: 'advanced',
        headerName: 'Permisos avanzados',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        flex: 1
      },
      {
        field: 'esRestaurante',
        headerName: 'Es Restaurante',
        editable: true,
        cellDataType: 'boolean',
        cellEditor: 'agCheckboxCellEditor',
        width: 130,
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'licenseStart',
        headerName: 'Inicio Licencia',
        editable: true,
        width: 140,
        cellEditor: 'agDateCellEditor',
        valueGetter: (p) => p.data?.licenseStart ? String(p.data.licenseStart).substring(0, 10) : '',
        valueSetter: (p) => { p.data.licenseStart = p.newValue; return true; },
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : p.value;
        },
      },
      {
        field: 'licenseDays',
        headerName: 'Días Licencia',
        editable: true,
        width: 130,
        cellDataType: 'number',
        cellStyle: { textAlign: 'right' },
      },
      {
        field: 'licenseType',
        headerName: 'Tipo Licencia',
        editable: true,
        width: 130,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['trial', 'paid', 'suspended'] },
        cellStyle: (p) => {
          if (p.value === 'paid')      return { color: '#155724', fontWeight: 'bold' };
          if (p.value === 'suspended') return { color: '#721c24', fontWeight: 'bold' };
          return { color: '#856404' };
        },
      },
      {
        field: 'licenseStatus',
        headerName: 'Estado',
        editable: false,
        width: 110,
        cellStyle: (p) => {
          if (p.value === 'active')   return { color: '#155724', fontWeight: 'bold' };
          if (p.value === 'expired')  return { color: '#721c24', fontWeight: 'bold' };
          return { color: '#856404' };
        },
      },
      {
        field: 'daysRemaining',
        headerName: 'Días Rest.',
        editable: false,
        width: 100,
        cellStyle: (p) => {
          if (p.value <= 0)  return { color: '#721c24', fontWeight: 'bold' };
          if (p.value <= 5)  return { color: '#856404', fontWeight: 'bold' };
          return {};
        },
      },
      {
        field: 'picture',
        headerName: 'Foto Root',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
        width: 120
      },
      {
        field: 'picture2',
        headerName: 'Header',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture2'
        },
        editable: false,
        width: 120
      },
      {
        field: 'picture3',
        headerName: 'Footer',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture3'
        },
        editable: false,
        width: 120
      },
    ];

    return this._columnDefs;
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
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Autoajustar columnas al ancho del grid
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;

    // Calcular el siguiente número de orden (máximo + 1)
    const maxOrden = this.rowData.reduce((max, row) => {
      const orden = Number(row.orden) || 0;
      return orden > max ? orden : max;
    }, 0);

    const newItem = {
      id: tempId,
      orden: maxOrden + 1,
      name: '',
      web: '',
      email: '',
      nameSmall: '',
      picture: '',
      picture2: '',
      picture3: '',
      phone: '',
      consortium: 'NO',
      formatRep: 'NA',
      city: '',
      advanced: false,
      esRestaurante: false,
      state: '',
      country: 'MEXICO',
      rfc: '',
      cp: '',
      active: 1,
      idCorporativo: 0,
      licenseStart: new Date().toISOString().substring(0, 10),
      licenseDays: 15,
      licenseType: 'trial',
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Posicionarse automáticamente en la primera columna editable
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'orden'
        });
      }, 100);
    }, 50);
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.nameSmall);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos Nombre y Nombre Corto antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter((row) => row.__modified && !row.__isNew);

    try {
      // Procesar nuevas empresas una por una para rastrear respuestas
      for (const row of newRows) {
        const cleanedData = this.cleanDataForServer(row);
        const response: any = await lastValueFrom(this.rootService.addRoot(cleanedData));

        if (response?.id) {
          // Asignar permisos al usuario actual
          try {
            await lastValueFrom(this.branchesService.assignPermissionAfterCreation(this.idUser, response.id, 'root'));
          } catch (permError) {
            console.error('Error asignando permiso root:', permError);
          }
          try {
            await lastValueFrom(this.branchesService.assignPermissionAfterCreation(this.idUser, response.id, 'company'));
          } catch (permError) {
            console.error('Error asignando permiso company:', permError);
          }

          // Crear entidades por defecto y asignar branch + contract al usuario
          const { branchId, contractId } = await this.createDefaultEntitiesForRoot(response.id, row.name);
          if (branchId) {
            try { await lastValueFrom(this.branchesService.assignPermissionAfterCreation(this.idUser, branchId, 'branch')); } catch (e) { console.error('Error asignando branch:', e); }
          }
          if (contractId) {
            try { await lastValueFrom(this.branchesService.assignPermissionAfterCreation(this.idUser, contractId, 'contract')); } catch (e) { console.error('Error asignando contract:', e); }
          }
        }
      }

      // Procesar actualizaciones
      for (const row of modifiedRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.rootService.updateRoot(row.id, cleanedData));
      }

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
    }
  }

  private logPeriferico(accion: string, empresa: string) {
    this.peripheralCurrentStep++;
    this.peripheralStep = accion;
    this.peripheralProgress = Math.min(
      Math.round((this.peripheralCurrentStep / this.peripheralTotalSteps) * 100),
      99
    );
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Auto-crear periferico [${accion}] para empresa "${empresa}"`,
      'Menu SMP - Empresas - Auto-crear periféricos',
      this.trackingService.getEmail()
    );
  }

  private startPeripheralProgress(totalSteps: number = 15) {
    this.creatingPeripherals = true;
    this.peripheralProgress = 0;
    this.peripheralStep = 'Initializing...';
    this.peripheralCurrentStep = 0;
    this.peripheralTotalSteps = totalSteps;
  }

  private endPeripheralProgress() {
    this.peripheralProgress = 100;
    this.peripheralStep = 'Done';
    setTimeout(() => { this.creatingPeripherals = false; }, 800);
  }

  // Crea todas las entidades periféricas para una empresa NUEVA.
  // Cada paso tiene su propio try/catch: un error en un paso no cancela los demás.
  // Acepta tanto camelCase (id) como PascalCase (Id) en las respuestas del backend.
  private async createDefaultEntitiesForRoot(rootId: number, rootName: string): Promise<{ branchId: number; contractId: number }> {
    const today     = new Date().toISOString().substring(0, 10);
    const nextYear  = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate   = nextYear.toISOString().substring(0, 10);
    const getId     = (r: any) => r?.id ?? r?.Id ?? 0;   // tolerante camelCase / PascalCase

    let branchId     = 0;
    let contractId   = 0;
    let conventionId = 0;
    let projectId    = 0;
    let tipoClienteId = 0;
    let rolId        = 0;
    let familiaId    = 0;
    let subfamiliaId = 0;
    const cuentaBase: any = { idCompany: rootId, active: true };

    this.startPeripheralProgress(18);
    this.logPeriferico('INICIO crear empresa nueva', rootName);

    // ── 1. Sucursal principal ────────────────────────────────────────────────
    try {
      const branch: any = await lastValueFrom(this.branchesService.addBranch({
        idCompany: rootId, name: 'PRINCIPAL',
        description: `${rootName.substring(0, 38)} - Oficina`, active: true
      }));
      branchId = getId(branch);
      this.logPeriferico('1-Sucursal creada', rootName);
    } catch (e) { console.error('paso 1 (sucursal):', e); }

    // ── 2. Contrato principal ────────────────────────────────────────────────
    try {
      const contract: any = await lastValueFrom(this.followprojectsService.addContract({
        numberContract: 'CONTRATO-001', description: `${rootName} - Contrato Principal`,
        descripSmall: 'Contrato Principal', idBranch: branchId, idProvider: 0,
        dateStar: today, dateEnd: endDate, speciality: 'OTROS', stateContract: 'ACTIVO',
        amountMx: 0, amountDll: 0, term: 0, consecutive: 1, active: 1
      }));
      contractId = getId(contract);
      this.logPeriferico('2-Contrato creado', rootName);
    } catch (e) { console.error('paso 2 (contrato):', e); }

    // ── 3. Convenio principal ────────────────────────────────────────────────
    try {
      const conv: any = await lastValueFrom(this.conventionsService.addConvention({
        name: 'CONV-001', description: `${rootName} - Convenio Principal`,
        start: today, end: endDate, amountMX: 0, amountDLL: 0, comment: '',
        id_type: 1, idContract: contractId, idProject: 0,
        type: 'Contract', vigente: true, active: true
      }));
      conventionId = getId(conv);
      this.logPeriferico('3-Convenio creado', rootName);
    } catch (e) { console.error('paso 3 (convenio):', e); }

    // ── 4. Proyecto principal ────────────────────────────────────────────────
    try {
      const proj: any = await lastValueFrom(this.projectsService.addProject({
        name: `${rootName} - Proyecto Principal`, number: 'PROYECTO-001',
        description: `Proyecto principal de ${rootName}`, idContrato: contractId,
        year: new Date().getFullYear().toString(), active: 1
      }));
      projectId = getId(proj);
      this.logPeriferico('4-Proyecto creado', rootName);
    } catch (e) { console.error('paso 4 (proyecto):', e); }

    // ── 5. Programa de trabajo (3 tareas) ────────────────────────────────────
    try {
      const wpBase = {
        idContract: contractId, idProject: projectId, idConvention: conventionId,
        startDate: today, endDate: endDate, costMX: 0, ponderado: 33, progress: 0,
        criticRoute: 'No', measure: 'HRS', phase: 'Fase 1', active: 1, activity: '', typeActivity: 'task'
      };
      await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 1, parent: 0, text: 'INICIO' }));
      await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 2, parent: 0, text: 'DESARROLLO' }));
      await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 3, parent: 0, text: 'CIERRE' }));
      this.logPeriferico('5-Programa de Trabajo creado', rootName);
    } catch (e) { console.error('paso 5 (workprogram):', e); }

    // ── 6. TIPO-CLIENTE (SMP catalog) ────────────────────────────────────────
    try {
      const tc: any = await lastValueFrom(this.catalogsService.addCatalog({
        description: 'General', active: true, idCompany: rootId, type: 'TIPO-CLIENTE', parentId: null
      }));
      tipoClienteId = getId(tc);
      this.logPeriferico('6-TIPO-CLIENTE creado', rootName);
    } catch (e) { console.error('paso 6 (tipo-cliente):', e); }

    // ── 6b. TIPO-CLIENTE en Tracking ──────────────────────────────────────────
    try {
      await lastValueFrom(this.catalogadmonService.addCatalogAdmon({
        description: 'General', active: 1, idCompany: rootId, type: 'TIPO-CLIENTE', parentId: null
      }));
      this.logPeriferico('6b-TIPO-CLIENTE Tracking creado', rootName);
    } catch (e) { console.error('paso 6b (tipo-cliente tracking):', e); }

    // ── 6c. BILL en Tracking ──────────────────────────────────────────────────
    try {
      await lastValueFrom(this.catalogadmonService.addCatalogAdmon({
        description: 'GENERAL', active: 1, idCompany: rootId, type: 'BILL', parentId: null
      }));
      this.logPeriferico('6c-BILL Tracking creado', rootName);
    } catch (e) { console.error('paso 6c (bill tracking):', e); }

    // ── 7. Cliente ────────────────────────────────────────────────────────────
    try {
      await lastValueFrom(this.customersService.addCustomer({
        company: rootName.toUpperCase(), nameContact: rootName, idBranch: branchId,
        idRoot: rootId, idTypecop: tipoClienteId, type: 'CUSTOMERS', vigente: true, active: true
      }));
      this.logPeriferico('7-Cliente creado', rootName);
    } catch (e) { console.error('paso 7 (cliente):', e); }

    // ── 8. Proveedor ──────────────────────────────────────────────────────────
    try {
      await lastValueFrom(this.customersService.addCustomer({
        company: rootName.toUpperCase(), nameContact: rootName, idBranch: branchId,
        idRoot: rootId, idTypecop: 0, type: 'PROVIDERS', vigente: true, active: true
      }));
      this.logPeriferico('8-Proveedor creado', rootName);
    } catch (e) { console.error('paso 8 (proveedor):', e); }

    // ── 9. BillingManagement ──────────────────────────────────────────────────
    try {
      await lastValueFrom(this.administrationService.addBillingManagementInfo({
        idRoot: rootId, emisorRfc: '', emisorNombre: rootName, emisorCp: '',
        prefix: 'REC', consecutive: 0, consecutivexp: 0, fiscalYear: new Date().getFullYear(),
        fiscalRegime: 0, iIva: 0.16, iIeps: 0, iI3: 0, rIva: 0, rIeps: 0,
        efirmaPass: '', dateStart: today, dateEnd: endDate, active: true
      }));
      this.logPeriferico('9-BillingManagement creado', rootName);
    } catch (e) { console.error('paso 9 (billing):', e); }

    // ── 10. Cuenta bancaria ───────────────────────────────────────────────────
    try {
      await lastValueFrom(this.administrationService.addAccountBanks({
        idBussines: rootId, numberAccount: '0000000000', nameAccount: 'Cuenta Principal',
        signAccount: 'sin firma', interbancaria: 'N/A', folioCheque: '', folioSinCheque: '',
        idBanco: 0, maskin: 'REC', consecin: 0, maskex: 'EGR', consecex: 0, eAplicaFiscal: 'Si'
      }));
      this.logPeriferico('10-CuentaBancaria creada', rootName);
    } catch (e) { console.error('paso 10 (cuenta bancaria):', e); }

    // ── 11. Unidades de medida MEASURE ────────────────────────────────────────
    try {
      await Promise.all(['PZA', 'SRV', 'HRS', 'MES', 'KG', 'M'].map(desc =>
        lastValueFrom(this.catalogsService.addCatalog({
          idCompany: rootId, description: desc, valueAddition: 'NA',
          valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, type: 'MEASURE', active: 1
        }))
      ));
      this.logPeriferico('11-Unidades MEASURE creadas (6)', rootName);
    } catch (e) { console.error('paso 11 (MEASURE):', e); }

    // ── 12. Cuentas contables ─────────────────────────────────────────────────
    try {
      const activo: any = await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '1', nombre: 'ACTIVO', descripcion: 'Activos de la empresa', nivel: 1, esHoja: false, idPadre: null
      }));
      await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '1.1', nombre: 'CAJA Y BANCOS', descripcion: 'Efectivo y equivalentes de efectivo', nivel: 2, esHoja: true, idPadre: getId(activo)
      }));
      const ingresos: any = await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '4', nombre: 'INGRESOS', descripcion: 'Ingresos de la empresa', nivel: 1, esHoja: false, idPadre: null
      }));
      await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '4.1', nombre: 'INGRESOS ORDINARIOS', descripcion: 'Ingresos por actividad ordinaria', nivel: 2, esHoja: true, idPadre: getId(ingresos)
      }));
      const egresos: any = await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '5', nombre: 'EGRESOS', descripcion: 'Egresos de la empresa', nivel: 1, esHoja: false, idPadre: null
      }));
      await lastValueFrom(this.cuentasContablesService.create({
        ...cuentaBase, codigo: '5.1', nombre: 'GASTOS OPERATIVOS', descripcion: 'Gastos de operación', nivel: 2, esHoja: true, idPadre: getId(egresos)
      }));
      this.logPeriferico('12-CuentasContables creadas (6)', rootName);
    } catch (e) { console.error('paso 12 (cuentas contables):', e); }

    // ── 13. Rol ADMINISTRADOR ─────────────────────────────────────────────────
    try {
      const rol: any = await lastValueFrom(this.rolesService.addRoles({
        idCompany: rootId, description: 'ADMINISTRADOR', comment: 'Rol principal', active: true
      }));
      rolId = getId(rol);
      this.logPeriferico('13-Rol ADMINISTRADOR creado', rootName);
    } catch (e) { console.error('paso 13 (rol):', e); }

    // ── 14. Posición ADMINISTRADOR ────────────────────────────────────────────
    try {
      await lastValueFrom(this.posicionesService.addPosition({
        idCompany: rootId, idRoles: rolId, description: 'ADMINISTRADOR', active: true
      }));
      this.logPeriferico('14-Posicion ADMINISTRADOR creada', rootName);
    } catch (e) { console.error('paso 14 (posición):', e); }

    // ── 15a. Familia GENERAL ──────────────────────────────────────────────────
    try {
      const fr: any = await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: rootId, description: 'GENERAL', type: 'FAMILY',
        valueAddition: 'NA', valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, active: 1
      }));
      familiaId = getId(fr);
      this.logPeriferico('15a-Familia GENERAL creada', rootName);
    } catch (e) { console.error('paso 15a (familia):', e); }

    // ── 15b. Subfamilia CONSUMIBLES ───────────────────────────────────────────
    try {
      if (familiaId) {
        const sr: any = await lastValueFrom(this.catalogsService.addCatalog({
          idCompany: rootId, description: 'CONSUMIBLES', type: 'SUBFAMILY', parentId: familiaId,
          valueAddition: 'NA', valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, active: 1
        }));
        subfamiliaId = getId(sr);
        this.logPeriferico('15b-Subfamilia CONSUMIBLES creada', rootName);
      }
    } catch (e) { console.error('paso 15b (subfamilia):', e); }

    // ── 15c-d. Materiales por defecto ─────────────────────────────────────────
    try {
      const measuresAll: any[] = await lastValueFrom(this.catalogsService.getUnits(rootId)).catch(() => []);
      const medidaId = measuresAll?.find((m: any) => m.description === 'PZA')?.id || null;
      await Promise.all(['Papel Bond', 'Tóner', 'Folder', 'Bolígrafo', 'Cinta Adhesiva'].map(name =>
        lastValueFrom(this.materialsService.addMaterial({
          idCompany: rootId, description: name, insumo: '', articulo: '', date: today,
          idMedida: medidaId, idFamilia: familiaId || null, idSubfamilia: subfamiliaId || null,
          idUbication: null, aplicaResg: false, picture: '',
          costoMN: 0, costoDLL: 0, ventaMN: 0, ventaDLL: 0,
          stockMin: 0, stockMax: 0, vigente: true, active: true, typematerial: 'MATERIAL'
        }))
      ));
      this.logPeriferico('15d-Materiales creados (5)', rootName);
    } catch (e) { console.error('paso 15c-d (materiales):', e); }

    // ── 16. Equipos por defecto ───────────────────────────────────────────────
    try {
      await Promise.all(['Computadora', 'Impresora', 'Escritorio', 'Silla de Oficina', 'Teléfono'].map(name =>
        lastValueFrom(this.equipmentService.addEquipment({
          idCompany: rootId, description: name, aplicaResg: false,
          costoMN: 0, costoDLL: 0, ventaMN: 0, ventaDLL: 0,
          stockMin: 0, stockMax: 0, quantity: 1, measure: 'DIA',
          costMN: 0, priceMN: 0, print: true, active: true
        }))
      ));
      this.logPeriferico('16-Equipos creados (5)', rootName);
    } catch (e) { console.error('paso 16 (equipos):', e); }

    this.endPeripheralProgress();
    return { branchId, contractId };
  }

  // Verifica y crea entidades por defecto que faltan en una empresa existente.
  // Cada paso es independiente: un fallo no detiene los demás.
  private async ensureDefaultEntitiesForRoot(rootId: number, rootName: string): Promise<void> {
    this.startPeripheralProgress(20);
    const today = new Date().toISOString().substring(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate = nextYear.toISOString().substring(0, 10);
    const cuentaBase: any = { idCompany: rootId, active: true };

    // ── 1. Sucursal ──────────────────────────────────────────────────────────
    let branchId = 0;
    try {
      const branches: any[] = await lastValueFrom(this.branchesService.getBranches(rootId)).catch(() => []);
      if (branches?.length) {
        branchId = branches[0].id;
      } else {
        const branch: any = await lastValueFrom(this.branchesService.addBranch({
          idCompany: rootId, name: 'PRINCIPAL',
          description: `${rootName.substring(0, 38)} - Oficina`, active: true
        }));
        branchId = branch?.id || 0;
        this.logPeriferico('1-Sucursal creada', rootName);
      }
    } catch (e) { console.error('ensure paso 1 (sucursal):', e); }

    // ── 2. Contrato ──────────────────────────────────────────────────────────
    let contractId = 0;
    try {
      const contracts: any[] = await lastValueFrom(this.followprojectsService.getContractsByRoot(rootId)).catch(() => []);
      if (contracts?.length) {
        contractId = contracts[0].id;
      } else {
        const contract: any = await lastValueFrom(this.followprojectsService.addContract({
          numberContract: 'CONTRATO-001', description: `${rootName} - Contrato Principal`,
          descripSmall: 'Contrato Principal', idBranch: branchId, idProvider: 0,
          dateStar: today, dateEnd: endDate, speciality: 'OTROS', stateContract: 'ACTIVO',
          amountMx: 0, amountDll: 0, term: 0, consecutive: 1, active: 1
        }));
        contractId = contract?.id || 0;
        this.logPeriferico('2-Contrato creado', rootName);
      }
    } catch (e) { console.error('ensure paso 2 (contrato):', e); }

    // ── 3. Convenio ──────────────────────────────────────────────────────────
    let conventionId = 0;
    try {
      if (contractId) {
        const conventions: any = await lastValueFrom(this.conventionsService.getConventionsByContractOrProject('Contract', contractId)).catch(() => []);
        if (conventions?.length) {
          conventionId = conventions[0].id;
        } else {
          const conv: any = await lastValueFrom(this.conventionsService.addConvention({
            name: 'CONV-001', description: `${rootName} - Convenio Principal`,
            start: today, end: endDate, amountMX: 0, amountDLL: 0, comment: '',
            id_type: 1, idContract: contractId, idProject: 0,
            type: 'Contract', vigente: true, active: true
          }));
          conventionId = conv?.id || 0;
          this.logPeriferico('3-Convenio CONV-001 creado (vigente)', rootName);
        }
      }
    } catch (e) { console.error('ensure paso 3 (convenio):', e); }

    // ── 4. Proyecto ──────────────────────────────────────────────────────────
    let projectId = 0;
    try {
      if (contractId) {
        const projects: any = await lastValueFrom(this.projectsService.getProjectListByContract(contractId)).catch(() => []);
        if (projects?.length) {
          projectId = projects[0].id;
        } else {
          const proj: any = await lastValueFrom(this.projectsService.addProject({
            name: `${rootName} - Proyecto Principal`, number: 'PROYECTO-001',
            description: `Proyecto principal de ${rootName}`, idContrato: contractId,
            year: new Date().getFullYear().toString(), active: 1
          }));
          projectId = proj?.id || 0;
          this.logPeriferico('4-Proyecto creado', rootName);
        }
      }
    } catch (e) { console.error('ensure paso 4 (proyecto):', e); }

    // ── 5. Programa de Trabajo ────────────────────────────────────────────────
    try {
      if (conventionId) {
        const existingWP: any[] = await lastValueFrom(this.workprogramsService.getByConvention(conventionId)).catch(() => []);
        if (!existingWP?.length) {
          const wpBase = {
            idContract: contractId, idProject: projectId, idConvention: conventionId,
            startDate: today, endDate: endDate, costMX: 0,
            ponderado: 33, progress: 0, criticRoute: 'No', measure: 'HRS', phase: 'Fase 1',
            active: 1, activity: '', typeActivity: 'task'
          };
          await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 1, parent: 0, text: 'INICIO' }));
          await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 2, parent: 0, text: 'DESARROLLO' }));
          await lastValueFrom(this.workprogramsService.addWorkProgram({ ...wpBase, idTask: 3, parent: 0, text: 'CIERRE' }));
          this.logPeriferico('5-Programa de Trabajo creado (3 tareas)', rootName);
        }
      }
    } catch (e) { console.error('ensure paso 5 (workprogram):', e); }

    // ── 6. TIPO-CLIENTE ──────────────────────────────────────────────────────
    let tipoClienteId = 0;
    try {
      const tiposCliente: any[] = await lastValueFrom(this.catalogsService.getCatalogs(rootId, 'TIPO-CLIENTE')).catch(() => []);
      if (tiposCliente?.length) {
        tipoClienteId = tiposCliente[0].id;
      } else {
        const tc: any = await lastValueFrom(this.catalogsService.addCatalog({
          description: 'General', active: true, idCompany: rootId, type: 'TIPO-CLIENTE', parentId: null
        }));
        tipoClienteId = tc?.id || 0;
        this.logPeriferico('6-TIPO-CLIENTE creado', rootName);
      }
    } catch (e) { console.error('ensure paso 6 (tipo-cliente):', e); }

    // ── 6b. TIPO-CLIENTE en Tracking ─────────────────────────────────────────
    try {
      const tiposTracking: any[] = await lastValueFrom(this.catalogsService.getCatalogsFromAdmon(rootId, 'TIPO-CLIENTE')).catch(() => []);
      if (!tiposTracking?.length) {
        await lastValueFrom(this.catalogadmonService.addCatalogAdmon({
          description: 'General', active: 1, idCompany: rootId, type: 'TIPO-CLIENTE', parentId: null
        }));
        this.logPeriferico('6b-TIPO-CLIENTE en Tracking creado', rootName);
      }
    } catch (e) { console.error('ensure paso 6b (tipo-cliente tracking):', e); }

    // ── 6c. BILL en Tracking ──────────────────────────────────────────────────
    try {
      const billCats: any[] = await lastValueFrom(this.catalogsService.getCatalogsFromAdmon(rootId, 'BILL')).catch(() => []);
      if (!billCats?.length) {
        await lastValueFrom(this.catalogadmonService.addCatalogAdmon({
          description: 'GENERAL', active: 1, idCompany: rootId, type: 'BILL', parentId: null
        }));
        this.logPeriferico('6c-BILL en Tracking creado', rootName);
      }
    } catch (e) { console.error('ensure paso 6c (bill tracking):', e); }

    // ── 7. Cliente ───────────────────────────────────────────────────────────
    try {
      const customers: any = await lastValueFrom(this.customersService.getCustomers(rootId, 'CUSTOMERS')).catch(() => []);
      if (!customers?.length) {
        await lastValueFrom(this.customersService.addCustomer({
          company: rootName.toUpperCase(), nameContact: rootName, idBranch: branchId,
          idRoot: rootId, idTypecop: tipoClienteId, type: 'CUSTOMERS', vigente: true, active: true
        }));
        this.logPeriferico('7-Cliente creado', rootName);
      }
    } catch (e) { console.error('ensure paso 7 (cliente):', e); }

    // ── 8. Proveedor (misma tabla que clientes en administration, diferenciado por type) ──
    try {
      const providers: any = await lastValueFrom(this.customersService.getCustomers(rootId, 'PROVIDERS')).catch(() => []);
      if (!providers?.length) {
        await lastValueFrom(this.customersService.addCustomer({
          company: rootName.toUpperCase(), nameContact: rootName, idBranch: branchId,
          idRoot: rootId, idTypecop: 0, type: 'PROVIDERS', vigente: true, active: true
        }));
        this.logPeriferico('8-Proveedor creado', rootName);
      }
    } catch (e) { console.error('ensure paso 8 (proveedor):', e); }

    // ── 9. BillingManagement ─────────────────────────────────────────────────
    try {
      const billing: any = await lastValueFrom(this.administrationService.getBillingManagementInfo(rootId)).catch(() => null);
      const billingEmpty = !billing || (Array.isArray(billing) ? billing.length === 0 : !billing.id);
      if (billingEmpty) {
        await lastValueFrom(this.administrationService.addBillingManagementInfo({
          idRoot: rootId, emisorRfc: '', emisorNombre: rootName, emisorCp: '',
          prefix: 'REC', consecutive: 0, consecutivexp: 0, fiscalYear: new Date().getFullYear(),
          fiscalRegime: 0, iIva: 0.16, iIeps: 0, iI3: 0, rIva: 0, rIeps: 0,
          efirmaPass: '', dateStart: today, dateEnd: endDate, active: true
        }));
        this.logPeriferico('9-BillingManagement creado', rootName);
      }
    } catch (e) { console.error('ensure paso 9 (billing):', e); }

    // ── 9. Cuenta bancaria ───────────────────────────────────────────────────
    try {
      const accounts: any[] = await lastValueFrom(this.administrationService.getAccountBanks(rootId)).catch(() => []);
      if (!accounts?.length) {
        await lastValueFrom(this.administrationService.addAccountBanks({
          idBussines: rootId, numberAccount: '0000000000', nameAccount: 'Cuenta Principal',
          signAccount: 'sin firma', interbancaria: 'N/A', folioCheque: '', folioSinCheque: '',
          idBanco: 0, maskin: 'REC', consecin: 0, maskex: 'EGR', consecex: 0, eAplicaFiscal: 'Si'
        }));
        this.logPeriferico('9-CuentaBancaria creada', rootName);
      }
    } catch (e) { console.error('ensure paso 9 (cuenta bancaria):', e); }

    // ── 10. Unidades de medida (MEASURE) ─────────────────────────────────────
    try {
      const measures: any[] = await lastValueFrom(this.catalogsService.getCatalogs(rootId, 'MEASURE')).catch(() => []);
      if (!measures?.length) {
        await Promise.all(['PZA', 'SRV', 'HRS', 'MES', 'KG', 'M'].map(desc =>
          lastValueFrom(this.catalogsService.addCatalog({
            idCompany: rootId, description: desc, valueAddition: 'NA',
            valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, type: 'MEASURE', active: 1
          }))
        ));
        this.logPeriferico('10-Unidades MEASURE creadas (6)', rootName);
      }
    } catch (e) { console.error('ensure paso 10 (MEASURE):', e); }

    // ── 11. Cuentas contables ────────────────────────────────────────────────
    try {
      const cuentas: any[] = await lastValueFrom(this.cuentasContablesService.getAll(rootId)).catch(() => []);
      if (!cuentas?.length) {
        const activo: any = await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '1', nombre: 'ACTIVO', descripcion: 'Activos de la empresa', nivel: 1, esHoja: false, idPadre: null
        }));
        await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '1.1', nombre: 'CAJA Y BANCOS', descripcion: 'Efectivo y equivalentes de efectivo', nivel: 2, esHoja: true, idPadre: activo.id
        }));
        const ingresos: any = await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '4', nombre: 'INGRESOS', descripcion: 'Ingresos de la empresa', nivel: 1, esHoja: false, idPadre: null
        }));
        await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '4.1', nombre: 'INGRESOS ORDINARIOS', descripcion: 'Ingresos por actividad ordinaria', nivel: 2, esHoja: true, idPadre: ingresos.id
        }));
        const egresos: any = await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '5', nombre: 'EGRESOS', descripcion: 'Egresos de la empresa', nivel: 1, esHoja: false, idPadre: null
        }));
        await lastValueFrom(this.cuentasContablesService.create({
          ...cuentaBase, codigo: '5.1', nombre: 'GASTOS OPERATIVOS', descripcion: 'Gastos de operación', nivel: 2, esHoja: true, idPadre: egresos.id
        }));
        this.logPeriferico('11-CuentasContables creadas (6)', rootName);
      }
    } catch (e) { console.error('ensure paso 11 (cuentas contables):', e); }

    // ── 12. Rol por defecto ──────────────────────────────────────────────────
    let rolId = 0;
    try {
      const rolesResp: any = await lastValueFrom(this.rolesService.getRoles(rootId)).catch(() => ({ data: [] }));
      const roles: any[] = rolesResp?.data || rolesResp || [];
      if (roles?.length) {
        rolId = roles[0].id;
      } else {
        const rol: any = await lastValueFrom(this.rolesService.addRoles({
          idCompany: rootId,
          description: 'ADMINISTRADOR',
          comment: 'Rol principal',
          active: true
        }));
        rolId = rol?.id || 0;
        this.logPeriferico('12-Rol ADMINISTRADOR creado', rootName);
      }
    } catch (e) { console.error('ensure paso 12 (rol):', e); }

    // ── 13. Posición ligada al rol ───────────────────────────────────────────
    try {
      if (rolId) {
        const posiciones: any[] = await lastValueFrom(this.posicionesService.getPositionsByRole(rootId, rolId)).catch(() => []);
        if (!posiciones?.length) {
          await lastValueFrom(this.posicionesService.addPosition({
            idCompany: rootId,
            idRoles: rolId,
            description: 'ADMINISTRADOR',
            active: true
          }));
          this.logPeriferico('13-Posicion ADMINISTRADOR creada', rootName);
        }
      }
    } catch (e) { console.error('ensure paso 13 (posición):', e); }

    // ── 14. Familia + Subfamilia + Materiales ────────────────────────────────
    // vw_MaterialsWithFamilies usa INNER JOIN: materiales sin familia son invisibles
    let familiaId = 0;
    let subfamiliaId = 0;
    try {
      const familias: any[] = await lastValueFrom(this.catalogsService.getCatalogs(rootId, 'FAMILY')).catch(() => []);
      const familiaGeneral = familias?.find((f: any) => f.description === 'GENERAL');
      if (familiaGeneral) {
        familiaId = familiaGeneral.id;
      } else {
        const fr: any = await lastValueFrom(this.catalogsService.addCatalog({
          idCompany: rootId, description: 'GENERAL', type: 'FAMILY',
          valueAddition: 'NA', valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, active: 1
        }));
        familiaId = fr?.id || 0;
        this.logPeriferico('14a-Familia GENERAL creada', rootName);
      }
    } catch (e) { console.error('ensure paso 14a (familia):', e); }

    try {
      if (familiaId) {
        const subfamilias: any[] = await lastValueFrom(this.catalogsService.getCatalogs(rootId, 'SUBFAMILY')).catch(() => []);
        const subConsu = subfamilias?.find((s: any) => s.description === 'CONSUMIBLES' && s.parentId === familiaId);
        if (subConsu) {
          subfamiliaId = subConsu.id;
        } else {
          const sr: any = await lastValueFrom(this.catalogsService.addCatalog({
            idCompany: rootId, description: 'CONSUMIBLES', type: 'SUBFAMILY', parentId: familiaId,
            valueAddition: 'NA', valueAdditionBit2: false, valueAdditionBit3: false, vigente: true, active: 1
          }));
          subfamiliaId = sr?.id || 0;
          this.logPeriferico('14b-Subfamilia CONSUMIBLES creada', rootName);
        }
      }
    } catch (e) { console.error('ensure paso 14b (subfamilia):', e); }

    try {
      const materials: any[] = await lastValueFrom(this.materialsService.getMaterials(rootId, 'MATERIAL')).catch(() => []);
      if (!materials?.length) {
        // Obtener ID de unidad PZA para que la vista INNER JOIN encuentre la medida
        const measuresAll: any[] = await lastValueFrom(this.catalogsService.getUnits(rootId)).catch(() => []);
        const medidaId = measuresAll?.find((m: any) => m.description === 'PZA')?.id || null;
        const defaultMaterials = ['Papel Bond', 'Tóner', 'Folder', 'Bolígrafo', 'Cinta Adhesiva'];
        await Promise.all(defaultMaterials.map(name =>
          lastValueFrom(this.materialsService.addMaterial({
            idCompany: rootId, description: name, insumo: '', articulo: '',
            date: new Date().toISOString().substring(0, 10), idMedida: medidaId,
            idFamilia: familiaId || null, idSubfamilia: subfamiliaId || null,
            idUbication: null, aplicaResg: false, picture: '',
            costoMN: 0, costoDLL: 0, ventaMN: 0, ventaDLL: 0,
            stockMin: 0, stockMax: 0, vigente: true, active: true, typematerial: 'MATERIAL'
          }))
        ));
        this.logPeriferico('14c-Materiales creados (5) con familia+subfamilia+unidad', rootName);
      }
    } catch (e) { console.error('ensure paso 14c (materiales):', e); }

    // ── 15. Equipos ──────────────────────────────────────────────────────────
    try {
      const equipment: any[] = await lastValueFrom(this.equipmentService.getEquipment(rootId)).catch(() => []);
      if (!equipment?.length) {
        const defaultEquipment = ['Computadora', 'Impresora', 'Escritorio', 'Silla de Oficina', 'Teléfono'];
        await Promise.all(defaultEquipment.map(name =>
          lastValueFrom(this.equipmentService.addEquipment({
            idCompany: rootId, description: name, aplicaResg: false,
            costoMN: 0, costoDLL: 0, ventaMN: 0, ventaDLL: 0,
            stockMin: 0, stockMax: 0, quantity: 1, measure: 'DIA',
            costMN: 0, priceMN: 0, print: true, active: true
          }))
        ));
        this.logPeriferico('15-Equipos creados (5)', rootName);
      }
    } catch (e) { console.error('ensure paso 15 (equipos):', e); }

    this.endPeripheralProgress();
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

}
