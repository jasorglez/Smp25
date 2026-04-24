# Manejo de Errores de Finkok - Guía de Referencia

## Descripción General

El sistema de timbrado con Finkok incluye un manejo robusto de errores que te permite identificar exactamente dónde está fallando el proceso de facturación electrónica.

## Estructura de Respuestas de Error

### Respuesta Exitosa
```json
{
  "success": true,
  "uuid": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "stampedXml": "<?xml version=\"1.0\"...",
  "fechaTimbrado": "2025-10-06T12:30:45",
  "noCertificadoSat": "00001000000123456789",
  "message": "Factura timbrada exitosamente"
}
```

### Respuesta con Error de Finkok
```json
{
  "success": false,
  "error": "Error 307: Credenciales de Finkok inválidas. Verifica tu usuario y contraseña.",
  "errorCode": "307",
  "errorDetail": "Credenciales de Finkok inválidas. Verifica tu usuario y contraseña.",
  "incidenceId": "INC-12345",
  "errorType": "finkok_error"
}
```

### Respuesta con Error del Sistema
```json
{
  "success": false,
  "error": "Archivo de certificado (.cer) no encontrado. Debes subir el certificado antes de timbrar.",
  "errorType": "system_error",
  "detail": "Error interno del sistema. Contacta a soporte técnico."
}
```

## Códigos de Error Más Comunes

### Errores de Autenticación (3xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **307** | Credenciales inválidas | Verifica usuario y contraseña en `appsettings.json` |
| **402** | Usuario inactivo | Contacta a soporte de Finkok para activar tu cuenta |
| **403** | Usuario suspendido | Contacta a soporte de Finkok |

### Errores de XML/Validación (3xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **301** | XML inválido | Verifica la estructura del CFDI generado |
| **302** | Error de esquema XSD | Revisa campos obligatorios del SAT |
| **303** | Certificado inválido | Verifica archivo .cer |
| **304** | Sello digital inválido | Verifica llave .key y contraseña |
| **305** | Cadena original incorrecta | Error en la firma digital |

### Errores de Certificados (4xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **401** | Certificado expirado | Renueva tu certificado ante el SAT |
| **404** | Certificado revocado | Obtén un nuevo certificado del SAT |
| **405** | Certificado no encontrado | Sube el certificado usando el endpoint `/upload-certificates` |

### Errores de Facturación (7xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **702** | Factura duplicada | Serie y folio ya fueron timbrados |
| **703** | RFC inválido | Verifica RFC de emisor o receptor |
| **704** | Fecha inválida | La fecha no puede ser mayor a la actual ni menor a 72 horas |
| **705** | Total incorrecto | Verifica cálculo de subtotal + impuestos |

### Errores del SAT (6xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **601** | Servicio SAT no disponible | Espera e intenta más tarde |
| **602** | Timeout con el SAT | Reintenta el timbrado |

### Errores de Cuenta (5xx)

| Código | Descripción | Solución |
|--------|-------------|----------|
| **501** | Créditos insuficientes | Recarga créditos en Finkok |
| **502** | Cuenta bloqueada | Contacta a soporte de Finkok |

## Proceso de Timbrado y Puntos de Error

```
1. Validar configuración
   ↓ Error: "Finkok credentials not configured"

2. Generar XML CFDI 4.0
   ↓ Error: "Income/Expense not found" / "Billing configuration not found"

3. Validar certificados
   ↓ Error: "Archivo de certificado (.cer) no encontrado"
   ↓ Error: "Archivo de llave privada (.key) no encontrado"
   ↓ Error: "El certificado ha expirado"

4. Firmar XML
   ↓ Error: "Error al generar el sello digital. Verifica la contraseña"

5. Enviar a Finkok
   ↓ Error: "Error de conexión con Finkok"
   ↓ Error: "Tiempo de espera agotado"

6. Procesar respuesta
   ↓ Error códigos 301-702 (ver tabla arriba)

7. Guardar en BD
   ✓ Éxito
```

## Logs Detallados

El sistema genera logs en diferentes niveles:

