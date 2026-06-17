import { Component, effect, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService, RolesxDetailedPermission } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin, lastValueFrom } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';

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
  selector: 'app-permissions-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rolespermissions-view.component.html',
  styleUrls: ['./rolespermissions-view.component.scss']
})
export class RolesPermissionsViewComponent implements OnInit {
  private rolesService = inject(RolesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  private authService = inject(AuthService);

  idRole: number;
  idPosicion: number;
  idEmpresa: number;
  rawData: any[] = [];
  notSavedChanges: boolean = false;
  groupedPermissions: MasterPermission[] = [];

  constructor() {
    effect(() => {
      this.idRole = this.signalsService.getIdRole()();
      this.idPosicion = this.signalsService.getIdPosicion()();
      this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos(this.idRole, this.idPosicion);
    });
  }

  ngOnInit(): void {}

  obtenerDatos(idRole: number, idPosicion: number) {
    this.rolesService.getPermissionsByRoles(this.idEmpresa, idRole, idPosicion)
      .subscribe((data: any) => {
        this.rawData = data;
        this.groupedPermissions = this.transformData(this.rawData);
      });
  }

  checkForChanges() {
    const modifiedPermissions = this.untransformData(this.groupedPermissions);
    this.notSavedChanges = modifiedPermissions.length > 0;
  }

  revertChanges() {
    this.groupedPermissions = this.transformData(this.rawData);
    this.notSavedChanges = false;
  }

  onMasterReadChange(master: MasterPermission) {
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    this.checkForChanges();
  }

  onCrudChange(permission: CrudPermission) {
    if (permission.canRead && permission.name === 'Principal') {
      permission.canCreate = true;
      permission.canUpdate = true;
      permission.canDelete = true;
    }

    if (!permission.canRead) {
      permission.canCreate = false;
      permission.canUpdate = false;
      permission.canDelete = false;
    }

    this.checkForChanges();
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
        canCreate: item.canCreate,
        canUpdate: item.canUpdate,
        canDelete: item.canDelete,
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

    return Array.from(masterMap.values());
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
          const payload: RolesxDetailedPermission = {
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
        return this.rolesService.addDetailedPermissionsxRoles(payload);
      });

      await lastValueFrom(forkJoin(saveObservables));

      alerts.basicAlert(
        'Datos Guardados',
        'Los permisos se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Update/Add Registros en Detalle de Roles', 'Menu Administracion Detalle de Roles', this.trackingService.getEmail());
      this.obtenerDatos(this.idRole, this.idPosicion);
      this.signalsService.setRefresSecurity(true);
      this.signalsService.setRefresCantidadPermisos(true);
      this.authService.reloadCurrentSessionGuard().subscribe();
    } catch (error) {
      console.error('Error al guardar los permisos:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  
    this.cdr.detectChanges();}

  private untransformData(data: MasterPermission[]): any[] {
    const modifiedList = [];

    data.forEach(master => {
      master.details.forEach(detail => {
        detail.subdetails.forEach(subdetail => {
          const allPermissions = [];

          if (subdetail.principal) {
            allPermissions.push(subdetail.principal);
          }

          allPermissions.push(...subdetail.children);

          allPermissions.forEach(permission => {
            const original = permission.__original;
            const isModified =
              original.masterRead !== master.masterRead ||
              original.detailedRead !== detail.detailedRead ||
              original.canRead !== permission.canRead ||
              original.canCreate !== permission.canCreate ||
              original.canUpdate !== permission.canUpdate ||
              original.canDelete !== permission.canDelete ||
              original.active !== permission.active;

            const hasAnyPermission = master.masterRead || detail.detailedRead || permission.canRead || permission.canCreate || permission.canUpdate || permission.canDelete;
            const isNewAndHasPermissions = !original.id && hasAnyPermission;

            if (isModified || isNewAndHasPermissions) {
              modifiedList.push({ ...permission, masterRead: master.masterRead, detailedRead: detail.detailedRead });
            }
          });
        });
      });
    });

    return modifiedList;
  }
}
