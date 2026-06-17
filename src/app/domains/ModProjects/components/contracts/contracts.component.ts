import { Component, effect, inject, TemplateRef, ViewChild, ChangeDetectorRef} from '@angular/core';
import { Icontract } from '../../../../interface/icontract';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { TrackingService } from '../../../../services/tracking.service';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ContractDetailsComponent } from './contract-details/contract-details.component';
import { BranchsService } from 'app/services/branchs.service';
import { AuthService } from 'app/services/auth.service';
import { ProvidersService } from 'app/services/providers.service';
import { DetailCellRendererProyectosComponent } from './details/detalles-proyectos.component';
import { ProjectsService } from 'app/services/projects.service';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [DomainsModule, ContractDetailsComponent],
  templateUrl: './contracts.component.html',
  styleUrl: './contracts.component.scss'
})
export class ContractsComponent {
  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerBranchs();
      this.getProviders();
      this.getContracts();
    });
  }

  @ViewChild(ContractDetailsComponent) contractDetails!: ContractDetailsComponent;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  selectedRowData: Icontract | null = null;

  private isOpen: boolean = false;
  showDetailsTab: boolean = false;
  idContract: number | null = null;

  idBranch: number;
  idRoot: number;

  notSavedChanges: boolean = false;
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;
  private doubleClicked = false;

  gridHeight: string = '80vh';

  // Inject services
  private trackingService = inject(TrackingService);
  private readonly cdr = inject(ChangeDetectorRef);
  private followprojectsService = inject(FollowprojectsService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);
  private branchsService = inject(BranchsService);
  private projectsService = inject(ProjectsService);
  authService = inject(AuthService);

  // Components for master-detail
  components = {
    detailCellRendererProyectos: DetailCellRendererProyectosComponent
  };

  public contract: Icontract[] = [];
  branchs: any[] = [];
  providers: any[] = [];
  private gridApi!: GridApi<Icontract>;

  // Opciones para combos
  especialidades: string[] = [
    'CIVIL', 'ELECTRICA', 'MECANICA', 'INSTRUMENTACION', 'PROCESO', 'TUBERIA', 'ESTRUCTURAL', 'OTROS'
  ];

  estadosContrato: string[] = [
    'ACTIVO', 'EN PROCESO', 'FINALIZADO', 'CANCELADO', 'SUSPENDIDO'
  ];

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    masterDetail: true,
    isRowMaster: (dataItem) => true,
    detailCellRenderer: 'detailCellRendererProyectos',
    detailRowHeight: 600,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
      this.selectedRowData = event.data;
    },
    onCellClicked: (event) => {
      const colId = event.column.getColId();
      const node = event.node;
      const api = event.api;

      // Handle "Proyectos" column click - expands master-detail for projects
      if (colId === 'project') {
        // Toggle expansion
        const isCurrentlyExpanded = node.expanded;

        // Collapse all other rows
        api.forEachNode(otherNode => {
          if (otherNode.expanded && otherNode !== node) {
            otherNode.setExpanded(false);
          }
        });

        if (isCurrentlyExpanded) {
          // If already expanded, collapse and clear filter
          node.setExpanded(false);
          api.setFilterModel(null);
          api.onFilterChanged();
        } else {
          // Apply filter to show only this contract and expand
          const filterModel = {
            id: { filterType: 'number', type: 'equals', filter: event.data.id }
          };
          api.setFilterModel(filterModel);
          api.onFilterChanged();
          event.data.detailType = 'proyectos';
          node.setExpanded(true);
        }
      }
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        const allColumns = this.colMaster;
        const currentColIndex = allColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < allColumns.length - 1) {
          setTimeout(() => {
            const rowNode = params.api.getRowNode(params.node.rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
            }
            params.api.ensureIndexVisible(params.node.rowIndex);
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: allColumns[currentColIndex + 1].field,
            });
          }, 150);
        }
        params.event.preventDefault();
      }
    },
    onFirstDataRendered: (params) => {
      // Autoajustar columnas al contenido
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      params.api.autoSizeColumns(allColumnIds, false);
    }
  };

  async activateDetailsTab() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.showDetailsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  
    this.cdr.detectChanges();}

  async adjustGridSize() {
    this.gridHeight = '20vh';
  }

  resetGridSize() {
    this.gridHeight = '80vh';
    this.idContract = null;
    this.showDetailsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  colMaster: ColDef[] = [
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      minWidth: 50,
      maxWidth: 60,
      pinned: 'left',
      sortable: false,
      filter: false,
      editable: false,
      cellStyle: { textAlign: 'center', fontWeight: 'bold' }
    },
    {
      field: 'id',
      headerName: 'ID',
      hide: true,
      filter: 'agNumberColumnFilter',
      filterParams: {
        filterOptions: ['equals']
      }
    },
    {
      field: 'numberContract',
      headerName: 'Contrato',
      filter: true,
      minWidth: 100,
      editable: true
    },
    {
      field: 'detalle',
      headerName: 'Detalle',
      width: 90,
      editable: false,
      sortable: false,
      filter: false,
      cellStyle: { backgroundColor: '#cfe2ff', cursor: 'pointer', textAlign: 'center' },
      onCellClicked: (event) => {
        this.selectedRowData = event.data;
        this.idContract = event.data.id;
        this.signalsService.setIdContract(event.data.id);
        this.activateDetailsTab();
      },
      cellRenderer: (params) => {
        return `<span style="display:flex; align-items:center; justify-content:center; gap:4px;">
          <i class="bi bi-list-ul" style="color:#0d6efd; font-size:14px;"></i>
        </span>`;
      }
    },
    {
      field: 'project',
      headerName: 'Proyectos',
      filter: true,
      minWidth: 100,
      editable: false,
      cellStyle: { backgroundColor: '#d4edda', cursor: 'pointer', textDecoration: 'underline' },
      cellRenderer: (params) => {
        const count = params.value || '0';
        return `<span style="display:flex; align-items:center; gap:6px;">
          <i class="bi bi-folder" style="color:#1976d2;"></i>
          <span>${count}</span>
        </span>`;
      }
    },
    {
      field: 'idBranch',
      headerName: 'Sucursal',
      editable: true,
      filter: true,
      minWidth: 100,
      cellEditor: 'agSelectCellEditor',
      filterParams: {
        defaultToNothingSelected: true,
      },
      cellEditorParams: (params) => {
        return {
          values: this.branchs
            ? this.branchs
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => item.id)
            : [],
        };
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const foundBranch = this.branchs?.find((item) => item.id === params.value);
        return foundBranch ? foundBranch.name : params.value;
      },
      valueGetter: (params) => {
        if (!params.data || !params.data.idBranch) return '';
        const branch = this.branchs?.find(b => b.id === params.data.idBranch);
        return branch ? branch.name : '';
      },
    },
    {
      field: 'description',
      headerName: 'Descripcion',
      minWidth: 100,
      editable: true
    },
    {
      field: 'descripSmall',
      headerName: 'Desc. Corta',
      minWidth: 100,
      editable: true
    },
    {
      field: 'speciality',
      headerName: 'Especialidad',
      minWidth: 100,
      filter: true,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['CIVIL', 'ELECTRICA', 'MECANICA', 'INSTRUMENTACION', 'PROCESO', 'TUBERIA', 'ESTRUCTURAL', 'OTROS']
      }
    },
    {
      field: 'idProvider',
      headerName: 'Contratista',
      minWidth: 100,
      filter: true,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params) => {
        return {
          values: this.providers
            ? this.providers.map((p) => p.id)
            : [],
        };
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const foundProvider = this.providers?.find((p) => p.id === params.value);
        return foundProvider ? foundProvider.name : params.value;
      },
      valueGetter: (params) => {
        if (!params.data || !params.data.idProvider) return '';
        const provider = this.providers?.find(p => p.id === params.data.idProvider);
        return provider ? provider.name : '';
      },
    },
    {
      field: 'resident',
      headerName: 'Residente',
      minWidth: 100,
      filter: true,
      editable: true
    },
    {
      field: 'supervisor',
      headerName: 'Supervisor',
      minWidth: 100,
      filter: true,
      editable: true
    },
    {
      field: 'dateStar',
      headerName: 'Fecha Inicio',
      minWidth: 100,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data?.dateStar) return null;
        return params.data.dateStar instanceof Date
          ? params.data.dateStar
          : new Date(params.data.dateStar);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.dateStar = null;
          return true;
        }
        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);
        if (isNaN(date.getTime())) {
          return false;
        }
        params.data.dateStar = date.toISOString().split('T')[0];
        if (params.data.dateEnd) {
          params.data.term = this.getTermInDays(params.data.dateStar, params.data.dateEnd);
        }
        return true;
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = params.value instanceof Date ? params.value : new Date(params.value);
        if (isNaN(date.getTime())) return '';
        return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
      }
    },
    {
      field: 'dateEnd',
      headerName: 'Fecha Fin',
      minWidth: 100,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data?.dateEnd) return null;
        return params.data.dateEnd instanceof Date
          ? params.data.dateEnd
          : new Date(params.data.dateEnd);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.dateEnd = null;
          return true;
        }
        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);
        if (isNaN(date.getTime())) {
          return false;
        }
        params.data.dateEnd = date.toISOString().split('T')[0];
        if (params.data.dateStar) {
          params.data.term = this.getTermInDays(params.data.dateStar, params.data.dateEnd);
        }
        return true;
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = params.value instanceof Date ? params.value : new Date(params.value);
        if (isNaN(date.getTime())) return '';
        return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
      }
    },
    {
      field: 'term',
      headerName: 'Plazo (días)',
      minWidth: 100,
      editable: false,
      valueFormatter: (params) => params.value ? `${params.value} días` : ''
    },
    {
      field: 'stateContract',
      headerName: 'Estado',
      minWidth: 100,
      filter: true,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['ACTIVO', 'EN PROCESO', 'FINALIZADO', 'CANCELADO', 'SUSPENDIDO']
      }
    },
    {
      field: 'amountMx',
      headerName: 'Monto MX',
      minWidth: 100,
      filter: true,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        precision: 2,
      },
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value)
    },
    {
      field: 'amountDll',
      headerName: 'Monto USD',
      minWidth: 100,
      filter: true,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        precision: 2,
      },
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value)
    }
  ];

  ngOnInit(): void {
    this.getContracts();
  }

  obtenerBranchs() {
    this.branchsService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching branches:', error)
    );
  }

  getProviders() {
    this.providersService.getProviders(this.idRoot).subscribe({
      next: (resp: any) => {
        this.providers = resp || [];
      },
      error: (error) => {
        console.error('Error fetching providers', error);
        this.providers = [];
      }
    });
  }

  getContracts() {
    this.followprojectsService.getContract(this.idBranch).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
      },
      (error) => {
        this.contract = [];
        console.error('Error fetching contracts', error);
      }
    );
  }

  mapContract(data: any[]): Icontract[] {
    return data.map(w => ({
      id: w.idContrato,
      numberContract: w.numberContract,
      project: w.project,
      description: w.description,
      descripSmall: w.descripSmall,
      amountMx: w.amountMx,
      amountDll: w.amountDll,
      resident: w.resident,
      supervisor: w.supervisor,
      name: w.name,
      speciality: w.speciality,
      idProvider: w.idProvider,
      dateStar: w.dateStar,
      dateEnd: w.dateEnd,
      stateContract: w.stateContract,
      term: w.term,
      idBranch: w.idBranch,
      consecutive: w.consecutive,
      active: w.active
    } as Icontract));
  }

  onSelectionChanged(event: any) {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  autoSizeAllColumns() {
    if (!this.gridApi) return;
    const allColumnIds: string[] = [];
    this.gridApi.getColumns()?.forEach((column: any) => {
      allColumnIds.push(column.getId());
    });
    this.gridApi.autoSizeColumns(allColumnIds, false);
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  statusBar = {
    statusPanels: [
      {
        statusPanel: 'agTotalAndFilteredRowCountComponent',
        align: 'left',
      }
    ]
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true
  };

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const newItem: any = {
      id: tempId,
      idBranch: this.idBranch > 0 ? this.idBranch : null,
      numberContract: '',
      project: '',
      description: '',
      descripSmall: '',
      resident: '',
      supervisor: '',
      amountMx: 0,
      amountDll: 0,
      speciality: 'CIVIL',
      idProvider: null,
      dateStar: today.toISOString().split('T')[0],
      dateEnd: nextMonth.toISOString().split('T')[0],
      stateContract: 'ACTIVO',
      term: 30,
      consecutive: 0,
      active: 1,
      __isNew: true,
    };

    this.contract = [newItem, ...this.contract];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila y abrir en modo edición
    setTimeout(() => {
      const newRowIndex = 0;
      this.gridApi.forEachNode((node: any) => {
        if (node.rowIndex === newRowIndex) {
          node.setSelected(true);
        }
      });
      this.gridApi.ensureIndexVisible(newRowIndex);
      this.gridApi.setFocusedCell(newRowIndex, 'numberContract');
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'numberContract',
      });
    }, 100);
  }

  async saveChanges() {
    const invalidItems = this.contract.filter((item) => {
      return !item.numberContract || 
             !item.description || 
             !item.idBranch;
    });

    if (invalidItems.length > 0) {
      const invalidContract = invalidItems[0];
      let errorMessage = 'Debe llenar los campos obligatorios:\n';
      
      if (!invalidContract.numberContract) errorMessage += '- Número de Contrato\n';
      if (!invalidContract.description) errorMessage += '- Descripción\n';
      if (!invalidContract.idBranch) errorMessage += '- Sucursal\n';
      
      alerts.basicAlert(
        'Validación',
        errorMessage,
        'error'
      );
      return;
    }

    const newRows = this.contract.filter((row) => row.__isNew);
    const modifiedRows = this.contract.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.followprojectsService.addContract(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.followprojectsService.updateContract(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han guardado los contratos correctamente.',
        'success'
      );

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.getContracts();

    } catch (error) {
      console.error('Error guardando contratos:', error);
      
      let errorMessage = 'Ocurrió un error al guardar los contratos.';
      
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.error?.errors) {
        const serverErrors = error.error.errors;
        if (Array.isArray(serverErrors)) {
          errorMessage = 'Errores de validación:\n' + serverErrors.join('\n');
        } else if (typeof serverErrors === 'object') {
          const errorMessages = Object.values(serverErrors).flat();
          errorMessage = 'Errores de validación:\n' + errorMessages.join('\n');
        }
      } else if (error?.status === 400) {
        errorMessage = 'Error de validación: Los datos enviados no son válidos.';
      } else if (error?.status === 500) {
        errorMessage = 'Error del servidor: Contacte al administrador.';
      }
      
      alerts.basicAlert(
        'Error',
        errorMessage,
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.project; // Este campo se calcula en el backend
    
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    // Asegurar que los campos numéricos sean números
    cleanedData.idBranch = Number(cleanedData.idBranch);
    cleanedData.idProvider = Number(cleanedData.idProvider) || null;
    cleanedData.amountMx = Number(cleanedData.amountMx) || 0;
    cleanedData.amountDll = Number(cleanedData.amountDll) || 0;
    cleanedData.term = Number(cleanedData.term) || 0;
    cleanedData.consecutive = Number(cleanedData.consecutive) || 0;
    cleanedData.active = Number(cleanedData.active) || 1;
    
    return cleanedData;
  }

  async deleteContract() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar contrato',
        'Por favor, seleccione un contrato para eliminar.',
        'warning'
      );
      return;
    }

    // Check if the contract has associated projects
    const projectCount = parseInt(this.selectedRowData.project) || 0;
    if (projectCount > 0) {
      alerts.basicAlert(
        'No se puede eliminar',
        `Este contrato tiene ${projectCount} proyecto(s) asociado(s). Debe eliminar primero los proyectos antes de poder eliminar el contrato.`,
        'error'
      );
      return;
    }

    // Confirmar antes de eliminar
    const confirmResult = await alerts.confirmAlert(
      '¿Esta seguro?',
      `¿Desea eliminar el contrato "${this.selectedRowData.numberContract || this.selectedRowData.description || 'seleccionado'}"? Esta accion no se puede deshacer.`,
      'warning',
      'Si, eliminar'
    );

    if (!confirmResult.isConfirmed) {
      return;
    }

    this.followprojectsService.deleteContract(this.selectedRowData.id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar contrato',
          'Error al eliminar el contrato.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert(
        'Eliminar contrato',
        'Contrato eliminado satisfactoriamente.',
        'success'
      );
      this.getContracts();
      this.selectedRowData = null;
    });
  
    this.cdr.detectChanges();}

  getTermInDays(dateStar: string, dateEnd: string): number {
    const start = new Date(dateStar);
    const end = new Date(dateEnd);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  revertChanges() {
    this.getContracts();
    this.selectedRowData = null;
    this.notSavedChanges = false;
    this.newlyAddedRows = [];

    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }

    if (this.showDetailsTab) {
      this.resetGridSize();
    }
  }

}
