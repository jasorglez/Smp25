# Documentación de Tablas para Integración SYSPRO
## Facturación Electrónica CFDI 4.0

**Versión:** 1.0
**Fecha:** 7 de Octubre de 2025
**Propósito:** Guía completa de campos requeridos para procesar facturas electrónicas desde SYSPRO

---

## Índice

1. [Introducción](#introducción)
2. [Tabla 1: BillingManagement (Configuración del Emisor)](#tabla-1-billingmanagement)
3. [Tabla 2: Incomeandexpense (Facturas/Comprobantes)](#tabla-2-incomeandexpense)
4. [Tabla 3: CustomersBilling (Datos del Receptor)](#tabla-3-customersbilling)
5. [Tabla 4: ConceptsxIncorExp (Conceptos/Partidas)](#tabla-4-conceptsxincorexp)
6. [Tabla 5: Catálogos SAT](#tabla-5-catálogos-sat)
7. [Matriz de Validaciones y Reglas de Negocio](#matriz-de-validaciones)
8. [Guía de Mapeo SYSPRO → Sistema Interno](#guía-de-mapeo)
9. [Resumen de Campos Requeridos de SYSPRO](#resumen-de-campos-requeridos)

---

## Introducción

Este documento detalla todas las tablas y campos involucrados en el proceso de facturación electrónica CFDI 4.0, explicando:

- **Qué representa cada campo**
- **Su propósito en el proceso de timbrado**
- **Si es obligatorio u opcional**
- **Cómo se mapea desde SYSPRO al sistema interno**
- **Validaciones y formatos esperados**

El objetivo es que el equipo de SYSPRO sepa exactamente qué datos debe proporcionar para generar facturas electrónicas válidas según el SAT.

---

## TABLA 1: BillingManagement (Configuración del Emisor)

Esta tabla almacena la configuración de facturación del **emisor** (la empresa que emite las facturas). Es una configuración única por empresa.

### Sección A: Identificación y Datos Fiscales del Emisor

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Id** | int | - | ✅ Sí | Identificador único de la configuración de facturación | Auto-generado | PK, Identity | 1 |
| **EmisorRfc** | nvarchar | 13 | ✅ Sí | RFC (Registro Federal de Contribuyentes) del emisor que aparecerá en todas las facturas | SYSPRO: Company.TaxNumber | Formato: 12 caracteres para PM + dígito<br>Validar contra SAT | `AAA010101AAA` |
| **EmisorNombre** | nvarchar | 254 | ✅ Sí | Razón social completa del emisor según constancia de situación fiscal | SYSPRO: Company.Name | Debe coincidir con la razón social registrada en el SAT | `EMPRESA EJEMPLO SA DE CV` |
| **FiscalRegime** | int | - | ✅ Sí | Código del régimen fiscal del emisor según catálogo c_RegimenFiscal del SAT | SYSPRO: Company.TaxRegime | Validar contra catálogo SAT<br>Debe corresponder al RFC | `601` (General de Ley PM) |
| **EmisorCp** | nvarchar | 5 | ✅ Sí | Código postal del domicilio fiscal del emisor (lugar de expedición por defecto) | SYSPRO: Company.PostalCode | Exactamente 5 dígitos<br>Validar contra c_CodigoPostal | `64000` |

### Sección B: Control de Folios

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Prefix** | nvarchar | 10 | ⚠️ Recomendado | Prefijo o serie que se utilizará en las facturas (aparece en el atributo Serie del CFDI) | Configuración manual o SYSPRO | Alfanumérico, máx 25 chars | `INGR`, `FAC`, `A` |
| **Consecutive** | int | - | ✅ Sí | Número consecutivo que se asignará a la siguiente factura (folio) | Configuración inicial | Se auto-incrementa tras cada timbrado exitoso | `52` |

**Importante:** La combinación **Serie + Folio** debe ser única por emisor. El sistema incrementa automáticamente el consecutivo después de cada timbrado exitoso.

### Sección C: Configuración de Impuestos

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **IIva** | decimal | (5,2) | ✅ Sí | Porcentaje de IVA que se aplicará a los conceptos gravados | SYSPRO: Company.DefaultTaxRate | Debe ser >= 0<br>Normalmente 16% en México | `16.00` |
| **Ieps** | decimal | (5,2) | ❌ No | Porcentaje de IEPS (Impuesto Especial sobre Producción y Servicios) si aplica | SYSPRO o manual | Opcional, solo para productos especiales | `8.00` |
| **IvaRetencion** | decimal | (5,2) | ❌ No | Porcentaje de retención de IVA si el emisor está obligado a retener | SYSPRO o manual | Solo para casos específicos | `10.67` |
| **IsrRetencion** | decimal | (5,2) | ❌ No | Porcentaje de retención de ISR si el emisor está obligado a retener | SYSPRO o manual | Solo para honorarios/arrendamiento | `10.00` |

### Sección D: Certificados Digitales (e.firma/FIEL)

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Certificado** | varbinary | MAX | ✅ Sí | Archivo .cer del certificado digital (FIEL) emitido por el SAT en formato binario | Archivo externo | Formato DER<br>Debe estar vigente<br>RFC debe coincidir con EmisorRfc | (binario) |
| **NoCertificado** | nvarchar | 20 | ✅ Sí | Número de serie del certificado digital (se extrae automáticamente del archivo .cer) | Auto-extraído del .cer | 20 dígitos exactos | `30001000000400002434` |
| **LlavePrivada** | varbinary | MAX | ✅ Sí | Archivo .key con la llave privada encriptada del certificado en formato binario | Archivo externo | Formato DER encriptado<br>Debe corresponder al .cer | (binario) |
| **ContrasenaCertificado** | nvarchar | 100 | ✅ Sí | Contraseña para desencriptar la llave privada (.key) | Manual (proporcionado por SAT al usuario) | ⚠️ Dato sensible<br>Debe encriptarse | `MiPassword123!` |
| **FechaInicioCert** | datetime2 | - | ✅ Sí | Fecha desde la cual el certificado es válido (se extrae del .cer) | Auto-extraído del .cer | Debe ser <= fecha actual | `2024-06-15 00:00:00` |
| **FechaFinCert** | datetime2 | - | ✅ Sí | Fecha de expiración del certificado (se extrae del .cer) | Auto-extraído del .cer | Debe ser > fecha actual<br>Alertar si vence pronto | `2028-06-15 00:00:00` |

**Proceso de carga de certificados:**
1. Usuario proporciona archivos .cer y .key + contraseña
2. Sistema valida que el .cer esté vigente y el RFC coincida
3. Sistema extrae NoCertificado, FechaInicioCert, FechaFinCert del .cer
4. Sistema valida que la contraseña pueda desencriptar el .key
5. Archivos se guardan como VARBINARY en la base de datos

### Sección E: Campos de Control

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|--------------|---------|
| **Active** | bit | - | ✅ Sí | Indica si la configuración está activa (soft delete) | true/false | `true` |
| **CreatedAt** | datetime2 | - | ✅ Sí | Fecha y hora de creación del registro | Auto-generado | `2025-10-06 10:30:00` |
| **UpdatedAt** | datetime2 | - | ❌ No | Fecha y hora de última modificación | Auto-actualizado | `2025-10-06 15:45:00` |

---

## TABLA 2: Incomeandexpense (Facturas/Comprobantes)

Esta tabla almacena cada **factura o comprobante** que se genera. Un registro = un CFDI.

### Sección A: Identificadores y Relaciones

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Id** | int | - | ✅ Sí | Identificador único interno de la factura | Auto-generado | PK, Identity | 118 |
| **IdBillingConfig** | int | - | ✅ Sí | Relación con la configuración de facturación (emisor) | Configuración del sistema | FK a `BillingManagement` | 1 |
| **IdCustomerBilling** | int | - | ✅ Sí | Relación con los datos fiscales del cliente (receptor) | SYSPRO: Invoice.CustomerCode | FK a `CustomersBilling` | 15 |

### Sección B: Información Temporal

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Date** | datetime2 | - | ✅ Sí | Fecha y hora de emisión del CFDI (atributo Fecha) | SYSPRO: Invoice.InvoiceDate | Formato: `YYYY-MM-DDTHH:MM:SS`<br>No puede ser futura<br>No puede ser > 72 horas en el pasado | `2025-10-06T00:00:00` |

### Sección C: Montos y Cálculos

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Subtotal** | decimal | (18,2) | ✅ Sí | Suma de los importes de todos los conceptos SIN impuestos (atributo SubTotal) | SYSPRO: Invoice.SubTotal | Debe ser = SUMA(Conceptos.Importe)<br>Mínimo 2 decimales | `5230.00` |
| **Tax** | decimal | (18,2) | ✅ Sí | Suma de todos los impuestos trasladados (normalmente IVA) | SYSPRO: Invoice.TaxAmount | Debe ser = SUMA(Conceptos.IVA)<br>Va en atributo TotalImpuestosTrasladados | `836.80` |
| **Total** | decimal | (18,2) | ✅ Sí | Total del comprobante incluyendo impuestos (atributo Total) | SYSPRO: Invoice.TotalAmount | Debe ser = Subtotal - Descuento + Tax<br>Este es el monto a pagar | `6066.80` |

**Fórmula de validación:**
```
Total = Subtotal - Descuento + Tax - Retenciones
```

### Sección D: Atributos del CFDI

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **TipoComprobante** | nvarchar | 1 | ✅ Sí | Tipo de comprobante según catálogo c_TipoDeComprobante | SYSPRO: Invoice.Type | `I` = Ingreso (factura)<br>`E` = Egreso (nota de crédito)<br>`T` = Traslado<br>`N` = Nómina<br>`P` = Pago | `I` |
| **FormaPago** | nvarchar | 2 | ⚠️ Condicional | Forma de pago según catálogo c_FormaPago del SAT | SYSPRO: Invoice.PaymentMethod | Obligatorio si MetodoPago=PUE<br>Debe ser `99` si MetodoPago=PPD | `03` = Transferencia<br>`01` = Efectivo<br>`28` = Tarjeta débito<br>`99` = Por definir |
| **MetodoPago** | nvarchar | 3 | ✅ Sí | Método de pago según catálogo c_MetodoPago | SYSPRO: Invoice.PaymentTerms | `PUE` = Pago en Una Exhibición (contado)<br>`PPD` = Pago en Parcialidades o Diferido (crédito) | `PUE` |
| **Moneda** | nvarchar | 3 | ✅ Sí | Moneda del comprobante según ISO 4217 | SYSPRO: Invoice.Currency | `MXN`, `USD`, `EUR`<br>Si no es MXN, requiere TipoCambio | `MXN` |
| **TipoCambio** | decimal | (18,6) | ⚠️ Condicional | Tipo de cambio aplicado si la moneda NO es MXN | SYSPRO: Invoice.ExchangeRate | Obligatorio si Moneda ≠ MXN<br>Mínimo 6 decimales<br>Debe ser > 0 | `17.850000` |
| **LugarExpedicion** | nvarchar | 5 | ✅ Sí | Código postal del lugar donde se expide la factura | SYSPRO: Company.PostalCode o BillingManagement.EmisorCp | 5 dígitos<br>Validar contra c_CodigoPostal | `64000` |

### Sección E: Serie y Folio

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Serie** | nvarchar | 25 | ⚠️ Recomendado | Serie o prefijo del folio (atributo Serie del CFDI) | BillingManagement.Prefix | Alfanumérico, máx 25 chars<br>Combinación Serie+Folio debe ser única | `INGR` |
| **Folio** | nvarchar | 40 | ✅ Sí | Número de folio consecutivo de la factura (atributo Folio) | BillingManagement.Consecutive | Numérico<br>Se asigna automáticamente al timbrar<br>Serie+Folio debe ser único | `52` |

### Sección F: Descripción y Clasificación

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|---------|
| **Description** | nvarchar | 500 | ⚠️ Recomendado | Descripción general de la factura (uso interno) | SYSPRO: Invoice.Description | `Factura por servicios de consultoría octubre 2025` |
| **Type** | int | - | ✅ Sí | Clasificación interna: 1=Ingreso, 2=Egreso | SYSPRO: Invoice.Type | `1` = Ingreso, `2` = Egreso |

### Sección G: Datos del Timbrado (Auto-llenados por el sistema)

**Nota:** Estos campos son generados AUTOMÁTICAMENTE después del timbrado exitoso con el PAC (Finkok). NO deben proporcionarse desde SYSPRO.

| Campo | Tipo de Dato | Longitud | Descripción Detallada | Cuándo se llena | Ejemplo |
|-------|--------------|----------|----------------------|-----------------|---------|
| **Uuid** | nvarchar | 36 | Folio fiscal único asignado por el SAT (TimbreFiscalDigital.UUID) | Después de timbrar con Finkok | `12345678-1234-1234-1234-123456789ABC` |
| **Xml** | nvarchar | MAX | XML original generado ANTES de timbrar (sin timbre fiscal) | Antes de enviar a Finkok | `<?xml version="1.0"...<cfdi:Comprobante...` |
| **XmlTimbrado** | nvarchar | MAX | XML completo después de timbrar (incluye nodo TimbreFiscalDigital) | Después de timbrar con Finkok | `<?xml version="1.0"...<tfd:TimbreFiscalDigital...` |
| **SelloDigital** | nvarchar | MAX | Sello digital del emisor (firma del XML con certificado .key) | Durante generación del XML | `(cadena Base64 larga)` |
| **SelloCfdi** | nvarchar | MAX | Sello del SAT aplicado al CFDI (firma del PAC) | Después de timbrar con Finkok | `(cadena Base64 larga)` |
| **NoCertificadoSat** | nvarchar | 20 | Número de certificado del SAT usado para el sello | Después de timbrar con Finkok | `00001000000504465028` |
| **FechaTimbrado** | datetime2 | - | Fecha y hora exacta del timbrado por el SAT | Después de timbrar con Finkok | `2025-10-06T14:35:22` |
| **RfcProvCertif** | nvarchar | 13 | RFC del PAC que realizó el timbrado (Finkok) | Después de timbrar con Finkok | `FIN0509283R5` |

### Sección H: Cancelación (Opcional)

| Campo | Tipo de Dato | Longitud | Descripción Detallada | Cuándo se llena |
|-------|--------------|----------|----------------------|-----------------|
| **FechaCancelacion** | datetime2 | - | Fecha y hora en que se canceló el CFDI | Cuando se cancela la factura |
| **MotivoCancelacion** | nvarchar | 2 | Clave del motivo de cancelación según c_MotivoCancelacion | Al solicitar cancelación |
| **FolioSustitucion** | nvarchar | 36 | UUID del CFDI que sustituye a este (si aplica) | Al cancelar por sustitución |

### Sección I: Campos de Auditoría

| Campo | Tipo de Dato | Descripción | Ejemplo |
|-------|--------------|-------------|---------|
| **Active** | bit | Indica si el registro está activo (soft delete) | `true` |
| **CreatedAt** | datetime2 | Fecha de creación del registro | `2025-10-06 10:00:00` |
| **UpdatedAt** | datetime2 | Fecha de última modificación | `2025-10-06 14:35:00` |

---

## TABLA 3: CustomersBilling (Datos del Receptor)

Esta tabla almacena la información fiscal de los **clientes** que recibirán las facturas electrónicas.

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Id** | int | - | ✅ Sí | Identificador único interno del registro | Auto-generado | PK, Identity | 1 |
| **IdCustomer** | int | - | ✅ Sí | Relación con la tabla Customer principal | SYSPRO: Customer.Id | FK a tabla Customer | 52 |
| **Rfc** | nvarchar | 13 | ✅ Sí | RFC (Registro Federal de Contribuyentes) del receptor. 13 caracteres para Persona Física, 12 para Persona Moral + dígito verificador | SYSPRO: Customer.TaxNumber | Formato: `^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$`<br>Validar contra SAT | PF: `XAXX010101000`<br>PM: `AAA010101AAA` |
| **NombreFiscal** | nvarchar | 254 | ✅ Sí | Razón social o nombre completo según constancia de situación fiscal del SAT | SYSPRO: Customer.Name | Máximo 254 caracteres<br>Debe coincidir con RFC en SAT | `ACME CORPORATIVO SA DE CV` |
| **CodigoPostal** | nvarchar | 5 | ✅ Sí | Código postal del domicilio fiscal del receptor (atributo DomicilioFiscalReceptor en CFDI) | SYSPRO: Customer.PostalCode | Exactamente 5 dígitos<br>Validar contra catálogo c_CodigoPostal del SAT | `64000` |
| **RegimenFiscal** | nvarchar | 3 | ✅ Sí | Clave del régimen fiscal del receptor según catálogo c_RegimenFiscal del SAT | SYSPRO: Customer.TaxRegime | Validar contra catálogo SAT<br>Debe ser compatible con UsoCFDI | `601` = General de Ley PM<br>`605` = Sueldos y Salarios<br>`612` = PF con Actividad Empresarial |
| **UsoCfdi** | nvarchar | 3 | ✅ Sí | Clave del uso que el receptor dará al CFDI según catálogo c_UsoCFDI del SAT | SYSPRO: Invoice.UsoCFDI | Validar contra catálogo SAT<br>Verificar compatibilidad con RegimenFiscal | `G01` = Adquisición de mercancías<br>`G03` = Gastos en general<br>`P01` = Por definir |
| **Email** | nvarchar | 100 | ⚠️ Recomendado | Email donde se enviará el XML y PDF timbrado | SYSPRO: Customer.Email | Formato email válido | `facturacion@cliente.com` |
| **Active** | bit | - | ✅ Sí | Indica si el registro está activo (soft delete) | Control interno | true/false | `true` |

### Validaciones Críticas para CustomersBilling:

**1. RFC vs Régimen Fiscal:**
- Si RFC tiene 12 caracteres → debe ser Persona Moral (régimen 601-626)
- Si RFC tiene 13 caracteres → debe ser Persona Física (régimen 605, 606, 612, 621)

**2. Compatibilidad RegimenFiscal + UsoCFDI:**
- Régimen 601 (PM General): compatible con G01, G02, G03, I01-I08
- Régimen 612 (PF Empresarial): compatible con G01, G02, G03, I01-I08, D01-D10
- Régimen 605 (Sueldos): compatible con D10 (Nómina)

**3. Código Postal:**
- Debe existir en catálogo c_CodigoPostal del SAT
- Debe corresponder a un código postal válido en México

---

## TABLA 4: ConceptsxIncorExp (Conceptos/Partidas de la Factura)

Esta tabla contiene los **conceptos o líneas de detalle** de cada factura.

| Campo | Tipo de Dato | Longitud | Obligatorio | Descripción Detallada | Origen en SYSPRO | Validaciones | Ejemplo |
|-------|--------------|----------|-------------|----------------------|------------------|--------------|---------|
| **Id** | int | - | ✅ Sí | Identificador único del concepto | Auto-generado | PK, Identity | 1 |
| **IdIncorExp** | int | - | ✅ Sí | Relación con el ingreso/egreso (factura) | Control interno | FK a `Incomeandexpense` | 118 |
| **ClaveProdServ** | nvarchar | 8 | ✅ Sí | Clave de producto o servicio según catálogo c_ClaveProdServ del SAT | SYSPRO: Product.SATCode | Validar contra catálogo SAT<br>Exactamente 8 dígitos | `01010101` = No existe en catálogo<br>`43231500` = Software de gestión |
| **ClaveUnidad** | nvarchar | 3 | ✅ Sí | Clave de unidad de medida según catálogo c_ClaveUnidad del SAT | SYSPRO: Product.UOMCode | Validar contra catálogo SAT | `E48` = Unidad de servicio<br>`H87` = Pieza<br>`MTR` = Metro |
| **NumeroIdentificacion** | nvarchar | 100 | ❌ No | Número de identificación interna del producto/servicio (SKU, código interno) | SYSPRO: Product.StockCode | Alfanumérico, máximo 100 chars | `SKU-12345`<br>`PROD-ABC-001` |
| **Quantity** | decimal | (18,6) | ✅ Sí | Cantidad de unidades del concepto | SYSPRO: InvoiceLine.Quantity | Mínimo 0.000001<br>Máximo 6 decimales | `1.000000`<br>`2.500000` |
| **Unit** | nvarchar | 20 | ⚠️ Recomendado | Descripción textual de la unidad (campo informativo) | SYSPRO: UnitOfMeasure.Description | Máximo 20 caracteres | `Servicio`<br>`Pieza`<br>`Metro` |
| **Description** | nvarchar | 1000 | ✅ Sí | Descripción del producto o servicio | SYSPRO: Product.Description | Mínimo 1 carácter<br>Máximo 1000 caracteres | `Servicio de consultoría empresarial mes de octubre 2025` |
| **Price** | decimal | (18,6) | ✅ Sí | Precio unitario (ValorUnitario en CFDI) | SYSPRO: InvoiceLine.UnitPrice | Mínimo 0.000001<br>Máximo 6 decimales | `1500.000000`<br>`99.990000` |
| **Descuento** | decimal | (18,2) | ❌ No | Monto del descuento aplicado al concepto | SYSPRO: InvoiceLine.DiscountAmount | Si existe, debe ser ≥ 0<br>No puede ser mayor que (Quantity × Price) | `150.00` |
| **ObjetoImp** | nvarchar | 2 | ✅ Sí | Clave de objeto de impuesto según catálogo c_ObjetoImp del SAT | SYSPRO: Product.TaxObject | `01` = No objeto de impuesto<br>`02` = Sí objeto de impuesto<br>`03` = Sí objeto, no obligado a desglose<br>`04` = Sí objeto, exento | `02` |
| **Iva** | bit | - | ✅ Sí | Indica si el concepto causa IVA | SYSPRO: InvoiceLine.IsTaxable | true/false<br>Si ObjetoImp=02 → debe ser true | `true` |
| **Active** | bit | - | ✅ Sí | Indica si el registro está activo | Control interno | true/false | `true` |

### Cálculos para Conceptos:

```
Importe = Quantity × Price
ImporteConDescuento = Importe - Descuento
BaseImponible = ImporteConDescuento
ImporteIVA = BaseImponible × (TasaIVA / 100)
```

**Ejemplo:**
- Quantity: 2
- Price: 1000.00
- Descuento: 100.00
- IVA: 16%

```
Importe = 2 × 1000.00 = 2000.00
ImporteConDescuento = 2000.00 - 100.00 = 1900.00
ImporteIVA = 1900.00 × 0.16 = 304.00
```

---

## TABLA 5: Catálogos SAT (Referencia)

Estas tablas almacenan los catálogos oficiales del SAT que deben consultarse para validar datos.

### 5.1 FormasPago (c_FormaPago)

| Clave | Descripción | Bancarizado | Uso Común |
|-------|-------------|-------------|-----------|
| **01** | Efectivo | No | Pagos en efectivo |
| **02** | Cheque nominativo | Sí | Cheques |
| **03** | Transferencia electrónica de fondos | Sí | Transferencias bancarias (SPEI) |
| **04** | Tarjeta de crédito | Sí | Pagos con tarjeta de crédito |
| **28** | Tarjeta de débito | Sí | Pagos con tarjeta de débito |
| **99** | Por definir | - | Cuando se usará PPD (pago posterior) |

**Origen en SYSPRO:** `Invoice.PaymentMethod` o `PaymentMethods.SATCode`

### 5.2 MetodosPago (c_MetodoPago)

| Clave | Descripción | Uso |
|-------|-------------|-----|
| **PUE** | Pago en Una sola Exhibición | Se usa cuando el pago es inmediato (contado) |
| **PPD** | Pago en Parcialidades o Diferido | Se usa cuando el pago es a crédito (requiere complemento de pago posterior) |

**Origen en SYSPRO:** `Invoice.PaymentTerms` → Si términos = 0 días → `PUE`, Si términos > 0 días → `PPD`

### 5.3 RegimenFiscal (c_RegimenFiscal)

| Clave | Descripción | Aplica Para |
|-------|-------------|-------------|
| **601** | General de Ley Personas Morales | PM (RFC 12 chars) |
| **603** | Personas Morales con Fines no Lucrativos | PM |
| **605** | Sueldos y Salarios e Ingresos Asimilados a Salarios | PF (RFC 13 chars) |
| **606** | Arrendamiento | PF |
| **612** | Personas Físicas con Actividades Empresariales y Profesionales | PF |
| **621** | Incorporación Fiscal (RESICO) | PF |
| **625** | Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas | PF |
| **626** | Régimen Simplificado de Confianza | PF o PM |

### 5.4 UsoCFDI (c_UsoCFDI)

| Clave | Descripción | Compatible con Régimen | Persona |
|-------|-------------|------------------------|---------|
| **G01** | Adquisición de mercancías | 601, 603, 612, 621, 625, 626 | PM y PF con actividad empresarial |
| **G02** | Devoluciones, descuentos o bonificaciones | 601, 603, 612, 621, 625, 626 | PM y PF con actividad empresarial |
| **G03** | Gastos en general | 601, 603, 605, 606, 612, 621, 625, 626 | PM y PF |
| **I01** | Construcciones | 601, 603, 612, 621, 626 | PM y PF con actividad empresarial |
| **I02** | Mobiliario y equipo de oficina por inversiones | 601, 603, 612, 621, 626 | PM y PF con actividad empresarial |
| **I08** | Otra maquinaria y equipo | 601, 603, 612, 621, 626 | PM y PF con actividad empresarial |
| **D10** | Pagos por servicios educativos (colegiaturas) | 605, 606, 612, 621 | Solo PF |
| **P01** | Por definir | Todos | Todos (uso temporal) |
| **S01** | Sin efectos fiscales | 616 (arrendamiento exento) | PF |
| **CP01** | Pagos (complemento de pago) | Todos | Todos |

### 5.5 ClaveProdServ (c_ClaveProdServ) - Principales Familias

| Familia | Descripción | Ejemplos |
|---------|-------------|----------|
| **01xxxxxx** | Animales vivos y productos animales | `01010101` = No existe (uso genérico) |
| **43xxxxxx** | Tecnología de la información | `43231500` = Software<br>`43232600` = Desarrollo de software |
| **80xxxxxx** | Servicios de gestión, servicios profesionales de empresa | `80101500` = Servicios de consultoría<br>`80141600` = Servicios de contabilidad |
| **81xxxxxx** | Servicios basados en ingeniería | `81112000` = Servicios de ingeniería |
| **93xxxxxx** | Productos y servicios alimenticios | `93141600` = Servicio de restaurante |

**Origen en SYSPRO:** `Product.SATProductCode` o `InvoiceLine.ClaveProdServ`

### 5.6 ClaveUnidad (c_ClaveUnidad)

| Clave | Descripción | Uso Común |
|-------|-------------|-----------|
| **ACT** | Actividad | Servicios profesionales |
| **E48** | Unidad de servicio | Servicios en general |
| **H87** | Pieza | Productos físicos |
| **XNA** | No aplica | Cuando no hay unidad física |
| **MTR** | Metro | Medidas lineales |
| **KGM** | Kilogramo | Peso |
| **LTR** | Litro | Volumen |
| **HUR** | Hora | Servicios por tiempo |
| **DAY** | Día | Rentas, servicios temporales |
| **MON** | Mes | Suscripciones, rentas mensuales |

**Origen en SYSPRO:** `Product.UnitOfMeasure.SATCode` o `InvoiceLine.ClaveUnidad`

---

## MATRIZ DE VALIDACIONES Y REGLAS DE NEGOCIO

### Validación 1: RFC y Régimen Fiscal

```
SI RFC.Length = 12 caracteres (Persona Moral)
  ENTONCES RegimenFiscal debe estar en [601, 603, 607, 608, 610, 611, 620, 622, 623, 624, 626]

SI RFC.Length = 13 caracteres (Persona Física)
  ENTONCES RegimenFiscal debe estar en [605, 606, 607, 608, 610, 611, 612, 614, 616, 621, 625, 626]
```

### Validación 2: Régimen Fiscal y Uso CFDI (Receptor)

| RegimenFiscal | UsoCFDI Permitidos |
|---------------|-------------------|
| 601 (PM General) | G01, G02, G03, I01, I02, I03, I04, I05, I06, I07, I08 |
| 612 (PF Empresarial) | G01, G02, G03, I01, I02, I03, I04, I05, I06, I07, I08, D01-D10 |
| 605 (Sueldos PF) | G01, G02, G03, D01-D10 |
| 606 (Arrendamiento PF) | G01, G02, G03, D01-D10 |
| 621 (RESICO PF) | G01, G02, G03, I01, I02, I03, I04, I05, I06, I07, I08, D01-D10 |

### Validación 3: Método de Pago y Forma de Pago

```
SI MetodoPago = "PUE" (Pago en una exhibición)
  ENTONCES FormaPago NO puede ser "99" (Por definir)
  Y FormaPago debe especificar método concreto (01, 03, 04, 28, etc.)

SI MetodoPago = "PPD" (Pago en parcialidades)
  ENTONCES FormaPago debe ser "99" (Por definir)
  Y se requiere emitir Complemento de Pago posteriormente
```

### Validación 4: Fechas

```
Fecha del CFDI:
  - NO puede ser fecha futura
  - NO puede ser anterior a más de 72 horas de la fecha actual
  - Formato obligatorio: YYYY-MM-DDTHH:MM:SS (ISO 8601)

Ejemplo válido: 2025-10-06T14:30:00
Ejemplo inválido: 2025-10-03T10:00:00 (si hoy es 2025-10-07 a las 08:00)
```

### Validación 5: Moneda y Tipo de Cambio

```
SI Moneda = "MXN"
  ENTONCES TipoCambio NO debe incluirse (o incluir con valor "1")

SI Moneda ≠ "MXN" (USD, EUR, etc.)
  ENTONCES TipoCambio es OBLIGATORIO
  Y debe tener mínimo 6 decimales
  Y debe ser > 0

Ejemplos:
  Moneda="MXN" → No incluir TipoCambio
  Moneda="USD", TipoCambio="17.850000" ✅
  Moneda="USD", TipoCambio="17.85" ❌ (faltan decimales)
```

### Validación 6: Cálculo de Totales

```
Para cada Concepto:
  Importe = Cantidad × ValorUnitario (redondeado a 2 decimales)
  ImporteConDescuento = Importe - Descuento

  SI ObjetoImp = "02" Y Iva = true:
    BaseImponible = ImporteConDescuento
    ImporteIVA = BaseImponible × TasaIVA (redondeado a 2 decimales)

A nivel Comprobante:
  SubTotal = SUMA(Conceptos.Importe)
  TotalDescuentos = SUMA(Conceptos.Descuento)
  TotalImpuestosTrasladados = SUMA(Conceptos.ImporteIVA)
  Total = SubTotal - TotalDescuentos + TotalImpuestosTrasladados

VALIDAR:
  Total del XML = Total calculado (tolerancia ±0.01 por redondeos)
```

**Ejemplo de Validación:**
```
Concepto 1: Cantidad=2, Precio=1000, Descuento=100, IVA=16%
  Importe = 2 × 1000 = 2000.00
  ImporteConDescuento = 2000 - 100 = 1900.00
  IVA = 1900 × 0.16 = 304.00

Concepto 2: Cantidad=1, Precio=500, Descuento=0, IVA=16%
  Importe = 1 × 500 = 500.00
  IVA = 500 × 0.16 = 80.00

Totales:
  SubTotal = 2000 + 500 = 2500.00
  TotalDescuentos = 100.00
  TotalImpuestosTrasladados = 304 + 80 = 384.00
  Total = 2500 - 100 + 384 = 2784.00 ✅
```

### Validación 7: Certificados Digitales

```
Certificado (.cer):
  - Formato: DER (binario)
  - Debe estar vigente (FechaInicio ≤ Hoy ≤ FechaFin)
  - RFC del certificado debe coincidir con RFC del Emisor
  - Tipo: FIEL (Firma Electrónica Avanzada)

Llave Privada (.key):
  - Formato: DER encriptado
  - Debe corresponder al certificado .cer
  - Requiere contraseña para desencriptar
  - Algoritmo: RSA con SHA256
```

### Validación 8: Serie y Folio

```
Serie (opcional):
  - Alfanumérico
  - Máximo 25 caracteres
  - Ejemplo: "A", "FAC", "INGR"

Folio:
  - Numérico
  - Único por Serie (combinación Serie+Folio debe ser única)
  - Auto-incremental desde BillingManagement.Consecutive
  - Máximo 40 caracteres

Validación de duplicados:
  NO puede existir otro CFDI timbrado con mismo:
    EmisorRFC + Serie + Folio
```

---

## GUÍA DE MAPEO: SYSPRO → Sistema Interno

### Sección 1: Configuración del Emisor (Una sola vez)

| Campo Destino | Tabla Destino | Origen SYSPRO | Transformación | Notas |
|---------------|---------------|---------------|----------------|-------|
| EmisorRfc | BillingManagement | Company.TaxNumber | Validar formato RFC (12 chars para PM) | Configuración manual inicial |
| EmisorNombre | BillingManagement | Company.Name | Sin transformación | Razón social completa |
| FiscalRegime | BillingManagement | Company.TaxRegime | Mapear a catálogo SAT | Ejemplo: "General" → `601` |
| EmisorCp | BillingManagement | Company.PostalCode | Validar 5 dígitos | Del domicilio fiscal |
| Prefix | BillingManagement | Manual o Config | Serie por defecto | Ejemplo: "INGR" |
| Consecutive | BillingManagement | Manual o Config | Folio inicial | Ejemplo: `1` |
| IIva | BillingManagement | Company.DefaultTaxRate | Convertir a decimal | 16% → `16.00` |
| Certificado (.cer) | BillingManagement | Archivo externo | Convertir a VARBINARY | Subir manualmente |
| LlavePrivada (.key) | BillingManagement | Archivo externo | Convertir a VARBINARY | Subir manualmente |
| ContrasenaCertificado | BillingManagement | Manual | Encriptar antes de guardar | ⚠️ Sensible |

### Sección 2: Datos del Cliente/Receptor (Por cada cliente)

| Campo Destino | Tabla Destino | Origen SYSPRO | Transformación | Validaciones |
|---------------|---------------|---------------|----------------|--------------|
| IdCustomer | CustomersBilling | Customer.CustomerCode | Relación FK | Debe existir en Customer |
| Rfc | CustomersBilling | Customer.TaxNumber | Validar formato | 12 o 13 caracteres |
| NombreFiscal | CustomersBilling | Customer.Name | Sin transformación | Razón social completa |
| CodigoPostal | CustomersBilling | Customer.PostalCode | Tomar primeros 5 dígitos | Validar contra c_CodigoPostal |
| RegimenFiscal | CustomersBilling | Customer.TaxRegime | Mapear a clave SAT | Ejemplo: `612` |
| UsoCfdi | CustomersBilling | Customer.DefaultUsoCFDI o Manual | Mapear a clave SAT | Ejemplo: `G03` |
| Email | CustomersBilling | Customer.Email | Validar formato email | Para envío de XML/PDF |

**Ejemplo de Mapeo:**
```
SYSPRO Customer:
  CustomerCode: "CLI-001"
  Name: "ACME CORPORATIVO SA DE CV"
  TaxNumber: "ACM0101011A0"
  PostalCode: "64000"
  TaxRegime: "General PM"
  Email: "facturacion@acme.mx"

→ Sistema Interno CustomersBilling:
  IdCustomer: 52
  Rfc: "ACM0101011A0"
  NombreFiscal: "ACME CORPORATIVO SA DE CV"
  CodigoPostal: "64000"
  RegimenFiscal: "601"
  UsoCfdi: "G03"
  Email: "facturacion@acme.mx"
```

### Sección 3: Factura/Comprobante (Por cada documento)

| Campo Destino | Tabla Destino | Origen SYSPRO | Transformación | Validaciones |
|---------------|---------------|---------------|----------------|--------------|
| Id | Incomeandexpense | Auto-generado | Identity | PK |
| IdBillingConfig | Incomeandexpense | Config | FK a BillingManagement | Relacionar con config del emisor |
| IdCustomerBilling | Incomeandexpense | Customer mapping | FK a CustomersBilling | Buscar por Customer.Id |
| Date | Incomeandexpense | Invoice.InvoiceDate | Convertir a formato ISO | `YYYY-MM-DDTHH:MM:SS` |
| Serie | Incomeandexpense | BillingManagement.Prefix | Copiar serie por defecto | Puede ser personalizada |
| Folio | Incomeandexpense | BillingManagement.Consecutive | Auto-incremental | Se asigna al timbrar |
| Subtotal | Incomeandexpense | Invoice.SubTotal | Decimal(18,2) | Suma de conceptos sin IVA |
| Tax | Incomeandexpense | Invoice.TaxAmount | Decimal(18,2) | Total de IVA |
| Total | Incomeandexpense | Invoice.TotalAmount | Decimal(18,2) | SubTotal + Tax |
| TipoComprobante | Incomeandexpense | Invoice.Type | Mapear: Invoice→"I", Credit→"E" | `I`=Ingreso, `E`=Egreso |
| FormaPago | Incomeandexpense | Invoice.PaymentMethod | Mapear a c_FormaPago | Ejemplo: "Transfer"→`03` |
| MetodoPago | Incomeandexpense | Invoice.PaymentTerms | Si términos=0→`PUE`, >0→`PPD` | PUE o PPD |
| Moneda | Incomeandexpense | Invoice.Currency | ISO 4217 | `MXN`, `USD`, `EUR` |
| TipoCambio | Incomeandexpense | Invoice.ExchangeRate | Decimal(18,6) | Solo si Moneda≠MXN |
| LugarExpedicion | Incomeandexpense | Company.PostalCode | Código postal del emisor | 5 dígitos |

**Ejemplo de Mapeo:**
```
SYSPRO Invoice:
  InvoiceNumber: "FAC-2025-001"
  InvoiceDate: "2025-10-06"
  CustomerCode: "CLI-001"
  SubTotal: 5230.00
  TaxAmount: 836.80
  TotalAmount: 6066.80
  Currency: "MXN"
  PaymentTerms: 0 (días)
  PaymentMethod: "Electronic Transfer"

→ Sistema Interno Incomeandexpense:
  IdBillingConfig: 1
  IdCustomerBilling: 15
  Date: "2025-10-06T00:00:00"
  Serie: "INGR"
  Folio: "52" (auto-asignado)
  Subtotal: 5230.00
  Tax: 836.80
  Total: 6066.80
  TipoComprobante: "I"
  FormaPago: "03"
  MetodoPago: "PUE"
  Moneda: "MXN"
  TipoCambio: null
  LugarExpedicion: "64000"
```

### Sección 4: Conceptos/Líneas de Factura (Por cada línea)

| Campo Destino | Tabla Destino | Origen SYSPRO | Transformación | Validaciones |
|---------------|---------------|---------------|----------------|--------------|
| IdIncorExp | ConceptsxIncorExp | Incomeandexpense.Id | FK | Relación con factura |
| ClaveProdServ | ConceptsxIncorExp | Product.SATProductCode | Validar contra c_ClaveProdServ | 8 dígitos, si no existe usar `01010101` |
| ClaveUnidad | ConceptsxIncorExp | Product.SATUnitCode | Validar contra c_ClaveUnidad | Ejemplo: `E48`, `H87` |
| NumeroIdentificacion | ConceptsxIncorExp | Product.StockCode | Sin transformación | SKU o código interno |
| Quantity | ConceptsxIncorExp | InvoiceLine.Quantity | Decimal(18,6) | Mínimo 0.000001 |
| Unit | ConceptsxIncorExp | UnitOfMeasure.Description | Texto descriptivo | Ejemplo: "Pieza", "Servicio" |
| Description | ConceptsxIncorExp | Product.Description | Máximo 1000 caracteres | Descripción detallada |
| Price | ConceptsxIncorExp | InvoiceLine.UnitPrice | Decimal(18,6) | Precio unitario |
| Descuento | ConceptsxIncorExp | InvoiceLine.DiscountAmount | Decimal(18,2) | Opcional, puede ser null |
| ObjetoImp | ConceptsxIncorExp | Product.TaxObject | `02` si es gravado, `01` si exento | Normalmente `02` |
| Iva | ConceptsxIncorExp | InvoiceLine.IsTaxable | Boolean | true si causa IVA |

**Ejemplo de Mapeo:**
```
SYSPRO InvoiceLine:
  StockCode: "SERV-001"
  Description: "Servicio de consultoría empresarial"
  Quantity: 1.0
  UnitPrice: 5230.00
  DiscountAmount: 0.00
  TaxAmount: 836.80
  IsTaxable: true
  SATProductCode: "80101500"
  SATUnitCode: "E48"

→ Sistema Interno ConceptsxIncorExp:
  IdIncorExp: 118
  ClaveProdServ: "80101500"
  ClaveUnidad: "E48"
  NumeroIdentificacion: "SERV-001"
  Quantity: 1.000000
  Unit: "Servicio"
  Description: "Servicio de consultoría empresarial"
  Price: 5230.000000
  Descuento: null
  ObjetoImp: "02"
  Iva: true
```

---

## RESUMEN DE CAMPOS REQUERIDOS DE SYSPRO

### Para Configuración Inicial (Una vez):
1. **Company.TaxNumber** → RFC del emisor
2. **Company.Name** → Razón social del emisor
3. **Company.TaxRegime** → Régimen fiscal (mapear a código SAT)
4. **Company.PostalCode** → Código postal del lugar de expedición
5. **Company.DefaultTaxRate** → Tasa de IVA por defecto (16%)
6. **Certificado .cer** → Archivo de certificado digital SAT
7. **Llave .key** → Archivo de llave privada
8. **Contraseña de certificado** → Para desencriptar .key

### Por cada Cliente:
1. **Customer.CustomerCode** → Identificador único
2. **Customer.Name** → Razón social o nombre fiscal
3. **Customer.TaxNumber** → RFC del cliente
4. **Customer.PostalCode** → Código postal del domicilio fiscal
5. **Customer.TaxRegime** → Régimen fiscal (mapear a código SAT)
6. **Customer.DefaultUsoCFDI** → Uso que dará al CFDI (G03, G01, etc.)
7. **Customer.Email** → Para envío de XML/PDF

### Por cada Factura:
1. **Invoice.InvoiceNumber** → Número de factura (referencia)
2. **Invoice.InvoiceDate** → Fecha de emisión
3. **Invoice.CustomerCode** → Identificador del cliente
4. **Invoice.SubTotal** → Subtotal sin impuestos
5. **Invoice.TaxAmount** → Total de impuestos (IVA)
6. **Invoice.TotalAmount** → Total con impuestos
7. **Invoice.Currency** → Moneda (MXN, USD, EUR)
8. **Invoice.ExchangeRate** → Tipo de cambio (si currency≠MXN)
9. **Invoice.PaymentTerms** → Términos de pago en días (0=contado, >0=crédito)
10. **Invoice.PaymentMethod** → Método de pago (Efectivo, Transferencia, Tarjeta)

### Por cada Línea de Factura:
1. **InvoiceLine.ItemCode** → Código del producto/servicio
2. **InvoiceLine.Description** → Descripción detallada
3. **InvoiceLine.Quantity** → Cantidad
4. **InvoiceLine.UnitPrice** → Precio unitario
5. **InvoiceLine.DiscountAmount** → Descuento (opcional)
6. **InvoiceLine.TaxAmount** → IVA de la línea
7. **InvoiceLine.IsTaxable** → Si causa impuestos (true/false)
8. **Product.SATProductCode** → Clave ClaveProdServ del SAT
9. **Product.SATUnitCode** → Clave ClaveUnidad del SAT

---

## Contacto y Soporte

Para dudas sobre esta documentación o el proceso de integración:

**Equipo de Desarrollo**
- Email: desarrollo@empresa.com
- Fecha de creación: 7 de Octubre de 2025
- Versión del documento: 1.0

**Referencias SAT:**
- Anexo 20: http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm
- Catálogos CFDI 4.0: http://www.sat.gob.mx/sitio_internet/cfd/catalogos/catCFDI.xsd
- Estándar CFDI 4.0: http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd

---

**FIN DEL DOCUMENTO**
