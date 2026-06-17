import { AfterViewInit, Component, ElementRef, inject, ViewChild, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RolesService } from 'app/services/roles.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { alerts } from 'app/helpers/alerts';
import { forkJoin, lastValueFrom } from 'rxjs';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { RolesDetailedDelisonComponent } from '../rolesDelison-detailed/rolesDelison-detailed.component';
import { PermissionsViewByUserComponent } from '../../users/details/detail-permissions-user/permissions-view.component';
import { ModalService } from 'app/services/permissions-modal.service';

@Component({
  selector: 'app-posicion-delison',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule, RolesDetailedDelisonComponent, PermissionsViewByUserComponent],
  styles: [`
    ::ng-deep .ag-cell-inline-editing {
      background-color: #fff3cd !important;
      border: 2px solid #ffc107 !important;
      box-shadow: 0 0 5px rgba(255, 193, 7, 0.5) !important;
    }
    ::ng-deep .ag-cell-inline-editing input,
    ::ng-deep .ag-cell-inline-editing select,
    ::ng-deep .ag-cell-inline-editing .ag-input-field-input,
    ::ng-deep .ag-cell-inline-editing .ag-text-field-input,
    ::ng-deep .ag-cell-inline-editing .ag-picker-field-wrapper {
      background-color: #fff3cd !important;
    }
    ::ng-deep .ag-cell-edit-wrapper {
      background-color: #fff3cd !important;
    }
    ::ng-deep .ag-popup-editor {
      background-color: #fff3cd !important;
      border: 2px solid #ffc107 !important;
      box-shadow: 0 0 5px rgba(255, 193, 7, 0.5) !important;
    }
    ::ng-deep .ag-popup-editor input,
    ::ng-deep .ag-popup-editor .ag-input-field-input,
    ::ng-deep .ag-popup-editor .ag-text-field-input {
      background-color: #fff3cd !important;
    }
    ::ng-deep .ag-select-list {
      background-color: #fff !important;
    }

    /* Modal (reusa look del modal de Users) */
    .permissions-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
    }

    .permissions-modal {
      background: #fff;
      border-radius: 12px;
      width: 96vw;
      max-width: 1600px;
      height: 96vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .permissions-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
      border-radius: 12px 12px 0 0;
      flex-shrink: 0;
    }

    .modal-title-text {
      font-size: 0.92rem;
      font-weight: 600;
      color: #1e3a5f;
    }

    .modal-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .action-btn-sm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 7px;
      font-size: 13px;
      cursor: pointer;
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .permissions-modal-body {
      overflow-y: auto;
      padding: 16px;
      flex: 1;
      min-height: 0;
    }
  `],
  template: `
    <!-- Contenedor principal con Flexbox -->
    <div #container tabindex="-1" style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column; outline: none;">
      <!-- Contenedor del Grid de Posiciones -->
      <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;" *ngIf="roleId">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Posiciones para el Rol: {{ roleName }}</strong>
          <div>
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addPosicion()"
              [disabled]="!posicionGridApi"
              >
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2"
              (click)="savePosiciones()"
              [disabled]="!hasPosicionChanges"
             >
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="revertNewPosiciones()"
              [disabled]="!hasNewRows"
              >
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedPosicion()"
              [disabled]="!selectedPosicion"
              >
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <!-- El grid ahora ocupa todo el espacio de su contenedor padre -->
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%;"
          [columnDefs]="posicionColumnDefs"
          [rowData]="posicionRowData"
          [gridOptions]="posicionGridOptions"
          [defaultColDef]="posicionDefaultColDef"
          (gridReady)="onPosicionGridReady($event)"
          (selectionChanged)="onPosicionSelectionChanged($event)"
          (cellValueChanged)="onPosicionCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)"
          (cellEditingStopped)="onCellEditingStopped($event)">
        </ag-grid-angular>
      </div>
    </div>

  `
})
export class PosicionDelisonComponent implements ICellRendererAngularComp, AfterViewInit {

  @ViewChild('container') container: ElementRef;
  
  params: any;
  roleId: number;
  idRoot: number;
  roleName: string;
  posicionRowData: any[] = [];
  hasPosicionChanges: boolean = false;
  hasNewRows: boolean = false;
  posicionGridApi: any;
  selectedPosicion: any = null;
  idUser: number = null;
  isAdvanced: boolean = false;

  private modalService = inject(ModalService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  private editableColumnOrder = ['description'];
  private enterPressed = false;

  posicionDefaultColDef: any = {
    sortable: true,
    resizable: true,
    suppressKeyboardEvent: (params: any) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.posicionGridApi) this.posicionGridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
  };

  posicionGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
  };

  private rolesService = inject(RolesService);
  private posicionesService = inject(PosicionesService);
  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  constructor(private currencyPipe: CurrencyPipe) {}

  posicionColumnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      filter: 'agNumberColumnFilter',
      hide: true,
    },
    {
      field: 'description',
      headerName: 'Descripción',
      editable: () => true,
      flex: 1,
      valueSetter: (params) => {
        params.data.description = (params.newValue || '').toUpperCase().trim();
        return true;
      },
      valueGetter: (params) => params.data?.description ?? ''
    },
    { 
      field: 'permisos', 
      headerName: 'Permisos',
      cellStyle: { backgroundColor: '#d4edda' }, 
      flex: 1,
      cellRenderer: (params) => {
        // Hacemos que el texto parezca un enlace para indicar que es clickeable.
        return `<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver Permisos</span>`;
      }
    },
  ];
  onCellClicked(event: any): void {
    const colId = event.column.getColId();
    // Reaccionar al clic en la columna 'permisos'
    if (colId === 'permisos') {
      const selectedData = event.data;
      const idBranch = Number(this.signalsService.getBranchSelectedBySidebar()());
      const idRole = Number(selectedData?.idRoles);
      const idPosicion = Number(selectedData?.id);
      const idUser = Number(this.idUser);

      if (!idUser || !idBranch || !idRole || !idPosicion) {
        alerts.basicAlert('Permisos', 'Faltan datos para abrir permisos (usuario/sucursal/rol/posición).', 'warning');
        return;
      }

      this.signalsService.setIdRole(idRole);
      this.signalsService.setIdPosicion(idPosicion);
      this.modalService.openPermissions({
        idUser,
        idBranch,
        idRole,
        idPosicion,
        userName: `${this.roleName} — ${selectedData?.description ?? 'Posición'}`,
        scope: 'position',
        roleTemplateOnly: true,
      });
    }
  }
  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.roleId = params.data.id;
    this.roleName = params.data.description;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.idUser = this.signalsService.getIdUSer()();
    this.isAdvanced = this.signalsService.getIsAdvanced();
    this.loadPosicionData();
  
    this.cdr.detectChanges();}

  ngAfterViewInit(): void {
    // Se elimina la llamada a focus() para evitar el parpadeo/redimensionamiento del grid al abrir el detalle.
  }
  refresh(): boolean {
    return false;
  }

  // Cuando el componente se destruye (al cerrar el detalle), limpiamos el filtro.
  ngOnDestroy() {
    // La limpieza del filtro ahora se maneja en onCellClicked del componente padre.
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;

    // Validar campo requerido: description
    if (event.column.getColId() === 'description' && !event.data.description?.trim()) {
      alerts.basicAlert('Campo requerido', 'La descripción es obligatoria', 'warning');
      setTimeout(() => {
        this.posicionGridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: 'description' });
      }, 100);
      return;
    }

    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.posicionGridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
  }

  onPosicionGridReady(params: any) {
    this.posicionGridApi = params.api;
    this.posicionGridApi.sizeColumnsToFit();
  }

  onPosicionSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.selectedPosicion = selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  onPosicionCellValueChanged(event: any) {
    if (event.colDef.field === 'description') {
      const upper = (event.data.description || '').toUpperCase().trim();
      event.data.description = upper;
      event.api.refreshCells({ rowNodes: [event.node], columns: ['description'], force: true });
    }
    if (event.newValue !== event.oldValue) {
      event.data.__modified = true;
      this.hasPosicionChanges = true;
    }
  }

  loadPosicionData() {
    this.posicionesService.getPositionsByRole(this.idRoot, this.roleId).subscribe({
      next: (data: any) => {
        this.posicionRowData = Array.isArray(data) ? data : (data ? [data] : []);
      },
      error: (error) => {
        console.error('ERROR', error);
        this.posicionRowData = [];
      }
    });
  }

  addPosicion() {
    const newPosicion = {
      idCompany: this.idRoot,
      idRoles: this.roleId,
      description: '',
      active: true,
      __isNew: true
    };
    this.posicionRowData = [newPosicion, ...this.posicionRowData];
    this.hasPosicionChanges = true;
    this.hasNewRows = true;
    setTimeout(() => {
      this.posicionGridApi.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 150);
  }

  revertNewPosiciones() {
    this.posicionGridApi.stopEditing(true);
    this.posicionRowData = this.posicionRowData.filter(row => !row.__isNew);
    this.hasNewRows = false;
    this.hasPosicionChanges = this.posicionRowData.some(row => row.__modified);
  }

  async savePosiciones() {
    const invalid = this.posicionRowData.find(row => (row.__isNew || row.__modified) && !row.description?.trim());
    if (invalid) {
      alerts.basicAlert('Campo requerido', 'La descripción es obligatoria en todos los registros', 'warning');
      return;
    }

    const newRows = this.posicionRowData.filter(row => row.__isNew);
    const modifiedRows = this.posicionRowData.filter(row => row.__modified && !row.__isNew);

    const addObservables = newRows.map(row => this.posicionesService.addPosition(this.cleanData(row)));
    const updateObservables = modifiedRows.map(row => this.posicionesService.updatePosition(row.id, this.cleanData(row)));

    try {
      await lastValueFrom(forkJoin([...addObservables, ...updateObservables]));
      alerts.basicAlert('Éxito', 'Posiciones guardadas correctamente', 'success');
      this.hasPosicionChanges = false;
      this.hasNewRows = false;
      this.loadPosicionData();
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudieron guardar las posiciones', 'error');
      console.error(error);
    }
  
    this.cdr.detectChanges();}

  async deleteSelectedPosicion() {
    if (!this.selectedPosicion) return;

    const confirmed = await alerts.confirmAlert(
      'Confirmar borrado',
      `¿Está seguro de que desea eliminar la posición "${this.selectedPosicion.description}"?`,
      'warning',
      'Sí, borrar'
    );

    if (!confirmed.isConfirmed) return;

    // Si es una fila nueva que aún no está en la BD, solo la quitamos del grid.
    if (this.selectedPosicion.__isNew) {
      this.posicionRowData = this.posicionRowData.filter(row => row.id !== this.selectedPosicion.id);
      this.selectedPosicion = null;
      return;
    }

    try {
      await lastValueFrom(this.posicionesService.deletePosition(this.selectedPosicion.id));
      alerts.basicAlert('Éxito', 'Posición eliminada correctamente', 'success');
      this.loadPosicionData();
      this.selectedPosicion = null;
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudo eliminar la posición', 'error');
      console.error(error);
    }
  
    this.cdr.detectChanges();}

  private cleanData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    return cleanedData;
  }

}
