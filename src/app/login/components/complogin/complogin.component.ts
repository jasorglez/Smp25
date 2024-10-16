import { Component, computed, inject, signal,  OnInit } from '@angular/core';
import { Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Ilogin } from '../../../interface/ilogin';
import { Router, RouterModule } from '@angular/router';

import { alerts } from '../../../helpers/alerts';
import { functions } from '../../../helpers/functions';

import { LoginService } from '../../../services/login.service';
import { TrackingService } from '../../../services/tracking.service';
import { CompanysService } from '../../../services/companys.service';

import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../services/auth.service';
import { UsersService } from '../../../services/users.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-complogin',
  standalone: true,
  templateUrl: './complogin.component.html',
  styleUrls: ['./complogin.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule
  ]

})
export class ComploginComponent implements OnInit {

  //idUser      = computed(()=>  this.signalsService.idUser()) ;

  hide = true;
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  images      : string[] = [
    '../../../assets/img/2.jpg',
    '../../../assets/img/3.jpg',
    '../../../assets/img/4.jpg',
    '../../../assets/img/5.jpg',
    '../../../assets/img/7.jpg',
    '../../../assets/img/8.jpg',
    '../../../assets/img/10.jpg',
    '../../../assets/img/11.jpg',        
    '../../../assets/img/14.jpg',    
    '../../../assets/img/16.jpg',    
    '../../../assets/img/18.jpg',
    '../../../assets/img/19.jpg',
    '../../../assets/img/20.jpg',
    '../../../assets/img/27.png',
    '../../../assets/img/51.png',
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

  formSubmitted = false;

  valorcapturado = '' ;

  constructor( ) { }

  ngOnInit(): void {
    this.randomImage = this.images[Math.floor(Math.random() * this.images.length)];
  }

  toggleHide() {
    this.hide = !this.hide;
  }

  // Función Login
	login(){
    // Validamos que el formulario haya sido enviado
    this.formSubmitted = true;

   // Atrapo la variable para enviarla al servicio
    this.emailcapt = this.flogin.get('emaillogin')?.value ?? '';
    this.trackingService.setEmail(this.emailcapt);

    if (this.flogin.invalid) {
      return;
    }
    //	Capturamos la información del formulario en la interfaz

    const data: Ilogin = {
      email: this.flogin.get('emaillogin')?.value ?? '',
      password: this.flogin.get('passwordlogin')?.value ?? ''
    };

    //  Ejecutamos el servicio del Login
     this.trackingService.addLog('', "Inicio del Sistema ", "Origen del Formulario Login", this.emailcapt)

     //console.log(this.emailcapt) ;

    this.auth.login(data).subscribe({
      next: (resp: any) => {
       // console.log(resp)
        localStorage.setItem('token', resp.data.token)
        this.userService.findEmail(this.emailcapt).subscribe({
          next: (datauser: any) => {
            if (datauser) {
              //console.log(datauser)
              // Defincion de variables globales
               this.trackingService.setnameUser(datauser.displayName);
               this.trackingService.setpictureUser(datauser.picture);
               this.trackingService.setabranch(datauser.applybranch) ;
               this.trackingService.setaplatform(datauser.applyplatform) ;
               this.trackingService.setaproject(datauser.applyproject) ;
               this.trackingService.setId(datauser.id) ;               
               this.signalsService.setidUser(datauser.id);
               this.router.navigate(['/main']) ;
            }
          },
          error: (error) => {
            console.error('Error al obtener los datos del usuario:', error);
            // Manejo del error
          }
        });
      },
      error: (err) => {
        /*=============================================
        Errores al intentar entrar al sistema
        =============================================*/

        if(err.error.error.message == "EMAIL_NOT_FOUND"){
          alerts.basicAlert("Error", 'Invalid email', "error")
        }else if(err.error.error.message == "INVALID_PASSWORD"){
          alerts.basicAlert("Error", 'Invalid password', "error")
        }else{
          alerts.basicAlert("Error", "An error occurred", "error")
        }

      }
    });
}


//Validamos formulario
invalidField(field:string){

return functions.invalidField(field, this.flogin, this.formSubmitted);

}


}