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

  // ✅ CORRECCIÓN: Signal para actualizar el maestro
  private masterUpdateTrigger = signal<any>(null);

  private masterRowToUpdate = signal<any | null>(null);

 // El componente maestro leerá esta señal
  get masterRowToUpdate$() {
    return this.masterRowToUpdate.asReadonly();
  }

 setMasterRowUpdate (data: any | null) {
   this.masterRowToUpdate.set(data);
 }


// Señal para disparar actualización del grid maestro
private updateMasterGrid = signal<{ id: number; subtotal: number; tax: number; total: number } | null>(null);

// ✅ CORRECCIÓN: Método mejorado para disparar actualizaciones
  triggerMasterUpdate(data: { id: number; subtotal: number; tax: number; total: number }) {
    console.log('🎯 SignalsService: triggerMasterUpdate llamado con:', data);
    
    // ✅ CORRECCIÓN: Crear una nueva referencia de objeto para forzar la detección de cambios
    const updateData = {
      ...data,
      timestamp: Date.now() // Agregar timestamp para garantizar cambio
    };
    
    console.log('🚀 SignalsService: Estableciendo signal con:', updateData);
    this.masterUpdateTrigger.set(updateData);
    
    // ✅ CORRECCIÓN: Limpiar el signal después de un tiempo para permitir futuros triggers
    setTimeout(() => {
      console.log('🧹 SignalsService: Limpiando signal');
      this.masterUpdateTrigger.set(null);
    }, 500);
  }

