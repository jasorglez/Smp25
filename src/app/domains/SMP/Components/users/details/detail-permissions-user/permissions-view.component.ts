import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService, CrudxDetailedPermission } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin, lastValueFrom } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { alerts } from 'app/helpers/alerts';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TrackingService } from 'app/services/tracking.service';
import { PermitionsService } from 'app/services/permitions.service';

// --- Interfaces ---
interface CrudPermission {
  name: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  idMasterPermission: number;
  idDetailedPermission: number;
  idShowPermition: number;
  active?: boolean;
  __original: any;
}

interface SubdetailPermission {
  subdetailedPermissionName: string;
  principal: CrudPermission | null;
  children: CrudPermission[];
}

interface DetailedPermission {
  detailedPermissionName: string;
  detailedRead: boolean;
  subdetails: SubdetailPermission[];
}

interface MasterPermission {
  masterPermissionName: string;
  masterRead: boolean;
  details: DetailedPermission[];
}

@Component({
  selector: 'app-permissions-view-by-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions-view.component.html',
  styleUrls: ['./permissions-view.component.scss']
})
export class PermissionsViewByUserComponent implements OnInit, OnChanges {
  private rolesService = inject(RolesService);
  private permitionsService = inject(PermitionsService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);

  @Input() idUserInput: number;
  @Input() idBranchInput: number;
  @Input() idRoleInput: number;
  @Input() idPosicionInput: number;

  idRole: number;
  idPosicion: number;
  idEmpresa: number;
  params: any;
  userId: number;
  userName: string;
  branchId: number;
  branchName: string;
  idCompany: number;
  rawData: any[] = [];
  notSavedChanges: boolean = false;
  groupedPermissions: MasterPermission[] = [];
  masterSeleccionado: MasterPermission | null = null;
  detailSeleccionado: DetailedPermission | null = null;
  subdetailExpandido: SubdetailPermission | null = null;
  pasoActual: number = 1;
  subdetailPaso2: SubdetailPermission | null = null;

  readonly coloresMaster: string[] = [
    '#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42', '#1b4332'
  ];

  // Orden deseado - palabras clave sin acentos para comparación robusta
  readonly ordenMaster: string[] = [
    'administracion',
    'compras',
    'almacenes',
    'recursos',
    'configurac'
  ];

  // Orden de los details según el menú de navegación
  readonly ordenDetails: string[] = [
    'dashboard',
    'configurac',
    'banco',
    'transferenc',
    'ingreso',
    'egreso',
    'cliente',
    'proveedor',
    'factura',
    'cuenta',
    'catalogo'
  ];

  constructor() {}

  // Normaliza texto: minúsculas y sin acentos
  private normalizar(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  ngOnInit(): void {
    this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.idUserInput && this.idRoleInput && this.idPosicionInput) {
      this.userId = this.idUserInput;
      this.branchId = this.idBranchInput;
      this.idRole = this.idRoleInput;
      this.idPosicion = this.idPosicionInput;
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
    }
  }

  agInit(params: ICellRendererParams & { idUser: number, idBranch: number, idRole: number, idPosicion: number }): void {
    this.params = params;
    this.userId = params.idUser;
    this.branchId = params.idBranch;
    this.idRole = params.idRole;
    this.idPosicion = params.idPosicion;
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
  }

  obtenerDatos(idCompany: number, idUser: number, idBranch: number, idRole: number, idPosicion: number) {
    this.permitionsService.getPermitionsSencillo(idCompany, idUser, idBranch, idRole, idPosicion)
      .subscribe((data: any) => {
        this.rawData = data;
        console.log('new data', this.rawData);
        this.groupedPermissions = this.transformData(this.rawData);
        this.masterSeleccionado = null;
        this.detailSeleccionado = null;
      });
  }

