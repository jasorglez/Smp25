# Sistema Completo de Facturación Electrónica CFDI 4.0

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura](#arquitectura)
3. [Funcionalidades Implementadas](#funcionalidades-implementadas)
4. [Endpoints API](#endpoints-api)
5. [Configuración](#configuración)
6. [Paquetes Opcionales](#paquetes-opcionales)
7. [Guía de Uso](#guía-de-uso)
8. [Troubleshooting](#troubleshooting)

---

## Resumen Ejecutivo

Sistema completo de facturación electrónica que cumple con el estándar CFDI 4.0 del SAT, integrado con Finkok como PAC autorizado.

### ✅ Características Principales

- ✅ **Generación de XML CFDI 4.0**
- ✅ **Firma digital** con certificados del SAT
- ✅ **Cadena original** usando XSLT oficial del SAT
- ✅ **Timbrado con Finkok** (demo y producción)
- ✅ **Validación con SAT** directa
- ✅ **Cancelación de CFDIs** con motivos
- ✅ **Generación de PDF** con link de verificación
- ✅ **Manejo robusto de errores** con códigos específicos
- ✅ **Logging detallado** de todo el proceso
- ✅ **Tests unitarios** incluidos

---

## Arquitectura

### Servicios Implementados

```
Services/Fact/
├── InvoiceXmlService.cs              # Genera XML CFDI 4.0
├── CadenaOriginalService.cs          # Cadena original (XSLT + Manual)
├── CfdiCancellationService.cs        # Cancelación con Finkok
├── SatValidationService.cs           # Validación directa con SAT
└── InvoicePdfService.cs              # Generación de PDF/HTML
```

### Modelos

```
Models/Fact/
├── FinkokResponse.cs                 # Respuestas de Finkok
├── FinkokStampException.cs           # Excepciones específicas
└── UploadCertificatesRequest.cs      # Upload de .cer y .key
```

### Controlador

```
Controllers/
└── BillingManagementController.cs    # 8 endpoints disponibles
```

---

## Funcionalidades Implementadas

### 1️⃣ Generación de XML CFDI 4.0

**Archivo:** `InvoiceXmlService.cs`

Genera XML completo según especificación SAT:
- ✅ Comprobante con todos los atributos requeridos
- ✅ Emisor con datos fiscales
- ✅ Receptor con régimen fiscal y uso CFDI
- ✅ Conceptos con impuestos
- ✅ Impuestos totales (traslados y retenciones)
- ✅ Validación de datos obligatorios

**Endpoint:** `POST /api/BillingManagement/generate-xml/{idIncomeExpense}`

### 2️⃣ Cadena Original con XSLT del SAT

**Archivo:** `CadenaOriginalService.cs`

Dos métodos disponibles:
- ✅ **XSLT oficial del SAT** (recomendado) - Descarga automática
- ✅ **Método manual** - Fallback sin internet
- ✅ Soporta todos los elementos CFDI 4.0
- ✅ Orden exacto según especificación

**Configuración:**
```json
{
  "Finkok": {
    "UseXsltForCadenaOriginal": true  // true = XSLT, false = manual
  }
}
```

### 3️⃣ Firma Digital

**Archivo:** `BillingManagementService.cs` (método `SignXml`)

- ✅ Carga certificados .cer y .key desde BD
- ✅ Valida vigencia del certificado
- ✅ Genera sello digital con RSA-SHA256
- ✅ Mensajes de error específicos
- ✅ Validación de contraseña de e.firma

**Endpoint para subir certificados:**
`POST /api/BillingManagement/upload-certificates/{idRoot}`

### 4️⃣ Timbrado con Finkok

**Archivo:** `BillingManagementService.cs` (método `GenerateAndStampInvoice`)

- ✅ Integración completa con Finkok (SOAP)
- ✅ Ambientes demo y producción
- ✅ Manejo de errores con códigos específicos
- ✅ Parseo robusto de respuesta XML
- ✅ Extracción de UUID y timbre fiscal
- ✅ Actualización automática en BD

**Endpoint:** `POST /api/BillingManagement/stamp/{idIncomeExpense}`

**Códigos de error soportados:**
- 307: Credenciales inválidas
- 301-305: Errores de XML/firma
- 401-405: Errores de certificados
- 702-705: Errores de facturación
- 601-602: Errores del SAT
- 501-502: Errores de cuenta

### 5️⃣ Validación con SAT

**Archivo:** `SatValidationService.cs`

- ✅ Consulta directa al SAT (sin PAC)
- ✅ Valida UUID, RFC, total
- ✅ Verifica si es cancelable
- ✅ Estado actual (Vigente/Cancelado)
- ✅ Validación EFOS

**Endpoint:** `POST /api/BillingManagement/validate-sat/{idIncomeExpense}`

**Respuesta:**
```json
{
  "success": true,
  "isValid": true,
  "codigoEstatus": "S",
  "estado": "Vigente",
  "esCancelable": true,
  "message": "CFDI válido y vigente ante el SAT"
}
```

### 6️⃣ Cancelación de CFDIs

**Archivo:** `CfdiCancellationService.cs`

- ✅ Cancelación con Finkok
- ✅ Motivos según catálogo SAT (01-04)
- ✅ Folio de sustitución (cuando aplica)
- ✅ Acuse de recibo
- ✅ Actualización en BD

**Endpoint:** `POST /api/BillingManagement/cancel/{idIncomeExpense}`

**Request body:**
```json
{
  "motivoCancelacion": "02",
  "folioSustitucion": "uuid-de-factura-sustituta"
}
```

**Motivos de cancelación:**
- `01`: Con relación
- `02`: Sin relación (más común)
- `03`: No se llevó a cabo
- `04`: Operación nominativa en factura global

### 7️⃣ Generación de PDF

**Archivo:** `InvoicePdfService.cs`

- ✅ HTML profesional con estilos
- ✅ Datos del emisor y receptor
- ✅ Tabla de conceptos
- ✅ Totales desglosados
- ✅ Link de verificación SAT
- ✅ Información del timbre fiscal
- ✅ Sello digital del SAT y CFDI

**Endpoint:** `GET /api/BillingManagement/pdf/{idIncomeExpense}`

**Nota:** Por ahora genera HTML. Para PDF real, instala una de estas librerías:
- `SelectPdf` (comercial)
- `IronPDF` (comercial)
- `DinkToPdf` (gratis, wrapper de wkhtmltopdf)
- `PuppeteerSharp` (gratis, usa headless Chrome)

**Para QR Code como imagen, instala:**
```bash
dotnet add package QRCoder
```

### 8️⃣ Manejo de Errores

**Archivo:** `FinkokResponse.cs`, `FinkokStampException.cs`

- ✅ 30+ códigos de error mapeados
- ✅ Mensajes en español
- ✅ Detección de SOAP Faults
- ✅ Parsing robusto de errores de Finkok
- ✅ Logging detallado

---

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/BillingManagement/config/{idRoot}` | Obtiene configuración de facturación |
| POST | `/api/BillingManagement/save` | Guarda nueva configuración |
| PUT | `/api/BillingManagement/update/{idRoot}` | Actualiza configuración |
| POST | `/api/BillingManagement/upload-certificates/{idRoot}` | Sube certificados .cer y .key |
| POST | `/api/BillingManagement/generate-xml/{id}` | Genera XML sin timbrar |
| **POST** | **`/api/BillingManagement/stamp/{id}`** | **Timbra factura (principal)** |
| POST | `/api/BillingManagement/cancel/{id}` | Cancela CFDI timbrado |
| POST | `/api/BillingManagement/validate-sat/{id}` | Valida con SAT |
| GET | `/api/BillingManagement/pdf/{id}` | Genera PDF de factura |

---

## Configuración

### appsettings.json

```json
{
  "ConnectionStrings": {
    "dbTracking": "Server=...;Database=...;..."
  },
  "Jwt": {
    "Key": "tu-clave-secreta"
  },
  "Finkok": {
    "Username": "usuario@finkok.com",
    "Password": "password",
    "Environment": "demo",                    // "demo" o "production"
    "UrlDemo": "https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl",
    "UrlProd": "https://facturacion.finkok.com/servicios/soap/stamp.wsdl",
    "CancelUrlDemo": "https://demo-facturacion.finkok.com/servicios/soap/cancel.wsdl",
    "CancelUrlProd": "https://facturacion.finkok.com/servicios/soap/cancel.wsdl",
    "UseXsltForCadenaOriginal": true          // true = XSLT SAT, false = manual
  }
}
```

### Base de Datos

Campos necesarios en `BillingManagement`:
- `EmisorRfc`, `EmisorNombre`, `EmisorCp`
- `FiscalRegime` (código de régimen fiscal)
- `Prefix` (serie de facturas)
- `Consecutive` (folio consecutivo, auto-incrementa)
- `IIva`, `IIeps`, `II3`, `RIva`, `RIeps` (tasas de impuestos)
- `CerFileContent` (archivo .cer en byte[])
- `KeyFileContent` (archivo .key en byte[])
- `EfirmaPass` (contraseña del certificado)

Campos necesarios en `Incomeandexpenses`:
- `Uuid`, `XmlTimbrado`, `FechaCertificacion`
- `Facturado`, `Cancelado`
- `Serie`, `Folio`
- `RfcReceptor`, `Subtotal`, `Tax`, `Total`

---

## Paquetes Opcionales

### Para Producción Completa

```bash
# QR Code como imagen
dotnet add package QRCoder

# PDF real (elige uno):
dotnet add package SelectPdf                # Comercial
dotnet add package IronPdf                  # Comercial
dotnet add package DinkToPdf                # Gratis
dotnet add package PuppeteerSharp           # Gratis
```

### Para Tests

```bash
cd ../Tracking.Tests
dotnet add package Moq
dotnet add package FluentAssertions
dotnet add package Microsoft.EntityFrameworkCore.InMemory
```

---

## Guía de Uso

### Flujo Completo de Facturación

```
1. Configurar Finkok
   ├─ Agregar credenciales en appsettings.json
   └─ Elegir ambiente (demo/production)

2. Subir Certificados SAT
   ├─ POST /api/BillingManagement/upload-certificates/{idRoot}
   ├─ Subir archivo .cer
   ├─ Subir archivo .key
   └─ Configurar contraseña de e.firma en BD

3. Crear Factura
   ├─ Crear registro en Incomeandexpenses
   ├─ Agregar conceptos en ConceptsxIncorExp
   └─ Asociar cliente con CustomersBilling

4. Timbrar
   ├─ POST /api/BillingManagement/stamp/{id}
   ├─ Sistema genera XML
   ├─ Firma digitalmente
   ├─ Envía a Finkok
   └─ Guarda UUID y XML timbrado

5. Generar PDF (opcional)
   └─ GET /api/BillingManagement/pdf/{id}

6. Validar con SAT (opcional)
   └─ POST /api/BillingManagement/validate-sat/{id}

7. Cancelar (si es necesario)
   └─ POST /api/BillingManagement/cancel/{id}
```

### Ejemplo: Timbrar Factura

**Request:**
```http
POST /api/BillingManagement/stamp/123
Authorization: Bearer {token}
```

**Response exitosa:**
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

**Response con error:**
```json
{
  "success": false,
  "error": "Error 307: Credenciales de Finkok inválidas. Verifica tu usuario y contraseña.",
  "errorCode": "307",
  "errorDetail": "Credenciales de Finkok inválidas. Verifica tu usuario y contraseña.",
  "errorType": "finkok_error"
}
```

---

## Troubleshooting

### Error: "Credenciales de Finkok inválidas"
✅ Verifica usuario y contraseña en `appsettings.json`
✅ Confirma que el ambiente sea correcto (`demo` o `production`)
✅ Verifica que la cuenta de Finkok esté activa

### Error: "Certificado no encontrado"
✅ Sube certificados usando `/upload-certificates`
✅ Verifica que los archivos sean .cer y .key válidos
✅ Confirma la contraseña de la e.firma en BD

### Error: "El certificado ha expirado"
✅ Los certificados del SAT tienen vigencia de 4 años
✅ Renueva tu certificado ante el SAT
✅ Sube el nuevo certificado

### Error 304/305: "Sello digital inválido"
✅ Verifica que .cer y .key correspondan al mismo certificado
✅ Confirma la contraseña de la e.firma
✅ Usa `UseXsltForCadenaOriginal: true` para cadena original correcta

### Error: "Error al descargar el XSLT del SAT"
✅ Sistema usa fallback manual automáticamente
✅ Verifica conexión a internet
✅ O configura `UseXsltForCadenaOriginal: false`

---

## Documentación Adicional

- [`FINKOK_ERROR_HANDLING.md`](./FINKOK_ERROR_HANDLING.md) - Códigos de error detallados
- [`XSLT_CADENA_ORIGINAL.md`](./XSLT_CADENA_ORIGINAL.md) - Explicación del XSLT
- [`Tracking.Tests/README.md`](../Tracking.Tests/README.md) - Guía de tests

---

## Seguridad

- ✅ Autenticación JWT en todos los endpoints
- ✅ Certificados almacenados en BD (byte[])
- ✅ Contraseña de e.firma en BD (considera encriptación)
- ✅ Validación de archivos subidos (.cer, .key máx 5MB)
- ✅ Logs no exponen datos sensibles

---

## Performance

- ✅ XSLT compilado en caché (primera vez se descarga)
- ✅ HttpClient reutilizable con IHttpClientFactory
- ✅ Queries optimizados con EF Core
- ✅ Logging con niveles (Debug solo en Development)

---

## Mantenimiento

### Actualización de XSLT del SAT
Si el SAT actualiza el XSLT:
- Con `UseXsltForCadenaOriginal: true` → ✅ Automático
- Con `UseXsltForCadenaOriginal: false` → ⚠️ Actualizar `CadenaOriginalService.cs`

### Renovación de Certificados
1. Obtener nuevo certificado del SAT
2. Subir con `/upload-certificates/{idRoot}`
3. Actualizar contraseña si cambió

### Créditos de Finkok
- Monitorea saldo en panel de Finkok
- Configura alertas de saldo bajo
- Los timbres demo no consumen créditos

---

## Soporte

**Finkok:** https://www.finkok.com/soporte
**SAT:** https://www.sat.gob.mx
**CFDI 4.0:** http://www.sat.gob.mx/sitio_internet/cfd/4/

**Issues del proyecto:** Contacta al equipo de desarrollo
