import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TeamService } from 'app/services/team.service';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { MaintenanceCatalogService } from 'app/services/maintenance-catalog.service';
import { TrackingService } from 'app/services/tracking.service';
import { forkJoin } from 'rxjs';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.scss'
})
export class EquiposComponent implements OnInit {
  readonly createSpecialtyOption = '__create_new_specialty__';

  private teamService = inject(TeamService);
  private employeesService = inject(EmployeesService);
  private signalsService = inject(SignalsService);
  private catalogService = inject(MaintenanceCatalogService);
  private trackingService = inject(TrackingService);

  idcompany: number = 0;
  idBranch: number = 0;
  teams: any[] = [];
  employees: any[] = [];
  loading: boolean = false;
  private initialized: boolean = false;
  private lastBranchId: number = 0;

  showForm: boolean = false;
  isEditing: boolean = false;
  editingTeamId: number | null = null;
  availableMembersList: any[] = [];

  formData: any = {
    name: '',
    leader: null as number | null,
    specialty: '',
    status: 'Activo',
    memberIds: [] as number[]
  };

  calculatedHourlyRate: number = 0;

  // Specialties loaded from catalog (SPECIALTY type)
  specialties: any[] = [];
  showSpecialtyModal: boolean = false;
  savingSpecialty: boolean = false;
  newSpecialtyDescription: string = '';

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) {
        return;
      }

      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadData();
    this.trackingService.addLog(
      String(this.idcompany),
      'Acceso a Equipos de Trabajo',
      'ModMaintenance/Equipos',
      ''
    );
  }

  loadData(): void {
    if (!this.hasValidContext()) {
      this.loading = false;
      this.teams = [];
      this.employees = [];
      return;
    }

    this.loading = true;
    const idBranchStr = this.idBranch.toString();

    // Load specialties from catalog
    if (this.idcompany > 0) {
      this.catalogService.getByCompanyAndType(this.idcompany, 'SPECIALTY').subscribe({
        next: (data) => {
          this.specialties = data;
        },
        error: (err) => {
          console.error('Error loading specialties catalog:', err);
          this.specialties = [];
        }
      });
    }

    forkJoin({
      teams: this.teamService.getAll(idBranchStr),
      employees: this.employeesService.getEmployees(this.idBranch)
    }).subscribe({
      next: (result: any) => {
        this.employees = (result.employees || []).filter((e: any) => e.active);
        const teamsRaw = result.teams || [];

        if (teamsRaw.length === 0) {
          this.teams = [];
          this.loading = false;
          return;
        }

        const memberRequests = teamsRaw.map((t: any) => this.teamService.getMembers(t.id));
        forkJoin(memberRequests).subscribe({
          next: (membersArrays: any) => {
            this.teams = teamsRaw.map((team: any, i: number) => {
              const members = (membersArrays[i] || []).map((m: any) => ({
                ...m,
                employeeName: this.getEmployeeName(m.idEmployee),
                baseHours: this.getEmployeeBaseHours(m.idEmployee)
              }));
              return {
                ...team,
                leaderName: this.getEmployeeName(team.leader),
                members: members
              };
            });
            this.loading = false;
          },
          error: () => {
            this.teams = teamsRaw.map((team: any) => ({
              ...team,
              leaderName: this.getEmployeeName(team.leader),
              members: []
            }));
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.loading = false;
      }
    });
  }

  getEmployeeName(id: number | null): string {
    if (!id) return 'Sin asignar';
    const emp = this.employees.find((e: any) => e.id === id);
    return emp ? emp.name : `Empleado #${id}`;
  }

  getEmployeeBaseHours(id: number | null): number {
    if (!id) return 0;
    const emp = this.employees.find((e: any) => e.id === id);
    return emp?.priceXHour || emp?.pricexhour || 0;
  }

  updateAvailableMembers(): void {
    const leaderId = this.formData.leader;
    this.availableMembersList = this.employees.filter((e: any) => e.id !== leaderId);
    this.recalculateHourlyRate();
  }

  onLeaderChange(): void {
    this.updateAvailableMembers();
  }

  onMembersChange(): void {
    this.recalculateHourlyRate();
  }

  recalculateHourlyRate(): void {
    let total = 0;

    // Include leader's hourly rate
    if (this.formData.leader) {
      total += this.getEmployeeBaseHours(this.formData.leader);
    }

    // Include members' hourly rates
    const memberIds: number[] = this.formData.memberIds || [];
    for (const empId of memberIds) {
      total += this.getEmployeeBaseHours(empId);
    }

    this.calculatedHourlyRate = Math.round(total * 100) / 100;
  }

  openCreateForm(): void {
    if (!this.canCreateByBranch()) {
      return;
    }

    this.isEditing = false;
    this.editingTeamId = null;
    this.formData = {
      name: '',
      leader: null,
      specialty: '',
      status: 'Activo',
      memberIds: []
    };
    this.calculatedHourlyRate = 0;
    this.updateAvailableMembers();
    this.showForm = true;
  }

  openEditForm(team: any): void {
    this.isEditing = true;
    this.editingTeamId = team.id;
    this.formData = {
      name: team.name,
      leader: team.leader || null,
      specialty: team.specialty || '',
      status: team.status || 'Activo',
      memberIds: (team.members || []).map((m: any) => m.idEmployee)
    };
    this.updateAvailableMembers();
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTeamId = null;
    this.closeSpecialtyModal();
  }

  handleSubmit(): void {
    if (!this.formData.name || !this.formData.specialty) return;
    if (!this.hasValidContext()) return;

    const teamData: any = {
      idBranch: this.idBranch.toString(),
      name: this.formData.name,
      leader: this.formData.leader || null,
      specialty: this.formData.specialty,
      status: this.formData.status,
      hourlyRate: this.calculatedHourlyRate,
      active: true
    };

    if (this.isEditing && this.editingTeamId) {
      this.teamService.update(this.editingTeamId, teamData).subscribe({
        next: () => {
          this.trackingService.addLog(
            String(this.idcompany),
            `Equipo actualizado: ${teamData.name}`,
            'ModMaintenance/Equipos',
            ''
          );
          this.syncMembers(this.editingTeamId!);
        },
        error: (err) => console.error('Error updating team:', err)
      });
    } else {
      this.teamService.add(teamData).subscribe({
        next: (created: any) => {
          this.trackingService.addLog(
            String(this.idcompany),
            `Equipo creado: ${teamData.name}`,
            'ModMaintenance/Equipos',
            ''
          );
          this.syncMembers(created.id);
        },
        error: (err) => console.error('Error creating team:', err)
      });
    }
  }

  private syncMembers(teamId: number): void {
    this.teamService.getMembers(teamId).subscribe({
      next: (currentMembers: any[]) => {
        const desiredIds: number[] = this.formData.memberIds || [];
        const currentEmpIds = (currentMembers || []).map((m: any) => m.idEmployee);

        const toAdd = desiredIds.filter((id: number) => !currentEmpIds.includes(id));
        const toRemove = (currentMembers || []).filter((m: any) => !desiredIds.includes(m.idEmployee));

        const ops: any[] = [];
        for (const empId of toAdd) {
          ops.push(this.teamService.addMember({ idTeam: teamId, idEmployee: empId, active: true }));
        }
        for (const m of toRemove) {
          ops.push(this.teamService.deleteMember(m.id));
        }

        if (ops.length > 0) {
          forkJoin(ops).subscribe({
            complete: () => { this.closeForm(); this.loadData(); }
          });
        } else {
          this.closeForm();
          this.loadData();
        }
      },
      error: () => {
        // No existing members, just add all
        const desiredIds: number[] = this.formData.memberIds || [];
        if (desiredIds.length > 0) {
          const adds = desiredIds.map((empId: number) =>
            this.teamService.addMember({ idTeam: teamId, idEmployee: empId, active: true })
          );
          forkJoin(adds).subscribe({
            complete: () => { this.closeForm(); this.loadData(); }
          });
        } else {
          this.closeForm();
          this.loadData();
        }
      }
    });
  }

  deleteTeam(team: any): void {
    if (!confirm('Eliminar equipo "' + team.name + '"?')) return;
    this.teamService.delete(team.id).subscribe({
      next: () => {
        this.trackingService.addLog(
          String(this.idcompany),
          `Equipo eliminado: ${team.name}`,
          'ModMaintenance/Equipos',
          ''
        );
        this.loadData();
      },
      error: (err) => console.error('Error deleting team:', err)
    });
  }

  getStatusClass(status: string): string {
    return status === 'Activo' ? 'status-active' : 'status-inactive';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  }

  private updateContext(): void {
    const signalCompany = this.signalsService.getRootSelectedBySidebar()();
    if (signalCompany !== null && signalCompany !== undefined) {
      this.idcompany = Number(signalCompany);
    } else {
      const companyStorage = localStorage.getItem('company');
      if (companyStorage) {
        const parsedCompany = Number(companyStorage);
        if (!Number.isNaN(parsedCompany)) {
          this.idcompany = parsedCompany;
        }
      }
    }

    const signalBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = signalBranch !== null && signalBranch !== undefined ? Number(signalBranch) : 0;
  }

  private hasValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch)) && Number(this.idBranch) > 0;
    return hasCompany && hasBranch;
  }

  canCreateByBranch(): boolean {
    return this.idBranch > 0;
  }

  onSpecialtyChange(): void {
    if (this.formData.specialty !== this.createSpecialtyOption) {
      return;
    }

    this.formData.specialty = '';
    this.newSpecialtyDescription = '';
    this.showSpecialtyModal = true;
  }

  closeSpecialtyModal(): void {
    this.showSpecialtyModal = false;
    this.savingSpecialty = false;
    this.newSpecialtyDescription = '';
  }

  saveNewSpecialty(): void {
    const description = this.newSpecialtyDescription.trim().toUpperCase();

    if (!description) {
      alerts.basicAlert('Dato requerido', 'Debes capturar la descripcion de la especialidad.', 'warning');
      return;
    }

    const duplicate = this.specialties.some(spec => (spec.description || '').trim().toUpperCase() === description);
    if (duplicate) {
      this.formData.specialty = description;
      this.closeSpecialtyModal();
      alerts.basicAlert('Catalogo existente', 'Esa especialidad ya existe y fue seleccionada.', 'info');
      return;
    }

    this.savingSpecialty = true;
    const nextSortOrder = this.specialties.length > 0
      ? Math.max(...this.specialties.map(spec => Number(spec.sortOrder) || 0)) + 1
      : 1;

    const payload = {
      idCompany: this.idcompany,
      type: 'SPECIALTY',
      description,
      valueAddition: '',
      sortOrder: nextSortOrder,
      active: true
    };

    this.catalogService.add(payload).subscribe({
      next: (created) => {
        const newSpecialty = created ?? payload;
        this.specialties = [...this.specialties, newSpecialty].sort((a, b) =>
          (a.description || '').localeCompare(b.description || '')
        );
        this.formData.specialty = newSpecialty.description ?? description;
        this.trackingService.addLog(
          String(this.idcompany),
          `Especialidad creada desde Equipos: ${this.formData.specialty}`,
          'ModMaintenance/Equipos',
          ''
        );
        this.closeSpecialtyModal();
      },
      error: (err) => {
        console.error('Error creating specialty catalog:', err);
        this.savingSpecialty = false;
        alerts.basicAlert('Error', 'No se pudo crear la especialidad.', 'error');
      }
    });
  }
}
