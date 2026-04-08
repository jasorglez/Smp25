**1. Registro de presupuesto por proyecto**  
El sistema debe permitir registrar el presupuesto inicial de un proyecto (Presupuesto Rev.0).  
El presupuesto deberá capturarse segregado por cuentas y subcuentas.  
Las cuentas principales son:  
- Nómina  
- Viáticos  
- Equipos  
- Indirectos  
- Impuestos  
- Otros gastos  
Cada cuenta podrá tener subcuentas configurables.  
Para cada registro de presupuesto se deberá almacenar:  
- Proyecto  
- Cuenta  
- Subcuenta  
- Monto presupuestado  
- Versión del presupuesto (Rev.0, Rev.1, Rev.2, etc.)  
- Fecha de creación  
**Distribución mensual del presupuesto**  
El sistema debe incluir checkboxes para seleccionar los meses en los que el presupuesto será utilizado, permitiendo asignar el gasto planificado por mes según las necesidades del proyecto.  
   
**2. Validación de presupuesto en el módulo de compras**  
En el módulo de compras, cuando se realice la comparativa de costos entre proveedores, el usuario podrá seleccionar una opción mediante un checkbox.  
*Regla de negocio:*  
Si el monto de la opción seleccionada supera el presupuesto disponible en la cuenta/subcuenta correspondiente, el sistema deberá:  
- Mostrar una alerta de “Presupuesto Superado”  
- Impedir continuar con el proceso o solicitar autorización según configuración del sistema.  
   
**3. ** **Preregistro** ** de gastos en módulo de Administración**  
En el módulo de Administración, se debe crear una funcionalidad llamada "Preregistro de Gasto", Esta funcionalidad permitirá registrar gastos fijos o comprometidos antes de que se ejecuten.  
Datos para registrar:  
- Proyecto  
- Cuenta  
- Subcuenta  
- Concepto del gasto  
- Monto  
- Fecha  
   
*Regla de negocio:*  
Si el monto del pre-registro supera el presupuesto disponible, el sistema deberá:  
- Mostrar una alerta de “Presupuesto Superado”.  
**4. Migración de montos entre cuentas**  
El Administrador del sistema SIAF debe tener la capacidad de migrar montos remanentes entre cuentas o subcuentas del mismo proyecto.  
Condiciones:  
- Solo se pueden transferir montos que estén disponibles (remanentes).  
- La transferencia debe registrar:  
- Cuenta origen  
- Subcuenta origen  
- Cuenta destino  
- Subcuenta destino  
- Monto transferido  
- Usuario que realizó la operación  
- Fecha  
Cada migración deberá generar una actualización de la versión del presupuesto.  
**5. Versionamiento del presupuesto**  
El sistema debe manejar versiones del presupuesto del proyecto.  
Cuando se realice cualquier modificación (migración, incremento o ajuste), el sistema debe:  
- Crear una nueva versión del presupuesto  
- Mostrar los cambios respecto a la versión anterior  
Ejemplo de versiones:  
- Rev.0 → Presupuesto inicial  
- Rev.1 → Ajuste por migración de fondos  
- Rev.2 → Incremento autorizado  
Cada versión debe registrar:  
- Número de revisión  
- Fecha del cambio  
- Usuario responsable  
- Motivo del cambio  
- Montos actualizados  
**6. Solicitud de incremento de presupuesto**  
Cuando se cumplan las siguientes condiciones:  
- El monto de una cuenta o subcuenta se ha agotado  
- No existe saldo disponible en otras cuentas o subcuentas del proyecto  
El sistema deberá:  
1. Enviar una alerta automática por correo electrónico a Dirección General solicitando autorización para incremento de presupuesto.  
2. Registrar la solicitud de incremento.  
3. Una vez autorizado el incremento:  
El sistema deberá:  
- Actualizar el presupuesto del proyecto  
- Generar una nueva versión Rev.n  
Se debe registrar:  
- Fecha del cambio  
- Número de revisión  
- Monto incrementado  
- Usuario que autorizó  
- Actualización de la línea base del presupuesto  
   
**7. Reporte de desempeño del presupuesto**  
El sistema debe generar un reporte de desempeño presupuestal con comparativa:  
- Planeado vs Real  
El reporte deberá incluir indicadores de desempeño presupuestal.  
Los indicadores específicos serán definidos posteriormente por el área financiera (Yaneth).  
Ejemplos de métricas posibles:  
- Presupuesto total  
- Gasto real acumulado  
- Variación presupuestal  
- % de ejecución del presupuesto  
- Desviación por cuenta y subcuenta  
   