  modificar() {
    this.permitionsService.getPermitionsDetail(this.idEmpresa, this.userId, this.branchId, this.idRole, this.idPosicion)
      .subscribe((data: any) => {
        this.rawData = data;
        this.groupedPermissions = this.transformData(this.rawData);
      });
  }

  seleccionarMaster(master: MasterPermission) {
    this.masterSeleccionado = master;
    this.detailSeleccionado = null;
  }

  seleccionarDetail(detail: DetailedPermission) {
    if (this.detailSeleccionado === detail) {
      this.detailSeleccionado = null;
      this.subdetailExpandido = null;
      return;
    }
    this.detailSeleccionado = detail;
    this.subdetailExpandido = null;

    // No forzar valores al seleccionar - respetar los valores existentes

    this.checkForChanges();
  }

  getColorMaster(index: number): string {
    return this.coloresMaster[index % this.coloresMaster.length];
  }

  getIndexMasterSeleccionado(): number {
    return this.groupedPermissions.indexOf(this.masterSeleccionado);
  }

  // Verifica si un detail tiene al menos un subdetail con children
  tieneChildren(detail: DetailedPermission): boolean {
    return detail.subdetails.some(sd => sd.children && sd.children.length > 0);
  }

  // Navega al paso 2 mostrando las acciones adicionales del subdetail
  toggleChildren(subdetail: SubdetailPermission) {
    this.subdetailPaso2 = subdetail;
    this.irPaso(2);
  }

  // Navega entre pasos
  irPaso(paso: number) {
    this.pasoActual = paso;
  }

  private transformData(data: any[]): MasterPermission[] {
    const masterMap = new Map<string, MasterPermission>();
    const detailMap = new Map<string, DetailedPermission>();

    data.forEach(item => {
      if (!masterMap.has(item.masterPermissionName)) {
        masterMap.set(item.masterPermissionName, {
          masterPermissionName: item.masterPermissionName,
          masterRead: item.masterRead,
          details: []
        });
      }

      const masterGroup = masterMap.get(item.masterPermissionName)!;

      const detailKey = `${item.masterPermissionName}|${item.detailedPermissionName}`;
      let detailGroup = detailMap.get(detailKey);
      if (!detailGroup) {
        detailGroup = {
          detailedPermissionName: item.detailedPermissionName,
          detailedRead: item.detailedRead,
          subdetails: []
        };
        detailMap.set(detailKey, detailGroup);
        masterGroup.details.push(detailGroup);
      }

      let subdetailGroup = detailGroup.subdetails.find(sd => sd.subdetailedPermissionName === item.subdetailedPermissionName);
      if (!subdetailGroup) {
        subdetailGroup = {
          subdetailedPermissionName: item.subdetailedPermissionName,
          principal: null,
          children: []
        };
        detailGroup.subdetails.push(subdetailGroup);
      }

      const crudItem: CrudPermission = {
        name: item.showColumn,
        canRead: item.canRead,
        canCreate: item.canCreate === false ? false : true,
        canUpdate: item.canUpdate === false ? false : true,
        canDelete: item.canDelete === false ? false : true,
        idMasterPermission: item.idMasterPermission,
        idDetailedPermission: item.idDetailedPermission,
        idShowPermition: item.idShowPermition,
        active: item.active,
        __original: { ...item }
      };

      if (item.showColumn === 'Principal') {
        subdetailGroup.principal = crudItem;
      } else {
        subdetailGroup.children.push(crudItem);
      }
    });

    // Ordenar según ordenMaster con normalización de acentos
    const result = Array.from(masterMap.values());
    result.sort((a, b) => {
      const nameA = this.normalizar(a.masterPermissionName);
      const nameB = this.normalizar(b.masterPermissionName);

      const indexA = this.ordenMaster.findIndex(o => nameA.includes(o));
      const indexB = this.ordenMaster.findIndex(o => nameB.includes(o));

      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });

    // Ordenar details dentro de cada master según ordenDetails
    result.forEach(master => {
      master.details.sort((a, b) => {
        const nameA = this.normalizar(a.detailedPermissionName);
        const nameB = this.normalizar(b.detailedPermissionName);
        const indexA = this.ordenDetails.findIndex(o => nameA.includes(o));
        const indexB = this.ordenDetails.findIndex(o => nameB.includes(o));
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });
    });

    return result;
  }

