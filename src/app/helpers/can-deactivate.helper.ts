import { alerts } from './alerts';

export function confirmExitIfUnsaved(
  hasUnsavedChanges: boolean
): Promise<boolean> {
  if (!hasUnsavedChanges) {
    return Promise.resolve(true);
  }

  return alerts
    .confirmAlert(
      'Cambios sin guardar',
      'Tienes cambios sin guardar. ¿Deseas salir sin guardar?',
      'warning',
      'Sí, salir'
    )
    .then((result) => result.isConfirmed);
}
