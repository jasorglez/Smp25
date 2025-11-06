import { Component, effect, inject, OnInit } from '@angular/core';
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

// --- Interfaces para una mejor definición de tipos ---
interface CrudPermission {
  name: string; // Corresponderá a showColumn
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  // --- Propiedades añadidas para mantener la referencia a los datos originales ---
  idMasterPermission: number;
  idDetailedPermission: number;
  idShowPermition: number;
  active?: boolean;
  __original: any; // Guardamos una copia del objeto original para comparar cambios
}

interface SubdetailPermission {
  subdetailedPermissionName: string;
  principal: CrudPermission | null; // El item 'Principal' que controla la visibilidad
  children: CrudPermission[]; // Los otros items (Ahorros, Prestamos, etc.)
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
  imports: [CommonModule, FormsModule], // Importamos FormsModule para usar ngModel en los checkboxes
  templateUrl: './permissions-view.component.html',
  styleUrls: ['./permissions-view.component.scss']
})
export class PermissionsViewByUserComponent implements OnInit {
  private rolesService = inject(RolesService);
  private permitionsService = inject(PermitionsService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);

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


  // Datos planos originales como los recibes de la API
  /*rawData = [
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Empleados",  showColumn: 'Principal',canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Empleados",  showColumn: 'Ahorros', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Empleados",  showColumn: 'Prestamos', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Horarios",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Historico Préstamos",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: false, subdetailedPermissionName:  "Historico Ahorros",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Nómina", detailedRead: false, subdetailedPermissionName:  "Nómina",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Nómina", detailedRead: false, subdetailedPermissionName:  "Nómina", showColumn: 'Horas Extras', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Nómina", detailedRead: false, subdetailedPermissionName:  "Bonos Historicos",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Nómina", detailedRead: false, subdetailedPermissionName:  "Histórico de Nominas Digitales",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Compras delison", masterRead: false, detailedPermissionName: "Proveedores", detailedRead: false, subdetailedPermissionName:  "Proveedores",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
    {masterPermissionName: "Compras delison", masterRead: false, detailedPermissionName: "Requisiciones", detailedRead: false, subdetailedPermissionName:  "Requisiciones",  showColumn: 'Principal', canRead: false, canCreate: false, canUpdate: false, canDelete: false},
  ];*/

  // Aquí almacenaremos los datos transformados en una estructura jerárquica
  groupedPermissions: MasterPermission[] = [];

  constructor() {
    // Remove effect as idRole and idPosicion should come from agInit params
  }

  ngOnInit(): void {
    // ngOnInit is called before agInit, so idRole and idPosicion won't be set yet.
    // Data fetching should happen in agInit for cell renderers.
    this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
  }
  agInit(params: ICellRendererParams & { idUser: number, idBranch: number, idRole: number, idPosicion: number }): void {
      this.params = params;
      this.userId = params.idUser; // Corrected access
      this.branchId = params.idBranch; // Corrected access (assuming idBranch is passed as idBranch)
      this.idRole = params.idRole; // Corrected access
      this.idPosicion = params.idPosicion; // Corrected access
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      // Fetch data once all necessary parameters are available
      this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
    }

  obtenerDatos(idCompany: number, idUser: number, idBranch: number, idRole: number, idPosicion: number) {
     this.permitionsService.getPermitionsSencillo(idCompany, idUser, idBranch, idRole, idPosicion)
       .subscribe((data: any) => {
         this.rawData = data;
         console.log("new data", this.rawData);
         this.groupedPermissions = this.transformData(this.rawData);
       });
    this.groupedPermissions = this.transformData(this.rawData);
  }
   modificar(){
    //if(this.authService.getCrudPermission('setup', 'users', 'create')){
       this.permitionsService.getPermitionsDetail(this.idEmpresa, this.userId, this.branchId, this.idRole, this.idPosicion)
      .subscribe((data: any) => {
        //this.editable = true
        this.rawData = data;
        this.groupedPermissions = this.transformData(this.rawData);
      });
    //}else if(this.authService.getCrudPermission('setup', 'users', 'update')){
       //this.editable = true
    //}/
       
  }


