import { Component, computed, inject, signal,  OnInit, ViewEncapsulation } from '@angular/core';
import { Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Ilogin } from '../../../interface/ilogin';
import { Router, RouterModule } from '@angular/router';

import { alerts } from '../../../helpers/alerts';
import { functions } from '../../../helpers/functions';

import { LoginService } from '../../../services/login.service';
import { TrackingService } from '../../../services/tracking.service';
import { CompanysService } from '../../../services/companys.service';

import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { SignalsService } from 'app/services/signals.service';
import { DomainsModule } from 'app/domains/domainsmodule';
import { switchMap, tap } from 'rxjs/operators';
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
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  /** Imágenes de fondo: por defecto asset; si hay imágenes guardadas en SMP Login, se usan esas. */
  images: string[] = [
    '../../../assets/img/login_ver2.webp',
  ];

  private readonly STORAGE_KEY_LOGIN_IMAGES = 'smp_login_images';

  private loginService    = inject(LoginService) ;
  private companysService = inject(CompanysService);
  private trackingService = inject(TrackingService);
  private userService     = inject(UsersService);
  private auth            = inject(AuthService);
  private formBuilder     = inject(FormBuilder);
  private router          = inject(Router);
  private signalsService = inject(SignalsService);

  randomImage : string = '' ;

	public flogin = this.formBuilder.group({
		emaillogin    : ['', [Validators.required, Validators.email]],
		passwordlogin : ['', Validators.required]
	})

  isAdvanced: boolean = false;
  formSubmitted = false;
  isLoading = false;
  idBranch: number;

  valorcapturado = '' ;


  ngOnInit(): void {
    this.loadLoginBackgroundImages();
    this.isAdvanced = this.signalsService.getIsAdvanced();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.randomImage = this.getBackgroundImageForToday();
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

  /** Elige la imagen de fondo: si hay más de una, rota cada 24 h; si hay una, esa. */
  private getBackgroundImageForToday(): string {
    if (this.images.length === 0) return '../../../assets/img/login_ver2.webp';
    if (this.images.length === 1) return this.images[0];
    const msPerDay = 24 * 60 * 60 * 1000;
    const dayIndex = Math.floor(Date.now() / msPerDay);
    const index = dayIndex % this.images.length;
    return this.images[index];
  }

  /** Carga las URLs de imágenes guardadas en SMP → Login; si hay alguna, se usan como fondo. */
  private loadLoginBackgroundImages(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_LOGIN_IMAGES);
      if (!stored) return;
      const data = JSON.parse(stored);
      const list = Array.isArray(data) ? data : [];
      const urls = list.map((item: { url?: string }) => item?.url).filter((u: string) => u);
      if (urls.length > 0) {
        this.images = urls;
      }
    } catch {
      // Si falla el parse, se mantiene la imagen por defecto
    }
  }

  toggleHide() {
    this.hide = !this.hide;
  }

  login() {
    this.formSubmitted = true;
    this.emailcapt = this.flogin.get('emaillogin')?.value ?? '';
    this.trackingService.setEmail(this.emailcapt);

    if (this.flogin.invalid) {
      return;
    }

    const data: Ilogin = {
      email: this.flogin.get('emaillogin')?.value ?? '',
      password: this.flogin.get('passwordlogin')?.value ?? ''
    };

    this.trackingService.addLog('', "Inicio del Sistema", "Origen del Formulario Login", this.emailcapt);
    this.isLoading = true;

    this.auth.login(data).subscribe({
      next: (resp: any) => {
        // ✅ Guardar token e iniciar timers de sesión
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
                    this.router.navigate(['/main']);
                  },
                  error: (permError) => {
                    console.error('Error fetching advanced permissions:', permError);
                    this.isLoading = false;
                  }
                });
              } else {
                this.auth.fetchUserPermissions(userId).subscribe({
                  next: (permissionsData: any) => {
                    if (permissionsData && permissionsData.permissions) {
                      this.auth.setUserPermissions(permissionsData.permissions);
                    }
                    this.router.navigate(['/main']);
                  },
                  error: (permError) => {
                    console.error('Error fetching permissions:', permError);
                    this.isLoading = false;
                  }
                });
              }
            }
          },
          error: (error) => {
            console.error('Error al obtener los datos del usuario:', error);
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.log(err);
        this.isLoading = false;
        alerts.basicAlert("Error", "Los datos de logueo son inválidos", "error");
      }
    });
  }

  invalidField(field:string){
    return functions.invalidField(field, this.flogin, this.formSubmitted);
  }
}