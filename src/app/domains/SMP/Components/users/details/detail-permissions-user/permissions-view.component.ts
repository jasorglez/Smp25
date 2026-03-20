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
import { AuthService } from 'app/services/auth.service';

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
  private authService = inject(AuthService);

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

  obtenerDatos(idCompany: number, idUser: number, idBranch: number, idRole: number, idPosicion: number, preserveSelection = false) {
    const prevMaster = preserveSelection ? this.masterSeleccionado?.masterPermissionName : null;
    const prevDetail = preserveSelection ? this.detailSeleccionado?.detailedPermissionName : null;
    this.permitionsService.getPermitionsSencillo(idCompany, idUser, idBranch, idRole, idPosicion)
      .subscribe((data: any) => {
        this.rawData = data;
        this.groupedPermissions = this.transformData(this.rawData);
        if (prevMaster) {
          this.masterSeleccionado = this.groupedPermissions.find(m => m.masterPermissionName === prevMaster) ?? null;
          if (this.masterSeleccionado && prevDetail) {
            this.detailSeleccionado = this.masterSeleccionado.details.find(d => d.detailedPermissionName === prevDetail) ?? null;
          }
        } else {
          this.masterSeleccionado = null;
          this.detailSeleccionado = null;
        }
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

  /** Clave única por permiso para comparar con rawData */
  private permissionKey(perm: { idDetailedPermission: number; idShowPermition: number }): string {
    return `${perm.idDetailedPermission}-${perm.idShowPermition}`;
  }

  /** Construye un mapa del estado original (rawData) para comparar */
  private buildOriginalStateMap(): Map<string, { masterRead: boolean; detailedRead: boolean; canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; active: boolean }> {
    const map = new Map<string, { masterRead: boolean; detailedRead: boolean; canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; active: boolean }>();
    this.rawData.forEach((item: any) => {
      const key = `${item.idDetailedPermission}-${item.idShowPermition}`;
      map.set(key, {
        masterRead: !!item.masterRead,
        detailedRead: !!item.detailedRead,
        canRead: !!item.canRead,
        canCreate: item.canCreate !== false,
        canUpdate: item.canUpdate !== false,
        canDelete: item.canDelete !== false,
        active: item.active !== false
      });
    });
    return map;
  }

  /** Indica si el estado actual difiere del original (rawData) */
  private hasRealChanges(): boolean {
    const current = this.untransformData(this.groupedPermissions);
    const originalMap = this.buildOriginalStateMap();
    for (const perm of current) {
      const key = this.permissionKey(perm);
      const orig = originalMap.get(key);
      if (!orig) return true; // permiso nuevo
      if (
        orig.masterRead !== !!perm.masterRead ||
        orig.detailedRead !== !!perm.detailedRead ||
        orig.canRead !== !!perm.canRead ||
        orig.canCreate !== (perm.canCreate !== false) ||
        orig.canUpdate !== (perm.canUpdate !== false) ||
        orig.canDelete !== (perm.canDelete !== false) ||
        orig.active !== (perm.active !== false)
      ) return true;
    }
    return current.length !== this.rawData.length;
  }

  checkForChanges() {
    this.notSavedChanges = this.hasRealChanges();
  }

  revertChanges() {
    this.groupedPermissions = this.transformData(this.rawData);
    this.notSavedChanges = false;
    this.masterSeleccionado = null;
    this.detailSeleccionado = null;
    this.subdetailExpandido = null;
  }

  onMasterReadChange(master: MasterPermission) {
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    const parentMaster = this.groupedPermissions.find(m => m.details?.includes(detail));
    if (parentMaster) {
      if (detail.detailedRead) {
        parentMaster.masterRead = true;
      } else {
        parentMaster.masterRead = false;
      }
    }
    this.checkForChanges();
  }

  onCrudChange(permission: CrudPermission) {
    const { detail, master, subdetail } = this.findDetailAndMasterForPermission(permission);
    const isChild = subdetail?.principal !== permission && subdetail?.children?.includes(permission);

    if (permission.canRead) {
      permission.canCreate = true;
      permission.canUpdate = true;
      permission.canDelete = true;
      if (isChild) {
        if (subdetail?.principal) {
          subdetail.principal.canRead = true;
        }
        if (detail) detail.detailedRead = true;
        if (master) master.masterRead = true;
      } else {
        if (subdetail?.principal && subdetail.principal !== permission) {
          subdetail.principal.canRead = true;
          subdetail.principal.canCreate = true;
          subdetail.principal.canUpdate = true;
          subdetail.principal.canDelete = true;
        }
        if (detail) detail.detailedRead = true;
        if (master) master.masterRead = true;
      }
    } else {
      permission.canCreate = false;
      permission.canUpdate = false;
      permission.canDelete = false;
      if (isChild) {
        if (subdetail?.principal) {
          subdetail.principal.canRead = false;
        }
        if (detail) detail.detailedRead = false;
        if (master) master.masterRead = false;
      } else {
        if (subdetail?.principal && subdetail.principal !== permission) {
          subdetail.principal.canRead = false;
          subdetail.principal.canCreate = false;
          subdetail.principal.canUpdate = false;
          subdetail.principal.canDelete = false;
        }
        if (detail) detail.detailedRead = false;
        if (master) master.masterRead = false;
      }
    }
    this.checkForChanges();
  }

  /** Encuentra el detail, master y subdetail que contienen este CrudPermission (principal o child). */
  private findDetailAndMasterForPermission(permission: CrudPermission): {
    detail: DetailedPermission | null;
    master: MasterPermission | null;
    subdetail: SubdetailPermission | null;
  } {
    for (const m of this.groupedPermissions) {
      for (const d of m.details || []) {
        const subdetailPrincipal = d.subdetails?.find(sd => sd.principal === permission);
        const subdetailChild = d.subdetails?.find(sd => sd.children?.includes(permission));
        const subdetail = subdetailPrincipal ?? subdetailChild ?? null;
        if (subdetail) {
          return { detail: d, master: m, subdetail };
        }
      }
    }
    return { detail: null, master: null, subdetail: null };
  }

  onSwitchChange(permission: CrudPermission) {
    // El switch solo controla canRead, no toca canCreate/canUpdate/canDelete
    this.checkForChanges();
  }

  async saveDetailChanges() {
    const currentPermissions = this.untransformData(this.groupedPermissions);
    const originalMap = this.buildOriginalStateMap();
    const changesMap = new Map<string, any>();

    for (const perm of currentPermissions) {
      const uniqueKey = this.permissionKey(perm);
      const orig = originalMap.get(uniqueKey);
      const changed = !orig ||
        orig.masterRead !== !!perm.masterRead ||
        orig.detailedRead !== !!perm.detailedRead ||
        orig.canRead !== !!perm.canRead ||
        orig.canCreate !== (perm.canCreate !== false) ||
        orig.canUpdate !== (perm.canUpdate !== false) ||
        orig.canDelete !== (perm.canDelete !== false) ||
        orig.active !== (perm.active !== false);
      if (changed && !changesMap.has(uniqueKey)) {
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

    if (changesMap.size === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    alerts.showLoading('Guardando...', 'Aplicando cambios de permisos');
    try {
      const saveObservables = Array.from(changesMap.values()).map(payload =>
        this.permitionsService.addPermitions(payload)
      );
      await lastValueFrom(forkJoin(saveObservables));

      alerts.closeLoading();
      alerts.basicAlert('Datos Guardados', 'Los permisos se han guardado correctamente.', 'success');
      this.notSavedChanges = false;
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Update/Add Registros en Detalle de Roles',
        'Menu Administracion Detalle de Roles',
        this.trackingService.getEmail()
      );
      this.signalsService.setRefresSecurity(true);
      this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion, true);
      const loggedUserId = this.trackingService.getId();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (loggedUserId && currentBranch) {
        this.authService.fetchUserPermissionsAdvanced(loggedUserId, currentBranch).subscribe({
          next: (data: any) => this.authService.setUserPermissions(data?.permissions ?? {}, currentBranch)
        });
      }
    } catch (error) {
      alerts.closeLoading();
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