import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TeamService } from 'app/services/team.service';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.scss'
})
export class EquiposComponent implements OnInit {

  private teamService = inject(TeamService);
  private employeesService = inject(EmployeesService);
  private signalsService = inject(SignalsService);

  idcompany: number = 0;
  idBranch: number = 0;
  teams: any[] = [];
  employees: any[] = [];
  loading: boolean = false;

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

  specialties: string[] = [
    'Electricidad',
    'Mecanica',
    'Hidraulica',
    'Neumatica',
    'Soldadura',
    'Pintura',
    'General'
  ];

  constructor() {
    effect(() => {
      this.updateContext();
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.loadData();
  }

  loadData(): void {
    if (!this.hasValidContext()) {
      this.loading = false;
      this.teams = [];
      this.employees = [];
      return;
    }

    this.loading = true;
    const idCompanyStr = this.idcompany.toString();

    forkJoin({
      teams: this.teamService.getAll(idCompanyStr),
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
            this.teams = teamsRaw.map((team: any, i: number) => ({
              ...team,
              leaderName: this.getEmployeeName(team.leader),
              members: (membersArrays[i] || []).map((m: any) => ({
                ...m,
                employeeName: this.getEmployeeName(m.idEmployee)
              }))
            }));
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

  updateAvailableMembers(): void {
    const leaderId = this.formData.leader;
    this.availableMembersList = this.employees.filter((e: any) => e.id !== leaderId);
  }

  onLeaderChange(): void {
    this.updateAvailableMembers();
  }

  openCreateForm(): void {
    this.isEditing = false;
    this.editingTeamId = null;
    this.formData = {
      name: '',
      leader: null,
      specialty: '',
      status: 'Activo',
      memberIds: []
    };
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
  }

  handleSubmit(): void {
    if (!this.formData.name || !this.formData.specialty) return;

    const teamData: any = {
      idCompany: this.idcompany.toString(),
      name: this.formData.name,
      leader: this.formData.leader || null,
      specialty: this.formData.specialty,
      status: this.formData.status,
      active: true
    };

    if (this.isEditing && this.editingTeamId) {
      this.teamService.update(this.editingTeamId, teamData).subscribe({
        next: () => this.syncMembers(this.editingTeamId!),
        error: (err) => console.error('Error updating team:', err)
      });
    } else {
      this.teamService.add(teamData).subscribe({
        next: (created: any) => this.syncMembers(created.id),
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
      next: () => this.loadData(),
      error: (err) => console.error('Error deleting team:', err)
    });
  }

  getStatusClass(status: string): string {
    return status === 'Activo' ? 'status-active' : 'status-inactive';
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
    if (signalBranch !== null && signalBranch !== undefined) {
      this.idBranch = Number(signalBranch);
    } else {
      const branchStorage = localStorage.getItem('branch');
      if (branchStorage) {
        const parsedBranch = Number(branchStorage);
        if (!Number.isNaN(parsedBranch)) {
          this.idBranch = parsedBranch;
        }
      }
    }
  }

  private hasValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch));
    return hasCompany && hasBranch;
  }
}
