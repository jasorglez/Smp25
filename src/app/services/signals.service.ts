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

  private rootSelectedBySidebar = signal<number | null>(null);

  setRootSelectedBySidebar(id: number) {
    this.rootSelectedBySidebar.set(id);
  }

  private contractSelectedBySidebar = signal<number | null>(null);

  setContractSelectedBySidebar(id: number) {
    this.contractSelectedBySidebar.set(id);
  }

  projectSelectedBySidebar = signal<number | null>(null);

  setProjectSelectedBySidebar(id: number) {
    this.projectSelectedBySidebar.set(id);
  }

  getRootSelectedBySidebar() {
    return this.rootSelectedBySidebar;
  }

  getContractSelectedBySidebar() {
    return this.contractSelectedBySidebar;
  }

  getProjectSelectedBySidebar() {
    return this.projectSelectedBySidebar;
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

  /* Aquí se definen las signals para el RiskMatrix */

  private idIdentificationRisk = signal<number>(null);
  private nameIdentificationRisk = signal<string>(null);
  private causeIdentificationRisk = signal<string>(null);

  setIdIdentificationRisk(id: number) {
    this.idIdentificationRisk.set(id);
  }

  getIdIdentificationRisk() {
    return this.idIdentificationRisk;
  }

  setNameIdentificationRisk(description: any) {
    this.nameIdentificationRisk.set(description);
  }
  setCauseIdentificationRisk(cause: any) {
    this.causeIdentificationRisk.set(cause);
  }

  getNameIdentificationRisk() {
    return this.nameIdentificationRisk();
  }

  getCauseIdentificationRisk() {
    return this.causeIdentificationRisk();
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

  idCompany = signal<number>(null);
  nameCompany = signal<string>(null);
  idContract = signal<number>(null);
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
  private selectedContract = signal<number>(null);
  idUser = signal<number>(0);
  private selectedProject = signal<number>(null);

  setCompanyName(name: string) {
    this.companyName.set(name);
  }

  setidUser(id: number) {
    this.idUser.set(id);
  }

  /* Signals para Matriz Issues */

  idIdentification = signal<number>(null);
  idProjectByIdentification = signal<number>(null);
  eventIdentification = signal<string>(null);
  classificationIdentification = signal<string>(null);
  registeredDateIdentification = signal<string>(null);
  nameIdentification = signal<string>(null);
  idAnalysis = signal<number>(null);
  nameAnalysis = signal<string>(null);
  idContingencyAction = signal<number>(null);
  nameContingencyAction = signal<string>(null);

  setIdIdentification(id: number) {
    this.idIdentification.set(id);
  }

  setIdProjectByIdentification(id: number) {
    this.idProjectByIdentification.set(id);
  }

  setEventIdentification(event: string) {
    this.eventIdentification.set(event);
  }

  setClassificationIdentification(classification: string) {
    this.classificationIdentification.set(classification);
  }

  setRegisteredDateIdentification(date: string) {
    this.registeredDateIdentification.set(date);
  }

  setIdAnalysis(id: number) {
    this.idAnalysis.set(id);
  }

  setIdContingencyAction(id: number) {
    this.idContingencyAction.set(id);
  }

  setIdentificationName(name: string) {
    this.nameIdentification.set(name);
  }

  setAnalysisName(name: string) {
    this.nameAnalysis.set(name);
  }

  setContingencyActionName(name: string) {
    this.nameContingencyAction.set(name);
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
    this.idIdentification = signal(null);
    this.idProjectByIdentification = signal(null);
    this.eventIdentification = signal(null);
    this.classificationIdentification = signal(null);
    this.registeredDateIdentification = signal(null);
    this.nameIdentification = signal(null);
    this.idAnalysis = signal(null);
    this.nameAnalysis = signal(null);
    this.idContingencyAction = signal(null);
    this.nameContingencyAction = signal(null);
    // Reinicia this.profile
    this.profileSignal(null, null, null, null, null, null);
  }
}
