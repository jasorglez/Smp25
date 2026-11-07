import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  effect,
} from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { AgGridModule } from 'ag-grid-angular';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { alerts } from 'app/helpers/alerts';
import {
  catchError,
  concat,
  EMPTY,
  lastValueFrom,
  toArray,
  throwError,
  firstValueFrom,
  forkJoin
} from 'rxjs';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { EmployeesService } from 'app/services/employees.service';
import { CommonModule } from '@angular/common';
import { AuthService } from 'app/services/auth.service';
import { AdministrationService } from 'app/services/administration.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { environment } from '@env/environment';
import { BranchsService } from 'app/services/branchs.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { MenuService } from 'app/services/menu.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    AgGridModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    // MultiLineEditorComponent,
  ],
  templateUrl: './menu.component.html',
})
export class menuComponent {
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private administrationService = inject(AdministrationService);
  private employeeService = inject(EmployeesService);
  authService = inject(AuthService);
  private trackingService = inject(TrackingService);
  private branchesService = inject(BranchsService);
  private gridApi: GridApi;
  private hrService = inject(HRService);
  private menuService = inject(MenuService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;


  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  id: string;
  rowData: any;
  hrData: any = {};
  masterMenus: any[] = [];
  idBranch: number;
  gridHeight: string = '75vh';
  idEmpresa: number;
  notSavedChanges: boolean = false;
  loadingMenus = false;
  savingPermissions = false;
  private menuLoadRequest = 0;

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      const companyId = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      if (companyId === this.idEmpresa) return;
      this.idEmpresa = companyId;
      this.loadCompanyMenus(companyId);
    });
  }

  private loadCompanyMenus(companyId: number): void {
    const request = ++this.menuLoadRequest;
    this.masterMenus = [];
    this.loadingMenus = !!companyId;
    if (!companyId) return;

    forkJoin({
      menus: this.menuService.getMasterMenu(),
      permissions: this.menuService.getMenu(companyId)
    }).subscribe({
      next: ({ menus, permissions }) => {
        if (request !== this.menuLoadRequest || companyId !== this.idEmpresa) return;
        const permissionsMap = new Map(permissions.map(permission => [permission.idMenu, permission.active]));
        this.masterMenus = menus.map(menu => ({ ...menu, hasPermission: !!permissionsMap.get(menu.id) }));
        this.loadingMenus = false;
      },
      error: (error) => {
        if (request !== this.menuLoadRequest || companyId !== this.idEmpresa) return;
        this.loadingMenus = false;
        console.error('Error al cargar los menús de la empresa seleccionada:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los menús de la empresa seleccionada en el sidebar.', 'error');
      }
    });
  }

  public gridOptions: any = {
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
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
    getRowStyle: (params) => {
      // Verifica el valor de la columna específica
      if (params.data && params.data.id < 0) {
        return { background: '#ffeeee' }; // Color rojo claro
      }
      return null; // Sin estilo especial para otros valores
    },
  };

  onPermissionChange() {
    if (!this.idEmpresa || this.loadingMenus || this.savingPermissions) return;
    const companyId = this.idEmpresa;
    const request = this.menuLoadRequest;
    const permissionsToUpdate = this.masterMenus.map(menu => ({
      idMenu: menu.id,
      active: menu.hasPermission
    }));
    this.savingPermissions = true;
    this.menuService.updateMenu(companyId, permissionsToUpdate).subscribe({
      next: () => {
        this.savingPermissions = false;
        if (companyId !== this.idEmpresa) return;
        if (request !== this.menuLoadRequest) {
          this.loadCompanyMenus(companyId);
          return;
        }
        alerts.saveAlert();
      },
      error: (error) => {
        this.savingPermissions = false;
        console.error('Error al actualizar permisos:', error);
        if (companyId !== this.idEmpresa) return;
        alerts.basicAlert('Error', 'Ocurrió un error al guardar los permisos.', 'error');
        this.loadCompanyMenus(companyId);
      }
    });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

  }

  
  get colMaster(): ColDef[] {
    return [
      {
        field: 'idEmployee',
        
      },
      
    ];
  }

  onCellValueChanged(event: any) {
    console.log('---- evento de cambio de celda: ', event);
    event.data.__modified = true;
    this.notSavedChanges = true;
    
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    if (data.bonus == 'N/A') {
      return null;
    }
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo menu', 'Sistema', this.trackingService.getEmail());
    const newItem = {
      active: true,
      idBranch: this.idBranch > 0 ? this.idBranch : null,
      idEmployee: '',
      employeeName: '',
      bonus: '',
      quantity: '',
      valid: true,
      vigente: false,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'employeeName'
      });
    }, 0);
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

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    //this.signalsService.setProviderOrCustomer(this.type);
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en menu', 'Sistema', this.trackingService.getEmail());
    this.notSavedChanges = false;
  }

  

  onRowDoubleClicked(event: any) {
    /*this.bonusForm.reset({
      nuevoBonus: '',
      motivo: ''
    });
    this.idEmployee = event.data.id;
    this.nameEmployee = event.data.name;
    this.bonoEmployee = event.data.bono;

    const modal = new bootstrap.Modal(document.getElementById('searchModal')!);
    modal.show();*/
  }



}
