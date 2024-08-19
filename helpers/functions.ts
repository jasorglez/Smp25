import { FormGroup } from  '@angular/forms';
import { alerts } from './alerts';

export class functions{

	/*=============================================
	Función para validar campos del formulario
	=============================================*/

	static invalidField(field:string, f:FormGroup, formSubmitted:boolean):boolean{

		if(formSubmitted && f.controls[field].invalid){

		   	return true;

		}else{

			return false;
		}

	}

	/*=============================================
	Función para determinar tamaños de pantalla
	=============================================*/

	static screenSize(minWidth:number, maxWidth:number):boolean{

		if(window.matchMedia(`(min-width:${minWidth}px) and (max-width:${maxWidth}px)`).matches){

			return true;

		}else{

			return false;
		}

	}

	/*=============================================
	Función para validar la imagen
	=============================================*/

	static validateImage(e:any):any{

		return new Promise(resolve => {

			const image = e.target.files[0];

			/*=============================================
		    Validamos el formato
		    =============================================*/

		    if(image["type"] !== "image/jpeg" && image["type"] !== "image/png"){

		    	alerts.basicAlert('error', 'The image must be in JPG or PNG format', 'error');

		    	return;

		    }

		    /*=============================================
		    Validamos el tamaño
		    =============================================*/

		    else if(image["size"] > 2000000){

		    	alerts.basicAlert('error', 'Image must not weigh more than 2MB', 'error');

		    	return;

		    }

		    /*=============================================
		    Mostramos la imagen temporal
		    =============================================*/

		    else{

		    	let data = new FileReader();
		    	data.readAsDataURL(image);

		    	data.onloadend = () =>{

		    		resolve(data.result);

		    	}

		    }


		})

	}

	/*=============================================
	Crear URL
	=============================================*/

	static createUrl(value:string){

		value = value.toLowerCase();
		value = value.replace(/[ ]/g, "-");
		value = value.replace(/[á]/g, "a");
		value = value.replace(/[é]/g, "e");
		value = value.replace(/[í]/g, "i");
		value = value.replace(/[ó]/g, "o");
		value = value.replace(/[ú]/g, "u");
		value = value.replace(/[ñ]/g, "n");
		value = value.replace(/[,]/g, "");

		return value;

	}


}


