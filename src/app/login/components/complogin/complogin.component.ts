import { Component, inject, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
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
export class ComploginComponent implements OnInit, OnDestroy {

  environment = environment;

  hide = true;
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  /** Imágenes de fondo desde el backend (SMP Login). Si la API falla o no hay imágenes, no se pide asset (evita 404). */
  images: string[] = [];
  currentImageIndex: number = 0;

  private loginService    = inject(LoginService) ;
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
  idBranch: number;
  carouselDirection: 'forward' | 'reverse' = 'reverse';

  valorcapturado = '' ;
  loginCardPositionClass = 'center';


  ngOnInit(): void {
    if (sessionStorage.getItem('idleLogoutNotice') === '1') {
      sessionStorage.removeItem('idleLogoutNotice');
      alerts.userBasicAlert(
        'Sesión cerrada',
        'Por seguridad, la sesión se cerró tras 10 minutos sin actividad.',
        'info'
      );
    } else if (sessionStorage.getItem('sessionExpiredNotice') === '1') {
      sessionStorage.removeItem('sessionExpiredNotice');
      alerts.userBasicAlert(
        'Sesión expirada',
        'Tu sesión expiró. Por favor, inicia sesión nuevamente.',
        'info'
      );
    }
    this.setRandomCardPosition();
    this.loadLoginBackgroundImages();
    this.isAdvanced = this.signalsService.getIsAdvanced();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    const storedEmail = this.signalsService.getemailChoose();
    if (storedEmail) {
      this.emailcapt = storedEmail;
    }
  }

  private setRandomCardPosition(): void {
    this.loginCardPositionClass = 'center';
  }

  ngOnDestroy(): void { }

  /** Fondo estático local — no se usa el API. */
  private loadLoginBackgroundImages(): void {
    this.images = ['/assets/img/fondo_circuito.webp'];
    this.currentImageIndex = 0;
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
              this.router.navigate(['/main']);
            }
          },
          error: (error) => {
            console.error('Error al obtener los datos del usuario:', error);
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0) {
          alerts.basicAlert("Error", "El servidor no está disponible. Por favor, contacta al administrador.", "error");
        } else {
          alerts.basicAlert("Error", "Los datos de logueo son inválidos", "error");
        }
      }
    });
  }

  invalidField(field:string){
    return functions.invalidField(field, this.flogin, this.formSubmitted);
  }
}
