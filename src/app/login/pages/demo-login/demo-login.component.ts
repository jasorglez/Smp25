import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { TrackingService } from '../../../services/tracking.service';
import { SignalsService } from '../../../services/signals.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-demo-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center vh-100"
         style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);">
      <div class="spinner-border text-primary mb-3" style="width:3.5rem;height:3.5rem;"></div>
      <h5 class="text-white mb-1">Cargando demo...</h5>
      <p class="text-white-50 small mb-0">Preparando tu entorno de prueba</p>
    </div>
  `
})
export class DemoLoginComponent implements OnInit {
  private auth           = inject(AuthService);
  private userService    = inject(UsersService);
  private trackingService = inject(TrackingService);
  private signalsService = inject(SignalsService);
  private router         = inject(Router);

  ngOnInit(): void {
    if (localStorage.getItem('mail')) {
      this.navigateHome();
      return;
    }
    this.loginAsDemo();
  }

  private loginAsDemo(): void {
    const { email, password } = environment.demo;

    this.auth.login({ email, password }).subscribe({
      next: (resp: any) => {
        localStorage.setItem('token', resp.data.token);
        this.auth.startSessionTimers();

        this.userService.findEmail(email).subscribe({
          next: (datauser: any) => {
            if (!datauser) { this.router.navigate(['/login']); return; }

            this.trackingService.setnameUser(datauser.displayName);
            this.trackingService.setpictureUser(datauser.picture);
            this.trackingService.setabranch(datauser.applybranch);
            this.trackingService.setaplatform(datauser.applyplatform);
            this.trackingService.setaproject(datauser.applyproject);
            this.trackingService.setId(datauser.id);
            this.signalsService.setidUser(datauser.id);
            this.signalsService.setemailChoose(email);
            this.signalsService.setrootChoose(datauser.userRoot);
            localStorage.setItem('userRoot', datauser.userRoot.toString());
            localStorage.setItem('mail', email);
            this.signalsService.setIsAdvanced(!!datauser.advanced);

            if (datauser.applybranch != null) {
              this.signalsService.setBranchSelectedBySidebar(datauser.applybranch);
            }

            const permObs = !!datauser.advanced && datauser.applybranch
              ? this.auth.fetchUserPermissionsAdvanced(datauser.id, datauser.applybranch)
              : this.auth.fetchUserPermissions(datauser.id);

            permObs.subscribe({
              next: async (permissionsData: any) => {
                if (permissionsData?.permissions) {
                  this.auth.setUserPermissions(permissionsData.permissions);
                }
                this.trackingService.setEmail(email);
                await this.trackingService.startSession(0, datauser.applybranch ?? 0);
                this.navigateHome();
              },
              error: () => this.navigateHome()
            });
          },
          error: () => this.router.navigate(['/login'])
        });
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  private navigateHome(): void {
    const target = this.auth.hasMasterPermission('dashboard') ? '/dashboard' : '/publicidad';
    this.router.navigate([target]);
  }
}
