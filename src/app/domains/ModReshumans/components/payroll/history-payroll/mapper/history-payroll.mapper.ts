import {
  HistoryPayroll,
  HistoryPayrollResponse,
} from 'app/interface/history-payroll.interface';

export class HistoryPayrollMapper {
  static mapRestHistoryPayroll(
    restHistoryPayroll: HistoryPayrollResponse
  ): HistoryPayroll {
    return {
      payrollId: restHistoryPayroll.payrollId,
      idBranch: restHistoryPayroll.idBranch,
      company: restHistoryPayroll.company,
      period: restHistoryPayroll.period,
      startDate: restHistoryPayroll.startDate,
      endDate: restHistoryPayroll.endDate,
      fiscalYear: restHistoryPayroll.fiscalYear,
      createdAt: restHistoryPayroll.createdAt,
      active: restHistoryPayroll.active,
    };
  }

  static mapRestHistoryItemToArray(
    restHistoryPayroll: HistoryPayrollResponse[]
  ): HistoryPayroll[] {
    return restHistoryPayroll.map(this.mapRestHistoryPayroll);
  }
}
