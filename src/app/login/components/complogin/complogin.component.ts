import { Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Ilogin } from '../../../interface/ilogin';
import { Router, RouterModule } from '@angular/router';

import { alerts } from '../../../helpers/alerts';
import { functions } from '../../../helpers/functions';

import { TrackingService } from '../../../services/tracking.service';

import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { DomainsModule } from 'app/domains/domainsmodule';
import { switchMap } from 'rxjs/operators';
import { environment } from '@env/environment';

@Component({
  selector: 'app-complogin',
  standalone: true,
  templateUrl: './complogin.component.html',
  styleUrls: ['./complogin.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    DomainsModule
  ]
})
export class ComploginComponent implements OnInit {

  environment = environment;

  hide = true;
  emailcapt: string = '';

  private trackingService = inject(TrackingService);
  private userService     = inject(UsersService);
  private auth            = inject(AuthService);
  private formBuilder     = inject(FormBuilder);
  private router          = inject(Router);
  private signalsService  = inject(SignalsService);

  public flogin = this.formBuilder.group({
    emaillogin:    ['', [Validators.required, Validators.email]],
    passwordlogin: ['', Validators.required]
  });

  isAdvanced: boolean = false;
  formSubmitted = false;
  isLoading = false;
  idBranch: number;

  ngOnInit(): void {
    this.isAdvanced = this.signalsService.getIsAdvanced();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    const storedEmail = this.signalsService.getemailChoose();
    if (storedEmail) {
      this.emailcapt = storedEmail;
      const branchAtInit = this.signalsService.getBranchSelectedBySidebar()();
      const isAdv = this.signalsService.getIsAdvanced();
      this.auth.getUserId(this.emailcapt).pipe(
        switchMap(userId => {
          if (isAdv && branchAtInit != null && branchAtInit !== 0) {
            return this.auth.fetchUserPermissionsAdvanced(userId, branchAtInit);
          }
          return this.auth.fetchUserPermissions(userId);
        })
      ).subscribe({
        next: (permissionsData: any) => {
          if (permissionsData && permissionsData.permissions) {
            this.auth.setUserPermissions(permissionsData.permissions);
          }
        },
        error: (err) => {
          console.error('Error fetching permissions on init:', err);
        }
      });
    }
  }

  toggleHide() {
    this.hide = !this.hide;
  }

  login() {
    this.formSubmitted = true;
    this.emailcapt = this.flogin.get('emaillogin')?.value ?? '';
    this.trackingService.setEmail(this.emailcapt);

    if (this.flogin.invalid) return;

    const data: Ilogin = {
      email: this.flogin.get('emaillogin')?.value ?? '',
      password: this.flogin.get('passwordlogin')?.value ?? ''
    };

    this.trackingService.addLog('', 'Inicio del Sistema', 'Origen del Formulario Login', this.emailcapt);
    this.isLoading = true;

    this.auth.login(data).subscribe({
      next: (resp: any) => {
        localStorage.setItem('token', resp.data.token);
        this.auth.startSessionTimers();

        this.userService.findEmail(this.emailcapt).subscribe({
          next: (datauser: any) => {
            if (datauser) {
              this.trackingService.setnameUser(datauser.displayName);
              this.trackingService.setpictureUser(datauser.picture);
              this.trackingService.setabranch(datauser.applybranch);
              this.trackingService.setaplatform(datauser.applyplatform);
              this.trackingService.setaproject(datauser.applyproject);
              this.trackingService.setId(datauser.id);
              this.signalsService.setidUser(datauser.id);
              this.signalsService.setemailChoose(this.emailcapt);
              this.signalsService.setrootChoose(datauser.userRoot);
              localStorage.setItem('userRoot', datauser.userRoot.toString());
              localStorage.setItem('mail', this.emailcapt);
              this.signalsService.setIsAdvanced(!!datauser.advanced);
              if (datauser.applybranch != null) {
                this.signalsService.setBranchSelectedBySidebar(datauser.applybranch);
                this.idBranch = datauser.applybranch;
              }

              const userId = datauser.id;
              const isAdvancedLocal = !!datauser.advanced;
              const branchIdLocal = datauser.applybranch ?? this.idBranch;

              if (isAdvancedLocal && branchIdLocal != null && branchIdLocal !== 0) {
                this.auth.fetchUserPermissionsAdvanced(userId, branchIdLocal).subscribe({
                  next: (permissionsData: any) => {
                    if (permissionsData && permissionsData.permissions) {
                      this.auth.setUserPermissions(permissionsData.permissions);
                    }
                    this.navigateToHomeAfterLogin();
                  },
                  error: () => { this.isLoading = false; }
                });
              } else {
                this.auth.fetchUserPermissions(userId).subscribe({
                  next: (permissionsData: any) => {
                    if (permissionsData && permissionsData.permissions) {
                      this.auth.setUserPermissions(permissionsData.permissions);
                    }
                    this.navigateToHomeAfterLogin();
                  },
                  error: () => { this.isLoading = false; }
                });
              }
            }
          },
          error: () => { this.isLoading = false; }
        });
      },
      error: (err) => {
        console.log(err);
        this.isLoading = false;
        alerts.basicAlert('Error', 'Los datos de logueo son inválidos', 'error');
      }
    });
  }

  invalidField(field: string) {
    return functions.invalidField(field, this.flogin, this.formSubmitted);
  }

  private navigateToHomeAfterLogin(): void {
    this.router.navigate(['/home']);
  }
}
