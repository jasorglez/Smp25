export interface Iproject {
  id: number;
  idConsecutivo: number;
  idContrato: number;
  idOilfield: number;
  idActive: number;
  number: string;
  name: string;
  request: string;
  priority: number;
  description: string;
  programStart?: string;
  programEnd?: string;
  realPronosticLPO?: string;
  realPronosticTTT?: string;
  company?: string;
  year: number;
  diameter: string;
  active: number;
  length: number;
  budgetManagement: string;
  lineRight: string;
  receivedEngineering: string;
  government: string;
  classification: string;
  typeConstruction: string;
  state: string;
  detailType?: string; // Added for master-detail functionality
}