### Information
- Inicio del proceso de timbrado
- Certificado cargado exitosamente
- XML firmado correctamente
- Factura timbrada con UUID

### Debug (solo en Development)
- Request SOAP enviado a Finkok
- Response SOAP recibido
- Longitud de la cadena original
- Decodificación del XML timbrado

### Error
- Errores de validación
- Errores de Finkok con código
- Errores de conexión
- Errores inesperados

### Ejemplo de logs:
```
[INF] Starting invoice generation and stamping for income/expense ID: 123
[DBG] Starting XML signing process
[DBG] Loading certificate (.cer)...
[INF] Certificate loaded successfully. Serial: 00001000000123456789, Valid until: 2026-05-15
[DBG] Generating cadena original...
[DBG] Cadena original generated. Length: 1245
[DBG] Generating digital seal...
[DBG] Digital seal generated successfully
[INF] XML signed successfully
[INF] Attempting to stamp invoice with Finkok. Environment: demo, URL: https://demo-facturacion.finkok.com/...
[DBG] Sending SOAP request to Finkok...
[DBG] Finkok response status: 200
[INF] Invoice stamped successfully. UUID: A1B2C3D4-E5F6-7890-ABCD-EF1234567890
```

## Configuración Requerida

### appsettings.json
```json
{
  "Finkok": {
    "Username": "tu-usuario@finkok.com",
    "Password": "tu-password",
    "Environment": "demo",  // o "production"
    "UrlDemo": "https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl",
    "UrlProd": "https://facturacion.finkok.com/servicios/soap/stamp.wsdl"
  }
}
```

### Antes de Timbrar

1. **Configurar credenciales de Finkok** en `appsettings.json`
2. **Subir certificados** (.cer y .key) usando: `POST /api/BillingManagement/upload-certificates/{idRoot}`
3. **Configurar contraseña** de la e.firma en el registro de BillingManagement
4. **Verificar datos del cliente** (RFC, régimen fiscal, código postal, uso CFDI)
5. **Crear conceptos** de la factura con datos correctos

## Testing

### Ambiente Demo de Finkok
- Usa credenciales de prueba
- No requiere certificados reales
- Los timbres NO son válidos ante el SAT
- Ideal para desarrollo y pruebas

### Ambiente Producción
- Requiere cuenta activa de Finkok
- Requiere certificados del SAT vigentes
- Consume créditos reales
- Los timbres son válidos ante el SAT

## Troubleshooting

### Error: "Credenciales de Finkok inválidas"
- Verifica que `appsettings.json` tenga las credenciales correctas
- Confirma que el ambiente (`demo` o `production`) sea el correcto
- Verifica que la cuenta de Finkok esté activa

### Error: "Certificado no encontrado"
- Usa el endpoint `POST /api/BillingManagement/upload-certificates/{idRoot}`
- Verifica que los archivos sean .cer y .key válidos
- Confirma que la contraseña de la e.firma esté configurada

### Error: "El certificado ha expirado"
- Obtén un nuevo certificado del SAT
- Los certificados tienen vigencia de 4 años
- No se puede timbrar con certificados vencidos

### Error: "Serie y folio duplicados"
- Cada factura debe tener un folio único
- El sistema auto-incrementa el consecutivo
- Verifica que no estés reintentando timbrar una factura ya timbrada

### Error: "Timeout"
- Puede ser problema de red o servicio del SAT lento
- Reintenta después de unos segundos
- Si persiste, verifica tu conexión a internet

## Endpoints Disponibles

```
GET  /api/BillingManagement/config/{idRoot}
POST /api/BillingManagement/save
PUT  /api/BillingManagement/update/{idRoot}
POST /api/BillingManagement/upload-certificates/{idRoot}
POST /api/BillingManagement/generate-xml/{idIncomeExpense}
POST /api/BillingManagement/stamp/{idIncomeExpense}  ← Principal para timbrar
```

## Soporte

Para problemas con:
- **Finkok**: Contacta a soporte de Finkok
- **Certificados del SAT**: Acude al SAT o tu proveedor de certificados
- **Sistema**: Revisa los logs detallados en la consola o archivo de logs