  /**
   * Transforma una lista plana de permisos en una estructura jerárquica.
   * @param data La lista plana de permisos.
   * @returns Un array de MasterPermission con datos anidados.
   */
  private transformData(data: any[]): MasterPermission[] {
    const masterMap = new Map<string, MasterPermission>();
    const detailMap = new Map<string, DetailedPermission>();

    data.forEach(item => {
      // Nivel Maestro
      if (!masterMap.has(item.masterPermissionName)) {
        masterMap.set(item.masterPermissionName, {
          masterPermissionName: item.masterPermissionName,
          masterRead: item.masterRead,
          details: []
        });
      }

      const masterGroup = masterMap.get(item.masterPermissionName)!;

      // Nivel Detallado (usando un mapa para eficiencia)
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

      // Nivel Sub-detallado
      let subdetailGroup = detailGroup.subdetails.find(sd => sd.subdetailedPermissionName === item.subdetailedPermissionName);
      if (!subdetailGroup) {
        subdetailGroup = {
          subdetailedPermissionName: item.subdetailedPermissionName,
          principal: null,
          children: []
        };
        detailGroup.subdetails.push(subdetailGroup);
      }

      // Crear el objeto de permiso
      const crudItem: CrudPermission = {
        name: item.showColumn,
        canRead: item.canRead,
        canCreate: item.canCreate,
        canUpdate: item.canUpdate,
        canDelete: item.canDelete,
        // --- Añadimos las propiedades extra que vienen de la API ---
        idMasterPermission: item.idMasterPermission,
        idDetailedPermission: item.idDetailedPermission,
        idShowPermition: item.idShowPermition,
        active: item.active,
        __original: { ...item } // Guardamos una copia del estado original
      };

      // Clasificar como 'principal' o 'child'
      if (item.showColumn === 'Principal') {
        subdetailGroup.principal = crudItem;
      } else {
        subdetailGroup.children.push(crudItem);
      }
    });

    return Array.from(masterMap.values());
  }

  checkForChanges() {
      const modifiedPermissions = this.untransformData(this.groupedPermissions);
      this.notSavedChanges = modifiedPermissions.length > 0;
    }
  
    revertChanges() {
      // Volvemos a transformar los datos originales para descartar cualquier cambio
      this.groupedPermissions = this.transformData(this.rawData);
      // Reseteamos el indicador de cambios
      this.notSavedChanges = false;
      //alerts.basicAlert('Cambios revertidos', 'Se han descartado los cambios no guardados.', 'info');
    }
  
    onMasterReadChange(master: MasterPermission) {
      this.checkForChanges();
    }
  
    onDetailedReadChange(detail: DetailedPermission) {
      this.checkForChanges();
    }
  
    onCrudChange(permission: CrudPermission) {
      this.checkForChanges();
    }
  async saveDetailChanges() {
    const modifiedPermissions = this.untransformData(this.groupedPermissions);

    if (modifiedPermissions.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    // Usaremos un Map para agrupar los cambios por una clave única compuesta 
    // para asegurar que cada sub-permiso se guarde de forma independiente.
    const changesMap = new Map<string, any>();

    try {
      for (const perm of modifiedPermissions) {
        // Creamos una clave única combinando idDetailedPermission y idShowPermition.
        const uniqueKey = `${perm.idDetailedPermission}-${perm.idShowPermition}`;

        // Solo procesamos si no hemos registrado ya un cambio para esta combinación única.
        if (!changesMap.has(uniqueKey)) {
          const payload: CrudxDetailedPermission = {
            idUser: this.userId,
            idBranch: this.branchId,
            idMasterPermission: perm.idMasterPermission,
            masterRead: perm.masterRead,
            idDetailedPermission: perm.idDetailedPermission,
            detailedRead: perm.detailedRead,
            // El subdetailedPermissionName y idShowPermition ya no son relevantes para la actualización
            // porque la BD solo guarda un registro por idDetailedPermission.
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

      // Ahora creamos los observables a partir de los cambios únicos en el mapa
      const saveObservables = Array.from(changesMap.values()).map(payload => {
        console.log("Enviando payload único:", payload);
        // Usamos el endpoint de "add" que internamente crea o actualiza.
        return this.permitionsService.addPermitions(payload);
      });

      // Ejecutamos todas las operaciones de creación y actualización en paralelo
      await lastValueFrom(forkJoin(saveObservables));

      alerts.basicAlert(
        'Datos Guardados',
        'Los permisos se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update/Add Registros en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());

    } catch (error) {
      console.error("Error al guardar los permisos:", error);
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
            const original = permission.__original;
            // Un permiso se considera modificado si sus valores CRUD o los de sus padres (master/detail read) han cambiado.
            const isModified =
              original.masterRead !== master.masterRead ||
              original.detailedRead !== detail.detailedRead ||
              original.canRead !== permission.canRead ||
              original.canCreate !== permission.canCreate ||
              original.canUpdate !== permission.canUpdate ||
              original.canDelete !== permission.canDelete ||
              original.active !== permission.active;

            // También consideramos que se debe guardar si tiene algún permiso activo pero no existe en la BD.
            const hasAnyPermission = master.masterRead || detail.detailedRead || permission.canRead || permission.canCreate || permission.canUpdate || permission.canDelete;
            const isNewAndHasPermissions = !original.id && hasAnyPermission;

            //if (isModified || isNewAndHasPermissions) {
              // Añadimos el permiso modificado junto con los valores de sus padres
              modifiedList.push({ ...permission, masterRead: master.masterRead, detailedRead: detail.detailedRead });
            //}
          });
        });
      });
    });

    return modifiedList;
  }

}
