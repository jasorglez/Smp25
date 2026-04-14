import Swal, { SweetAlertIcon } from 'sweetalert2';

// Z-index por encima de cualquier modal (el modal usa 99999)
const SWAL_Z_INDEX = 999999;

export class alerts{

	/*=============================================
	Función para alerta básica
	=============================================*/

	static basicAlert(title:string, text:string, icon:SweetAlertIcon){

		return Swal.fire({
			title,
			text,
			icon,
			customClass: { container: 'swal-over-modal' }
		});

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
			confirmButtonText: confirmButtonText,
			customClass: { container: 'swal-over-modal' }
		})

	}

	/*=============================================
	Función para modal de input/textarea
	=============================================*/

	static inputAlert(title: string, text: string, inputType: 'text' | 'textarea', inputValue: string = '', options: any = {}) {
		const swalOptions = options.swalOptions || {};
		return Swal.fire({
			title: title,
			text: text,
			input: inputType,
			inputValue: inputValue,
			inputAttributes: options.inputAttributes || {},
			showCancelButton: options.showCancelButton ?? true,
			confirmButtonText: options.confirmButtonText || 'Guardar',
			cancelButtonText: options.cancelButtonText || 'Cancelar',
			confirmButtonColor: options.confirmButtonColor || '#3085d6',
			cancelButtonColor: options.cancelButtonColor || '#d33',
			inputValidator: (value) => {
				if (!value && options.required !== false) {
					return 'Este campo es requerido';
				}
				return null;
			},
			customClass: { container: 'swal-over-modal' },
			...swalOptions
		});
	}

	/*=============================================
	Función para modal de texto largo (fullscreen)
	=============================================*/

	static largeTextAlert(title: string, text: string, inputValue: string = '', options: any = {}) {
		const id = options.id || 'swal-large-text';
		const swalOptions = options.swalOptions || {};
		const maxLength = options.maxLength ? `maxlength="${options.maxLength}"` : '';
		const placeholder = options.placeholder ? `placeholder="${options.placeholder}"` : '';
		const rows = options.rows || 16;
		const safeValue = String(inputValue ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		return Swal.fire({
			title,
			text,
			html: `
				<textarea id="${id}" class="swal2-textarea"
					${maxLength}
					rows="${rows}"
					style="min-height: 70vh; width: 100%; font-family: inherit; font-size: 14px; line-height: 1.4; white-space: pre-wrap; resize: vertical;"
					wrap="soft" spellcheck="true" ${placeholder}>${safeValue}</textarea>
			`,
			showCancelButton: options.showCancelButton ?? true,
			confirmButtonText: options.confirmButtonText || 'Guardar',
			cancelButtonText: options.cancelButtonText || 'Cancelar',
			confirmButtonColor: options.confirmButtonColor || '#3085d6',
			cancelButtonColor: options.cancelButtonColor || '#d33',
			focusConfirm: false,
			customClass: { container: 'swal-over-modal' },
			preConfirm: () => {
				const el = document.getElementById(id) as HTMLTextAreaElement | null;
				const value = el ? el.value : '';
				if (!value && options.required !== false) {
					Swal.showValidationMessage('Este campo es requerido');
					return null;
				}
				return value;
			},
			willOpen: () => {
				const active = document.activeElement as HTMLElement | null;
				if (active && typeof active.blur === 'function') active.blur();
			},
			didOpen: () => {
				const el = document.getElementById(id) as HTMLTextAreaElement | null;
				if (el) {
					el.focus();
					el.selectionStart = el.value.length;
					el.selectionEnd = el.value.length;
				}
			},
			...swalOptions
		});
	}

	/*=============================================
	Toast: aparece y desaparece solo (sin botón OK)
	=============================================*/

	static toastAlert(title: string, icon: SweetAlertIcon, timer: number = 2500) {
		return Swal.mixin({
			toast: true,
			position: 'top-end',
			showConfirmButton: false,
			timer,
			timerProgressBar: true,
			customClass: { container: 'swal-over-modal' },
		}).fire({ title, icon });
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
			customClass: { container: 'swal-over-modal' },
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
			customClass: { container: 'swal-over-modal' },
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

}