import Swal, { SweetAlertIcon } from 'sweetalert2';

export class alerts{

	/*=============================================
	Función para alerta básica
	=============================================*/

	static basicAlert(title:string, text:string, icon:SweetAlertIcon){

		return Swal.fire(title, text, icon);

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

	/*=============================================
	Función para mostrar loading (no se puede cerrar)
	=============================================*/

	static showLoading(title: string, text: string) {
		Swal.fire({
			title: title,
			text: text,
			allowOutsideClick: false,
			allowEscapeKey: false,
			allowEnterKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});
	}

	/*=============================================
	Función para cerrar el loading
	=============================================*/

	static closeLoading() {
		Swal.close();
	}

	/*=============================================
	Función para mostrar loading con progreso actualizable
	=============================================*/

	static showLoadingWithProgress(title: string, text: string, progress: number = 0) {
		const progressBar = `
			<div style="width: 100%; background-color: #f0f0f0; border-radius: 10px; overflow: hidden; margin-top: 20px;">
				<div style="width: ${progress}%; background-color: #3085d6; height: 30px; border-radius: 10px; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
					${progress}%
				</div>
			</div>
		`;

		Swal.fire({
			title: title,
			html: `${text}<br>${progressBar}`,
			allowOutsideClick: false,
			allowEscapeKey: false,
			allowEnterKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});
	}

	/*=============================================
	Función para actualizar el progreso del loading
	=============================================*/

	static updateLoadingProgress(title: string, text: string, progress: number) {
		const progressBar = `
			<div style="width: 100%; background-color: #f0f0f0; border-radius: 10px; overflow: hidden; margin-top: 20px;">
				<div style="width: ${progress}%; background-color: ${progress >= 100 ? '#28a745' : '#3085d6'}; height: 30px; border-radius: 10px; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
					${progress}%
				</div>
			</div>
		`;

		Swal.update({
			title: title,
			html: `${text}<br>${progressBar}`
		});
	}

	/*=============================================
	Función para mostrar toast notification
	=============================================*/

	static toastAlert(text: string, icon: SweetAlertIcon, timer: number = 3000) {
		const Toast = Swal.mixin({
			toast: true,
			position: 'top-end',
			showConfirmButton: false,
			timer: timer,
			timerProgressBar: true,
			didOpen: (toast) => {
				toast.onmouseenter = Swal.stopTimer;
				toast.onmouseleave = Swal.resumeTimer;
			}
		});

		return Toast.fire({
			icon: icon,
			title: text
		});
	}

}
