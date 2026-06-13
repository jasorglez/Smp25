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

}

/* // Para una operación exitosa
alerts.basicAlert('¡Éxito!', 'Los datos se han guardado correctamente', 'success');

// Para mostrar un error
alerts.basicAlert('Error', 'No se pudo conectar con el servidor', 'error');

// Para una advertencia
alerts.basicAlert('Advertencia', '¿Está seguro de eliminar este registro?', 'warning');

// Para un mensaje informativo
alerts.basicAlert('Información', 'El sistema estará en mantenimiento esta noche', 'info');

// Para una pregunta
alerts.basicAlert('Confirmar', '¿Desea continuar con esta operación?', 'question'); */
