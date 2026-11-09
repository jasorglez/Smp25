# Permisos de módulos por empresa y usuario

Los módulos disponibles para un usuario se configuran por **empresa + usuario**. Cambiar de sucursal no cambia esos permisos. Las asignaciones de sucursales siguen delimitando las sucursales con las que puede trabajar.

En Usuarios, el detalle anidado de una empresa y la pestaña Permisos maestros consultan y guardan la misma configuración. La pestaña utiliza la empresa seleccionada en el sidebar y guarda cada cambio; el detalle anidado utiliza la empresa de su fila y requiere pulsar Guardar. Su contador se actualiza al cargar y guardar.

El inicio de sesión, la validación de rutas y el dashboard consultan los permisos de empresa y usuario. Al cambiar de empresa se descartan las respuestas atrasadas de la selección anterior. La selección de sucursal y el indicador de configuración avanzada ya no seleccionan los permisos de módulos.

## Compatibilidad con producción

- Una configuración explícita de empresa y usuario tiene prioridad, incluso cuando todos sus permisos estén desactivados. Los registros inactivos conservan esa elección para evitar volver a heredar permisos.
- Mientras una empresa no tenga configuración propia para ese usuario, se conservan las asignaciones globales anteriores.
- Para cuentas antiguas que solo tenían asignaciones avanzadas, se recuperan los accesos existentes de las sucursales asignadas que pertenecen a esa empresa. Es una lectura de compatibilidad: no recibe una sucursal seleccionada, no copia permisos a otras empresas ni modifica los registros antiguos. Deja de intervenir cuando se guarda una configuración explícita de empresa y usuario.
- Se conserva la interpretación anterior de los catálogos heredados. Este cambio no depura ni modifica permisos reales, usuarios, asignaciones de sucursales o esquemas de base de datos.

## Validación y publicación del código

Se compilaron Angular en producción y el backend Security. Las pruebas con tablas temporales verificaron las asignaciones, la revocación completa, reactivación, compatibilidad y aislamiento. Las pruebas del frontend verificaron empresa y usuario, guardado, respuestas atrasadas y ausencia de selección de módulos por sucursal.

Una comprobación de solo lectura de la base configurada revisó cinco configuraciones por empresa, cinco casos globales y las tres cuentas activas que dependían únicamente del esquema avanzado anterior. No ejecutó guardados de permisos reales.

Publicar primero **MicroservicioSecurity** y después el frontend. La consulta de autorización debe recibir `companyId`. La compilación y las pruebas no confirman por sí mismas el despliegue ni sustituyen la revisión visual de una sesión publicada.
