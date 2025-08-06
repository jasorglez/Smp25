import Swal, { SweetAlertIcon } from 'sweetalert2';

export class alerts{

	/*=============================================
	Función para alerta básica
	=============================================*/

	static basicAlert(title:string, text:string, icon:SweetAlertIcon){

		Swal.fire(title, text, icon);

	}

	/*=============================================
	Función para alertas con confirmación
	=============================================*/

	static confirmAlert(title:string, text:string,icon:SweetAlertIcon, confirmButtonText:string){

		return Swal.fire({
			title: title,
			text: text,
			icon: icon,
			showCancelButton: true,
			confirmButtonColor: '#3085d6',
			cancelButtonColor: '#d33',
			confirmButtonText: confirmButtonText
		})

	}

	/*=============================================
	Función para modal de input/textarea
	=============================================*/

	static inputAlert(title: string, text: string, inputType: 'text' | 'textarea', inputValue: string = '', options: any = {}) {
		return Swal.fire({
			title: title,
			text: text,
			input: inputType,
			inputValue: inputValue,
			inputAttributes: options.inputAttributes || {},
			showCancelButton: options.showCancelButton || true,
			confirmButtonText: options.confirmButtonText || 'Guardar',
			cancelButtonText: options.cancelButtonText || 'Cancelar',
			confirmButtonColor: options.confirmButtonColor || '#3085d6',
			cancelButtonColor: options.cancelButtonColor || '#d33',
			inputValidator: (value) => {
				if (!value && options.required !== false) {
					return 'Este campo es requerido';
				}
				return null;
			}
		});
	}

}
