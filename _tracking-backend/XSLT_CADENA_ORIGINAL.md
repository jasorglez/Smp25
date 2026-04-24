# XSLT Oficial del SAT para Cadena Original - Guía Completa

## ¿Qué es el XSLT del SAT?

El **XSLT (eXtensible Stylesheet Language Transformations)** es un archivo oficial publicado por el SAT que define **exactamente** cómo transformar el XML de un CFDI en la **cadena original** que se usa para generar el sello digital.

## ¿Por qué es importante?

1. **Obligatorio para timbrado válido**: Sin la cadena original correcta, el PAC rechazará la factura
2. **Orden exacto**: Cada atributo debe aparecer en el orden específico definido por el SAT
3. **Validación del SAT**: El SAT valida que tu sello coincida con la cadena original generada por su XSLT
4. **Sin margen de error**: Un solo carácter fuera de lugar invalida toda la factura

## Ubicación Oficial del XSLT

### CFDI 4.0 (Actual)
```
URL: http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0.xslt
Versión: 4.0
Fecha publicación: 2022
```

### CFDI 3.3 (Obsoleto desde 2023)
```
URL: http://www.sat.gob.mx/sitio_internet/cfd/3/cadenaoriginal_3_3/cadenaoriginal_3_3.xslt
Versión: 3.3
Estatus: Obsoleto
```

## Implementación en el Sistema

### Dos Métodos Disponibles

#### 1. **XSLT Oficial del SAT** (Recomendado) ⭐

**Ventajas:**
- ✅ 100% compatible con el SAT
- ✅ Se actualiza automáticamente si el SAT modifica el XSLT
- ✅ No requiere mantenimiento manual
- ✅ Garantiza validación correcta

**Desventajas:**
- ⚠️ Requiere conexión a internet la primera vez
- ⚠️ Pequeño overhead al descargar el XSLT

**Configuración:**
```json
{
  "Finkok": {
    "UseXsltForCadenaOriginal": true  // ← Por defecto
  }
}
```

**Cómo funciona:**
1. Primera vez: Descarga el XSLT de `http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0.xslt`
2. Compila el XSLT en memoria
3. Aplica la transformación al XML de tu factura
4. Genera la cadena original exacta según el SAT
5. El XSLT compilado se mantiene en caché para futuras facturas

#### 2. **Método Manual** (Fallback)

**Ventajas:**
- ✅ No requiere conexión a internet
- ✅ Más rápido (no descarga nada)
- ✅ Funciona offline

**Desventajas:**
- ⚠️ Debe actualizarse manualmente si el SAT cambia el estándar
- ⚠️ Más complejo de mantener

**Configuración:**
```json
{
  "Finkok": {
    "UseXsltForCadenaOriginal": false  // Usar método manual
  }
}
```

### Comportamiento del Sistema

El sistema es **inteligente** y tiene fallback automático:

```
1. Si UseXsltForCadenaOriginal = true:
   ├─ Intenta descargar y usar XSLT del SAT
   │  ├─ ✓ Éxito → Usa XSLT
   │  └─ ✗ Error → Fallback a método manual (con warning en log)

2. Si UseXsltForCadenaOriginal = false:
   └─ Usa método manual directamente
```

## Ejemplo de Cadena Original

### XML de Entrada (simplificado):
```xml
<cfdi:Comprobante
    Version="4.0"
    Serie="A"
    Folio="123"
    Fecha="2025-10-06T12:30:45"
    SubTotal="1000.00"
    Total="1160.00"
    ...>
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa SA" .../>
    <cfdi:Receptor Rfc="BBB010101BBB" .../>
    <cfdi:Conceptos>
        <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1.000000" .../>
    </cfdi:Conceptos>
</cfdi:Comprobante>
```

### Cadena Original Resultante:
```
||4.0|A|123|2025-10-06T12:30:45|1000.00|1160.00|I|01|MXN|01234|AAA010101AAA|Empresa SA|601|BBB010101BBB|Cliente SA|12345|603|G01|01010101|1.000000|ACT|Servicio|100.00|100.00|02|100.00|002|Tasa|0.160000|16.00|16.00|002|Tasa|0.160000|16.00||
```

**Características:**
- Comienza con `||`
- Termina con `||`
- Cada campo separado por `|`
- Orden exacto según XSLT del SAT
- Incluye todos los atributos obligatorios
- Atributos opcionales vacíos también llevan su `|`

## Estructura de la Cadena Original

### Orden de Elementos (CFDI 4.0):

1. **Comprobante (atributos raíz)**
   - Version, Serie, Folio, Fecha, FormaPago, NoCertificado, Certificado, etc.

2. **InformaciónGlobal** (opcional)
   - Periodicidad, Meses, Año

3. **CfdiRelacionados** (opcional)
   - TipoRelacion, UUIDs relacionados

4. **Emisor**
   - Rfc, Nombre, RegimenFiscal

5. **Receptor**
   - Rfc, Nombre, DomicilioFiscalReceptor, RegimenFiscalReceptor, UsoCFDI

