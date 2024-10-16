import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SignalsService {

  /*
  Voy a empezar a definir las signals en un mismo servicio,
  de esta forma no estarán dispersados por todos lados.
  */

  /* Aquí se definen las signals para el sidebar */

  rootSelectedBySidebar = signal<number | null>(null);

  setRootSelectedBySidebar(id: number) {
    this.rootSelectedBySidebar.set(id);
  }

  contractSelectedBySidebar = signal<number | null>(null);

  setContractSelectedBySidebar(id: number) {
    this.contractSelectedBySidebar.set(id);
  }

  projectSelectedBySidebar = signal<number | null>(null);

  setProjectSelectedBySidebar(id: number) {
    this.projectSelectedBySidebar.set(id);
  }


  getContractSelectedBySidebar() {
    return this.contractSelectedBySidebar;
  }

  /* Aquí se definen las signals para el setup de Users */

  profile = {
    idUser: signal<number>(null),
    emailUser: signal<string>(null),
    profilePicUser: signal<string>(null),
    nameUser: signal<string>(null),
    organizationUser: signal<string>(null),
    positionUser: signal<string>(null)
  };

  isidUserEmpty(): boolean {
    return this.idUser() === null || this.idUser() === 0;
  }


  profileSignal(id: number, email: string, picture: string, name: string, organization: string, position: string) {
    this.profile.idUser.set(id);
    this.profile.emailUser.set(email);
    this.profile.profilePicUser.set(picture);
    this.profile.nameUser.set(name);
    this.profile.organizationUser.set(organization);
    this.profile.positionUser.set(position);
  }

  /* Signals de Users X Permissions */

  idCompany    = signal<number>(null);
  nameCompany  = signal<string>(null);
  idContract   = signal<number>(null);
  nameContract = signal<string>(null);
  

  private companyCheckedSignal = signal(false);
  private contractCheckedSignal = signal(false);

  companyChecked() {
    return this.companyCheckedSignal;
  }

  contractChecked() {
    return this.contractCheckedSignal;
  }

  companySignal(id: number, name: string) {
    this.idCompany.set(id);
    this.nameCompany.set(name);
  }

  contractSignal(id: number, name: string) {
    this.idContract.set(id);
    this.nameContract.set(name);
  }

  /* Signal para la sidebar */

  companyName = signal<string>(null);

  setCompanyName(name: string) {
    this.companyName.set(name);
  }

  idUser       = signal<number>(0) ;

  setidUser(id:number)
  {
     this.idUser.set(id) ;
  }

  /* Borramos todas las signals, tratar de poner esto a lo último.
  Si van a crear nuevas signals, recuerden introducir una señal
  null en deleteSignals() para que todas las signals se borren
  al momento de hacer logout */

  deleteSignals() {
    this.contractSelectedBySidebar = signal(null);
    this.idCompany = signal(null);
    this.nameCompany = signal(null);
    this.idContract = signal(null);
    this.nameContract = signal(null);
    this.companyName = signal(null);
    this.companyCheckedSignal = signal(false);
    this.contractCheckedSignal = signal(false);
    // Reinicia this.profile
    this.profileSignal(null, null, null, null, null, null);
  }
}