// Getter para la señal
getMasterUpdateTrigger() {  
  return this.updateMasterGrid.asReadonly();
}

  private emailChoose           = signal<string | null>(null);

  private rootChoose            = signal<boolean>(
    // Restaurar desde localStorage si existe, sino false por defecto
    typeof localStorage !== 'undefined' && localStorage.getItem('userRoot')
      ? localStorage.getItem('userRoot') === 'true'
      : false
  );

  private isAdvanced            = signal<boolean>(false);
  
  private catalogSelected       = signal<string | null>(null);

  private sectionSelected       = signal<string | null>(null);
  
  private rootSelectedBySidebar = signal<number | null>(null);  
  
  private Procces               = signal<number | null>(null);

  setemailChoose(id: string) {
    this.emailChoose.set(id);
  }

  setIsAdvanced(id: boolean) {
    this.isAdvanced.set(id);
  }

  setrootChoose(id: boolean) {
    this.rootChoose.set(id);
  }

  setCatalogSelected(id: string) {
    this.catalogSelected.set(id);
  }

  setSectionSelected(id: string) {
    this.sectionSelected.set(id);
  }

  setRootSelectedBySidebar(id: number) {
    this.rootSelectedBySidebar.set(id);
  }

  private contractSelectedBySidebar = signal<number | null>(null);

  setContractSelectedBySidebar(id: number) {
    this.contractSelectedBySidebar.set(id);
  }

  // Convenio vigente del contrato activo (solo lectura para todos excepto módulo Convenios)
  private conventionVigente = signal<{ id: number; name: string } | null>(null);

  setConventionVigente(data: { id: number; name: string } | null) {
    this.conventionVigente.set(data);
  }

  getConventionVigente() {
    return this.conventionVigente;
  }

  private projectSelectedBySidebar = signal<number | null>(null);
  private projectNameBySidebar = signal<string>('');

  setProjectSelectedBySidebar(id: number) {
    this.projectSelectedBySidebar.set(id);
  }

  setProjectNameBySidebar(name: string) { this.projectNameBySidebar.set(name); }
  getProjectNameBySidebar() { return this.projectNameBySidebar; }

  /** Signal exclusiva del sidebar (nunca modificada por ordenes).
   *  Usada por sistema/reportes-diarios para evitar contaminación cruzada. */
  private sidebarProjectId = signal<number | null>(null);

  setSidebarProjectId(id: number | null) {
    this.sidebarProjectId.set(id);
  }

  getSidebarProjectId() {
    return this.sidebarProjectId;
  }

  private branchSelectedBySidebar = signal<number | null>(null);

  setBranchSelectedBySidebar(id: number) {
    this.branchSelectedBySidebar.set(id);
  }

  private branchNameSelectedBySidebar = signal<string>(null);
  
  setBranchNameSelectedBySidebar(name: string) {
    this.branchNameSelectedBySidebar.set(name);
  }

  setProcces(id : number){
    this.Procces.set(id);
  }
  

  //aqui estan los get
  getemailChoose()
  {
    return this.emailChoose()
  }

  getIsAdvanced()
  {
    return this.isAdvanced()
  }

  getrootChoose() {
     return this.rootChoose() ;
  }

  getCatalogSelected() {
    return this.catalogSelected();
  }
  getSectionSelected() {
    return this.sectionSelected();
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
  private companyNameSmall = signal<string>(null);
  private selectedContract = signal<number>(null);
  idUser = signal<number>(0);
  private displayName = signal<string>(null);
  private userRoot = signal<number>(null);
  private selectedProject = signal<number>(null);

  setCompanyName(name: string) {
    this.companyName.set(name);
  }

  getCompanyName() {
    return this.companyName;
  }

  setCompanyNameSmall(name: string) {
    this.companyNameSmall.set(name);
  }

  getCompanyNameSmall() {
    return this.companyNameSmall;
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

  getIdUSer(){
    return this.idUser;
  }

  setUserRoot(Root: any){
    return this.userRoot.set(Root);
  }

  getUserRoot(){
    return this.userRoot;
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
  private idEmployeePayroll = signal<number>(null);

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

  setIdEmployeePayroll(id: number) {
    this.idEmployeePayroll.set(id);
  }

  getIdEmployeePayroll() {
    return this.idEmployeePayroll;
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

  /* Para el refrescado de la sucursal en el sidebar */
  private updateBranchList = signal<boolean>(false);

  getUpdateBranchList() {
    return this.updateBranchList;
  }

  triggerUpdateBranchList() {
    this.updateBranchList.set(true);
  }

  resetSignalBranchList() {
    this.updateBranchList.set(false);
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

  // Payrolls
  private normalPayrollId = signal<number>(null);
  setNormalPayrollId(id: number) {
    this.normalPayrollId.set(id);
  }
  getNormalPayrollId() {
    return this.normalPayrollId;
  }

  // Para definir providers o customers
  private providerOrCustomer = signal<string>(null);

  setProviderOrCustomer(providerOrCustomer: string) {
    this.providerOrCustomer.set(providerOrCustomer);
  }

  getProviderOrCustomer() {
    return this.providerOrCustomer; 
  }

  // Para llevar el idEmployee, el startDate y el endDate
  private dataClockEmployee =  {
    idEmployee: signal<number>(null),
    startDate: signal<string>(null),
    endDate: signal<string>(null)
  };

  setDetailClockForEmployee(idEmployee: number, startDate: string, endDate: string) {
    this.dataClockEmployee.idEmployee.set(idEmployee);
    this.dataClockEmployee.startDate.set(startDate);
    this.dataClockEmployee.endDate.set(endDate);
  }
  
  getDetailClockForEmployee() {
    return this.dataClockEmployee;
  }

  // Para roles

  private idRole = signal<number>(null);
  private idPosicion = signal<number>(null);

  setIdRole(id: number) {
    this.idRole.set(id);
  }

  getIdRole() {
    return this.idRole;
  }

  setIdPosicion(id: number) {
    this.idPosicion.set(id);
  }

  getIdPosicion() {
    return this.idPosicion;
  }

  // Contratos

  setIdContract(id: number) {
    this.idContract.set(id);
  }

  getIdContract() {
    return this.idContract;
  }

  // Convenios

  private idConvention = signal<number>(null);


  setIdConvention(id: number) {
    this.idConvention.set(id);
  }

  getIdConvention() {
    return this.idConvention;
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
    this.projectNameBySidebar = signal('');
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

    private refreshNomina = signal<boolean>(false);

    // Método para obtener el signal
    get getRefreshNomina() {
      return this.refreshNomina;
    }
    // Método para actualizar el signal
    triggerRefreshNomina() {
      this.refreshNomina.set(true);
    }
  
    // Método para resetear el signal
    resetRefreshNomina() {
      this.refreshNomina.set(false);
    }

  private idCatalogFamily = signal<number>(null);
  private idMaterial = signal<number>(null);
  private closeCatalog = signal<boolean>(false);
  private fechaInicioNomina = signal<string>(null);
  private fechaFinNomina = signal<string>(null);
  private initSaving = signal<boolean>(false);
  private closedPayroll = signal<boolean>(false);
  private closedReport = signal<boolean>(false);
  private refreshClock = signal<boolean>(false);
  private refresCantidadPermisos = signal<boolean>(false);
  private refresSecurity = signal<boolean>(false);
  private masterCatalog = signal<number>(null); 
  private IdProveedor = signal<number>(null);
  private Invited = signal<boolean>(false);

  setInvited(value: boolean){
    this.Invited.set(value);
  }

  getInvited(){
    return this.Invited;
  }
  
  setIdCatalogFamily(id: number){
    this.idCatalogFamily.set(id);
  }

  setIdMaterial(id: number){
    this.idMaterial.set(id);
  }

  setCloseCatalog(valor: boolean){
    this.closeCatalog.set(valor);
  }

  getIdCatalogFamily(){
    return this.idCatalogFamily;
  }

  getIdMaterial(){
    return this.idMaterial;
  }

  getCloseCatalog(){
    return this.closeCatalog;
  }

  setFechaNomina(fechaInicio: string, fechaFin: string) {
    this.fechaInicioNomina.set(fechaInicio);
    this.fechaFinNomina.set(fechaFin);
  }
  getFechaNomina() {
    return {
      fechaInicio: this.fechaInicioNomina(),
      fechaFin: this.fechaFinNomina()
    };
  }
  setInitSaving() {
    this.initSaving.set(true);
  }
  getInitSaving() {
    return this.initSaving;
  }
  resetInitSaving() {
    this.initSaving.set(false);
  }

  setClosedPayroll(value: boolean) {
    this.closedPayroll.set(value);
  }
  getClosedPayroll() {
    return this.closedPayroll;
  }
  
  setClosedReport(value: boolean) {
    this.closedReport.set(value);
  }
  getClosedReport() {
    return this.closedReport;
  }

  setRefreshClock(value: boolean) {
    this.refreshClock.set(value);
  }
  getRefreshClock() {
    return this.refreshClock;
  }

  setRefresCantidadPermisos(value: boolean) {
    this.refresCantidadPermisos.set(value);
  }
  getRefresCantidadPermisos() {
    return this.refresCantidadPermisos;
  }

  setRefresSecurity(value: boolean) {
    this.refresSecurity.set(value);
  }
  getRefresSecurity() {
    return this.refresSecurity;
  }

  setMasterCatalog(value: number){
    this.masterCatalog.set(value);
  }

  getMasterCatalog() {
    return this.masterCatalog;
  }
  setIdProveedor(value: number){
    this.IdProveedor.set(value);
  }

  getIdProveedor() {
    return this.IdProveedor();
  }

  // Signal para nuevo proveedor creado desde modal
  private newProviderCreated = signal<{ id: number; name: string; } | null>(null);

  setNewProviderCreated(id: number, name: string) {
    this.newProviderCreated.set({ id, name });
  }

  getNewProviderCreated() {
    return this.newProviderCreated;
  }

  resetNewProviderCreated() {
    this.newProviderCreated.set(null);
  }
}
