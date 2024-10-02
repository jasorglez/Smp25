import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TraductorService } from '../../services/traductor.service';
import { TrackingService } from '../../services/tracking.service';
import { CompanysService } from '../../services/companys.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { ContractsService } from 'app/services/contracts.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';

import { SharedModule } from '../shared.module';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
})
export class SideBarComponent {
  selectedCompany   : string = '';
  companyData       : any;
  contractData      : any ;
  branchData        : any[] = [];
  projectData       : any[] = [];
  centerprocessData : any[] = [];
  platformData      : any[] = [];

  selectedContractId: string = '';
  selectedProjectId : string = '';
  selectedBranchId  : string = '';
  selectedCProcessId: number = 0;
  selectedPlatformId: number = 0;
  usersData: any[];

  constructor(
    public translateService: TraductorService,
    public trackingService : TrackingService,
    public companysService : CompanysService,
    public authService     : AuthService,
    public rootService     : RootService,
    public contractService : ContractsService,
    public projectService  : ProjectsService,
    private router: Router,
    private permissionsService: UsersxpermissionsService,
    private signalsService  : SignalsService
  ) {}

  async ngOnInit() {
    await this.getpermissionxRoots();
  }

   
  onRootsSelected(event: Event): void {

    const target = event.target as HTMLSelectElement;

    this.trackingService.setCompany(target.value) ;

    this.selectedCompany = target.value;
   // alert('Picture:'+ this.selectedCompany);
    console.log(this.selectedCompany);
    this.getpermissionxRoots();
  }
 
  async getpermissionxRoots() {
          // Aquí consulto la tabla donde está el idUser correspondiente a company
          this.rootService.get2Root()
            .subscribe((data) => {
              const rootId = Object.values(data)
              if (rootId) {
                this.companyData = rootId;
                // Ya tengo el id de la compañía root
                this.selectedCompany = this.companyData[0].id;

                // Ahora consulto la información de root
                this.trackingService.setCompany(this.selectedCompany);
                this.getHeadersCompanys(this.selectedCompany);
                this.getpermissionxContracts(parseInt(this.selectedCompany));
              } else {
                console.log(
                  `No se encontró ningún usuario con idUser ${rootId}`
                );
              }
            });     
   }

   async onContractsSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedContractId = target.value;
    this.trackingService.setContract(this.selectedContractId);
    this.signalsService.setContractSelectedBySidebar(Number(this.selectedContractId));
  }

   async getpermissionxContracts(idRoot : number) {
    // Aquí consulto la tabla donde está el idUser correspondiente a company
    this.contractService.getContractsBy2fields(idRoot)
      .subscribe((data) => {
        const contractId = Object.values(data)
        if (contractId) {
          this.contractData = contractId;
          // Ya tengo el id de la compañía root
          this.selectedContractId = this.contractData[0].id;

          // Ahora consulto la información de root
          this.trackingService.setContract(this.selectedContractId);
          this.getpermissionxProjects(parseInt(this.selectedContractId));
        } else {
          console.log(
            `No se encontró ningún Contract con idRoot ${contractId}`
          );
        }
      });     
  }

  async onProjectSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedProjectId = target.value;
    this.trackingService.setProject(this.selectedProjectId);
  }
  
   async getpermissionxProjects(idContract : number) {
    // Aquí consulto la tabla donde está el idUser correspondiente a company
    this.projectService.getProjectsByContract(idContract)
      .subscribe((data) => {
        const projectId = Object.values(data)
        if (projectId) {
          this.projectData = projectId;
          // Ya tengo el id de la compañía root
          this.selectedProjectId = this.projectData[0].id;

          // Ahora consulto la información de root
          this.trackingService.setCompany(this.selectedProjectId);                    
        } else {
          console.log(
            `No se encontró ningún Project con idProject ${this.selectedProjectId}`
          );
        }
      });     
  }


  getHeadersCompanys(companyId) {
    this.rootService
      .getRootbyId(companyId)
      .subscribe((datacom: any) => {
        // Utilizar los datos obtenidos
        this.trackingService.setnameComp(datacom.name);
        this.signalsService.setCompanyName(datacom.name); // Envio la signal a auth.service
        this.trackingService.setpictureComp(datacom.picture);
        //this.trackingService.setformatrepint(datacom.formatrep);
        // alert('Format:'+ datacom.formatrep);
      });
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
