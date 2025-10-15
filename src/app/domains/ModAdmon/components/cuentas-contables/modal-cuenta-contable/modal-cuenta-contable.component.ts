import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { TrackingService } from 'app/services/tracking.service';
import {
  ICuentaContable,
  ICuentaContableTree,
  ICuentaContableForm
} from 'app/interface/icuentas-contables';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-modal-cuenta-contable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-cuenta-contable.component.html',
  styleUrls: ['./modal-cuenta-contable.component.scss']
})
export class ModalCuentaContableComponent implements OnInit {
  public activeModal = inject(NgbActiveModal);
  private cuentasService = inject(CuentasContablesService);
  private trackingService = inject(TrackingService);

  @Input() cuenta?: ICuentaContableTree;
  @Input() parentCuenta?: ICuentaContableTree;
  @Input() nivelPadre?: number;
  @Input() isEdit: boolean = false;
  @Input() idCompany: number = 0;
  @Input() cuentasExistentes: ICuentaContable[] = [];

  formData: ICuentaContableForm = {
    codigo: '',
    nombre: '',
    descripcion: '',
    nivel: 1,
    idPadre: undefined,
    esHoja: false,
    activo: true,
    idCompany: 0
  };

  loading: boolean = false;
  codigoSugerido: string = '';

  ngOnInit(): void {
    if (this.isEdit && this.cuenta) {
      // Modo edición
      this.formData = {
        id: this.cuenta.id,
        codigo: this.cuenta.codigo,
        nombre: this.cuenta.nombre,
        descripcion: this.cuenta.descripcion || '',
        nivel: this.cuenta.nivel,
        idPadre: this.cuenta.idPadre,
        esHoja: this.cuenta.esHoja,
        activo: this.cuenta.activo,
        idCompany: this.cuenta.idCompany
      };
    } else if (this.parentCuenta) {
      // Modo creación con padre
      this.formData.nivel = this.parentCuenta.nivel + 1;
      this.formData.idPadre = this.parentCuenta.id;
      this.formData.idCompany = this.idCompany;
      this.formData.esHoja = this.formData.nivel === 3; // Nivel 3 siempre es hoja
      this.generarCodigoSugerido();
    } else {
      // Modo creación nivel 1
      this.formData.nivel = 1;
      this.formData.idCompany = this.idCompany;
      this.formData.esHoja = false;
      this.generarCodigoSugerido();
    }
  }

  generarCodigoSugerido(): void {
    if (this.isEdit) return;

    let prefijo = '';
    let siguienteNumero = 1;

    if (this.parentCuenta) {
      // Obtener el código del padre
      prefijo = this.parentCuenta.codigo;

      // Buscar las cuentas hijas del mismo padre
      const hermanos = this.cuentasExistentes.filter(
        c => c.idPadre === this.parentCuenta!.id && c.nivel === this.formData.nivel
      );

      if (hermanos.length > 0) {
        // Encontrar el último número usado
        const numeros = hermanos
          .map(h => {
            const partes = h.codigo.replace(prefijo, '');
            return parseInt(partes) || 0;
          })
          .filter(n => !isNaN(n));

        if (numeros.length > 0) {
          siguienteNumero = Math.max(...numeros) + 1;
        }
      }

      // Generar código sugerido
      if (this.formData.nivel === 2) {
        this.codigoSugerido = `${prefijo}${siguienteNumero.toString().padStart(2, '0')}`;
      } else if (this.formData.nivel === 3) {
        this.codigoSugerido = `${prefijo}${siguienteNumero.toString().padStart(2, '0')}`;
      }
    } else {
      // Nivel 1: buscar el siguiente código disponible
      const nivel1 = this.cuentasExistentes.filter(c => c.nivel === 1);

      if (nivel1.length > 0) {
        const codigos = nivel1
          .map(c => parseInt(c.codigo))
          .filter(n => !isNaN(n))
          .sort((a, b) => a - b);

        if (codigos.length > 0) {
          siguienteNumero = codigos[codigos.length - 1] + 1000;
        }
      } else {
        siguienteNumero = 4000; // Primer código para ingresos o 5000 para egresos
      }

      this.codigoSugerido = siguienteNumero.toString();
    }

    this.formData.codigo = this.codigoSugerido;
  }

