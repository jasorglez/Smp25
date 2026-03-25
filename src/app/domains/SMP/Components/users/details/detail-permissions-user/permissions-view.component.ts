import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService, CrudxDetailedPermission } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin, lastValueFrom, Observable } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { alerts } from 'app/helpers/alerts';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TrackingService } from 'app/services/tracking.service';
import { PermitionsService } from 'app/services/permitions.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
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
  private systemPermissionsService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  private authService = inject(AuthService);

  /** Ids de permisos detallados (misma fuente que Permisos maestros / UserSystemPermissions). */
  private userSystemPermissionIds: number[] = [];
  /** Copia al cargar datos: detectar cambios sin guardar y revertir. */
  private userSystemPermissionIdsBaseline: number[] = [];

  /** Misma respuesta que Permisos maestros: `getMasterPermissions` (acordeón). */
  private masterPermissionsCatalog: any[] = [];

  /** Línea base de switches maestros izquierdos tras cargar/ revertir (evita “sucio” falso). */
  private masterReadBaselineByName = new Map<string, boolean>();

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
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** IDs `detail.id` del catálogo (idénticos a los switches del acordeón Permisos maestros). */
  private getCatalogDetailedIdsForMasterName(masterPermissionName: string): Set<number> {
    const ids = new Set<number>();
    const target = this.normalizar(masterPermissionName || '');
    if (!target || !Array.isArray(this.masterPermissionsCatalog)) {
      return ids;
    }
    let match = this.masterPermissionsCatalog.find(
      (m) => this.normalizar(m?.permissionName ?? '') === target
    );
    if (!match) {
      match = this.masterPermissionsCatalog.find((m) => {
        const n = this.normalizar(m?.permissionName ?? '');
        return n.length >= 3 && target.length >= 3 && (n.includes(target) || target.includes(n));
      });
    }
    if (!match) {
      return ids;
    }
    for (const d of match.detailedPermissions || []) {
      if (d?.id != null && d.id !== '') {
        ids.add(Number(d.id));
      }
    }
    return ids;
  }

  /** Apaga CRUD bajo un módulo (misma lógica que applyMasterOff en la rejilla). */
  private zeroCrudReadsForMaster(master: MasterPermission): void {
    for (const detail of master.details) {
      for (const sd of detail.subdetails) {
        if (sd.principal) {
          sd.principal.canRead = false;
          sd.principal.canCreate = false;
          sd.principal.canUpdate = false;
          sd.principal.canDelete = false;
        }
        for (const child of sd.children) {
          child.canRead = false;
          child.canCreate = false;
          child.canUpdate = false;
          child.canDelete = false;
        }
      }
    }
  }

  /**
   * Switch izquierdo: si hay rejilla, refleja "¿algún submódulo encendido?".
   * Si todos los del lado derecho están apagados → maestro apagado y se limpian ids/CRUD del módulo.
   * Si no hay filas de rejilla, usa el catálogo (acordeón Permisos maestros).
   */
  private syncMasterLeftSwitchesFromUserSys(): void {
    let pruned = false;
    for (const master of this.groupedPermissions) {
      if (master.details?.length) {
        const anyDetailOn = master.details.some((d) => d.detailedRead === true);
        master.masterRead = anyDetailOn;
        if (!anyDetailOn) {
          const beforeLen = this.userSystemPermissionIds.length;
          const toRemove = this.collectDetailedPermissionIdsForMaster(master);
          this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));
          if (this.userSystemPermissionIds.length !== beforeLen) {
            pruned = true;
          }
          this.zeroCrudReadsForMaster(master);
        }
      } else {
        const catIds = this.getCatalogDetailedIdsForMasterName(master.masterPermissionName);
        if (catIds.size > 0) {
          master.masterRead = [...catIds].every((id) => this.userSystemPermissionIds.includes(id));
        }
      }
    }
    if (pruned) {
      this.syncReadFlagsFromUserSystemPermissions();
    }
  }

  private captureMasterReadBaseline(): void {
    this.masterReadBaselineByName = new Map(
      this.groupedPermissions.map((m) => [m.masterPermissionName, m.masterRead])
    );
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
    forkJoin({
      crud: this.permitionsService.getPermitionsSencillo(idCompany, idUser, idBranch, idRole, idPosicion),
      userSys: this.systemPermissionsService.getUserPermissions(idUser),
      catalog: this.systemPermissionsService.getMasterPermissions(idCompany),
    }).subscribe({
      next: ({ crud, userSys, catalog }) => {
        this.rawData = crud;
        console.log('new data', this.rawData);
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.userSystemPermissionIds = (userSys ?? []).map((p: any) => p.permissionId);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.groupedPermissions = this.transformData(this.rawData);
        this.syncReadFlagsFromUserSystemPermissions();
        this.syncMasterLeftSwitchesFromUserSys();
        this.captureMasterReadBaseline();
        this.masterSeleccionado = null;
        this.detailSeleccionado = null;
        this.notSavedChanges = false;
      },
      error: (err) => console.error(err),
    });
  }

  modificar() {
    const idCo = this.idEmpresa ?? this.idCompany;
    forkJoin({
      crud: this.permitionsService.getPermitionsDetail(this.idEmpresa, this.userId, this.branchId, this.idRole, this.idPosicion),
      userSys: this.systemPermissionsService.getUserPermissions(this.userId),
      catalog: this.systemPermissionsService.getMasterPermissions(idCo),
    }).subscribe({
      next: ({ crud, userSys, catalog }) => {
        this.rawData = crud;
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.userSystemPermissionIds = (userSys ?? []).map((p: any) => p.permissionId);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.groupedPermissions = this.transformData(this.rawData);
        this.syncReadFlagsFromUserSystemPermissions();
        this.syncMasterLeftSwitchesFromUserSys();
        this.captureMasterReadBaseline();
        this.notSavedChanges = false;
      },
      error: (err) => console.error(err),
    });
  }

  /**
   * IDs de `UserSystemPermissions` alineados con los switches del panel derecho del modal:
   * uno por fila (`detail`), el mismo que `onDetailedReadChange` / Permisos maestros.
   * No recorre `rawData` ni filas CRUD hijas, para no encender ítems del acordeón que no tienen
   * interruptor en esta rejilla (p. ej. Aportaciones, Transferencias, etc.).
   */
  private collectDetailedPermissionIdsForMaster(master: MasterPermission): Set<number> {
    const ids = new Set<number>();
    for (const detail of master.details) {
      const canonical = this.getDetailedPermissionIdForDetail(detail);
      if (canonical != null) {
        ids.add(canonical);
      }
    }
    return ids;
  }

  /** Al apagar el módulo izquierdo: apagar rejilla, paneles CRUD y quitar ids del usuario (en memoria hasta Guardar). */
  private applyMasterOffCascade(master: MasterPermission): void {
    master.masterRead = false;
    const toRemove = this.collectDetailedPermissionIdsForMaster(master);
    this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));

    for (const detail of master.details) {
      detail.detailedRead = false;
    }
    this.zeroCrudReadsForMaster(master);

    if (this.masterSeleccionado === master) {
      this.detailSeleccionado = null;
      this.subdetailExpandido = null;
    }
  }

  /** Al encender el módulo izquierdo: encender rejilla, CRUD y añadir ids (en memoria hasta Guardar). */
  private applyMasterOnCascade(master: MasterPermission): void {
    master.masterRead = true;
    const toAdd = this.collectDetailedPermissionIdsForMaster(master);
    const next = [...this.userSystemPermissionIds];
    for (const id of toAdd) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    this.userSystemPermissionIds = next;

    for (const detail of master.details) {
      detail.detailedRead = true;
      for (const sd of detail.subdetails) {
        if (sd.principal) {
          sd.principal.canRead = true;
          sd.principal.canCreate = true;
          sd.principal.canUpdate = true;
          sd.principal.canDelete = true;
        }
        for (const child of sd.children) {
          child.canRead = true;
          child.canCreate = true;
          child.canUpdate = true;
          child.canDelete = true;
        }
      }
    }
  }

  /** Id de permiso detallado estable para el submódulo (rejilla derecha). */
  private getDetailedPermissionIdForDetail(detail: DetailedPermission): number | null {
    for (const sd of detail.subdetails) {
      if (sd.principal?.idDetailedPermission != null) {
        return sd.principal.idDetailedPermission;
      }
      for (const c of sd.children) {
        if (c.idDetailedPermission != null) {
          return c.idDetailedPermission;
        }
      }
    }
    return null;
  }

  /** Alinea lectura (rejilla + cada Principal/hijo por su idDetailedPermission) con UserSystemPermissions. */
  private syncReadFlagsFromUserSystemPermissions(): void {
    for (const master of this.groupedPermissions) {
      for (const detail of master.details) {
        const canonical = this.getDetailedPermissionIdForDetail(detail);
        if (canonical != null) {
          detail.detailedRead = this.userSystemPermissionIds.includes(canonical);
        }
        for (const sd of detail.subdetails) {
          if (sd.principal?.idDetailedPermission != null) {
            const pid = sd.principal.idDetailedPermission;
            sd.principal.canRead = this.userSystemPermissionIds.includes(pid);
          }
          for (const child of sd.children) {
            if (child.idDetailedPermission != null) {
              child.canRead = this.userSystemPermissionIds.includes(child.idDetailedPermission);
            }
          }
        }
      }
    }
  }

  /** Actualiza solo en memoria; el PUT va en Guardar. */
  private applyUserSystemPermissionLocal(
    detailPermissionId: number,
    enabled: boolean,
    onAfter?: () => void
  ): void {
    const next = [...this.userSystemPermissionIds];
    if (enabled) {
      if (!next.includes(detailPermissionId)) {
        next.push(detailPermissionId);
      }
    } else {
      const idx = next.indexOf(detailPermissionId);
      if (idx !== -1) {
        next.splice(idx, 1);
      }
    }
    this.userSystemPermissionIds = next;
    this.syncReadFlagsFromUserSystemPermissions();
    onAfter?.();
    this.syncMasterLeftSwitchesFromUserSys();
    this.checkForChanges();
  }

  private areUserSystemPermissionsDirty(): boolean {
    const a = [...this.userSystemPermissionIds].sort((x, y) => x - y);
    const b = [...this.userSystemPermissionIdsBaseline].sort((x, y) => x - y);
    if (a.length !== b.length) {
      return true;
    }
    return a.some((id, i) => id !== b[i]);
  }

  /** Crear/Actualizar/Borrar y master lateral (no los switches de UserSystem). */
  private hasNonUserSysCrudDirty(): boolean {
    for (const master of this.groupedPermissions) {
      if (this.masterReadBaselineByName.has(master.masterPermissionName)) {
        const origMr = this.masterReadBaselineByName.get(master.masterPermissionName)!;
        if (master.masterRead !== origMr) {
          return true;
        }
      }

      for (const detail of master.details) {
        for (const sd of detail.subdetails) {
          const all: CrudPermission[] = [];
          if (sd.principal) {
            all.push(sd.principal);
          }
          all.push(...sd.children);
          for (const p of all) {
            const o = p.__original;
            if (!o) {
              continue;
            }
            if (
              p.canCreate !== !!o.canCreate ||
              p.canUpdate !== !!o.canUpdate ||
              p.canDelete !== !!o.canDelete
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private propagarActivacionCrudTrasLectura(permission: CrudPermission): void {
    if (permission.canRead && this.detailSeleccionado && this.masterSeleccionado) {
      this.detailSeleccionado.detailedRead = true;
      this.masterSeleccionado.masterRead = true;
      permission.canCreate = true;
      permission.canUpdate = true;
      permission.canDelete = true;
    }
    if (!permission.canRead) {
      permission.canCreate = false;
      permission.canUpdate = false;
      permission.canDelete = false;
    }
  }

  /** Switch de lectura en panel CRUD (Principal / hijos): misma API que Permisos maestros. */
  onPermisoReadCrudChange(permission: CrudPermission): void {
    const id = permission.idDetailedPermission;
    if (id != null) {
      this.applyUserSystemPermissionLocal(id, permission.canRead, () =>
        this.propagarActivacionCrudTrasLectura(permission)
      );
      return;
    }
    this.propagarActivacionCrudTrasLectura(permission);
    this.checkForChanges();
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
    this.notSavedChanges =
      this.areUserSystemPermissionsDirty() || this.hasNonUserSysCrudDirty();
  }

  revertChanges() {
    this.groupedPermissions = this.transformData(this.rawData);
    this.userSystemPermissionIds = [...this.userSystemPermissionIdsBaseline];
    this.syncReadFlagsFromUserSystemPermissions();
    this.syncMasterLeftSwitchesFromUserSys();
    this.captureMasterReadBaseline();
    this.notSavedChanges = false;
    this.masterSeleccionado = null;
    this.detailSeleccionado = null;
    this.subdetailExpandido = null;
  }

  onMasterReadChange(master: MasterPermission) {
    if (master.masterRead) {
      this.applyMasterOnCascade(master);
      this.seleccionarMaster(master);
    } else {
      this.applyMasterOffCascade(master);
    }
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    const id = this.getDetailedPermissionIdForDetail(detail);
    if (id == null) {
      if (detail.detailedRead) {
        this.seleccionarDetail(detail);
      }
      this.checkForChanges();
      return;
    }
    this.applyUserSystemPermissionLocal(id, detail.detailedRead, () => {
      if (detail.detailedRead) {
        this.seleccionarDetail(detail);
        detail.subdetails.forEach((sd) => {
          if (sd.principal?.canRead) {
            sd.principal.canCreate = true;
            sd.principal.canUpdate = true;
            sd.principal.canDelete = true;
          }
        });
      }
    });
  }

  onCrudChange(permission: CrudPermission) {
    this.propagarActivacionCrudTrasLectura(permission);
    this.checkForChanges();
  }

  onSwitchChange(permission: CrudPermission) {
    // El switch solo controla canRead, no toca canCreate/canUpdate/canDelete
    this.checkForChanges();
  }

  async saveDetailChanges() {
    const userSysDirty = this.areUserSystemPermissionsDirty();
    const crudDirty = this.hasNonUserSysCrudDirty();

    if (!userSysDirty && !crudDirty) {
      alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    const requests: Observable<any>[] = [];

    if (userSysDirty) {
      requests.push(
        this.systemPermissionsService.updateUserPermissions(this.userId, [...this.userSystemPermissionIds])
      );
    }

    if (crudDirty) {
      const modifiedPermissions = this.untransformData(this.groupedPermissions);
      const changesMap = new Map<string, any>();
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
      for (const payload of changesMap.values()) {
        console.log('Enviando payload único:', payload);
        requests.push(this.permitionsService.addPermitions(payload));
      }
    }

    try {
      alerts.showLoading('Guardando permisos', 'Cargando permisos...');
      await lastValueFrom(forkJoin(requests));
      alerts.closeLoading();

      if (userSysDirty) {
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update UserSystemPermissions (modal usuarios)',
          'Menu Administracion Permisos Maestros',
          this.trackingService.getEmail()
        );
      }

      if (crudDirty) {
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update/Add Registros en Detalle de Roles',
          'Menu Administracion Detalle de Roles',
          this.trackingService.getEmail()
        );
      }

      // Menú lateral: misma sucursal que el modal (guardAdvanced) + tick para refrescar *ngIf
      if (Number(this.userId) === Number(this.signalsService.idUser())) {
        try {
          await lastValueFrom(
            this.authService.reloadCurrentSessionGuard({ idBranchOverride: this.branchId })
          );
        } catch (err) {
          console.error('Error al actualizar permisos del menú lateral tras guardar', err);
        }
      }

      alerts.basicAlert('Datos Guardados', 'Los permisos se han guardado correctamente.', 'success');
      this.notSavedChanges = false;
      if (!crudDirty) {
        this.captureMasterReadBaseline();
      }

      if (crudDirty) {
        this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
      }
    } catch (error) {
      alerts.closeLoading();
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