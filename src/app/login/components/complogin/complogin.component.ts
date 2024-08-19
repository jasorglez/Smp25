import { Component, OnInit } from '@angular/core';
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

  hide = true;
  emailcapt   : string = '';
  displayName : string = '' ;
  picture     : string = '' ;

  images      : string[] = [
    '../../../assets/img/1.png',
    '../../../assets/img/2.jpg',
    '../../../assets/img/3.jpg',
    '../../../assets/img/4.jpg',
    '../../../assets/img/5.jpg',
    '../../../assets/img/6.png',
    '../../../assets/img/7.jpg',
    '../../../assets/img/8.jpg',
    '../../../assets/img/9.jpg',
    '../../../assets/img/10.jpg',
    '../../../assets/img/11.jpg',
    '../../../assets/img/12.png',
    '../../../assets/img/13.png',
    '../../../assets/img/14.jpg',
    '../../../assets/img/15.png',
    '../../../assets/img/16.jpg',
    '../../../assets/img/17.png',
    '../../../assets/img/18.jpg',
    '../../../assets/img/19.jpg',
    '../../../assets/img/20.jpg',
    '../../../assets/img/21.png',
    '../../../assets/img/22.jpg',
    '../../../assets/img/23.jpg',
    '../../../assets/img/24.jpg',
    '../../../assets/img/25.jpg',
    '../../../assets/img/26.png',
    '../../../assets/img/27.png',
    '../../../assets/img/28.png',
    '../../../assets/img/29.png',
    '../../../assets/img/30.png',
    '../../../assets/img/31.png',
    '../../../assets/img/32.png',
    '../../../assets/img/33.png',
    '../../../assets/img/34.png',
    '../../../assets/img/35.png',
    '../../../assets/img/36.png',
    '../../../assets/img/37.png',
    '../../../assets/img/38.png',
    '../../../assets/img/39.png',
    '../../../assets/img/40.png',
    '../../../assets/img/41.png',
    '../../../assets/img/42.png',
    '../../../assets/img/43.png',
    '../../../assets/img/44.png',
    '../../../assets/img/45.png',
    '../../../assets/img/46.png',
    '../../../assets/img/47.png',
    '../../../assets/img/48.png',
    '../../../assets/img/49.png',
    '../../../assets/img/51.png',
    '../../../assets/img/52.png',
    '../../../assets/img/53.png'
  ];

  randomImage : string = '' ;

	public flogin = this.formBuilder.group({
		emaillogin    : ['', [Validators.required, Validators.email]],
		passwordlogin : ['', Validators.required]
	})

  formSubmitted = false;

  valorcapturado = '' ;

  constructor( private loginService: LoginService,
              private companysService : CompanysService,
              private trackingService : TrackingService,
              private userService: UsersService,
              private auth: AuthService,
              private formBuilder: FormBuilder,
              private router: Router) { }

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
      password: this.flogin.get('passwordlogin')?.value ?? '',
      returnSecureToken: true
    };

    //  Ejecutamos el servicio del Login
     this.trackingService.addLog('', "Inicio del Sistema ", "Origen del Formulario Login", this.emailcapt)

     //console.log(this.emailcapt) ;

    this.loginService.login(data).subscribe(
      (resp)=>{
        this.userService.findEmail(this.emailcapt).subscribe(
          (datauser: any) => {
            if (datauser) {
              //alert('se encontro el dato')
               this.trackingService.setnameUser(datauser.displayName);
               this.trackingService.setpictureUser(datauser.picture);
               this.trackingService.setabranch(datauser.applybranch) ;
               this.trackingService.setaplatform(datauser.applyplatform) ;
               this.trackingService.setaproject(datauser.  applyproject) ;

               this.router.navigate(['/main']) ;
            }
          },
          (error) => {
            console.error('Error al obtener los datos del usuario:', error);
            // Manejo del error
          }
        );

        /*const user = await this.auth.login(this.emailcapt, this.f.controls.passwordlogin.value)
        if (user.user.emailVerified) {
             //aqui lo mandamos al home o en caso contratio a la verificacion del email
        }*/
        //this.router.navigateByUrl("/");

      },

      (err)=>{

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
    );
}


/*=============================================
Validamos formulario
=============================================*/

invalidField(field:string){

return functions.invalidField(field, this.flogin, this.formSubmitted);

}


}
