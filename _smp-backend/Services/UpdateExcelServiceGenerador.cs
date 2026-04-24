using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using ClosedXML.Excel;

namespace SMP.Services
{
    public class UpdateExcelServiceGenerador : IUpdateExcelServiceGenerador
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<UpdateExcelServiceGenerador> _logger;
        private const int MaxRetryAttempts = 3;
        private const int RetryDelayMilliseconds = 2000;

        public UpdateExcelServiceGenerador(DbSmpContext dbContext, ILogger<UpdateExcelServiceGenerador> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private XLWorkbook OpenWorkbookWithRetry(string filePath)
        {
            for (int attempt = 1; attempt <= MaxRetryAttempts; attempt++)
            {
                try
                {
                    return new XLWorkbook(filePath);
                }
                catch (IOException ex) when (attempt < MaxRetryAttempts)
                {
                    _logger.LogWarning("Intento {Attempt} fallido al abrir el archivo. Reintentando en {Delay}ms... Error: {Error}",
                        attempt, RetryDelayMilliseconds, ex.Message);
                    Thread.Sleep(RetryDelayMilliseconds);
                }
            }
            throw new IOException($"No se pudo abrir el archivo después de {MaxRetryAttempts} intentos");
        }

        private void SaveWorkbookSafely(XLWorkbook workbook, string filePath)
        {
            var tempPath = Path.Combine(Path.GetTempPath(), $"temp_excel_{Guid.NewGuid()}.xlsx");
            try
            {
                workbook.SaveAs(tempPath);

                for (int attempt = 1; attempt <= MaxRetryAttempts; attempt++)
                {
                    try
                    {
                        File.Copy(tempPath, filePath, true);
                        _logger.LogInformation("Archivo guardado exitosamente en: {FilePath}", filePath);
                        return;
                    }
                    catch (IOException ex) when (attempt < MaxRetryAttempts)
                    {
                        _logger.LogWarning("Intento {Attempt} fallido al guardar. Reintentando en {Delay}ms... Error: {Error}",
                            attempt, RetryDelayMilliseconds, ex.Message);
                        Thread.Sleep(RetryDelayMilliseconds);
                    }
                }
                throw new IOException($"No se pudo guardar el archivo después de {MaxRetryAttempts} intentos");
            }
            finally
            {
                if (File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch { }
                }
            }
        }

        public string ModificarOInsertarOt(ExcelDataRequest data)
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "FORMATO_GENERADOR_NEW.xlsx");
            _logger.LogInformation("Intentando abrir archivo Excel en: {FilePath}", filePath);
            _logger.LogInformation("Directorio actual: {CurrentDir}", Directory.GetCurrentDirectory());

            if (!File.Exists(filePath))
            {
                _logger.LogError("Archivo no encontrado: {FilePath}", filePath);
                throw new FileNotFoundException($"Archivo Excel no encontrado en: {filePath}");
            }