  checkForChanges() {
    const modifiedPermissions = this.untransformData(this.groupedPermissions);
    this.notSavedChanges = modifiedPermissions.length > 0;
  }

  revertChanges() {
    this.groupedPermissions = this.transformData(this.rawData);
    this.notSavedChanges = false;
    this.masterSeleccionado = null;
    this.detailSeleccionado = null;
    this.subdetailExpandido = null;
  }

  onMasterReadChange(master: MasterPermission) {
    if (master.masterRead) {
      this.seleccionarMaster(master);
    }
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    if (detail.detailedRead) {
      this.seleccionarDetail(detail);
    }
    this.checkForChanges();
  }

  onCrudChange(permission: CrudPermission) {
    // Al activar el switch de una tarjeta gris (submenú): activar tarjeta de arriba + master y marcar Crear/Actualizar/Borrar por defecto
    if (permission.canRead && this.detailSeleccionado && this.masterSeleccionado) {
      this.detailSeleccionado.detailedRead = true;
      this.masterSeleccionado.masterRead = true;
      permission.canCreate = true;
      permission.canUpdate = true;
      permission.canDelete = true;
    }
    this.checkForChanges();
  }

  onSwitchChange(permission: CrudPermission) {
    // El switch solo controla canRead, no toca canCreate/canUpdate/canDelete
    this.checkForChanges();
  }

  async saveDetailChanges() {
    const modifiedPermissions = this.untransformData(this.groupedPermissions);

    if (modifiedPermissions.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    const changesMap = new Map<string, any>();

    try {
      for (const perm of modifiedPermissions) {
        const uniqueKey = `${perm.idDetailedPermission}-${perm.idShowPermition}`;
        if (!changesMap.has(uniqueKey)) {
          const payload: CrudxDetailedPermission = {
            idUser: this.userId,
            idBranch: this.branchId,
            idMasterPermission: perm.idMasterPermission,
            masterRead: perm.masterRead,
            idDetailedPermission: perm.idDetailedPermission,
            detailedRead: perm.detailedRead,
            subdetailedPermissionName: perm.name,
            idShowPermition: perm.idShowPermition,
            idRole: this.idRole,
            idPosicion: this.idPosicion,
            canCreate: perm.canCreate,
            canRead: perm.canRead,
            canUpdate: perm.canUpdate,
            canDelete: perm.canDelete,
            active: perm.active ?? true,
          };
          changesMap.set(uniqueKey, payload);
        }
      }

      const saveObservables = Array.from(changesMap.values()).map(payload => {
        console.log('Enviando payload único:', payload);
        return this.permitionsService.addPermitions(payload);
      });

      await lastValueFrom(forkJoin(saveObservables));

      alerts.basicAlert('Datos Guardados', 'Los permisos se han guardado correctamente.', 'success');
      this.notSavedChanges = false;
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update/Add Registros en Detalle de Roles',
        'Menu Administracion Detalle de Roles',
        this.trackingService.getEmail()
      );

    } catch (error) {
      console.error('Error al guardar los permisos:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  }

  private untransformData(data: MasterPermission[]): any[] {
    const modifiedList = [];

    data.forEach(master => {
      master.details.forEach(detail => {
        detail.subdetails.forEach(subdetail => {
          const allPermissions = [];
          if (subdetail.principal) allPermissions.push(subdetail.principal);
          allPermissions.push(...subdetail.children);
          allPermissions.forEach(permission => {
            modifiedList.push({
              ...permission,
              masterRead: master.masterRead,
              detailedRead: detail.detailedRead
            });
          });
        });
      });
    });

    return modifiedList;
  }
}