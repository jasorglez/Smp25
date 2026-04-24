using System.IO;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.View;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

public class IngresosExcelService : IIngresosExcelService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<IngresosExcelService> _logger;

    public IngresosExcelService(DbTrackingContext context, ILogger<IngresosExcelService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    public async Task<byte[]> ProcesadorExcel(string FechaIncio, string FechaFin, string Type)
    {
        try
        {
            string[] Trimestre = [
                "Primer Trimestre", "Segundo Trimestre","Tercer Trimestre","Cuarto Trimestre",
                "Quinto Trimestre","Sexto Trimestre","Séptimo Trimestre","Octavo Trimestre",
                "Noveno Trimestre","Décimo Trimestre","Undécimo Trimestre","Duodécimo Trimestre",
                "Decimotercer Trimestre","Decimocuarto Trimestre","Decimoquinto Trimestre","Decimosexto Trimestre",
                "Decimoséptimo Trimestre","Decimoctavo Trimestre","Decimonoveno Trimestre","Vigésimo Trimestre",
                "Vigésimo primer Trimestre","Vigésimo segundo Trimestre","Vigésimo tercer Trimestre",
                "Vigésimo cuarto Trimestre","Vigésimo quinto Trimestre","Vigésimo sexto Trimestre",
                "Vigésimo séptimo Trimestre","Vigésimo octavo Trimestre","Vigésimo noveno Trimestre",
                "Trigésimo Trimestre","Trigésimo primer Trimestre","Trigésimo segundo Trimestre",
                "Trigésimo tercer Trimestre","Trigésimo cuarto Trimestre","Trigésimo quinto Trimestre",
                "Trigésimo sexto Trimestre","Trigésimo séptimo Trimestre","Trigésimo octavo Trimestre",
                "Trigésimo noveno Trimestre","Cuadragésimo Trimestre","Cuadragésimo primer Trimestre",
                "Cuadragésimo segundo Trimestre"
];

            _logger.LogInformation("Iniciando la generación de reporte Excel para el tipo {Type} desde {FechaInicio} hasta {FechaFin}", Type, FechaIncio, FechaFin);
            
            // Construir la ruta de forma robusta, relativa a la ubicación del ensamblado de la aplicación.
            // Esto evita problemas con el directorio de trabajo en entornos de servidor.
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "ingreso_HJM_NUNKINI.xlsx");
            _logger.LogError("La ruta esperada: {FilePath}", filePath);
            if (!File.Exists(filePath))
            {
                _logger.LogError("No se encontró el archivo de plantilla de Excel en la ruta esperada: {FilePath}", filePath);
                throw new FileNotFoundException($"Archivo Excel no encontrado en: {filePath}");
            }

            using var workbook = new XLWorkbook(filePath);
            var hoja = workbook.Worksheets.First();

            var ultimaFilaConDatos = hoja.LastRowUsed()?.RowNumber() ?? 1;
            var ultimaColumnaConDatos = hoja.LastColumnUsed()?.ColumnNumber() ?? 4;

            // Borrar datos antiguos del reporte
            if (ultimaFilaConDatos > 1 && ultimaColumnaConDatos >= 4)
            {
                var rangoABorrar = hoja.Range(2, 4, ultimaFilaConDatos, ultimaColumnaConDatos);
                rangoABorrar.Clear(XLClearOptions.All);
            }

            // 1. Parsear las fechas de entrada
            if (!DateTime.TryParseExact(FechaIncio, "yyyy-MM", null, System.Globalization.DateTimeStyles.None, out var fechaInicio) ||
                !DateTime.TryParseExact(FechaFin, "yyyy-MM", null, System.Globalization.DateTimeStyles.None, out var fechaFin))
            {
                _logger.LogWarning("Formato de fecha inválido. Se esperaba 'yyyy-MM'. FechaInicio: {FechaInicio}, FechaFin: {FechaFin}", FechaIncio, FechaFin);
                throw new ArgumentException("El formato de las fechas es inválido. Utilice 'yyyy-MM'.");
            }
            var fechaFinAjustada = fechaFin.AddMonths(1).AddDays(-1);

            // Generar la lista de meses para las columnas del Excel
            List<DateTime> meses = new List<DateTime>();
            DateTime actual = fechaInicio;
            while (actual <= fechaFin)
            {
                meses.Add(actual);
                actual = actual.AddMonths(1);
            }

            // Mapeo de conceptos: [Clave: Nombre en BD] -> [Valor: Nombre en Excel]
            // La clave (izquierda) es el nombre que viene del sistema/base de datos.
            var mapeoConceptos = new Dictionary<string, string>
            {
                 // --- INGRESOS PROPIOS ---
                // 1.- IMPUESTOS
                { "1.1. PREDIAL", "1.1.-Predial" },
                { "1.2 Sobre Espectaculo Publicos", "1.2.-Sobre espectaculos publicos" },
                { "1.3 Sobre Adquisicion de Inmuebles", "1.3.-sobre adquisiciòn de inmuebles" }, // Mantener acento si es consistente
                // 2.- DERECHOS
                { "2.1 Derechos de Piso", "Derecho de piso" },
                { "2.2 Servicios de Panteones", "Servicio de pantiones" },
                { "2.3 Servicios de recoleccion de Basura", "Servicio de recolecciòn de basura" },
                { "2.4 Por uso de Rastro Publico", "Por uso de Rastro publico" },
                { "2.5 Por uso de Suelo", "Por uso de suelo" },
                { "2.6 Licencias de Funcionamiento", "Licencia  de funcionamiento" },
                { "2.7 Por uso de la via Publica", "Por uso de la via publica" },
                { "2.8 Certificados", "Certificados" },
                { "2.9 Constancias", "Constancias" },
                { "2.10 Duplicados", "Duplicados" },
                { "2.11 Documentos de Compra Venta", "Documentos de compra venta" },
                { "2.12 Otros Derechos", "Otros derechos" },
                // 3.- PRODUCTOS
                { "3.1 Panteo Municipal (Lotes y Nichos)", "Panteon Municipal (Lotes y Nichos)" },
                { "3.2 Panteon Municipal (Bovedas)", "Panteon Municipal (Boveda)" },
                { "3.3 Mercado Publico y Locales Comerciales", "Mercado publico y Locales Comerciales" },
                { "3.4 Baños Publicos", "Baños publicos" },
                { "3.5 Otros Productos (Ferias y Tradiciones)", "Otros Productos (Ferias Tradicioners)" },
                // 4.- APROVECHAMIENTOS
                { "4.1 Rezagos", "Rezagos" },
                { "4.2 Multas", "Multas" },
                // --- INGRESOS POR PARTICIPACIÓN ---
                // 5.- PARTICIPACIONES
                { "5.1 Fondo Municipal", "Fondo Municipal" },
                { "5.2 Fondo Estatal", "Fondo Estatal" }, // Corregido
                { "5.2.1 Complemento de Fondo Estatal", "Complemento de Fondo Estatal" },
                { "5.3 Fondo Municipal  de Prima Vacacional", "Fondo Municipal  de Prima Vacacional" },
                // --- INGRESOS EXTRAORDINARIOS ---
                // 6.- APOYO EXTRAORDINARIOS
                { "6.1 Donaciones", "Donaciones" },
                { "6.2 Devoluciones Pago ISR", "Deboluciones pago de ISR" },
                { "6.3 Apoyo Extraordinario", "Apoyo Extraordinario" },
                { "6.4 Otros Apoyos (Aguinaldo)", "Otros Apoyos (Aguinaldo)" },
                // --- OTROS INGRESOS ---
                { "7.- Ajuste Anual", "7.-Ajuste Anual" },
                { "8.- Prestamo", "8.- Prestamo" },
                { "total de ingresos del mes", "total de ingresos del mes" }
            };

            // Se crea el mapeo de Nombre en Excel a número de fila
            var conceptoFilaMap = new Dictionary<string, int>();
            foreach (var cell in hoja.Column(3).CellsUsed(c => c.Address.RowNumber >= 9)) // Asumiendo que los conceptos empiezan en la fila 5
            {
                conceptoFilaMap[cell.GetString().Trim()] = cell.Address.RowNumber;
            }

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
            _logger.LogInformation("Consultando datos de la base de datos para el rango de {FechaInicio} a {FechaFinAjustada}", fechaInicio, fechaFinAjustada);
            var datosCompletos = await (
                from master in _context.Incomeandexpenses
                join concept in _context.ConceptsxIncorExps on master.Id equals concept.IdIncorExp
                join catalog in _context.Catalogs on concept.IdCatIng equals catalog.Id
                where indicadores.Contains(master.IdAccount.Value)
                    && master.Date.HasValue
                    && master.Date.Value >= fechaInicio
                    && master.Date.Value <= fechaFinAjustada
                    && master.Active
                    && concept.Active
                select new
                {
                    master.Date,
                    ConceptoNombre = catalog.Description,
                    concept.Total
                }
            ).ToListAsync();

            // Agrupar los resultados por mes y concepto en memoria
            var datosAgrupados = datosCompletos
                .GroupBy(d => new { Year = d.Date.Value.Year, Month = d.Date.Value.Month, d.ConceptoNombre })
                .Select(g => new
                {
                    g.Key.Year,
                    g.Key.Month,
                    g.Key.ConceptoNombre,
                    TotalMes = g.Sum(x => x.Total)
                })
                .ToList();

            int columna = 4; // D
            int trimestreIndex = 0;
            for (int i = 0; i < meses.Count; i += 3)
            {
                var celdaTrimestre = hoja.Range(7, columna, 7, columna + 2).Merge();
                celdaTrimestre.Value = Trimestre[trimestreIndex];
                celdaTrimestre.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                // Iterar sobre los 3 meses del trimestre actual
                for (int j = 0; j < 3 && (i + j) < meses.Count; j++)
                {
                    var mes = meses[i + j];
                    hoja.Cell(8, columna).Value = mes.ToString("MMM-yyyy", System.Globalization.CultureInfo.InvariantCulture).ToUpper();
                    var datosDelMes = datosAgrupados.Where(d => d.Year == mes.Year && d.Month == mes.Month);

                    foreach (var dato in datosDelMes)
                    {
                        if (mapeoConceptos.TryGetValue(dato.ConceptoNombre, out var nombreEnExcel) && conceptoFilaMap.TryGetValue(nombreEnExcel, out int fila))
                        {
                            hoja.Cell(fila, columna).Value = dato.TotalMes;
                            _logger.LogInformation("Insertando en Fila: {Fila}, Columna: {Columna}, Concepto: {Concepto}, Monto: {Monto}", fila, columna, dato.ConceptoNombre, dato.TotalMes);
                        }
                        else
                        {
                            _logger.LogWarning("-------El concepto '{Concepto}' de la BD no tiene un mapeo definido o no se encontró en el Excel.", dato.ConceptoNombre);
                        }
                    }
                    var celdaTotal = hoja.Cell(55, columna);
                    celdaTotal.FormulaA1 = $"=SUM({hoja.Cell(10, columna).Address.ColumnLetter}10:{hoja.Cell(54, columna).Address.ColumnLetter}54)";
                    columna++;
                }
                
                // Corregir el rango para la celda combinada del total del trimestre.
                // Debe basarse en las columnas del trimestre recién procesado.
                var rangoTotalTrimestre = hoja.Range(56, columna - 3, 56, columna - 1);
                rangoTotalTrimestre.Merge().Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                // Asignar la fórmula solo a la primera celda del rango combinado.
                var celdaFormulaTrimestre = hoja.Cell(56, columna - 3);
                celdaFormulaTrimestre.FormulaA1 = $"=SUM({hoja.Cell(55, columna - 3).Address.ColumnLetter}55:{hoja.Cell(55, columna - 1).Address.ColumnLetter}55)";
                trimestreIndex++;
            }
                var medio = (columna / 2) -1;
                var TextenceterName = hoja.Range(2, medio, 2, medio + 2).Merge();
                TextenceterName.Value = "NUNKINI";
                TextenceterName.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                TextenceterName.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                TextenceterName.Style.Font.Bold = true;

                var TextenceterCalle = hoja.Range(3, medio, 3, medio + 2).Merge();
                TextenceterCalle.Value = "RFC: MCC740101EN9   C. 22, San Francisco, 24910";
                TextenceterCalle.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                TextenceterCalle.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                TextenceterCalle.Style.Font.Bold = true;

                var TextenceterCyte = hoja.Range(4, medio, 4, medio + 2).Merge();
                TextenceterCyte.Value = "Nunkini, Campeche";
                TextenceterCyte.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                TextenceterCyte.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                TextenceterCyte.Style.Font.Bold = true;

                string rutaImagen = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "nunkini.jpg");
                if (File.Exists(rutaImagen))
                {
                    var imagen = hoja.AddPicture(rutaImagen)
                                    .MoveTo(hoja.Cell(1, columna -1)) // fila 1, columna calculada
                                    .WithSize(120, 120);         // tamaño en píxeles (ajústalo)
                }
                else
                {
                    throw new FileNotFoundException($"Archivo Excel no encontrado en: {rutaImagen}");
                    _logger.LogWarning("No se encontró la imagen en la ruta: {Ruta}", rutaImagen);
                }

                

            // Aplicar bordes a toda la tabla generada
            if (meses.Count > 0)
            {
                // El rango va desde la columna de conceptos (C) hasta la última columna con datos.
                // Y desde la fila de encabezados de trimestre (3) hasta la fila de totales de trimestre (52).
                var rangoTabla = hoja.Range(7, 3, 56, columna - 1);
                rangoTabla.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
                rangoTabla.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);

                // Aplicar formato de contabilidad a las celdas con dinero
                // El rango va desde la fila 5 hasta la 52, y desde la columna D hasta la última columna con datos.
                var rangoDinero = hoja.Range(10, 4, 56, columna - 1);
                rangoDinero.Style.NumberFormat.Format = "_(\"$\"* #,##0.00_);_(\"$\"* (#,##0.00);_(\"$\"* \"-\"??_);_(@_)";
            }
            
            // Guardar el libro de trabajo en un stream de memoria en lugar de un archivo físico
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

public interface IIngresosExcelService
{
    Task<byte[]> ProcesadorExcel(string FechaIncio, string FechaFin, string Type);
}
