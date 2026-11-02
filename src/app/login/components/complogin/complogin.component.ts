import { Component, inject, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Validators, FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Ilogin } from '../../../interface/ilogin';
import { Router, RouterModule } from '@angular/router';

import { alerts } from '../../../helpers/alerts';
import { functions } from '../../../helpers/functions';

import { LoginService } from '../../../services/login.service';
import { TrackingService } from '../../../services/tracking.service';
import { CompanysService } from '../../../services/companys.service';
import { LoginImageService } from '../../../services/login-image.service';

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
    FormsModule,
    RouterModule,
    DomainsModule
  ]
})
export class ComploginComponent implements OnInit, OnDestroy {

  environment = environment;

  hide = true;
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  /** Imágenes de fondo desde el backend (SMP Login). Si la API falla o no hay imágenes, no se pide asset (evita 404). */
  images: string[] = [];
  currentImageIndex: number = 0;
  private carouselTimer: any = null;

  private loginService    = inject(LoginService) ;
  private loginSetupService = inject(LoginImageService);
  private companysService = inject(CompanysService);
  private trackingService = inject(TrackingService);
  private userService     = inject(UsersService);
  private auth            = inject(AuthService);
  private formBuilder     = inject(FormBuilder);
  private router          = inject(Router);
  private signalsService = inject(SignalsService);

  /** @deprecated reemplazado por currentImageIndex + carrusel */
  randomImage : string = '' ;

	public flogin = this.formBuilder.group({
		emaillogin    : ['', [Validators.required, Validators.email]],
		passwordlogin : ['', Validators.required]
	})

  isAdvanced: boolean = false;
  formSubmitted = false;
  isLoading = false;
  googleCompanyStep = false;
  googleIdToken = '';
  googleEmail = '';
  googleDisplayName = '';
  googleCompanyName = '';
  googleCompanyShortName = '';
  googleCompanyType = '';
  googleBootstrapWarnings: string[] = [];
  idBranch: number;
  carouselDirection: 'forward' | 'reverse' = 'reverse';

  valorcapturado = '' ;
  loginCardPositionClass = 'corner-top-left';


