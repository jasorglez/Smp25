# Importar materiales desde Excel

En **Compras → Materiales**, abrir **Importar materiales**. La opción también está disponible en las pantallas que comparten el catálogo de materiales.

1. Seleccionar la empresa en el sidebar.
2. Descargar **Formato Excel** (vacío) o **Ejemplo** (dos filas ilustrativas).
3. Preparar la hoja `Materiales`, usando los nombres incluidos en las hojas `Familias`, `Subfamilias` y `Unidades` de esa empresa.
4. Subir el archivo `.xlsx` o `.xls`, revisar la vista previa y corregir las observaciones por número de fila.
5. Confirmar la carga con **Importar N materiales**. El servidor valida nuevamente el lote antes de guardarlo.

## Formato

| Columna | Obligatoria | Indicaciones |
| --- | --- | --- |
| Insumo | Sí | Clave única, hasta 35 caracteres. Usar texto para conservar ceros iniciales. |
| Descripcion | Sí | Hasta 1000 caracteres; no debe repetirse en el archivo ni en la empresa. |
| Familia | Sí | Nombre de una familia activa de la empresa. |
| Subfamilia | Sí | Nombre de una subfamilia activa que pertenezca a la familia indicada. |
| Unidad | Sí | Nombre de una unidad activa de la empresa. |
| CodigoBarras | No | Texto, máximo 50 caracteres. |
| CostoMN | No | Número no negativo, máximo dos decimales. Vacío equivale a 0. |
| VentaMN | No | Número no negativo, máximo dos decimales. Vacío equivale a 0. |
| StockMin | No | Entero no negativo. Vacío equivale a 0. |
| StockMax | No | Entero mayor o igual a StockMin. Vacío equivale a 0. |
| GramosPorMetro | No | Positivo, máximo cuatro decimales. Dejar vacío si no corresponde. |

No cambiar los encabezados ni el nombre de la hoja. Los nombres pueden escribirse sin distinguir mayúsculas y acentos. Los insumos y descripciones duplicados se comparan sin distinguir mayúsculas, acentos y espacios adicionales. Los nombres ambiguos en los catálogos deben corregirse antes de importar. No se crean familias, subfamilias o unidades automáticamente.

El límite es de 5000 filas de materiales y 10 MB por archivo; eliminar filas vacías sobrantes o dividir archivos más grandes. Las fórmulas se deben reemplazar por valores. La vista previa muestra las primeras 50 filas y hasta 100 observaciones a la vez.

## Comportamiento

La importación crea materiales nuevos de tipo `CONSUMABLE`, como el alta habitual de esta pantalla, con existencia inicial 0. Las existencias se registran mediante entradas de almacén. No sobrescribe, reactiva ni elimina materiales existentes, ni importa imágenes, marcas o conversiones adicionales.

Los cambios pendientes del listado se deben guardar o deshacer antes de abrir la importación. Al cambiar de empresa se descartan el archivo y la vista previa. Los resultados de consultas atrasadas no se aplican a otra empresa. La confirmación indica la empresa y el número de materiales a crear.

`POST /api/Material/import` recibe la empresa y las filas en una única petición autenticada. El servidor resuelve los catálogos dentro de esa empresa, comprueba duplicados y guarda todo el lote en una transacción serializable. Cualquier error revierte el lote completo. Ante una interrupción de red, consultar el listado antes de reintentar. No requiere tablas nuevas ni cambios de permisos. Deben desplegarse frontend y Warehouse.

## Validación

Se probaron: Excel real de ida y vuelta, códigos con ceros iniciales, columnas obligatorias, valores numéricos, stock, duplicados normalizados y límite de filas. Las pruebas del controlador con tablas temporales verificaron el alta por lote, rechazo de materiales existentes y catálogos de otra empresa, y reversión completa ante un error de base de datos. No se importaron materiales en tablas reales. La revisión visual y el despliegue siguen pendientes.
