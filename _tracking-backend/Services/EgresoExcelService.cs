using System.IO;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.View;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

public class EgresosExcelService : IEgresosExcelService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<EgresosExcelService> _logger;
    private readonly IIncomeAndExpenseService _incomeAndExpenseService;


    public EgresosExcelService(DbTrackingContext context, ILogger<EgresosExcelService> logger, IIncomeAndExpenseService incomeAndExpenseService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _incomeAndExpenseService = incomeAndExpenseService ?? throw new ArgumentNullException(nameof(incomeAndExpenseService));
    }
    public async Task<byte[]> ProcesadorExcelEgresos(string Mes, int idCompany, string Type)
    {
        try
        {            
            // Construir la ruta de forma robusta
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "egresos_HJM_NUNKINI.xlsx");
            _logger.LogInformation("Cargando plantilla de Excel desde: {FilePath}", filePath);
            if (!File.Exists(filePath))
            {
                _logger.LogError("No se encontró el archivo de plantilla de Excel en la ruta esperada: {FilePath}", filePath);
                throw new FileNotFoundException($"Archivo Excel no encontrado en: {filePath}");
            }


            using var workbook = new XLWorkbook(filePath);
            var hoja = workbook.Worksheets.First();

            // Limpiar datos antiguos (si es necesario)
            var ultimaFilaConDatos = hoja.LastRowUsed()?.RowNumber() ?? 1;
            var ultimaColumnaConDatos = hoja.LastColumnUsed()?.ColumnNumber() ?? 1;
            if (ultimaFilaConDatos >= 2)
            {
                var rangoLimpiar = hoja.Range(2, 1, ultimaFilaConDatos, 4);
                rangoLimpiar.Clear(); // Limpia contenido, comentarios y celdas combinadas
                rangoLimpiar.Style = workbook.Style; // Restablece el estilo (quita colores y bordes)
            }

            // 1. Parsear la fecha de entrada
            if (!DateTime.TryParseExact(Mes, "yyyy-MM", null, System.Globalization.DateTimeStyles.None, out var fechaInicioMes))
            {
                _logger.LogWarning("Formato de fecha inválido. Se esperaba 'yyyy-MM'. Mes: {Mes}", Mes);
                throw new ArgumentException("El formato de la fecha es inválido. Utilice 'yyyy-MM'.");
            }
            var fechaFinMes = fechaInicioMes.AddMonths(1).AddDays(-1);

            // 2. Determinar los IDs de las cuentas a consultar
            List<int> indicadores;
            switch (Type)
                {
                case "ESTATAL":
                    indicadores = [30];
                    break;
                case "MUNICIPAL":
                    indicadores = [31];
                    break;
                case "PROPIA":
                    indicadores = [34];
                    break;
                case "GENERAL":
                    indicadores = [30, 31, 34];
                    break;
                default:
                    _logger.LogWarning("Tipo de reporte no válido: {Type}", Type);
                    throw new ArgumentException("El tipo de reporte no es válido.");
            }

            // 3. Obtener TODOS los datos de la BD en una sola consulta optimizada
            SaldoEIngresosDto monto = new SaldoEIngresosDto { SaldoInicial = 0, IngresosMes = 0 };

            foreach (var indicador in indicadores)
            {
                var resultado = await _incomeAndExpenseService.GetSaldoEIngresosMes(indicador, fechaInicioMes, fechaFinMes);
                monto.SaldoInicial += resultado.SaldoInicial;
                monto.IngresosMes += resultado.IngresosMes;
            }
            
            _logger.LogInformation("Consultando datos de egresos para el mes {Mes} y compañía {IdCompany}, SaldoInicial: {SaldoInicial}, IngresosMes: {IngresosMes}", Mes, idCompany, monto?.SaldoInicial, monto?.IngresosMes);
            var datosAgrupados = await _context.ViewEgresos
                .Where(e => e.IdBusinnes == idCompany
                            && e.DateExpend >= fechaInicioMes
                            && e.DateExpend <= fechaFinMes
                            && indicadores.Contains(e.IdAccount))
                .GroupBy(e => e.Nivel4) // Agrupamos por el concepto de nivel 4
                .Select(g => new
                {
                    Nivel4 = g.Key,
                    CodigoNivel1 = g.Max(x => x.CodigoNivel1),
                    Nivel1 = g.Max(x => x.Nivel1),
                    CodigoNivel4 = g.Max(x => x.CodigoNivel4),
                    Total = g.Sum(x => x.Total)
                })
                .OrderBy(e => e.CodigoNivel1).ThenBy(e => e.CodigoNivel4)
                .ToListAsync();

            _logger.LogInformation("Se encontraron {Count} grupos de egresos.", datosAgrupados.Count);

            // 5. Llenar la hoja de Excel escribiendo filas dinámicamente
            var mes = fechaInicioMes.ToString("MMMM yyyy", new System.Globalization.CultureInfo("es-ES")).ToUpper();
            var rangoTitulo = hoja.Range(2, 1, 2, 4).Merge();
            rangoTitulo.Value = "INFORME DE EGRESOS CORRESPONDIENTES AL MES DE " + mes + " DE LOS INGRESOS " + Type + " DE LA HJMN";
            rangoTitulo.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            rangoTitulo.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            rangoTitulo.Style.Font.Bold = true;
            rangoTitulo.Style.Fill.BackgroundColor = XLColor.CadmiumYellow;

            hoja.Cell(3, 1).Value ="CONCEPTO";
            hoja.Range(3, 1, 3, 4).Style.Font.Bold = true; // Negrita para resaltar
            hoja.Range(3, 1, 3, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; // Negrita para resaltar
            hoja.Range(3, 1, 3, 4).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center; // Negrita para resaltar
            hoja.Cell(3, 2).Value ="SUBTOTAL";
            hoja.Cell(3, 3).Value ="TOTAL";
            hoja.Cell(3, 4).Value ="%";
            int filaActual = 4; // Comenzamos a escribir a partir de la fila 10 (debajo de la fecha)

            // Agrupamos en memoria por Nivel 1 para crear las secciones
            var gruposNivel1 = datosAgrupados.GroupBy(g => new { g.CodigoNivel1, g.Nivel1 });

            foreach (var grupo in gruposNivel1)
            {
                var itemsValidos = grupo.Where(d => !string.IsNullOrEmpty(d.Nivel4)).ToList();
                int cantidadItems = itemsValidos.Count;

                // 1. Escribir cabecera del Nivel 1 (Ej: 1000 SERVICIOS PERSONALES) y su Total
                hoja.Cell(filaActual, 1).Value = grupo.Key.CodigoNivel1 + " " + grupo.Key.Nivel1;
                hoja.Cell(filaActual, 1).Style.Font.Bold = true; // Negrita para resaltar

                if (cantidadItems > 0)
                {
                    hoja.Cell(filaActual, 3).FormulaA1 = $"=SUM(B{filaActual + 1}:B{filaActual + cantidadItems})";
                }
                else
                {
                    hoja.Cell(filaActual, 3).Value = 0;
                }

                hoja.Cell(filaActual, 3).Style.Font.Bold = true;
                filaActual++;

                // 2. Escribir los items de Nivel 4 pertenecientes a este grupo
                foreach (var dato in itemsValidos)
                {
                    hoja.Cell(filaActual, 1).Value = "   " + dato.CodigoNivel4 + " " + dato.Nivel4; // Con sangría visual
                    hoja.Cell(filaActual, 2).Value = dato.Total; // Valor en columna SUBTOTAL (2)
                    filaActual++;
                }
            }
            var rangoTitulo2 = hoja.Range(filaActual, 1, filaActual, 2).Merge();
            rangoTitulo2.Value = "TOTAL DE EGRESOS";
            rangoTitulo2.Style.Font.Bold = true;
            rangoTitulo2.Style.Fill.BackgroundColor = XLColor.CadmiumYellow;
            var celdaTotal = hoja.Cell(filaActual, 3);
            celdaTotal.FormulaA1 =  $"=SUM(C4:C{filaActual - 1})";
            celdaTotal.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            celdaTotal.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            celdaTotal.Style.Font.Bold = true;
            celdaTotal.Style.Fill.BackgroundColor = XLColor.CadmiumYellow;
            var celdaTotal2 = hoja.Cell(filaActual, 4);
            celdaTotal2.Style.Fill.BackgroundColor = XLColor.CadmiumYellow;

            // Aplicar bordes a toda la tabla
            var rangoTabla = hoja.Range(2, 1, filaActual, 4);
            rangoTabla.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            rangoTabla.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);

            var newFila = filaActual + 2; 
            var Tabla2 = hoja.Range(newFila, 1, newFila, 3).Merge();
            Tabla2.Value = "RESUMEN DE INGRESOS Y EGRESOS DEL MES DE " + mes;
            Tabla2.Style.Font.Bold = true;
            Tabla2.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            Tabla2.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            Tabla2.Style.Fill.BackgroundColor = XLColor.CadmiumYellow;

            newFila++;
            var Tabla3 = hoja.Range(newFila, 1, newFila, 2).Merge();
            Tabla3.Value = "SALDO INICIAL";
            Tabla3.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            Tabla3.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            hoja.Cell(newFila, 3).Value = monto?.SaldoInicial ?? 0;

            newFila++;
            var Tabla4 = hoja.Range(newFila, 1, newFila, 2).Merge();
            Tabla4.Value = "(MAS) + INGRESOS DEL MES";
            Tabla4.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            Tabla4.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            hoja.Cell(newFila, 3).Value = monto?.IngresosMes ?? 0;

            newFila++;
            var Tabla5 = hoja.Range(newFila, 1, newFila, 2).Merge();
            Tabla5.Value = "(IGUAL) = TOTAL DISPONIBLES EN EL MES";
            Tabla5.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            Tabla5.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            var datoEgresos = hoja.Cell(newFila, 3);
            datoEgresos.FormulaA1 = $"=SUM(C{newFila - 2}:C{newFila - 1})";

            newFila++;
            var Tabla6 = hoja.Range(newFila, 1, newFila, 2).Merge();
            Tabla6.Value = "(MENOS) - EGRESOS DEL MES";
            Tabla6.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            Tabla6.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            var datoEgresos2 = hoja.Cell(newFila, 3);
            datoEgresos2.FormulaA1 = $"=C{filaActual}";

            newFila++;
            var Tabla7 = hoja.Range(newFila, 1, newFila, 2).Merge();
            Tabla7.Value = "(IGUAL) = SALDO FINAL DEL MES";
            Tabla7.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            Tabla7.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            var datoEgresos3 = hoja.Cell(newFila, 3);
            datoEgresos3.FormulaA1 = $"=C{newFila-2}-C{newFila-1}";

            var rangoTabla2 = hoja.Range(filaActual + 2, 1, newFila, 3);
            rangoTabla2.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            rangoTabla2.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);


            var firma = newFila + 3;
            hoja.Cell(firma, 1).Value ="TESORERO";
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; // Negrita para resaltar
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center; // Negrita para resaltar
            hoja.Cell(firma, 2).Value ="SINDICO DE HACIENDA";
            hoja.Cell(firma, 4).Value ="PRESIDENTE";


            firma= firma + 3;
            hoja.Cell(firma, 1).Value ="________________";
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; // Negrita para resaltar
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center; // Negrita para resaltar
            hoja.Cell(firma, 2).Value ="________________";
            hoja.Cell(firma, 4).Value ="________________";

            firma++;    
            hoja.Cell(firma, 1).Value ="C. FELIX COLLI CHIM";
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center; // Negrita para resaltar
            hoja.Range(firma, 1, firma, 4).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center; // Negrita para resaltar
            hoja.Cell(firma, 2).Value ="MTRO. FELIPE CAHUM HAAS";
            hoja.Cell(firma, 4).Value ="C. RAFAEL RENE";

            // Aplicar formato de moneda
            // Ajustamos el rango para que aplique formato a las columnas 2 (Subtotal) y firma (Total) desde la fila 4
            var rangoDinero = hoja.Range(4, 2, hoja.LastRowUsed()?.RowNumber() ?? 4, 3);
            rangoDinero.Style.NumberFormat.Format = "_(\"$\"* #,##0.00_);_(\"$\"* (#,##0.00);_(\"$\"* \"-\"??_);_(@_)";

            // Guardar los cambios explícitamente en el archivo "principal" (disco)
            workbook.Save();

            // 6. Guardar el libro en memoria y devolver los bytes
            using (var stream = new MemoryStream())
            {
                workbook.SaveAs(stream);
                return stream.ToArray();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar el archivo Excel.");
            throw;
        }
    }

}

public interface IEgresosExcelService
{
    Task<byte[]> ProcesadorExcelEgresos(string Mes, int idCompany, string Type);
}