  ngOnInit(): void {
    this.setRandomCardPosition();
    this.loadLoginBackgroundImages();
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

  private setRandomCardPosition(): void {
    const positions = ['corner-top-left', 'corner-top-right', 'corner-bottom-left', 'corner-bottom-right'];
    const randomIndex = Math.floor(Math.random() * positions.length);
    this.loginCardPositionClass = positions[randomIndex];
  }

  /** Determina el índice de inicio y persiste en localStorage según la dirección del carrusel. */
  private getStartingIndex(): number {
    if (this.images.length === 0) return 0;
    const defaultSeed = this.carouselDirection === 'reverse' ? String(this.images.length) : '-1';
    const lastIndex = parseInt(localStorage.getItem('loginImgIndex') ?? defaultSeed, 10);
    const step = this.carouselDirection === 'reverse' ? -1 : 1;
    const nextIndex = (lastIndex + step + this.images.length) % this.images.length;
    localStorage.setItem('loginImgIndex', String(nextIndex));
    return nextIndex;
  }

  /** Inicia el carrusel cíclico cada 6 segundos según la dirección configurada. */
  private startCarousel(): void {
    if (this.carouselTimer) clearInterval(this.carouselTimer);
    if (this.images.length <= 1) return;
    const step = this.carouselDirection === 'reverse' ? -1 : 1;
    this.carouselTimer = setInterval(() => {
      this.currentImageIndex = (this.currentImageIndex + step + this.images.length) % this.images.length;
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.carouselTimer) clearInterval(this.carouselTimer);
  }

  /** Carga las URLs de imágenes desde el backend (SMP → Login); si hay alguna, se usan como fondo. */
  private loadLoginBackgroundImages(): void {
    this.loginSetupService.getLoginImagesPublic().subscribe({
      next: (list) => {
        const urls = (list || [])
          .map((item) => this.loginSetupService.getImageDisplayUrl(item?.url))
          .filter((u: string) => u);
        if (urls.length > 0) {
          this.images = urls;
          this.currentImageIndex = this.getStartingIndex();
          this.startCarousel();
        }
      },
      error: () => {
        // Si falla (ej. API no disponible), se mantiene el fondo oscuro por defecto
      }
    });
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
          next: async (datauser: any) => {
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

              await this.trackingService.startSession(0, this.idBranch ?? 0);

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
                    this.navigateToHomeAfterLogin();
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

  async startGoogleRegistration(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const identity = await this.auth.signInWithGoogle();
      this.googleIdToken = identity.firebaseIdToken;
      this.googleEmail = identity.email;
      this.googleDisplayName = identity.displayName;
      this.auth.startGoogleRegistration(identity.firebaseIdToken).subscribe({
        next: (response: any) => {
          if (response?.status === 'existing' && response?.token) {
            this.finishGoogleLogin(response, identity.email);
            return;
          }
          this.googleCompanyStep = true;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('No se pudo validar la cuenta de Google:', error);
          this.isLoading = false;
          alerts.basicAlert('No se pudo continuar', 'No fue posible validar tu cuenta de Google. Intenta nuevamente.', 'error');
        }
      });
    } catch (error: any) {
      console.error('Error al iniciar con Google:', error);
      this.isLoading = false;
      if (error?.code !== 'auth/popup-closed-by-user') {
        alerts.basicAlert('No se pudo iniciar con Google', 'Intenta nuevamente o usa el acceso con correo y contraseña.', 'error');
      }
    }
  }

  completeGoogleRegistration(): void {
    if (!this.googleCompanyName.trim() || !this.googleCompanyShortName.trim() || !this.googleCompanyType) {
      alerts.basicAlert('Completa los datos', 'Indica el nombre, nombre corto y giro de la empresa.', 'warning');
      return;
    }
    this.isLoading = true;
    this.auth.completeGoogleRegistration({
      firebaseIdToken: this.googleIdToken,
      companyName: this.googleCompanyName.trim(),
      companyShortName: this.googleCompanyShortName.trim(),
      companyType: this.googleCompanyType
    }).subscribe({
      next: (response: any) => {
        if (!response?.token) {
          this.isLoading = false;
          alerts.basicAlert('Registro incompleto', 'El servidor no devolvió una sesión válida.', 'error');
          return;
        }
        if (response.status === 'created_with_warnings') {
          this.googleBootstrapWarnings = response.warnings || [];
          this.isLoading = false;
          return;
        }
        this.googleBootstrapWarnings = [];
        this.finishGoogleLogin(response, this.googleEmail);
      },
      error: (error) => {
        console.error('Error completando el registro con Google:', error);
        this.isLoading = false;
        alerts.basicAlert('No se pudo crear la empresa', error?.error?.message || 'Intenta nuevamente con la misma cuenta de Google.', 'error');
      }
    });
  }

  cancelGoogleRegistration(): void {
    this.googleCompanyStep = false;
    this.googleIdToken = '';
  }

  private finishGoogleLogin(response: any, email: string): void {
    localStorage.setItem('token', response.token);
    this.auth.startSessionTimers();
    this.emailcapt = email;
    this.trackingService.setEmail(email);
    this.userService.findEmail(email).subscribe({
      next: (datauser: any) => {
        if (!datauser?.id) {
          this.isLoading = false;
          alerts.basicAlert('Cuenta lista', 'No se pudo cargar el perfil de usuario. Intenta iniciar sesión nuevamente.', 'warning');
          return;
        }
        this.trackingService.setnameUser(datauser.displayName);
        this.trackingService.setpictureUser(datauser.picture);
        this.trackingService.setabranch(datauser.applybranch);
        this.trackingService.setaplatform(datauser.applyplatform);
        this.trackingService.setaproject(datauser.applyproject);
        this.trackingService.setId(datauser.id);
        this.signalsService.setidUser(datauser.id);
        this.signalsService.setemailChoose(email);
        this.signalsService.setrootChoose(datauser.userRoot);
        localStorage.setItem('userRoot', String(datauser.userRoot ?? 0));
        localStorage.setItem('mail', email);
        this.signalsService.setIsAdvanced(!!datauser.advanced);
        if (datauser.applybranch != null) {
          this.signalsService.setBranchSelectedBySidebar(datauser.applybranch);
          this.idBranch = datauser.applybranch;
        }
        this.trackingService.startSession(0, this.idBranch ?? 0).then(() => {
          const permissions = datauser.advanced && datauser.applybranch
            ? this.auth.fetchUserPermissionsAdvanced(datauser.id, datauser.applybranch)
            : this.auth.fetchUserPermissions(datauser.id);
          permissions.subscribe({
            next: (permissionData: any) => {
              if (permissionData?.permissions) this.auth.setUserPermissions(permissionData.permissions);
              this.navigateToHomeAfterLogin();
            },
            error: (error) => {
              console.error('Error cargando permisos después del acceso con Google:', error);
              this.isLoading = false;
            }
          });
        }).catch((error) => {
          console.error('Error iniciando sesión después del acceso con Google:', error);
          this.isLoading = false;
        });
      },
      error: (error) => {
        console.error('Error obteniendo el usuario después del acceso con Google:', error);
        this.isLoading = false;
      }
    });
  }

  invalidField(field:string){
    return functions.invalidField(field, this.flogin, this.formSubmitted);
  }

  /** Con permiso dashboard → /dashboard; si no, /publicidad (misma lógica que el ítem del sidebar). */
  private navigateToHomeAfterLogin(): void {
    const target = this.auth.hasMasterPermission('dashboard') ? '/dashboard' : '/publicidad';
    this.router.navigate([target]);
  }
}
