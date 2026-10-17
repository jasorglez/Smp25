import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of, forkJoin } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdministrationService } from 'app/services/administration.service';
import { AuthService } from 'app/services/auth.service';
import { PayrollService } from 'app/services/payroll.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-dash-human-resources',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dash-human-resources.component.html',
  styleUrl: './dash-human-resources.component.scss'
})
export class DashHumanResourcesComponent implements OnInit {
  private readonly administrationService = inject(AdministrationService);
  private readonly payrollService = inject(PayrollService);
  private readonly signalsService = inject(SignalsService);
  private readonly authService = inject(AuthService);

  readonly canViewPayroll = this.authService.hasDetailedPermission('hr', 'payroll');
  readonly canViewClock = this.authService.hasDetailedPermission('hr', 'clock');

  loading = false;
  branchId = 0;
  payrollRows: any[] = [];
  payrollCount = 0;
  latestPayroll: any = null;
  attendance = { employees: 0, delays: 0, absences: 0, pendingOuts: 0 };
  payrollUnavailable = false;
  clockUnavailable = false;
  private initialized = false;

  constructor() {
    effect(() => {
      const selectedBranch = Number(this.signalsService.getBranchSelectedBySidebar()() ?? 0);
      if (selectedBranch === this.branchId) return;
      this.branchId = selectedBranch;
      if (this.initialized) this.loadDashboard();
    });
  }

  ngOnInit(): void {
    this.branchId = Number(this.signalsService.getBranchSelectedBySidebar()() ?? 0);
    this.initialized = true;
    this.loadDashboard();
  }

  loadDashboard(): void {
    if (!this.branchId) {
      this.payrollRows = [];
      this.payrollCount = 0;
      this.latestPayroll = null;
      this.attendance = { employees: 0, delays: 0, absences: 0, pendingOuts: 0 };
      this.loading = false;
      return;
    }

    this.loading = true;
    this.payrollUnavailable = false;
    this.clockUnavailable = false;
    const now = new Date();
    const start = this.toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = this.toDateInput(now);

    forkJoin({
      payrolls: this.canViewPayroll
        ? this.administrationService.getNormalPayrolls(this.branchId).pipe(catchError(() => {
          this.payrollUnavailable = true;
          return of([]);
        }))
        : of([]),
      clock: this.canViewClock
        ? this.payrollService.getMasterClock(this.branchId, start, end).pipe(catchError(() => {
          this.clockUnavailable = true;
          return of([]);
        }))
        : of([])
    }).subscribe({
      next: result => {
        this.setPayrollSummary(result.payrolls);
        this.setAttendanceSummary(result.clock);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  formatCurrency(value: any): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })
      .format(this.toNumber(value));
  }

  formatPeriodDate(value: any): string {
    if (!value) return '—';
    const dateOnly = typeof value === 'string' ? value.slice(0, 10) : '';
    const dateParts = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-MX');
  }

  private setPayrollSummary(payload: any): void {
    const rows = this.asArray(payload).filter(row => row && (row.startDate || row.endDate));
    rows.sort((a, b) => this.dateValue(b.endDate || b.startDate) - this.dateValue(a.endDate || a.startDate));
    this.payrollRows = rows.slice(0, 5);
    this.payrollCount = rows.length;
    this.latestPayroll = rows[0] || null;
  }

  private setAttendanceSummary(payload: any): void {
    const rows = this.asArray(payload);
    const employees = new Set(rows.map(row => row.idEmployee).filter(id => id !== null && id !== undefined));
    this.attendance = rows.reduce((summary, row) => ({
      employees: employees.size,
      delays: summary.delays + this.toNumber(row.delays),
      absences: summary.absences + this.toNumber(row.absences),
      pendingOuts: summary.pendingOuts + this.toNumber(row.pendingOuts)
    }), { employees: 0, delays: 0, absences: 0, pendingOuts: 0 });
  }

  private asArray(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  private toNumber(value: any): number {
    const parsed = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private dateValue(value: any): number {
    const date = new Date(value || '').getTime();
    return Number.isFinite(date) ? date : 0;
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