6. **Conceptos** (por cada concepto)
   - ClaveProdServ, Cantidad, ClaveUnidad, Descripcion, ValorUnitario, Importe, ObjetoImp
   - Impuestos del concepto (Traslados, Retenciones)

7. **Impuestos Totales**
   - TotalImpuestosRetenidos, TotalImpuestosTrasladados
   - Retenciones y Traslados

## Logs del Sistema

Cuando se genera la cadena original, verás logs como:

```
[DBG] Generating cadena original...
[DBG] Using SAT official XSLT for cadena original
[INF] Loading SAT official XSLT for CFDI 4.0
[INF] SAT XSLT loaded and compiled successfully
[DBG] Cadena original generated with XSLT. Length: 347
[TRC] Cadena original: ||4.0|A|123|2025-10-06T12:30:45|...||
```

Si hay error con XSLT:
```
[WRN] Failed to generate cadena original with XSLT, falling back to manual method
System.Net.Http.HttpRequestException: Error al descargar el XSLT del SAT...
[DBG] Using manual method for cadena original
[DBG] Cadena original generated manually. Length: 347
```

## Validación de la Cadena Original

### ¿Cómo verificar que es correcta?

1. **Longitud**: Debe ser significativa (generalmente 200-500+ caracteres)
2. **Formato**: Debe empezar y terminar con `||`
3. **Separadores**: Todos los campos separados por `|`
4. **No vacía**: Si tiene menos de 50 caracteres, probablemente está mal

### Herramientas de Validación

El SAT NO proporciona un validador público de cadena original, pero:
- ✅ **Finkok valida la cadena** al timbrar
- ✅ **El SAT valida** que el sello coincida con la cadena
- ❌ Si el sello es incorrecto, Finkok retorna error 304 o 305

## Troubleshooting

### Error: "Error al descargar el XSLT del SAT"

**Causa:** No hay conexión a internet o el sitio del SAT está caído

**Solución:**
1. Verifica tu conexión a internet
2. Intenta acceder manualmente a: http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0.xslt
3. Si el SAT está caído, el sistema usará método manual automáticamente
4. O configura `"UseXsltForCadenaOriginal": false`

### Error 304: "Sello digital inválido"

**Causa:** La cadena original no coincide con el sello generado

**Posibles razones:**
1. ❌ La llave privada (.key) no corresponde al certificado (.cer)
2. ❌ La contraseña de la e.firma es incorrecta
3. ❌ El XML fue modificado después de firmar
4. ❌ La cadena original se generó incorrectamente (muy raro con XSLT oficial)

**Solución:**
1. Verifica que .cer y .key sean del mismo certificado
2. Confirma la contraseña de la e.firma
3. Usa el XSLT oficial del SAT (`UseXsltForCadenaOriginal: true`)
4. Revisa los logs para ver la cadena original generada

### Error 305: "Cadena original incorrecta"

**Causa:** La estructura de la cadena original no cumple con el estándar del SAT

**Solución:**
1. **Usa el XSLT oficial** (prácticamente elimina este error)
2. Si usas método manual, verifica que el orden de elementos sea correcto
3. Revisa que no falten atributos obligatorios en el XML

## Actualización del XSLT

### ¿Qué pasa si el SAT actualiza el XSLT?

Con `UseXsltForCadenaOriginal: true`:
- ✅ **Automático**: El sistema descarga y usa la última versión
- ✅ No requiere cambios en tu código
- ✅ Siempre compatible con el SAT

Con `UseXsltForCadenaOriginal: false`:
- ⚠️ **Manual**: Debes actualizar `CadenaOriginalService.cs`
- ⚠️ Requiere pruebas después de cada cambio

## Recomendaciones

### Para Producción ⭐
```json
{
  "Finkok": {
    "UseXsltForCadenaOriginal": true  // ← RECOMENDADO
  }
}
```

**Razones:**
- Garantiza compatibilidad 100% con el SAT
- Se actualiza automáticamente
- Reduce errores 304 y 305
- No requiere mantenimiento

### Para Testing/Desarrollo
```json
{
  "Finkok": {
    "UseXsltForCadenaOriginal": false  // Para testing offline
  }
}
```

**Cuándo usar:**
- Testing sin conexión a internet
- Debugging de la cadena original
- Ambientes completamente aislados

## Referencias Oficiales

- **Portal del SAT - CFDI**: https://www.sat.gob.mx/consultas/
- **Estándar CFDI 4.0**: http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd
- **XSLT Cadena Original 4.0**: http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0.xslt
- **Guía de llenado**: Anexo 20 de la Resolución Miscelánea Fiscal

## Soporte Técnico

Si tienes dudas sobre la cadena original:
1. Revisa los logs del sistema (nivel Debug o Trace)
2. Compara tu cadena con ejemplos del SAT
3. Verifica que el XML cumpla con el XSD del SAT
4. Contacta a soporte de tu PAC (Finkok) con el XML y la cadena generada
