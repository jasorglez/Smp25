export interface HistoryPayrollResponse {
  payrollId: number;
  idBranch: number;
  company: string;
  period: string;
  startDate: Date;
  endDate: Date;
  fiscalYear: string;
  excelFile: string;
  createdAt: Date;
  active: boolean;
  payrollEmployees: PayrollEmployee[];
}

export interface PayrollEmployee {
  payrollEmployeeId: number;
  employeeId: number;
  name: string;
  workedDays: number;
  integratedDailySalary: number;
  dailySalary: number;
  wages: number;
  totalEarnings: number;
  otherIncome: number;
  taxableEarnings: number;
  article96Tax: number;
  article114Subsidy: number;
  totalArticle115EmploymentSubsidy: number;
  accreditedEmploymentSubsidy: number;
  incomeTax: number;
  employmentSubsidy: number;
  medicalInsurance: number;
  retirementInsurance: number;
  socialSecurity: number;
  housingFundWithholding: number;
  childSupport: number;
  netPay: number;
  signature: string;
  payrollId: number;
  payrollRecord: string;
}