  usarCodigoSugerido(): void {
    this.formData.codigo = this.codigoSugerido;
  }

  validarFormulario(): string[] {
    const errores: string[] = [];

    if (!this.formData.codigo || this.formData.codigo.trim() === '') {
      errores.push('El código es obligatorio');
    }

    if (!this.formData.nombre || this.formData.nombre.trim() === '') {
      errores.push('El nombre es obligatorio');
    }

    // Validar código único (excepto en edición de la misma cuenta)
    const codigoExiste = this.cuentasExistentes.some(
      c => c.codigo === this.formData.codigo && (!this.isEdit || c.id !== this.formData.id)
    );

    if (codigoExiste) {
      errores.push('El código ya existe. Debe ser único.');
    }

    // Validar que el código tenga formato correcto según el nivel
    if (this.formData.nivel === 2 && this.parentCuenta) {
      if (!this.formData.codigo.startsWith(this.parentCuenta.codigo)) {
        errores.push(`El código debe comenzar con ${this.parentCuenta.codigo}`);
      }
    } else if (this.formData.nivel === 3 && this.parentCuenta) {
      if (!this.formData.codigo.startsWith(this.parentCuenta.codigo)) {
        errores.push(`El código debe comenzar con ${this.parentCuenta.codigo}`);
      }
    }

    return errores;
  }

  async guardar(): Promise<void> {
    const errores = this.validarFormulario();

    if (errores.length > 0) {
      alerts.basicAlert('Validación', errores.join('<br>'), 'warning');
      return;
    }

    this.loading = true;

    const accion = this.isEdit ? 'Actualizar' : 'Crear';
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `${accion} cuenta ${this.formData.codigo}`,
      'Menu Administración - Cuentas Contables',
      this.trackingService.getEmail()
    );

    if (this.isEdit && this.formData.id) {
      // Actualizar
      this.cuentasService.update(this.formData.id, this.formData).subscribe({
        next: () => {
          alerts.basicAlert('Actualizado', 'La cuenta ha sido actualizada correctamente', 'success');
          this.activeModal.close(true);
        },
        error: (error) => {
          console.error('Error updating cuenta:', error);
          alerts.basicAlert('Error', 'No se pudo actualizar la cuenta', 'error');
          this.loading = false;
        }
      });
    } else {
      // Crear
      this.cuentasService.create(this.formData).subscribe({
        next: () => {
          alerts.basicAlert('Creado', 'La cuenta ha sido creada correctamente', 'success');
          this.activeModal.close(true);
        },
        error: (error) => {
          console.error('Error creating cuenta:', error);
          alerts.basicAlert('Error', 'No se pudo crear la cuenta', 'error');
          this.loading = false;
        }
      });
    }
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }

  get tituloModal(): string {
    if (this.isEdit) {
      return `Editar Cuenta - Nivel ${this.formData.nivel}`;
    } else if (this.parentCuenta) {
      return `Nueva Cuenta - Nivel ${this.formData.nivel} (Subcuenta de ${this.parentCuenta.codigo})`;
    } else {
      return 'Nueva Cuenta - Nivel 1';
    }
  }

  get nivelBadgeClass(): string {
    switch (this.formData.nivel) {
      case 1: return 'bg-primary';
      case 2: return 'bg-info';
      case 3: return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  get nivelDescripcion(): string {
    switch (this.formData.nivel) {
      case 1: return 'Cuenta Mayor (Raíz)';
      case 2: return 'Subcuenta';
      case 3: return 'Cuenta Detalle (Hoja - Recibe movimientos)';
      default: return '';
    }
  }
}
