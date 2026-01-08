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

  //idUser      = computed(()=>  this.signalsService.idUser()) ;

  hide = true;
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  images      : string[] = [
    '../../../assets/img/fondo_circuito.webp'
  ];

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
    
    this.isAdvanced = this.signalsService.getIsAdvanced();
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.randomImage = this.images[Math.floor(Math.random() * this.images.length)];
  }

  toggleHide() {
    this.hide = !this.hide;
  }

  // Función Login
  login() {
    // Validamos que el formulario haya sido enviado
    this.formSubmitted = true;

    // Atrapo la variable para enviarla al servicio
    this.emailcapt = this.flogin.get('emaillogin')?.value ?? '';
    this.trackingService.setEmail(this.emailcapt);

    if (this.flogin.invalid) {
      return;
    }
    // Capturamos la información del formulario en la interfaz
    const data: Ilogin = {
      email: this.flogin.get('emaillogin')?.value ?? '',
      password: this.flogin.get('passwordlogin')?.value ?? ''
    };

    // Ejecutamos el servicio del Login
    //console.log('Datos de Login:', data);
   // console.log('Email capturado:', this.trackingService.getEmail());
    this.trackingService.addLog('', "Inicio del Sistema ", "Origen del Formulario Login", this.emailcapt);

    // Activar spinner
    this.isLoading = true;

    this.auth.login(data).subscribe({
      next: (resp: any) => {
        localStorage.setItem('token', resp.data.token);
        this.userService.findEmail(this.emailcapt).subscribe({
          next: (datauser: any) => {
            if (datauser) {
              // Definición de variables globales
     
              this.trackingService.setnameUser(datauser.displayName);
              this.trackingService.setpictureUser(datauser.picture);
              this.trackingService.setabranch(datauser.applybranch);
              this.trackingService.setaplatform(datauser.applyplatform);
              this.trackingService.setaproject(datauser.applyproject);
              this.trackingService.setId(datauser.id);
              this.signalsService.setidUser(datauser.id);
              //aqui atrapa la signal, y le doy el valor del email
              this.signalsService.setemailChoose(this.emailcapt) ;

               this.signalsService.setrootChoose(datauser.userRoot) ;
               // Guardar userRoot en localStorage para persistir al recargar
               localStorage.setItem('userRoot', datauser.userRoot.toString());

              // Refactorización: Encadenar observables con switchMap
              this.auth.getUserId(this.emailcapt).pipe(
                switchMap(userId => {
                  // Determinar qué llamada de permisos hacer basado en el estado 'advanced' del usuario
                  const isAdvanced = datauser.advanced;
                  // Nota: idBranch no está disponible aquí. Si es necesario, debe obtenerse de 'datauser'
                  // o de una selección previa al login. Asumimos que no es estrictamente necesario para el primer login.
                   
                  const permissions$ = this.isAdvanced
                    ? this.auth.fetchUserPermissionsAdvanced(userId, this.idBranch) // Usar null o un valor por defecto
                    : this.auth.fetchUserPermissions(userId);
                  return permissions$;
                }),
                tap((permissionsData: any) => {
                  this.auth.setUserPermissions(permissionsData.permissions);
                  // El spinner se mantiene hasta que navegue exitosamente
                  this.router.navigate(['/main']);
                })
              ).subscribe({
                error: (permError) => {
                  console.error('Error fetching user permissions:', permError);
                  this.isLoading = false;
                }
              });
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
        // Desactivar spinner en caso de error
        this.isLoading = false;
        alerts.basicAlert("Error", "Los datos de logueo son inválidos", "error");
      }
    });
  }


//Validamos formulario
invalidField(field:string){

return functions.invalidField(field, this.flogin, this.formSubmitted);

}


}