            XLWorkbook workbook = null;
            try
            {
                workbook = OpenWorkbookWithRetry(filePath);
                var hoja = workbook.Worksheets.Skip(1).First();

                // Mapear columnas esperadas
                var columnasEsperadas = new Dictionary<string, string>()
                {
                    { "NUMERO_OS", "Número OS" },
                    { "INMUEBLE", "INMUEBLE" },
                    { "NOMBRE_SERVICIO", "Nombre del servicio" },
                    { "EQUIPO_EJECUTOR", "Equipo ejecutor" },
                    { "COLONIA", "Colonia" },
                    { "CALLE", "Calle" },
                    { "NUMERO", "Número" },
                    { "TRABAJO_REALIZADO", "Trabajo realizado" },
                    { "RESULTADO_TRABAJO", "Resultado del trabajo" },
                    { "CANTIDAD", "Cantidad" },
                    { "FECHA_ASIGNACION", "Fecha asignación" },
                    { "FECHA_EJECUCION", "Fecha ejecución" },
                    { "DIAS", "Días" },
                    { "AREA", "Área" },
                    { "VALIDADO", "Validado" },
                    { "OBSERVACIONES", "Observaciones" },
                    { "INCIDENCIA", "INCIDENCIA" }
                };

                var columnas = new Dictionary<string, int>();
                var headers = hoja.Row(1).Cells();

                for (int i = 0; i < headers.Count(); i++)
                {
                    var headerValue = headers.ElementAt(i).GetString().Trim();
                    foreach (var kvp in columnasEsperadas)
                    {
                        if (headerValue.Equals(kvp.Value, StringComparison.OrdinalIgnoreCase))
                        {
                            columnas[kvp.Key] = i + 1;
                            break;
                        }
                    }
                }

                // Crear columnas faltantes
                int siguienteColumna = headers.Count() + 1;
                foreach (var kvp in columnasEsperadas)
                {
                    if (!columnas.ContainsKey(kvp.Key))
                    {
                        columnas[kvp.Key] = siguienteColumna;
                        hoja.Cell(1, siguienteColumna).Value = kvp.Value;
                        siguienteColumna++;
                    }
                }


                // Siempre añade una nueva fila al final
                int ultimaFila = hoja.LastRowUsed()?.RowNumber() ?? 1;
                int nuevaFila = ultimaFila + 1;
                for (int col = 1; col <= 50; col++)
                {
                    var celda = hoja.Cell(nuevaFila, col);
                    if (celda.IsEmpty())
                        celda.Value = ""; // O puedes usar .SetValue<string>("")
                }

                var rangoFila = hoja.Range(nuevaFila, 1, nuevaFila, 46);
                ActualizarFila(hoja, nuevaFila, columnas, data);

                SaveWorkbookSafely(workbook, filePath);

                return $"Se añadió nueva fila en: {nuevaFila}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al modificar o insertar OT en Excel");
                throw;
            }
            finally
            {
                workbook?.Dispose();
            }
        }

        private void ActualizarFila(IXLWorksheet hoja, int fila, Dictionary<string, int> columnas, ExcelDataRequest data)
        {
            hoja.Cell(fila, columnas["NUMERO_OS"]).Value = data.NumeroOS;
            hoja.Cell(fila, columnas["INMUEBLE"]).Value = data.INMUEBLE;
            hoja.Cell(fila, columnas["NOMBRE_SERVICIO"]).Value = data.NombreDelServicio;
            hoja.Cell(fila, columnas["EQUIPO_EJECUTOR"]).Value = data.EquipoEjecutor;
            hoja.Cell(fila, columnas["COLONIA"]).Value = data.Colonia;
            hoja.Cell(fila, columnas["CALLE"]).Value = data.Calle;
            hoja.Cell(fila, columnas["NUMERO"]).Value = data.Numero;
            hoja.Cell(fila, columnas["TRABAJO_REALIZADO"]).Value = data.TrabajoRealizado;
            hoja.Cell(fila, columnas["RESULTADO_TRABAJO"]).Value = data.ResultadoDelTrabajo;
            hoja.Cell(fila, columnas["CANTIDAD"]).Value = data.Cantidad;
            hoja.Cell(fila, columnas["FECHA_ASIGNACION"]).Value = data.FechaAsignacion;
            hoja.Cell(fila, columnas["FECHA_EJECUCION"]).Value = data.FechaEjecucion;
            hoja.Cell(fila, columnas["DIAS"]).Value = data.Dias;
            hoja.Cell(fila, columnas["AREA"]).Value = data.Area;
            hoja.Cell(fila, columnas["VALIDADO"]).Value = data.Validado;
            hoja.Cell(fila, columnas["OBSERVACIONES"]).Value = data.Observaciones;
            hoja.Cell(fila, columnas["INCIDENCIA"]).Value = data.INCIDENCIA;
        }
        public string SearchIntervalOt(DateTime dateStart, DateTime dateEnd , int type)
        {
            XLWorkbook workbook = null;
            try
            {
                var listados = new List<int>();
                switch (type)
                {
                    case 1:
                        listados = _context.Projects
                            .Where(p => p.IdOilfield >= 47)
                            .Select(p => p.Id)
                            .ToList();
                        break;
                    case 2:
                        listados = _context.Projects
                            .Where(p => p.IdOilfield >= 47 && p.Classification == "Interna")
                            .Select(p => p.Id)
                            .ToList();
                        break;
                    case 3:
                        listados = _context.Projects
                            .Where(p => p.IdOilfield >= 47 && p.Classification == "Externa")
                            .Select(p => p.Id)
                            .ToList();
                        break;
                    default:
                        _logger.LogWarning("Tipo desconocido seleccionado: {Type}", type);
                        break;
                }
                _logger.LogInformation("IDs de proyectos obtenidos para el tipo {Type}: {Ids}", type, string.Join(", ", listados));

                // 1. Buscar registros "CONCEPT" en el rango de fechas
                var conceptos = _context.LogbookDetallada
                    .Where(l => l.Date >= dateStart && l.Date <= dateEnd && l.Typenote == "CONCEPT" && l.EstatusReporte == true && l.Id_project.HasValue && listados.Contains(l.Id_project.Value))
                    .ToList();

                if (!conceptos.Any())
                {
                    return $"No se encontraron registros CONCEPT entre {dateStart:yyyy-MM-dd} y {dateEnd:yyyy-MM-dd}";
                }

                // Abrir archivo Excel una sola vez
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "FORMATO_GENERADOR_NEW.xlsx");
                _logger.LogInformation("Intentando abrir archivo Excel en SearchIntervalOt: {FilePath}", filePath);

                if (!File.Exists(filePath))
                {
                    _logger.LogError("Archivo no encontrado en SearchIntervalOt: {FilePath}", filePath);
                    throw new FileNotFoundException($"Archivo Excel no encontrado en: {filePath}");
                }

                workbook = OpenWorkbookWithRetry(filePath);
                var hoja = workbook.Worksheets.Skip(1).First();

                // Mapear columnas esperadas (una sola vez)
                var columnasEsperadas = new Dictionary<string, string>()
                {
                    { "NUMERO_OS", "Número OS" },
                    { "INMUEBLE", "INMUEBLE" },
                    { "NOMBRE_SERVICIO", "Nombre del servicio" },
                    { "EQUIPO_EJECUTOR", "Equipo ejecutor" },
                    { "COLONIA", "Colonia" },
                    { "CALLE", "Calle" },
                    { "NUMERO", "Número" },
                    { "TRABAJO_REALIZADO", "Trabajo realizado" },
                    { "RESULTADO_TRABAJO", "Resultado del trabajo" },
                    { "CANTIDAD", "Cantidad" },
                    { "FECHA_ASIGNACION", "Fecha asignación" },
                    { "FECHA_EJECUCION", "Fecha ejecución" },
                    { "DIAS", "Días" },
                    { "AREA", "Área" },
                    { "VALIDADO", "Validado" },
                    { "OBSERVACIONES", "Observaciones" },
                    { "INCIDENCIA", "INCIDENCIA" }
                };

                var columnas = new Dictionary<string, int>();
                var headers = hoja.Row(1).Cells();

                for (int i = 0; i < headers.Count(); i++)
                {
                    var headerValue = headers.ElementAt(i).GetString().Trim();
                    foreach (var kvp in columnasEsperadas)
                    {
                        if (headerValue.Equals(kvp.Value, StringComparison.OrdinalIgnoreCase))
                        {
                            columnas[kvp.Key] = i + 1;
                            break;
                        }
                    }
                }

                // Crear columnas faltantes
                int siguienteColumna = headers.Count() + 1;
                foreach (var kvp in columnasEsperadas)
                {
                    if (!columnas.ContainsKey(kvp.Key))
                    {
                        columnas[kvp.Key] = siguienteColumna;
                        hoja.Cell(1, siguienteColumna).Value = kvp.Value;
                        siguienteColumna++;
                    }
                }

                // Limpiar datos existentes desde la fila 2
                var ultimaFilaConDatos = hoja.LastRowUsed()?.RowNumber() ?? 1;
                if (ultimaFilaConDatos > 1)
                {
                    var rangoABorrar = hoja.Range(2, 1, ultimaFilaConDatos, hoja.LastColumnUsed()?.ColumnNumber() ?? 1);
                    rangoABorrar.Clear(XLClearOptions.All);
                }

                var resultadosCompletos = new List<string>();
                int filaActual = 2; // Empezar desde la fila 2 (después del encabezado)

                // 2. Agrupar conceptos por Id_ot
                var conceptosPorOT = conceptos.GroupBy(c => c.Id_ot).ToList();

                foreach (var grupoOT in conceptosPorOT)
                {
                    var idOt = grupoOT.Key;
                    var conceptosDeEstaOT = grupoOT.ToList();

                    // 3. Obtener la OT original
                    var otOriginal = _context.OTs
                        .Where(o => o.Id == idOt)
                        .FirstOrDefault();

                    if (otOriginal == null)
                    {
                        _logger.LogWarning("No se encontró OT con ID {IdOt}", idOt);
                        continue; // Saltar si no existe la OT original
                    }

                    var otUsada = otOriginal;

                    // 4. Buscar OT más reciente para el mismo CDC
                    var otMasReciente = _context.OTs
                        .Where(o => o.CDC == otOriginal.CDC && o.RegisterDate > otOriginal.RegisterDate)
                        .OrderByDescending(o => o.RegisterDate)
                        .FirstOrDefault();

                    if (otMasReciente != null)
                    {
                        // Verificar si existe al menos un concepto equivalente en la OT más reciente
                        var hayCoincidencia = conceptosDeEstaOT.Any(concepto =>
                            _context.LogbookDetallada.Any(c =>
                                c.Id_ot == otMasReciente.Id &&
                                c.NombreConcepto == concepto.NombreConcepto &&
                                c.Date == concepto.Date
                            )
                        );

                        if (hayCoincidencia)
                        {
                            _logger.LogInformation("Usando OT más reciente {NuevaOT} en lugar de {ViejaOT} para CDC {CDC}",
                                otMasReciente.OtNumber, otOriginal.OtNumber, otOriginal.CDC);

                            otUsada = otMasReciente;
                        }
                        else
                        {
                            _logger.LogInformation("No se encontró concepto equivalente en OT más reciente. Se mantiene la OT original {OtNumber}", otOriginal.OtNumber);
                        }
                    }

                    // 5. Procesar cada concepto
                    foreach (var concepto in conceptosDeEstaOT)
                    {
                        // Buscar personal relacionado
                        var personal = _context.LogbookDetallada
                            .Where(l => l.Date == concepto.Date &&
                                        l.Id_ot == concepto.Id_ot &&
                                        l.Typenote == "PERSONAL")
                            .ToList();

                        // Formatear equipo ejecutor
                        string equipoEjecutor = "Sin personal";
                        if (personal.Any())
                        {
                            var primeros = personal.Select(p =>
                            {
                                var nombre = p.NombreEmpleado ?? "";
                                var partes = nombre.Split(' ');
                                return partes.Length > 0 ? partes[0] : "Sin nombre";
                            }).ToList();

                            // Obtener número de cuadrilla del primer registro personal
                            string numeroCuadrilla = "0";
                            var primerPersonal = personal.FirstOrDefault();
                            if (primerPersonal?.Cuadrilla != null)
                            {
                                // Extraer solo el número, removiendo la palabra "cuadrilla"
                                var cuadrillaTexto = primerPersonal.Cuadrilla.ToLower();
                                var cuadrillaParts = cuadrillaTexto.Split(new[] { "cuadrilla" }, StringSplitOptions.RemoveEmptyEntries);

                                // Si hay texto después de "cuadrilla", usarlo
                                if (cuadrillaParts.Length > 0)
                                {
                                    var numeroExtraido = cuadrillaParts[cuadrillaParts.Length - 1].Trim();
                                    if (!string.IsNullOrWhiteSpace(numeroExtraido))
                                    {
                                        numeroCuadrilla = numeroExtraido;
                                    }
                                }
                            }

                            string nombresFormateados;
                            if (primeros.Count == 1)
                                nombresFormateados = primeros[0];
                            else if (primeros.Count == 2)
                                nombresFormateados = $"{primeros[0]} Y {primeros[1]}";
                            else
                            {
                                var ultimo = primeros.Last();
                                var otros = string.Join(", ", primeros.Take(primeros.Count - 1));
                                nombresFormateados = $"{otros} Y {ultimo}";
                            }

                            equipoEjecutor = $"{numeroCuadrilla}({nombresFormateados})";
                        }

                        // Crear ExcelDataRequest
                        var excelData = new ExcelDataRequest
                        {
                            NumeroOS = otUsada?.OtNumber ?? "0",
                            INMUEBLE = int.TryParse(otUsada?.CDC, out int cdc) ? cdc : 0,
                            NombreDelServicio = otUsada?.Description ?? "",
                            EquipoEjecutor = equipoEjecutor,
                            Colonia = otUsada?.Neighborhood ?? "",
                            Calle = otUsada?.Address ?? "",
                            Numero = int.TryParse(otUsada?.AddressNumber, out int num) ? num : 0,
                            TrabajoRealizado = concepto.NombreConcepto ?? "",
                            ResultadoDelTrabajo = "EJECUTADO",
                            Cantidad = (int)concepto.Quantity,
                            FechaAsignacion = otUsada?.RegisterDate?.ToString("dd/MM/yyyy") ?? "",
                            FechaEjecucion = concepto.Date?.ToString("dd/MM/yyyy") ?? "",
                            Dias = (otUsada?.RegisterDate != null && concepto.Date != null)
                                ? Math.Max((concepto.Date.Value - otUsada.RegisterDate.Value).Days, 1)
                                : 1,
                            Area = otUsada?.Area ?? "",
                            Validado = concepto.Validado ?? "NO PAGO",
                            Observaciones = otUsada?.Results ?? "",
                            INCIDENCIA = "NO"
                        };

                        _logger.LogInformation("Procesando concepto {ConceptoId}: OT {OtId}, NumOS {NumOS}, Inmueble {CDC}",
                            concepto.Id, concepto.Id_ot, otUsada.OtNumber, otUsada.CDC);

                        // Agregar fila directamente en memoria (sin abrir/cerrar el archivo)
                        for (int col = 1; col <= 50; col++)
                        {
                            var celda = hoja.Cell(filaActual, col);
                            if (celda.IsEmpty())
                                celda.Value = "";
                        }

                        ActualizarFila(hoja, filaActual, columnas, excelData);

                        resultadosCompletos.Add(
                            $"Concepto {concepto.Id} (OS: {excelData.NumeroOS}, Trabajo: {excelData.TrabajoRealizado}): Se añadió en fila {filaActual}"
                        );

                        filaActual++;
                    }
                }

                // Guardar archivo una sola vez al final
                SaveWorkbookSafely(workbook, filePath);
                _logger.LogInformation("Archivo Excel guardado exitosamente con {Count} conceptos", conceptos.Count);

                var resultadoFinal = string.Join("\n", resultadosCompletos);
                _logger.LogInformation("Se procesaron {Count} conceptos en el Excel", conceptos.Count);

                return $"Se procesaron {conceptos.Count} conceptos:\n{resultadoFinal}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al buscar registros en el intervalo de fechas");
                return $"Error al buscar registros: {ex.Message}";
            }
            finally
            {
                workbook?.Dispose();
            }
        }
        
        public byte[] GetExcelFileOt()
        {
            try
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "FORMATO_GENERADOR_NEW.xlsx");
                _logger.LogInformation("Intentando leer archivo Excel para descarga: {FilePath}", filePath);
                if (!File.Exists(filePath))
                {
                    throw new FileNotFoundException("El archivo Excel no existe");
                }

                // Reintentar lectura del archivo si está bloqueado
                for (int attempt = 1; attempt <= MaxRetryAttempts; attempt++)
                {
                    try
                    {
                        return File.ReadAllBytes(filePath);
                    }
                    catch (IOException ex) when (attempt < MaxRetryAttempts)
                    {
                        _logger.LogWarning("Intento {Attempt} fallido al leer el archivo para descarga. Reintentando en {Delay}ms... Error: {Error}",
                            attempt, RetryDelayMilliseconds, ex.Message);
                        Thread.Sleep(RetryDelayMilliseconds);
                    }
                }

                // Si llegamos aquí, el último intento falló
                return File.ReadAllBytes(filePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener el archivo Excel");
                throw;
            }
        }
    }

    public interface IUpdateExcelServiceGenerador
    {
        string ModificarOInsertarOt(ExcelDataRequest data);
        string SearchIntervalOt(DateTime dateStart, DateTime dateEnd, int type);
        byte[] GetExcelFileOt();
    }
}