import { inject, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SignalsService {

  // Voy a empezar a definir las signals en un mismo servicio,
  // de esta forma no estarán dispersados por todos lados.

  /* Aquí se definen las signals para el sidebar */

  contractSelectedBySidebar = signal<number | null>(null);

  setContractSelectedBySidebar(id:number) {
    this.contractSelectedBySidebar.set(id);
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
  
  profileSignal(id: number, email: string, picture: string, name: string, organization: string, position: string) {
    this.profile.idUser.set(id);
    this.profile.emailUser.set(email);
    this.profile.profilePicUser.set(picture);
    this.profile.nameUser.set(name);
    this.profile.organizationUser.set(organization);
    this.profile.positionUser.set(position);
  }
}
