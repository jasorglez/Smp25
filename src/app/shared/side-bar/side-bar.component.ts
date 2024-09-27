import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TraductorService } from '../../services/traductor.service';
import { TrackingService } from '../../services/tracking.service';
import { Router } from '@angular/router';

import { CompanysService } from '../../services/companys.service';

import { SharedModule } from '../shared.module';
import { alerts } from 'app/helpers/alerts';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { RootService } from 'app/services/root.service';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  selectedCompany: string = '';
  companyData: any;
  branchData: any[] = [];
  projectData: any[] = [];
  centerprocessData: any[] = [];
  platformData: any[] = [];

  selectedProjectId: string = '';
  selectedBranchId: string = '';
  selectedCProcessId: number = 0;
  selectedPlatformId: number = 0;
  usersData: any[];

  constructor(
    public translateService: TraductorService,
    public trackingService: TrackingService,
    public companysService: CompanysService,
    public authService: AuthService,
    public rootService: RootService,
    private router: Router,
    private permissionsService: UsersxpermissionsService
  ) {}

  async ngOnInit() {
    await this.getpermissionxCompanys();
    //this.getPermissionxCprocess();
    //   alert(this.trackingService.getpictureComp())
  }

  ////////////////////////////////////////
  // Este es el cambio que se hizo para obtener todo de SQL
  ////////////////////////////////////////

  //empiezan los procedimientos para las llamadas de los combobox
  //obtener los permisos de la cia
 
  onCompanysSelected(event: Event): void {

    const target = event.target as HTMLSelectElement;

    this.trackingService.setCompany(target.value) ;

    this.selectedCompany = target.value;
   // alert('Picture:'+ this.selectedCompany);

    //this.getpermissionxBranchs();
    this.getpermissionxCompanys();
  }
 
  async getpermissionxCompanys() {
    this.trackingService.getIdUser(localStorage.getItem('mail')!)
      .subscribe((data) => {
        this.usersData = Object.values(data);
        if (this.usersData.length > 0) {
          // Aquí obtengo el idUser para buscarlo en la tabla de userxCompanys
          const idUser = this.usersData[3]?.id;
          // Aquí consulto la tabla donde está el idUser correspondiente a company
          this.permissionsService
            .getDataUsersxPermissions('root')
            .subscribe((data) => {
              const userWithId = Object.values(data).find(
                (item) => item.idUser === idUser
              );
              if (userWithId) {
                this.companyData = userWithId;
                // Ya tengo el id de la compañía root
                this.selectedCompany = this.companyData.idPermission;

                // Ahora consulto la información de root
                this.trackingService.setCompany(this.selectedCompany);
                this.getHeadersCompanys(this.selectedCompany);
                //this.getpermissionxBranchs();
              } else {
                console.log(
                  `No se encontró ningún usuario con idUser ${idUser}`
                );
              }
            });
        }
      });
  }

  getHeadersCompanys(companyId) {
    this.rootService
      .getRootbyId(companyId)
      .subscribe((datacom: any) => {
        // Utilizar los datos obtenidos
        this.trackingService.setnameComp(datacom.name);
        this.authService.setCompanyName(datacom.name); // Envio la signal a auth.service
        this.trackingService.setpictureComp(datacom.picture);
        //this.trackingService.setformatrepint(datacom.formatrep);
        // alert('Format:'+ datacom.formatrep);
      });
  }


  ////////////////////////////////////////
  // Aqui termina el cambio que hizo para obtener todo de SQL
  ////////////////////////////////////////

     
  async onProjectSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedProjectId = target.value;
    this.trackingService.setProject(this.selectedProjectId);
  }
  

  async onCpSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.trackingService.setPlatform(parseInt(target.value));
    this.selectedCProcessId = parseInt(target.value, 10);
    await this.getPermissionxPlataform(this.selectedCProcessId);
  }

  async getPermissionxPlataform(id: number) {
    if (this.trackingService.getaplat() === 'Si') {
      this.companysService.getPermissionsxPlatform(id).subscribe((data) => {
        this.platformData = Object.values(data);
        //console.log("platformData", this.platformData)
        if (this.platformData.length > 0) {
          this.selectedPlatformId = this.platformData[0].id;
          this.trackingService.setPlatform(this.selectedPlatformId);
          this.trackingService.setPlataforma(this.platformData[0].description);
        } else {
          alerts.basicAlert(
            'Error',
            'No existen Plataformas para este usuario.',
            'error'
          );
        }
      });
    }
  }

  async onPlataformSelected(event: Event) {
    const target = event.target as HTMLSelectElement;

    //this.trackingService.setPlatform(parseInt(target.value)) ;
    this.trackingService.setPlataforma(target.value);
    //console.log(target.value)

    this.selectedPlatformId = parseInt(target.value, 10);
    this.trackingService.setPlatform(this.selectedPlatformId);
  }

  // Menus de las llamadas del HTML
  Dashboard() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Dashboard',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/procesdas']);
  }

  Admon() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Admon',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/admon']);
  }

  Bpi() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu BPI',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/bpi']);
  }

  Indicadores() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu indicadopres',
      'Menu Indicadores Bar',
      ''
    );
    this.router.navigate(['/indicgrals']);
  }

  PepOper() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Pep Operaciones',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/allcontract']);
  }

  PepTablero() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Pep Tablero',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/procespep']);
  }

  warehouseproc() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eleccion del menu Almacenes',
      'Menu Side Bar',
      ''
    );
    this.router.navigate(['/proceswar']);
  }

}
