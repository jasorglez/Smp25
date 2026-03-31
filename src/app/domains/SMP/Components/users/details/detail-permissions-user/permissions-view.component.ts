import { Component, effect, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService, CrudxDetailedPermission } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin, lastValueFrom, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
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

type PermissionsScope = 'userSystem' | 'position';

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
  /** 'userSystem' (default): sincroniza con Permisos maestros / UserSystemPermissions. 'position': permisos por posición (opción B). */
  @Input() scopeInput: 'userSystem' | 'position' = 'userSystem';

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

  constructor() {
    effect(() => {
      this.signalsService.guardRefreshTick();
      if (this.scopeInput === 'position') {
        return;
      }
      const uid = this.userId;
      if (uid == null || Number.isNaN(Number(uid)) || Number(uid) <= 0) {
        return;
      }
      this.systemPermissionsService
        .getUserPermissions(Number(uid))
        .pipe(take(1))
        .subscribe({
          next: (userSys: any) => {
            const list = userSys ?? [];
            this.userSystemPermissionIds = list.map((p: any) => p.permissionId);
            this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
            this.syncReadFlagsFromUserSystemPermissions();
            this.syncMasterLeftSwitchesFromUserSys();
            this.notSavedChanges = false;
          },
          error: (err) => console.error('Resync UserSystem (Permisos maestros ↔ modal)', err),
        });
    });
  }

  // Normaliza texto: minúsculas y sin acentos
  private normalizar(texto: string): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Bloque de catálogo para un permiso maestro (misma lista que el acordeón Permisos maestros). */
  private getMasterCatalogEntry(masterPermissionName: string): any | null {
    const target = this.normalizar(masterPermissionName || '');
    if (!target || !Array.isArray(this.masterPermissionsCatalog)) {
      return null;
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
    return match ?? null;
  }

  /** IDs `detail.id` del catálogo (idénticos a los switches del acordeón Permisos maestros). */
  private getCatalogDetailedIdsForMasterName(masterPermissionName: string): Set<number> {
    const ids = new Set<number>();
    const match = this.getMasterCatalogEntry(masterPermissionName);
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

  /**
   * ID de permiso detallado en UserSystemPermissions para una fila del panel derecho,
   * por nombre de maestro + nombre del detalle (misma pareja que `detail.id` en el acordeón).
   */
  private getCatalogDetailedIdForDetailName(
    masterPermissionName: string,
    detailedPermissionName: string
  ): number | null {
    const catalogMaster = this.getMasterCatalogEntry(masterPermissionName);
    if (!catalogMaster) {
      return null;
    }
    const dn = this.normalizar(detailedPermissionName || '');
    if (!dn) {
      return null;
    }
    const list = catalogMaster.detailedPermissions || [];
    let row = list.find((d: any) => this.normalizar(d?.permissionName ?? '') === dn);
    if (!row) {
      row = list.find((d: any) => {
        const n = this.normalizar(d?.permissionName ?? '');
        return n.length >= 3 && dn.length >= 3 && (n.includes(dn) || dn.includes(n));
      });
    }
    if (row?.id == null || row.id === '') {
      return null;
    }
    return Number(row.id);
  }

  /**
   * Si el nombre del detalle en CRUD no alinea con el del catálogo, localiza la fila por palabra clave
   * (sucursal / departamento / usuario) para el mismo id que Permisos maestros / UserSystemPermissions.
   */
  private resolveConfiguracionEdgeCatalogId(master: MasterPermission, detail: DetailedPermission): number | null {
    const catalogMaster = this.getMasterCatalogEntry(master.masterPermissionName);
    if (!catalogMaster) {
      return null;
    }
    const dn = this.normalizar(detail.detailedPermissionName || '');
    const list = catalogMaster.detailedPermissions || [];
    const pickRow = (key: string) =>
      list.find((d: any) => this.normalizar(d?.permissionName ?? '').includes(key));
    if (dn.includes('sucursal')) {
      const row = pickRow('sucursal');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    if (dn.includes('departamento')) {
      const row = pickRow('departamento');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    if (dn.includes('usuario')) {
      const row = pickRow('usuario');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    return null;
  }

  private findMasterContainingDetail(detail: DetailedPermission): MasterPermission | null {
    for (const m of this.groupedPermissions) {
      if (m.details.some((d) => d === detail)) {
        return m;
      }
    }
    return null;
  }

  /**
   * Varios bloques CRUD con fila "Principal" bajo el mismo detalle (p. ej. Usuarios: Security, Departamento, Permisos).
   * En ese caso cada switch debe usar solo su idDetailedPermission, no el id de catálogo del detalle completo.
   */
  private detailHasMultiplePrincipalSections(detail: DetailedPermission): boolean {
    return detail.subdetails.filter((sd) => sd.principal != null).length >= 2;
  }

  private normalizeDetailedId(raw: any): number | null {
    if (raw == null || raw === '') {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Fila CRUD `showColumn` para el switch de sección; el API puede usar otro casing. */
  private isPrincipalShowColumn(showColumn: unknown): boolean {
    return this.normalizar(String(showColumn ?? '')) === 'principal';
  }

  /** En modo por posición: los switches master/detail reflejan el estado de CRUD (canRead). */
  private recomputeReadsFromCrud(): void {
    for (const master of this.groupedPermissions) {
      let anyDetailOn = false;
      for (const detail of master.details) {
        const perms: CrudPermission[] = [];
        for (const sd of detail.subdetails) {
          if (sd.principal) perms.push(sd.principal);
          perms.push(...sd.children);
        }
        const anyOn = perms.some((p) => p.canRead === true);
        detail.detailedRead = anyOn;
        if (anyOn) {
          anyDetailOn = true;
        }
      }
      master.masterRead = anyDetailOn;
    }
  }

  /**
   * Mantiene en UserSystem el id canónico del detalle (tarjeta Usuarios) solo si algún Principal tiene lectura en CRUD.
   */
  private reconcileCanonicalUserSystemForMultiPrincipalDetail(detail: DetailedPermission): void {
    const canonical = this.getDetailedPermissionIdForDetail(detail);
    if (canonical == null) {
      this.syncMasterLeftSwitchesFromUserSys();
      this.checkForChanges();
      return;
    }
    const anyPrincipalRead = detail.subdetails.some((sd) => sd.principal?.canRead === true);
    const next = [...this.userSystemPermissionIds];
    const idx = next.indexOf(canonical);
    if (anyPrincipalRead && idx === -1) {
      next.push(canonical);
    } else if (!anyPrincipalRead && idx !== -1) {
      next.splice(idx, 1);
    }
    this.userSystemPermissionIds = next;
    this.syncReadFlagsFromUserSystemPermissions();
    this.syncMasterLeftSwitchesFromUserSys();
    this.checkForChanges();
  }

  /** Tras sync de lectura: si lectura off → CRUD off; si on → CRUD on (mismo criterio que el cascade previo). */
  private syncPrincipalCrudFromReadForDetail(detail: DetailedPermission): void {
    for (const sd of detail.subdetails) {
      if (sd.principal) {
        if (!sd.principal.canRead) {
          sd.principal.canCreate = false;
          sd.principal.canUpdate = false;
          sd.principal.canDelete = false;
        } else {
          sd.principal.canCreate = true;
          sd.principal.canUpdate = true;
          sd.principal.canDelete = true;
        }
      }
      for (const child of sd.children) {
        if (!child.canRead) {
          child.canCreate = false;
          child.canUpdate = false;
          child.canDelete = false;
        } else {
          child.canCreate = true;
          child.canUpdate = true;
          child.canDelete = true;
        }
      }
    }
  }

  /**
   * ID del permiso detallado "principal" del módulo en UserSystemPermissions.
   * Ejemplo: master "Almacenes" -> detail "Almacenes" (como en Permisos Maestros).
   */
  private getCatalogDetailedIdForMasterToggle(masterPermissionName: string): number | null {
    const target = this.normalizar(masterPermissionName || '');
    const match = this.getMasterCatalogEntry(masterPermissionName);
    if (!match || !target) {
      return null;
    }

    const sameNameDetail = (match.detailedPermissions || []).find((d: any) =>
      this.normalizar(d?.permissionName ?? '') === target
    );

    if (sameNameDetail?.id == null || sameNameDetail.id === '') {
      return null;
    }
    return Number(sameNameDetail.id);
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

  /** Módulo "Configuración" del modal (sidebar izquierdo). */
  private isConfiguracionMaster(master: MasterPermission): boolean {
    return this.normalizar(master.masterPermissionName || '').includes('configurac');
  }

  /**
   * Módulo "Almacenes": en Permisos maestros el primer switch "Almacenes" es el permiso
   * homónimo (un id en UserSystemPermissions), no el agregado de todas las tarjetas.
   */
  private isAlmacenesMaster(master: MasterPermission): boolean {
    return this.normalizar(master.masterPermissionName || '').includes('almacen');
  }

  /** Si el maestro Almacenes tiene permiso homónimo en catálogo, no aplicar poda de todo el módulo en sync. */
  private isAlmacenesHomonymLeftSwitchMode(master: MasterPermission): boolean {
    return (
      this.isAlmacenesMaster(master) &&
      this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName) != null
    );
  }

  /**
   * Tarjetas del panel derecho que deben mantener sincronizado el switch maestro "Configuración":
   * Sucursales, Usuarios, Departamentos (mismos nombres que en Permisos maestros).
   */
  private isConfiguracionEdgeCardDetail(detail: DetailedPermission): boolean {
    const n = this.normalizar(detail.detailedPermissionName || '');
    if (!n) {
      return false;
    }
    return n.includes('sucursal') || n.includes('departamento') || n.includes('usuario');
  }

  /** Tarjeta "Usuarios" dentro de Configuración (no Departamentos ni Sucursales de primer nivel). */
  private isUsuariosConfigDetail(master: MasterPermission, detail: DetailedPermission): boolean {
    if (!this.isConfiguracionMaster(master)) {
      return false;
    }
    const n = this.normalizar(detail.detailedPermissionName || '');
    return n.includes('usuario') && !n.includes('sucursal') && !n.includes('departamento');
  }

  /**
   * Tarjetas bajo Configuración › Usuarios cuyo permiso UserSystem es el del acordeón
   * Permisos maestros › Setup Usuarios (mismo `detail.id` que en el catálogo API).
   */
  private isEmpresasOrSucursalesSetupSubdetail(sd: SubdetailPermission): boolean {
    const sn = this.normalizar(sd.subdetailedPermissionName || '');
    const permisosSinMaestros =
      (sn === 'permisos' || sn === 'permissions') && !sn.includes('maestro');
    return (
      sn === 'empresas' ||
      sn === 'sucursales' ||
      sn === 'empresa' ||
      sn === 'sucursal' ||
      sn === 'almacenes' ||
      sn === 'almacen' ||
      sn === 'warehouses' ||
      sn === 'warehouse' ||
      sn.includes('warehouse') ||
      sn === 'security' ||
      sn.includes('security') ||
      sn.includes('seguridad') ||
      sn === 'departamento' ||
      sn === 'department' ||
      sn.includes('departamento') ||
      sn.includes('department') ||
      permisosSinMaestros
    );
  }

  /** Maestro del catálogo API: Setup Usuarios / `users-setup` (Permisos maestros). */
  private findSetupUsuariosCatalogMaster(): any | null {
    if (!Array.isArray(this.masterPermissionsCatalog)) {
      return null;
    }
    return (
      this.masterPermissionsCatalog.find((m) => {
        const n = this.normalizar(m?.permissionName ?? '');
        const idf = String(m?.identifier ?? m?.Identifier ?? '').toLowerCase();
        return idf === 'users-setup' || (n.includes('setup') && n.includes('usuario'));
      }) ?? null
    );
  }

  /**
   * Id en UserSystemPermissions para un ítem del acordeón Setup Usuarios
   * (mismo `detail.id` que Permisos maestros).
   */
  private getCatalogDetailedIdFromSetupUsuariosPermission(detailedName: string): number | null {
    const master = this.findSetupUsuariosCatalogMaster();
    if (!master) {
      return null;
    }
    const dn = this.normalizar(detailedName || '');
    const list = master.detailedPermissions || [];
    let row = list.find((d: any) => this.normalizar(d?.permissionName ?? '') === dn);
    if (!row) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        return idf !== '' && idf === dn;
      });
    }
    if (!row) {
      row = list.find((d: any) => {
        const n = this.normalizar(d?.permissionName ?? '');
        return n.length >= 3 && dn.length >= 3 && (n.includes(dn) || dn.includes(n));
      });
    }
    // CRUD del modal puede traer "warehouses" / "Warehouse"; en catálogo suele ser "Almacenes" + identifier warehouses
    if (
      !row &&
      (dn === 'warehouses' || dn === 'warehouse' || dn.includes('warehouse'))
    ) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return idf === 'warehouses' || n.includes('almacen');
      });
    }
    if (!row && (dn === 'security' || dn.includes('security') || dn.includes('seguridad'))) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return idf === 'security' || n.includes('security');
      });
    }
    if (
      !row &&
      (dn === 'department' || dn === 'departamento' || dn.includes('departamento'))
    ) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        return idf === 'department' || idf === 'departamento';
      });
    }
    if (!row && (dn === 'permissions' || dn === 'permisos')) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return (
          idf === 'permissions' ||
          (n === 'permisos' && !n.includes('maestro'))
        );
      });
    }
    if (row?.id == null || row.id === '') {
      return null;
    }
    return Number(row.id);
  }

  private collectSetupUsuarioEmpresaSucursalIds(): number[] {
    const out: number[] = [];
    const labels = [
      'Empresas',
      'Sucursales',
      'Almacenes',
      'Security',
      'Departamento',
      'Permisos',
    ] as const;
    for (const label of labels) {
      const id = this.getCatalogDetailedIdFromSetupUsuariosPermission(label);
      if (id != null) {
        out.push(id);
      }
    }
    return out;
  }

  /** ¿Algún detalle pertinente encendido para pintar el switch izquierdo del maestro? */
  private anyDetailReadOnForMasterLeftSwitch(master: MasterPermission): boolean {
    if (!master.details?.length) {
      return false;
    }
    if (this.isConfiguracionMaster(master)) {
      return master.details.some(
        (d) => this.isConfiguracionEdgeCardDetail(d) && d.detailedRead === true
      );
    }
    return master.details.some((d) => d.detailedRead === true);
  }

  /**
   * IDs UserSystem al afectar todo el módulo Configuración.
   * `includeSetupUsuarioSubIds`: al apagar el módulo completo, quitar también Empresas/Sucursales
   * del acordeón Setup Usuarios (mismos que en Permisos maestros).
   */
  private collectConfiguracionEdgeAndHomonymIds(
    master: MasterPermission,
    options?: { includeSetupUsuarioSubIds?: boolean }
  ): Set<number> {
    const ids = new Set<number>();
    for (const detail of master.details) {
      if (this.isConfiguracionEdgeCardDetail(detail)) {
        const id = this.getDetailedPermissionIdForDetail(detail);
        if (id != null) {
          ids.add(id);
        }
      }
    }
    const homonym = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    if (homonym != null) {
      ids.add(homonym);
    }
    if (options?.includeSetupUsuarioSubIds) {
      for (const id of this.collectSetupUsuarioEmpresaSucursalIds()) {
        ids.add(id);
      }
    }
    return ids;
  }

  private zeroCrudReadsForConfiguracionEdges(master: MasterPermission): void {
    for (const detail of master.details) {
      if (!this.isConfiguracionEdgeCardDetail(detail)) {
        continue;
      }
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
   * Almacenes (solo modal, homónimo): si todas las tarjetas derechas están apagadas, apagar el switch izquierdo
   * y quitar el permiso homónimo sin podar el resto del módulo con el branch genérico.
   * Si no hay filas de rejilla, usa el catálogo (acordeón Permisos maestros).
   */
  private syncMasterLeftSwitchesFromUserSys(): void {
    let pruned = false;
    for (const master of this.groupedPermissions) {
      if (master.details?.length) {
        if (this.isAlmacenesHomonymLeftSwitchMode(master)) {
          const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName)!;
          const allRightOff = master.details.every((d) => !d.detailedRead);
          if (allRightOff) {
            master.masterRead = false;
            const beforeLen = this.userSystemPermissionIds.length;
            this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => id !== hid);
            if (this.userSystemPermissionIds.length !== beforeLen) {
              pruned = true;
            }
          } else {
            master.masterRead = this.userSystemPermissionIds.includes(hid);
          }
          continue;
        }

        const anyDetailOn = this.anyDetailReadOnForMasterLeftSwitch(master);
        master.masterRead = anyDetailOn;
        if (!anyDetailOn) {
          const beforeLen = this.userSystemPermissionIds.length;
          const toRemove = this.isConfiguracionMaster(master)
            ? this.collectConfiguracionEdgeAndHomonymIds(master, { includeSetupUsuarioSubIds: true })
            : this.collectDetailedPermissionIdsForMaster(master);
          this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));
          if (this.userSystemPermissionIds.length !== beforeLen) {
            pruned = true;
          }
          if (this.isConfiguracionMaster(master)) {
            for (const detail of master.details) {
              if (this.isConfiguracionEdgeCardDetail(detail)) {
                detail.detailedRead = false;
              }
            }
            this.zeroCrudReadsForConfiguracionEdges(master);
          } else {
            for (const detail of master.details) {
              detail.detailedRead = false;
            }
            this.zeroCrudReadsForMaster(master);
          }
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

  /** Mismo usuario que la sesión (perfil o signal) para refrescar menú / guard sin F5. */
  private isEditingSessionUser(): boolean {
    const rowUser = Number(this.userId);
    if (Number.isNaN(rowUser) || rowUser <= 0) {
      return false;
    }
    const profileId = this.signalsService.profile.idUser();
    const fromProfile =
      profileId != null && profileId !== 0 ? Number(profileId) : Number.NaN;
    const fromSignal = Number(this.signalsService.idUser());
    const sessionId =
      !Number.isNaN(fromProfile) && fromProfile > 0
        ? fromProfile
        : !Number.isNaN(fromSignal) && fromSignal > 0
          ? fromSignal
          : Number.NaN;
    return !Number.isNaN(sessionId) && rowUser === sessionId;
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

  obtenerDatos(
    idCompany: number,
    idUser: number,
    idBranch: number,
    idRole: number,
    idPosicion: number,
    options?: { preserveUiSelection?: boolean; onComplete?: () => void }
  ) {
    const preserve = options?.preserveUiSelection === true;
    const savedMasterName = preserve ? this.masterSeleccionado?.masterPermissionName : undefined;
    const savedDetailName = preserve ? this.detailSeleccionado?.detailedPermissionName : undefined;

    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    forkJoin({
      crud: this.permitionsService.getPermitionsSencillo(idCompany, idUser, idBranch, idRole, idPosicion),
      userSys:
        scope === 'userSystem'
          ? this.systemPermissionsService.getUserPermissions(idUser)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
      catalog:
        scope === 'userSystem'
          ? this.systemPermissionsService.getMasterPermissions(idCompany)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
    }).subscribe({
      next: ({ crud, userSys, catalog }: any) => {
        this.rawData = crud;
        console.log('new data', this.rawData);
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.userSystemPermissionIds = (userSys ?? []).map((p: any) => p.permissionId);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.groupedPermissions = this.transformData(this.rawData);
        if (scope === 'userSystem') {
          this.syncReadFlagsFromUserSystemPermissions();
          this.syncMasterLeftSwitchesFromUserSys();
        } else {
          this.recomputeReadsFromCrud();
        }
        this.captureMasterReadBaseline();

        if (preserve && savedMasterName) {
          const m = this.groupedPermissions.find((x) => x.masterPermissionName === savedMasterName);
          if (m) {
            this.masterSeleccionado = m;
            this.detailSeleccionado =
              savedDetailName != null && savedDetailName !== ''
                ? m.details.find((d) => d.detailedPermissionName === savedDetailName) ?? null
                : null;
          } else {
            this.masterSeleccionado = null;
            this.detailSeleccionado = null;
          }
        } else {
          this.masterSeleccionado = null;
          this.detailSeleccionado = null;
        }

        this.notSavedChanges = false;
        options?.onComplete?.();
      },
      error: (err) => console.error(err),
    });
  }

  modificar() {
    const idCo = this.idEmpresa ?? this.idCompany;
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    forkJoin({
      crud: this.permitionsService.getPermitionsDetail(this.idEmpresa, this.userId, this.branchId, this.idRole, this.idPosicion),
      userSys:
        scope === 'userSystem'
          ? this.systemPermissionsService.getUserPermissions(this.userId)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
      catalog:
        scope === 'userSystem'
          ? this.systemPermissionsService.getMasterPermissions(idCo)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
    }).subscribe({
      next: ({ crud, userSys, catalog }: any) => {
        this.rawData = crud;
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.userSystemPermissionIds = (userSys ?? []).map((p: any) => p.permissionId);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.groupedPermissions = this.transformData(this.rawData);
        if (scope === 'userSystem') {
          this.syncReadFlagsFromUserSystemPermissions();
          this.syncMasterLeftSwitchesFromUserSys();
        } else {
          this.recomputeReadsFromCrud();
        }
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
    const toRemove = this.isConfiguracionMaster(master)
      ? this.collectConfiguracionEdgeAndHomonymIds(master, { includeSetupUsuarioSubIds: true })
      : this.collectDetailedPermissionIdsForMaster(master);
    this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));

    if (this.isConfiguracionMaster(master)) {
      for (const detail of master.details) {
        if (this.isConfiguracionEdgeCardDetail(detail)) {
          detail.detailedRead = false;
        }
      }
      this.zeroCrudReadsForConfiguracionEdges(master);
    } else {
      for (const detail of master.details) {
        detail.detailedRead = false;
      }
      this.zeroCrudReadsForMaster(master);
    }

    if (this.masterSeleccionado === master) {
      this.detailSeleccionado = null;
      this.subdetailExpandido = null;
    }
  }

  /** Al encender el módulo izquierdo: encender rejilla, CRUD y añadir ids (en memoria hasta Guardar). */
  private applyMasterOnCascade(master: MasterPermission): void {
    master.masterRead = true;
    const toAdd = this.isConfiguracionMaster(master)
      ? this.collectConfiguracionEdgeAndHomonymIds(master)
      : this.collectDetailedPermissionIdsForMaster(master);
    const next = [...this.userSystemPermissionIds];
    for (const id of toAdd) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    this.userSystemPermissionIds = next;

    if (this.isConfiguracionMaster(master)) {
      for (const detail of master.details) {
        if (!this.isConfiguracionEdgeCardDetail(detail)) {
          continue;
        }
        detail.detailedRead = true;
        // Usuarios con Security / Departamento / Permisos: no encender todos los switches al subir el maestro;
        // cada uno sigue su id en UserSystemPermissions (sync abajo).
        if (this.detailHasMultiplePrincipalSections(detail)) {
          continue;
        }
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
      for (const detail of master.details) {
        if (!this.isConfiguracionEdgeCardDetail(detail)) {
          continue;
        }
        if (this.detailHasMultiplePrincipalSections(detail)) {
          this.syncReadFlagsForSingleDetail(detail);
          this.syncPrincipalCrudFromReadForDetail(detail);
        }
      }
    } else {
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
  }

  /**
   * Id en UserSystemPermissions para la fila del panel derecho: prioriza el catálogo
   * (mismo `id` que el acordeón Permisos maestros); si no hay match, usa CRUD.
   */
  private getDetailedPermissionIdForDetail(detail: DetailedPermission): number | null {
    const master = this.findMasterContainingDetail(detail);
    if (master) {
      let fromCatalog = this.getCatalogDetailedIdForDetailName(
        master.masterPermissionName,
        detail.detailedPermissionName
      );
      if (fromCatalog == null && this.isConfiguracionMaster(master) && this.isConfiguracionEdgeCardDetail(detail)) {
        fromCatalog = this.resolveConfiguracionEdgeCatalogId(master, detail);
      }
      if (fromCatalog != null) {
        return fromCatalog;
      }
    }
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

  /** Una fila del panel derecho + sus subdetalles CRUD, alineada con UserSystemPermissions. */
  private syncReadFlagsForSingleDetail(detail: DetailedPermission): void {
    const canonical = this.getDetailedPermissionIdForDetail(detail);
    const multiPrincipal = this.detailHasMultiplePrincipalSections(detail);

    if (canonical != null) {
      if (multiPrincipal) {
        // UserSystem solo tiene el permiso detallado padre; cada switch Principal vive en CRUD.
        const anyPrincipalRead = detail.subdetails.some((sd) => sd.principal?.canRead === true);
        detail.detailedRead =
          anyPrincipalRead || this.userSystemPermissionIds.includes(canonical);
      } else {
        detail.detailedRead = this.userSystemPermissionIds.includes(canonical);
      }
    }
    for (const sd of detail.subdetails) {
      if (sd.principal) {
        if (multiPrincipal) {
          // Id en UserSystem: mismo criterio que Permisos maestros › Setup Usuarios para Empresas/Sucursales.
          let pid = this.normalizeDetailedId(sd.principal.idDetailedPermission);
          const m = this.findMasterContainingDetail(detail);
          if (
            m &&
            this.isUsuariosConfigDetail(m, detail) &&
            this.isEmpresasOrSucursalesSetupSubdetail(sd)
          ) {
            const sid = this.getCatalogDetailedIdFromSetupUsuariosPermission(sd.subdetailedPermissionName);
            if (sid != null) {
              pid = sid;
            }
          }
          if (pid != null && pid !== canonical) {
            sd.principal.canRead = this.userSystemPermissionIds.includes(pid);
          }
        } else {
          const pid = this.normalizeDetailedId(sd.principal.idDetailedPermission);
          const pidUse = canonical != null ? canonical : pid;
          if (pidUse != null) {
            sd.principal.canRead = this.userSystemPermissionIds.includes(pidUse);
          }
        }
      }
      // Hijos: normalmente se sincronizan salvo bajo principal en multiPrincipal (antes quedaban solo en CRUD).
      // Configuración › Usuarios › Acciones adicionales: Security / Departamento / Permisos usan los mismos ids
      // que Permisos maestros (Setup Usuarios), y deben reflejar `userSystemPermissionIds`.
      if (!(multiPrincipal && sd.principal != null)) {
        for (const child of sd.children) {
          const cid = this.normalizeDetailedId(child.idDetailedPermission);
          if (cid != null) {
            child.canRead = this.userSystemPermissionIds.includes(cid);
          }
        }
      } else {
        const mKids = this.findMasterContainingDetail(detail);
        if (mKids && this.isUsuariosConfigDetail(mKids, detail)) {
          for (const child of sd.children) {
            const setupId = this.getCatalogDetailedIdFromSetupUsuariosPermission(child.name);
            if (setupId != null) {
              const on = this.userSystemPermissionIds.includes(setupId);
              child.canRead = on;
              if (!on) {
                child.canCreate = false;
                child.canUpdate = false;
                child.canDelete = false;
              } else {
                child.canCreate = true;
                child.canUpdate = true;
                child.canDelete = true;
              }
            }
          }
        }
      }
    }
  }

  /** Alinea lectura (rejilla + cada Principal/hijo por su idDetailedPermission) con UserSystemPermissions. */
  private syncReadFlagsFromUserSystemPermissions(): void {
    for (const master of this.groupedPermissions) {
      for (const detail of master.details) {
        this.syncReadFlagsForSingleDetail(detail);
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
              p.canRead !== !!o.canRead ||
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
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      this.propagarActivacionCrudTrasLectura(permission);
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }
    const master = this.masterSeleccionado;
    const detail = this.detailSeleccionado;
    let id: number | null = this.normalizeDetailedId(permission.idDetailedPermission);
    // Una sola sección Principal: el switch alinea con UserSystem vía id canónico del detalle.
    // Varias (Security / Departamento / Permisos): UserSystem solo tiene el padre; cada switch es solo CRUD + reconcile.
    if (this.isPrincipalShowColumn(permission.name) && master && detail) {
      if (this.detailHasMultiplePrincipalSections(detail)) {
        this.propagarActivacionCrudTrasLectura(permission);
        const canonical = this.getDetailedPermissionIdForDetail(detail);
        const sub = detail.subdetails.find((s) => s.principal === permission) ?? null;
        let userSysId = this.normalizeDetailedId(permission.idDetailedPermission);
        if (
          this.isUsuariosConfigDetail(master, detail) &&
          sub &&
          this.isEmpresasOrSucursalesSetupSubdetail(sub)
        ) {
          const setupId = this.getCatalogDetailedIdFromSetupUsuariosPermission(sub.subdetailedPermissionName);
          if (setupId != null) {
            userSysId = setupId;
          }
        }
        if (userSysId != null && userSysId !== canonical) {
          this.applyUserSystemPermissionLocal(userSysId, permission.canRead, () =>
            this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail)
          );
        } else {
          this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail);
        }
        return;
      }
      const canonical = this.getDetailedPermissionIdForDetail(detail);
      if (canonical != null) {
        id = canonical;
      }
    }
    // Hijos bajo principal en sección multiPrincipal: por defecto solo CRUD local.
    // Excepción Configuración › Usuarios: hijos alineados con Setup Usuarios actualizan `userSystemPermissionIds`
    // en memoria; el PUT y mensaje de guardado ocurren solo al pulsar Guardar.
    const parentSubdetail = detail?.subdetails.find((sd) => sd.children.includes(permission));
    if (detail && this.detailHasMultiplePrincipalSections(detail) && parentSubdetail?.principal != null) {
      const masterCtx = this.masterSeleccionado;
      if (
        masterCtx &&
        this.isUsuariosConfigDetail(masterCtx, detail) &&
        parentSubdetail.children.includes(permission)
      ) {
        const setupUsuariosId = this.getCatalogDetailedIdFromSetupUsuariosPermission(permission.name);
        if (setupUsuariosId != null) {
          this.applyUserSystemPermissionLocal(setupUsuariosId, permission.canRead, () =>
            this.propagarActivacionCrudTrasLectura(permission)
          );
          return;
        }
      }
      this.propagarActivacionCrudTrasLectura(permission);
      this.checkForChanges();
      return;
    }
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

  /**
   * Visibilidad del panel CRUD del detalle seleccionado. Además de `detailedRead`, Almacenes en modo homónimo
   * puede tener el switch maestro y el id en UserSystem activos mientras el detalle aún no marca lectura.
   */
  mostrarPanelCrudParaDetalleSeleccionado(): boolean {
    const detail = this.detailSeleccionado;
    const master = this.masterSeleccionado;
    if (!detail || !master || !master.masterRead) {
      return false;
    }
    if (detail.detailedRead) {
      return true;
    }
    if (!this.isAlmacenesHomonymLeftSwitchMode(master)) {
      return false;
    }
    const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    return hid != null && this.userSystemPermissionIds.includes(hid);
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

      if (this.isPrincipalShowColumn(item.showColumn)) {
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
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    // En modo "position" NO debe tocar permisos maestros (UserSystemPermissions).
    // Solo consideramos cambios de CRUD.
    this.notSavedChanges =
      (scope === 'userSystem' ? this.areUserSystemPermissionsDirty() : false) ||
      this.hasNonUserSysCrudDirty();
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
  }

  onMasterReadChange(master: MasterPermission) {
    // En modo por posición, los switches del sidebar izquierdo NO deben sincronizarse con permisos maestros.
    // Solo afectan el CRUD local.
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      if (master.masterRead) {
        // Encender: activa lectura + CRUD (C/U/D) en todos los permisos del master
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
      } else {
        // Apagar: limpia lectura + CRUD
        for (const detail of master.details) {
          detail.detailedRead = false;
        }
        this.zeroCrudReadsForMaster(master);
      }
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }

    const masterToggleId = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    // Almacenes (homónimo): al encender el maestro izquierdo, encender todas las tarjetas del panel derecho
    // y los ids de usuario; al apagar, solo el homónimo (comportamiento previo).
    if (this.isAlmacenesHomonymLeftSwitchMode(master)) {
      if (master.masterRead) {
        this.applyMasterOnCascade(master);
        if (masterToggleId != null && !this.userSystemPermissionIds.includes(masterToggleId)) {
          this.userSystemPermissionIds = [...this.userSystemPermissionIds, masterToggleId];
        }
        this.syncReadFlagsFromUserSystemPermissions();
        this.syncMasterLeftSwitchesFromUserSys();
        this.seleccionarMaster(master);
      } else {
        this.applyUserSystemPermissionLocal(masterToggleId!, master.masterRead);
      }
      this.checkForChanges();
      return;
    }
    // Configuración se gobierna por las tarjetas Sucursales / Usuarios / Departamentos (no solo el homónimo).
    if (masterToggleId != null && !this.isConfiguracionMaster(master)) {
      this.applyUserSystemPermissionLocal(masterToggleId, master.masterRead, () => {
        if (master.masterRead) {
          this.seleccionarMaster(master);
        }
      });
      return;
    }

    if (master.masterRead) {
      this.applyMasterOnCascade(master);
      this.seleccionarMaster(master);
    } else {
      this.applyMasterOffCascade(master);
    }
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    // En modo por posición, el switch de detalle solo gobierna CRUD (no UserSystem).
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      if (!detail.detailedRead) {
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
      } else {
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
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }

    const master = this.findMasterContainingDetail(detail);
    if (master && this.detailHasMultiplePrincipalSections(detail)) {
      if (detail.detailedRead) {
        const canonical = this.getDetailedPermissionIdForDetail(detail);
        if (canonical != null && !this.userSystemPermissionIds.includes(canonical)) {
          this.userSystemPermissionIds = [...this.userSystemPermissionIds, canonical];
        }
        this.seleccionarDetail(detail);
      } else {
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = false;
            sd.principal.canCreate = false;
            sd.principal.canUpdate = false;
            sd.principal.canDelete = false;
          }
        }
        if (master && this.isUsuariosConfigDetail(master, detail)) {
          for (const sd of detail.subdetails) {
            if (!this.isEmpresasOrSucursalesSetupSubdetail(sd)) {
              continue;
            }
            const sid = this.getCatalogDetailedIdFromSetupUsuariosPermission(sd.subdetailedPermissionName);
            if (sid != null) {
              const idx = this.userSystemPermissionIds.indexOf(sid);
              if (idx !== -1) {
                this.userSystemPermissionIds.splice(idx, 1);
              }
            }
          }
        }
        this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail);
      }
      this.syncReadFlagsFromUserSystemPermissions();
      this.syncMasterLeftSwitchesFromUserSys();
      this.checkForChanges();
      return;
    }

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
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    const userSysDirty = scope === 'userSystem' ? this.areUserSystemPermissionsDirty() : false;
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
        // Solo en modo UserSystem: esto hace que el menú/guards se re-sincronicen.
        this.signalsService.bumpGuardRefreshTick();
      }

      if (crudDirty) {
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update/Add Registros en Detalle de Roles',
          'Menu Administracion Detalle de Roles',
          this.trackingService.getEmail()
        );
      }

      // IMPORTANTE:
      // - En modo "position" este modal NO debe restringir ni refrescar permisos de sesión/menú.
      // - Solo guarda la configuración en BD.
      if (scope === 'userSystem') {
        const sameSessionUser = this.isEditingSessionUser();
        // Menú Setup (pestañas Sucursales, Empresas, etc.): siempre que UserSystem cambió, usar guard/{userId}
        // (guard básico). guardAdvanced lee CrudPermissions y no refleja updateUserPermissions correctamente.
        if (sameSessionUser) {
          try {
            await lastValueFrom(
              this.authService.reloadCurrentSessionGuard({
                idBranchOverride: this.branchId,
                ...(userSysDirty ? { preferUserSystemGuard: true as const } : {}),
              })
            );
          } catch (err) {
            console.error(
              'Error al actualizar permisos del menú lateral tras guardar',
              err
            );
          }
        }
      }

      alerts.basicAlert('Datos Guardados', 'Los permisos se han guardado correctamente.', 'success');
      this.notSavedChanges = false;
      if (!crudDirty) {
        this.captureMasterReadBaseline();
      }

      if (crudDirty || userSysDirty) {
        this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion, {
          preserveUiSelection: true,
        });
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