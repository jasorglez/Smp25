import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SignalsService {
  /*
  Voy a empezar a definir las signals en un mismo servicio,
  de esta forma no estarán dispersados por todos lados.
  */

  /* Aquí se definen las signals para el sidebar */

  private rootSelectedBySidebar = signal<number | null>(null);
  private Procces = signal<number | null>(null);

  setRootSelectedBySidebar(id: number) {
    this.rootSelectedBySidebar.set(id);
  }

  private contractSelectedBySidebar = signal<number | null>(null);

  setContractSelectedBySidebar(id: number) {
    this.contractSelectedBySidebar.set(id);
  }

  private projectSelectedBySidebar = signal<number | null>(null);

  setProjectSelectedBySidebar(id: number) {
    this.projectSelectedBySidebar.set(id);
  }

  private branchSelectedBySidebar = signal<number | null>(null);
  private branchNameSelectedBySidebar = signal<string>(null);

  setBranchSelectedBySidebar(id: number) {
    this.branchSelectedBySidebar.set(id);
  }

  setBranchNameSelectedBySidebar(name: string) {
    this.branchNameSelectedBySidebar.set(name);
  }

  setProcces(id : number){
    this.Procces.set(id);
  }

  getProcces(){
    return this.Procces;
  }

  getBranchNameSelectedBySidebar() {
    return this.branchNameSelectedBySidebar;
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

  getBranchSelectedBySidebar() {
    return this.branchSelectedBySidebar;
  }

  /* Aquí se definen las signals para el setup de Users */

  profile = {
    idUser: signal<number>(null),
    emailUser: signal<string>(null),
    profilePicUser: signal<string>(null),
    nameUser: signal<string>(null),
    organizationUser: signal<string>(null),
    positionUser: signal<string>(null),
  };

  isidUserEmpty(): boolean {
    return this.idUser() === null || this.idUser() === 0;
  }

  /* Aquí se definen las signals para el RiskMatrix */

  private idIdentificationRisk = signal<number>(null);
  private nameIdentificationRisk = signal<string>(null);
  private causeIdentificationRisk = signal<string>(null);
  private idAnalysisRisk = signal<number>(null);
  private idPlanificationRisk = signal<number>(null);
  private planificationActionRisk = signal<string>(null);
  private selectedWorkProgram = signal<string>(null);

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

  setIdAnalysisRisk(id: number) {
    this.idAnalysisRisk.set(id);
  }

  getIdAnalysisRisk() {
    return this.idAnalysisRisk;
  }

  setSelectedWorkProgram(name: string) {
    this.selectedWorkProgram.set(name);
  }

  getSelectedWorkProgram() {
    return this.selectedWorkProgram;
  }

  setIdPlanificationRisk(id: number) {
    this.idPlanificationRisk.set(id);
  }

  getIdPlanificationRisk() {
    return this.idPlanificationRisk;
  }

  setPlanificationActionRisk(action: string) {
    this.planificationActionRisk.set(action);
  }

  getPlanificationActionRisk() {
    return this.planificationActionRisk;
  }

  /* Signals para el perfil de usuario */

  profileSignal(
    id: number,
    email: string,
    picture: string,
    name: string,
    organization: string,
    position: string
  ) {
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
  idRoot = signal<number>(null);
  idBranch = signal<number>(null);
  idStore = signal<number>(null);

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

  setCompanyFromPermissions(id: number) {
    this.idRoot.set(id);
  }

  getCompanyFromPermissions() {
    return this.idRoot;
  }

  setBranchFromPermissions(id: number) {
    this.idBranch.set(id);
  }

  getBranchFromPermissions() {
    return this.idBranch;
  }

  setStoreFromPermissions(id: number) {
    this.idStore.set(id);
  }

  getStoreFromPermissions() {
    return this.idStore;
  }

  /* Signal para la sidebar */

  private companyName = signal<string>(null);
  private selectedContract = signal<number>(null);
  idUser = signal<number>(0);
  private displayName = signal<string>(null);
  private selectedProject = signal<number>(null);

  setCompanyName(name: string) {
    this.companyName.set(name);
  }

  getCompanyName() {
    return this.companyName;
  }

  setidUser(id: number) {
    this.idUser.set(id);
  }

  setDisplayName(name: string) {
    this.displayName.set(name);
  }

  getDisplayName() {
    return this.displayName;
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

  /* Signals para requisiciones */

  private idRequisition = signal<number>(null);
  private idEmployee = signal<number>(null);
  private nameRequisition = signal<string>(null);
  private requisitionSolicitant = signal<string>(null);
  private requisitionDate = signal<string>(null);

  setIdRequisition(id: number) {
    this.idRequisition.set(id);
  }

  getIdRequisition() {
    return this.idRequisition;
  }

  setIdEmployee(id: number) {
    this.idEmployee.set(id);
  }

  getIdEmployee() {
    return this.idEmployee;
  }


  setRequisitionName(name: string) {
    this.nameRequisition.set(name);
  }

  getRequisitionName() {
    return this.nameRequisition;
  }

  setRequisitionSolicitant(solicitant: string) {
    this.requisitionSolicitant.set(solicitant);
  }

  getRequisitionSolicitant() {
    return this.requisitionSolicitant;
  }

  setRequisitionDate(date: string) {
    this.requisitionDate.set(date);
  }

  getRequisitionDate() {
    return this.requisitionDate;
  }

  // Voy a borrar la signal de la requisición u OC para que se resetee de forma manual
  // al cambiar de OC o requisición

  deleteRequisitionData() {
    this.idRequisition.set(null);
    this.nameRequisition.set(null);
    this.requisitionSolicitant.set(null);
    this.requisitionDate.set(null);
  }

  /* Para entradas y salidas */
  private idInAndOut = signal<number>(null);
  private nameInAndOut = signal<string>(null);

  setIdInAndOut(id: number) {
    this.idInAndOut.set(id);
  }

  getIdInAndOut() {
    return this.idInAndOut;
  }

  setInAndOutName(name: string) {
    this.nameInAndOut.set(name);
  }

  getInAndOutName() {
    return this.nameInAndOut;
  }

  deleteInAndOutData() {
    this.idInAndOut.set(null);
    this.nameInAndOut.set(null);
  }

  /* Para clientes */
  private idClient = signal<number>(null);
  private nameClient = signal<string>(null);

  setIdClient(id: number) {
    this.idClient.set(id);
  }

  getIdClient() {
    return this.idClient;
  }

  deleteClientData() {
    this.idClient.set(null);
    this.nameClient.set(null);
  }

  setNameClient(name: string) {
    this.nameClient.set(name);
  }

  getNameClient() {
    return this.nameClient;
  }

  deleteClientName() {
    this.nameClient.set(null);
  }

  /* Para el punto de venta */

  private idCustomerFromPOS = signal<number>(null);

  setIdCustomerFromPOS(id: number) {
    this.idCustomerFromPOS.set(id);
  }

  getIdCustomerFromPOS() {
    return this.idCustomerFromPOS;
  }

  /* Para el income and expenses */

  private idIncomeAndExpense = signal<number>(null);
  private updateIncAndExp = signal<boolean>(false);

  setIdIncomeAndExpense(id: number) {
    this.idIncomeAndExpense.set(id);
  }
  getIdIncomeAndExpense() {
    return this.idIncomeAndExpense;
  }

  // Método para obtener el signal
  getupdateIncAndExp() {
    return this.updateIncAndExp;
  }

  // Método para actualizar el signal
  triggerUpdateIncAndExp() {
    this.updateIncAndExp.set(true);
  }

  // Método para resetear el signal
  resetSignalIncAndExp() {
    this.updateIncAndExp.set(false);
  }

  /* Borramos todas las signals, tratar de poner esto a lo último.
  Si van a crear nuevas signals, recuerden introducir una señal
  null en deleteSignals() para que todas las signals se borren
  al momento de hacer logout */

  deleteSignals() {
    this.rootSelectedBySidebar = signal(null);
    this.branchSelectedBySidebar = signal(null);
    this.branchNameSelectedBySidebar = signal(null);
    this.projectSelectedBySidebar = signal(null);
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
    this.idIdentificationRisk = signal(null);
    this.nameIdentificationRisk = signal(null);
    this.causeIdentificationRisk = signal(null);
    this.idAnalysisRisk = signal(null);
    this.idPlanificationRisk = signal(null);
    this.planificationActionRisk = signal(null);
    this.selectedWorkProgram = signal(null);
    this.idRequisition = signal(null);
    this.nameRequisition = signal(null);
    this.requisitionSolicitant = signal(null);
    this.requisitionDate = signal(null);
    this.selectedContract = signal(null);
    this.selectedProject = signal(null);
    this.idClient = signal(null);
    this.nameClient = signal(null);
    this.idCustomerFromPOS = signal(null);
    this.idIncomeAndExpense = signal(null);
    this.refreshEmployees = signal(false);

    // Reinicia this.profile
    this.profileSignal(null, null, null, null, null, null);
  }

  private refreshEmployees = signal<boolean>(false);

    // Método para obtener el signal
    getRefreshEmployees() {
      return this.refreshEmployees;
    }
  
    // Método para actualizar el signal
    triggerRefreshEmployees() {
      this.refreshEmployees.set(true);
    }
  
    // Método para resetear el signal
    resetRefreshEmployees() {
      this.refreshEmployees.set(false);
    }
}
