using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using SMP.Models.TD;
using ClosedXML.Excel;

namespace SMP.Services
{
    public class UpdateExcelServiceExternas : IUpdateExcelServiceExternas
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<UpdateExcelServiceExternas> _logger;
        private const int MaxRetryAttempts = 3;
        private const int RetryDelayMilliseconds = 2000;

        public UpdateExcelServiceExternas(DbSmpContext dbContext, ILogger<UpdateExcelServiceExternas> logger)
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


        public string SearchIntervalCuadExter(DateTime dateStart, DateTime dateEnd, List<string> seleccionados)
        {
            XLWorkbook workbook = null;
            try
            {
                // Limpiar datos existentes del Excel desde la fila 2
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "CALCULO_DE_PAGO_A_CUADRILLA_EXTERNAS.xlsx");
                _logger.LogInformation("Intentando abrir archivo Excel en SearchIntervalCuadExter: {FilePath}", filePath);
                _logger.LogInformation("Intentando abrir archivo Excel en SearchIntervalCuadExter: {seleccionados}", seleccionados);

                if (!File.Exists(filePath))
                {
                    _logger.LogError("Archivo no encontrado en SearchIntervalCuadExter: {FilePath}", filePath);
                    throw new FileNotFoundException($"Archivo Excel no encontrado en: {filePath}");
                }

                // Abrir el archivo UNA vez usando el método con retry
                workbook = OpenWorkbookWithRetry(filePath);
                var hoja = workbook.Worksheets.First();

                // Obtener la última fila con datos
                var ultimaFilaConDatos = hoja.LastRowUsed()?.RowNumber() ?? 1;

                // Borrar todas las filas de datos (desde fila 2 hasta la última con datos)
                if (ultimaFilaConDatos > 1)
                {
                    var rangoABorrar = hoja.Range(2, 1, ultimaFilaConDatos, hoja.LastColumnUsed()?.ColumnNumber() ?? 1);
                    rangoABorrar.Clear(XLClearOptions.All);
                }

                // Cargar valores de conceptos desde la base de datos
                var conceptsFromDb = _context.Set<Concepts>()
                    .Where(c => c.Active)
                    .ToDictionary(c => c.Id, c => c.ExternalTeamValue ?? 0);

                // 1. Buscar registros "CONCEPT" en el rango de fechas
                var conceptos = _context.LogbookDetallada
                    .Where(l => l.Date >= dateStart && l.Date <= dateEnd && l.Typenote == "CONCEPT" )
                    .ToList();

                if (!conceptos.Any())
                {
                    return $"No se encontraron registros CONCEPT entre {dateStart:yyyy-MM-dd} y {dateEnd:yyyy-MM-dd}";
                }

                var resultadosCompletos = new List<string>();

                // 2. Agrupar conceptos por Id_ot
                var conceptosPorOT = conceptos.GroupBy(c => c.Id_ot).ToList();
                var contador = 1;

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
                                var cuadrillaTexto = primerPersonal.Cuadrilla.ToLower();
                                var cuadrillaParts = cuadrillaTexto.Split(new[] { "cuadrilla" }, StringSplitOptions.RemoveEmptyEntries);

                                // Si hay texto después de "cuadrilla", usarlo
                                if (cuadrillaParts.Length > 0)
                                {
                                    var numeroExtraido = cuadrillaParts[^1].Trim();
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

                            equipoEjecutor = $"{numeroCuadrilla}";
                            
                            // 👉 FILTRO DE CUADRILLAS
                            if (!seleccionados.Contains(numeroCuadrilla))
                            {
                                continue; // saltar este concepto, no está en los seleccionados
                            }
                        }
                        else
                        {
                            // Si no hay personal, también puedes decidir si saltar o no
                            continue;
                        }

                        // Crear ExcelDataRequest
                        var data = concepto.Validado == "PAGO" ? (decimal)concepto.Quantity : 0;
                        var excelData = new ExcelDataRequestCuadExter
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
                            Validado = concepto.Validado ?? "PAGO",
                            Observaciones = otUsada?.Results ?? "",
                            INCIDENCIA = "NO",
                            ResaneDeBanqueta = concepto.NombreConcepto == "RESANE DE BANQUETA" ? data : null,
                            FugaEnMedidor = concepto.NombreConcepto == "FUGA DE MEDIDOR" ? data : null,
                            FugaEnBanqueta = concepto.NombreConcepto == "FUGA EN BANQUETA" ? data : null,
                            InstMedidor12112Piso = concepto.NombreConcepto == """I. MEDIDOR 1/2"  HASTA 1 1/2" EN PISO""" ? data : null,
                            InstMedidor12112Arco = concepto.NombreConcepto == """I. MEDIDOR 1/2"  HASTA 1 1/2"EN ARCO""" ? data : null,
                            InstMedidor2Caja = concepto.NombreConcepto == """I. MEDIDOR 2" EN PISO CON CONSTRUCCION DE CAJA""" ? data : null,
                            InstMedidor3Caja = concepto.NombreConcepto == """I.MEDIDOR 3" EN PISO CON CONSTRUCCION DE CAJA""" ? data : null,
                            InstMedidor4Caja = concepto.NombreConcepto == """I.MEDIDOR 4" EN PISO CON CONSTRUCCION DE CAJA""" ? data : null,
                            InstValvula12 = concepto.NombreConcepto ==  "INST. VÁLVULA 1/2\"" ? data : null,
                            CambioMedidor12112 = concepto.NombreConcepto == "CAMBIO DE MEDIDOR 1/2\"  HASTA 1 1/2\" " ? data : null,
                            ReconexionAsfalto = concepto.NombreConcepto == "RECONEXIÓN EN ASFALTO" ? data : null,
                            CorteAsfaltoRed = concepto.NombreConcepto == "CORTE EN ASFALTO (EN RED)" ? data : null,
                            CorteExtMedidorMadera = concepto.NombreConcepto == "CORTE EN EXTREMIDAD DE MEDIDOR CON DISP. DE MADERA" ? data : null,
                            ReconexionBanqueta = concepto.NombreConcepto == "RECONEXION EN BANQUETA" ? data : null,
                            ReconexionTierra = concepto.NombreConcepto == "RECONEXION EN TIERRA" ? data : null,
                            ReconexionMuro = concepto.NombreConcepto == "RECONEXION EN MURO" ? data : null,
                            CorteTomaTierra = concepto.NombreConcepto == "CORTE EN TIERRA" ? data : null,
                            CorteTomaMuro = concepto.NombreConcepto == "CORTE EN MURO" ? data : null,
                            CorteTomaPavimento = concepto.NombreConcepto == "CORTE DE TOMA EN PAVIMENTO" ? data : null,
                            CorteBanqueta = concepto.NombreConcepto == "CORTE EN BANQUETA" ? data : null,
                            ReconexionDrenaje = concepto.NombreConcepto == "RECONEXIÓN DE DRENAJE" ? data : null,
                            CorteDrenajeTapon = concepto.NombreConcepto == "CORTE CON TAPÓN" ? data : null,
                            CorteDrenajeRegistro = concepto.NombreConcepto == "CORTE DRENAJE REGISTRO" ? data : null,
                            GastoVisitaObra = concepto.NombreConcepto == "GASTO POR VISITA" ? data : null,
                            SondeoTierra = concepto.NombreConcepto == "SONDEO EN TIERRA" ? data : null,
                            SondeoBanqueta = concepto.NombreConcepto == "SONDEO EN BANQUETA" ? data : null,
                            SondeoPavimento = concepto.NombreConcepto == "SONDEO EN PAVIMENTO" ? data : null,
                            RetiroTapones = concepto.NombreConcepto == "RETIRAR TAPÓN" ? data : null

                        };

                        _logger.LogInformation("Procesando concepto {ConceptoId}: OT {OtId}, NumOS {NumOS}, Inmueble {CDC}",
                            concepto.Id, concepto.Id_ot, otUsada.OtNumber, otUsada.CDC);

                        // Enviar al método externo (pasando la hoja para modificar en memoria)
                        var resultadoModificacion = ModificarOInsertarCuadExternas(excelData, hoja);
                        contador++;

                        resultadosCompletos.Add(
                            $"Concepto {concepto.Id} (OS: {excelData.NumeroOS}, Trabajo: {excelData.TrabajoRealizado}): {resultadoModificacion}"
                        );
                    }
                }

                var resultadoFinal = string.Join("\n", resultadosCompletos);
                _logger.LogInformation("Se procesaron {Count} conceptos en el Excel", conceptos.Count);
                _logger.LogInformation("Resultado de la modificación: {Resultado}", contador);
                var columnasEsperadas = new Dictionary<string, string>()
                {
                    { "NUMERO_OS", "Número OS" },
                    { "INMUEBLE", "INMUEBLE" },
                    { "NOMBRE_SERVICIO", "Nombre del servicio" },
                    { "EQUIPO_EJECUTOR", "Equipo ejecutor" },
                    { "TRABAJO_REALIZADO", "Trabajo realizado" },
                    { "COLONIA", "Colonia" },
                    { "CALLE", "Calle" },
                    { "NUMERO", "Número" },
                    { "RESULTADO_TRABAJO", "Resultado del trabajo" },
                    { "CANTIDAD", "Cantidad" },
                    { "FECHA_ASIGNACION", "Fecha asignación" },
                    { "FECHA_EJECUCION", "Fecha ejecución" },
                    { "DIAS", "Días" },
                    { "AREA", "Área" },
                    { "VALIDADO", "Validado" },
                    { "OBSERVACIONES", "Observaciones" },
                    { "INCIDENCIA", "INCIDENCIA" },
                    { "RESANE_DE_BANQUETA", "RESANE DE BANQUETA" },
                    { "FUGA_EN_MEDIDOR", "FUGA EN MEDIDOR" },
                    { "FUGA_EN_BANQUETA", "FUGA EN BANQUETA" },
                    { "INST_MEDIDOR_1_2_1_1_2_PISO", "INST. MEDIDOR 1/2\" - 1 1/2\" PISO" },
                    { "INST_MEDIDOR_1_2_1_1_2_ARCO", "INST. MEDIDOR 1/2\" - 1 1/2\" ARCO" },
                    { "INST_MEDIDOR_2_CAJA", "INST. MEDIDOR 2\" CONSTRUCCION DE CAJA" },
                    { "INST_MEDIDOR_3_CAJA", "INST. MEDIDOR 3\" CONSTRUCCION DE CAJA" },
                    { "INST_MEDIDOR_4_CAJA", "INST. MEDIDOR 4\" CONSTRUCCION DE CAJA" },
                    { "INST_VALVULA_1_2", "INSTALACION DE VALVULA 1/2\"" },
                    { "CAMBIO_MEDIDOR_1_2_1_1_2", "CAMBIO DE MEDIDOR 1/2\"- 1 1/2\"" },
                    { "RECONEXION_ASFALTO", "RECONEXION EN ASFALTO" },
                    { "CORTE_ASFALTO_RED", "CORTE EN ASFALTO (EN RED)" },
                    { "CORTE_EXT_MEDIDOR_MADERA", "CORTE EN EXTREMIDAD DE MEDIDOR CON DISP. DE MADERA" },
                    { "RECONEXION_BANQUETA", "RECONEXION BANQUETA" },
                    { "RECONEXION_TIERRA", "RECONEXION EN TIERRA" },
                    { "RECONEXION_MURO", "RECONEXION EN MURO" },
                    { "CORTE_TOMA_TIERRA", "CORTE DE TOMA EN TIERRA" },
                    { "CORTE_TOMA_MURO", "CORTE DE TOMA EN MURO" },
                    { "CORTE_BANQUETA", "CORTE EN BANQUETA" },
                    { "CORTE_TOMA_PAVIMENTO", "CORTE DE TOMA EN PAVIMENTO" },
                    { "RECONEXION_DRENAJE", "RECONEXION DE DRENAJE" },
                    { "CORTE_DRENAJE_TAPON", "CORTE DE DRENAJE CON TAPON" },
                    { "CORTE_DRENAJE_REGISTRO", "CORTE DRENAJE REGISTRO" },
                    { "GASTO_VISITA_OBRA", "GASTO POR VISITA DE OBRA" },
                    { "SONDEO_TIERRA", "SONDEO EN TIERRA" },
                    { "SONDEO_BANQUETA", "SONDEO EN BANQUETA" },
                    { "SONDEO_PAVIMENTO", "SONDEO EN PAVIMENTO" },
                    { "RETIRO_TAPONES", "RETIRO DE TAPONES" }
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
                /*int ultimaFila = hoja.LastRowUsed()?.RowNumber() ?? 1;
                int colNumeroOS = columnas["NUMERO_OS"];
                int totalFilasDatos = 0;
                for (int i = 2; i <= ultimaFila; i++) 
                {
                    var valor = hoja.Cell(i, colNumeroOS).GetString().Trim();
                    if (!string.IsNullOrEmpty(valor))
                        totalFilasDatos = i; // Guarda el número de la última fila con datos
                }
                int nuevaFila = totalFilasDatos + 1;*/
                int ultimaFila = hoja.LastRowUsed()?.RowNumber() ?? 1;

// Encuentra la columna correcta
                int colResane = columnas["RESANE_DE_BANQUETA"];
                string letraResane = hoja.Column(colResane).ColumnLetter();

                // Calcular nueva fila
                int nuevaFila = ultimaFila + 1;
                _logger.LogInformation("Nueva fila para insertar datos: {NuevaFila}", nuevaFila);

                ModificarOInsertarCuadExternas(new ExcelDataRequestCuadExter
                {
                    ResaneDeBanqueta = $"=SUM(S2:S{contador})",
                    FugaEnMedidor = $"=SUM(T2:T{contador})",
                    FugaEnBanqueta = $"=SUM(U2:U{contador})",
                    InstMedidor12112Piso = $"=SUM(V2:V{contador})",
                    InstMedidor12112Arco = $"=SUM(W2:W{contador})",
                    InstMedidor2Caja = $"=SUM(X2:X{contador})",
                    InstMedidor3Caja = $"=SUM(Y2:Y{contador})",
                    InstMedidor4Caja = $"=SUM(Z2:Z{contador})",
                    InstValvula12 = $"=SUM(AA2:AA{contador})",
                    CambioMedidor12112 = $"=SUM(AB2:AB{contador})",
                    ReconexionAsfalto = $"=SUM(AC2:AC{contador})",
                    CorteAsfaltoRed = $"=SUM(AD2:AD{contador})",
                    CorteExtMedidorMadera = $"=SUM(AE2:AE{contador})",
                    ReconexionBanqueta = $"=SUM(AF2:AF{contador})",
                    ReconexionTierra = $"=SUM(AG2:AG{contador})",
                    ReconexionMuro = $"=SUM(AH2:AH{contador})",
                    CorteTomaTierra = $"=SUM(AI2:AI{contador})",
                    CorteTomaMuro = $"=SUM(AJ2:AJ{contador})",
                    CorteBanqueta = $"=SUM(AK2:AK{contador})",
                    CorteTomaPavimento = $"=SUM(AL2:AL{contador})",
                    ReconexionDrenaje = $"=SUM(AM2:AM{contador})",
                    CorteDrenajeTapon = $"=SUM(AN2:AN{contador})",
                    CorteDrenajeRegistro = $"=SUM(AO2:AO{contador})",
                    GastoVisitaObra = $"=SUM(AP2:AP{contador})",
                    SondeoTierra = $"=SUM(AQ2:AQ{contador})",
                    SondeoBanqueta = $"=SUM(AR2:AR{contador})",
                    SondeoPavimento = $"=SUM(AS2:AS{contador})",
                    RetiroTapones = $"=SUM(AT2:AT{contador})"
                }, hoja);

                ModificarOInsertarCuadExternas(new ExcelDataRequestCuadExter
                {
                    ResaneDeBanqueta = conceptsFromDb.ContainsKey(1) && conceptsFromDb[1] > 0 ? conceptsFromDb[1].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    FugaEnMedidor = conceptsFromDb.ContainsKey(2) && conceptsFromDb[2] > 0 ? conceptsFromDb[2].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    FugaEnBanqueta = conceptsFromDb.ContainsKey(3) && conceptsFromDb[3] > 0 ? conceptsFromDb[3].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstMedidor12112Piso = conceptsFromDb.ContainsKey(4) && conceptsFromDb[4] > 0 ? conceptsFromDb[4].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstMedidor12112Arco = conceptsFromDb.ContainsKey(5) && conceptsFromDb[5] > 0 ? conceptsFromDb[5].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstMedidor2Caja = conceptsFromDb.ContainsKey(6) && conceptsFromDb[6] > 0 ? conceptsFromDb[6].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstMedidor3Caja = conceptsFromDb.ContainsKey(7) && conceptsFromDb[7] > 0 ? conceptsFromDb[7].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstMedidor4Caja = conceptsFromDb.ContainsKey(8) && conceptsFromDb[8] > 0 ? conceptsFromDb[8].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    InstValvula12 = conceptsFromDb.ContainsKey(9) && conceptsFromDb[9] > 0 ? conceptsFromDb[9].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CambioMedidor12112 = conceptsFromDb.ContainsKey(10) && conceptsFromDb[10] > 0 ? conceptsFromDb[10].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    ReconexionAsfalto = conceptsFromDb.ContainsKey(11) && conceptsFromDb[11] > 0 ? conceptsFromDb[11].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteAsfaltoRed = conceptsFromDb.ContainsKey(12) && conceptsFromDb[12] > 0 ? conceptsFromDb[12].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteExtMedidorMadera = conceptsFromDb.ContainsKey(13) && conceptsFromDb[13] > 0 ? conceptsFromDb[13].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    ReconexionBanqueta = conceptsFromDb.ContainsKey(14) && conceptsFromDb[14] > 0 ? conceptsFromDb[14].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    ReconexionTierra = conceptsFromDb.ContainsKey(15) && conceptsFromDb[15] > 0 ? conceptsFromDb[15].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    ReconexionMuro = conceptsFromDb.ContainsKey(16) && conceptsFromDb[16] > 0 ? conceptsFromDb[16].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteTomaTierra = conceptsFromDb.ContainsKey(17) && conceptsFromDb[17] > 0 ? conceptsFromDb[17].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteTomaMuro = conceptsFromDb.ContainsKey(18) && conceptsFromDb[18] > 0 ? conceptsFromDb[18].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteBanqueta = conceptsFromDb.ContainsKey(19) && conceptsFromDb[19] > 0 ? conceptsFromDb[19].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteTomaPavimento = conceptsFromDb.ContainsKey(28) && conceptsFromDb[28] > 0 ? conceptsFromDb[28].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    ReconexionDrenaje = conceptsFromDb.ContainsKey(20) && conceptsFromDb[20] > 0 ? conceptsFromDb[20].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteDrenajeTapon = conceptsFromDb.ContainsKey(21) && conceptsFromDb[21] > 0 ? conceptsFromDb[21].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    CorteDrenajeRegistro = conceptsFromDb.ContainsKey(22) && conceptsFromDb[22] > 0 ? conceptsFromDb[22].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    GastoVisitaObra = conceptsFromDb.ContainsKey(23) && conceptsFromDb[23] > 0 ? conceptsFromDb[23].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    SondeoTierra = conceptsFromDb.ContainsKey(24) && conceptsFromDb[24] > 0 ? conceptsFromDb[24].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    SondeoBanqueta = conceptsFromDb.ContainsKey(25) && conceptsFromDb[25] > 0 ? conceptsFromDb[25].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    SondeoPavimento = conceptsFromDb.ContainsKey(26) && conceptsFromDb[26] > 0 ? conceptsFromDb[26].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0",
                    RetiroTapones = conceptsFromDb.ContainsKey(27) && conceptsFromDb[27] > 0 ? conceptsFromDb[27].ToString("F2", System.Globalization.CultureInfo.GetCultureInfo("es-ES")) : "0"
                }, hoja);

                ModificarOInsertarCuadExternas(new ExcelDataRequestCuadExter
                {
                    ResaneDeBanqueta = $"=S{contador+1}*S{contador+2}",
                    FugaEnMedidor = $"=T{contador+1}*T{contador+2}",
                    FugaEnBanqueta = $"=U{contador+1}*U{contador+2}",
                    InstMedidor12112Piso = $"=V{contador+1}*V{contador+2}",
                    InstMedidor12112Arco = $"=W{contador+1}*W{contador+2}",
                    InstMedidor2Caja = $"=X{contador+1}*X{contador+2}",
                    InstMedidor3Caja = $"=Y{contador+1}*Y{contador+2}",
                    InstMedidor4Caja = $"=Z{contador+1}*Z{contador+2}",
                    InstValvula12 = $"=AA{contador+1}*AA{contador+2}",
                    CambioMedidor12112 = $"=AB{contador+1}*AB{contador+2}",
                    ReconexionAsfalto = $"=AC{contador+1}*AC{contador+2}",
                    CorteAsfaltoRed = $"=AD{contador+1}*AD{contador+2}",
                    CorteExtMedidorMadera = $"=AE{contador+1}*AE{contador+2}",
                    ReconexionBanqueta = $"=AF{contador+1}*AF{contador+2}",
                    ReconexionTierra = $"=AG{contador+1}*AG{contador+2}",
                    ReconexionMuro = $"=AH{contador+1}*AH{contador+2}",
                    CorteTomaTierra = $"=AI{contador+1}*AI{contador+2}",
                    CorteTomaMuro = $"=AJ{contador+1}*AJ{contador+2}",
                    CorteBanqueta = $"=AK{contador+1}*AK{contador+2}",
                    CorteTomaPavimento = $"=AL{contador+1}*AL{contador+2}",
                    ReconexionDrenaje = $"=AM{contador+1}*AM{contador+2}",
                    CorteDrenajeTapon = $"=AN{contador+1}*AN{contador+2}",
                    CorteDrenajeRegistro = $"=AO{contador+1}*AO{contador+2}",
                    GastoVisitaObra = $"=AP{contador+1}*AP{contador+2}",
                    SondeoTierra = $"=AQ{contador+1}*AQ{contador+2}",
                    SondeoBanqueta = $"=AR{contador+1}*AR{contador+2}",
                    SondeoPavimento = $"=AS{contador+1}*AS{contador+2}",
                    RetiroTapones = $"=AT{contador+1}*AT{contador+2}"
                }, hoja);
                ModificarOInsertarCuadExternas(new ExcelDataRequestCuadExter
                {
                    ResaneDeBanqueta = $"=S{contador+3}",
                    FugaEnMedidor = $"=S{contador+4}+T{contador+3}",
                    FugaEnBanqueta = $"=T{contador+4}+U{contador+3}",
                    InstMedidor12112Piso = $"=U{contador+4}+V{contador+3}",
                    InstMedidor12112Arco = $"=V{contador+4}+W{contador+3}",
                    InstMedidor2Caja = $"=W{contador+4}+X{contador+3}",
                    InstMedidor3Caja = $"=X{contador+4}+Y{contador+3}",
                    InstMedidor4Caja = $"=Y{contador+4}+Z{contador+3}",
                    InstValvula12 = $"=Z{contador+4}+AA{contador+3}",
                    CambioMedidor12112 = $"=AA{contador+4}+AB{contador+3}",
                    ReconexionAsfalto = $"=AB{contador+4}+AC{contador+3}",
                    CorteAsfaltoRed = $"=AC{contador+4}+AD{contador+3}",
                    CorteExtMedidorMadera = $"=AD{contador+4}+AE{contador+3}",
                    ReconexionBanqueta = $"=AE{contador+4}+AF{contador+3}",
                    ReconexionTierra = $"=AF{contador+4}+AG{contador+3}",
                    ReconexionMuro = $"=AG{contador+4}+AH{contador+3}",
                    CorteTomaTierra = $"=AH{contador+4}+AI{contador+3}",
                    CorteTomaMuro = $"=AI{contador+4}+AJ{contador+3}",
                    CorteBanqueta = $"=AJ{contador+4}+AK{contador+3}",
                    CorteTomaPavimento = $"=AK{contador+4}+AL{contador+3}",
                    ReconexionDrenaje = $"=AL{contador+4}+AM{contador+3}",
                    CorteDrenajeTapon = $"=AM{contador+4}+AN{contador+3}",
                    CorteDrenajeRegistro = $"=AN{contador+4}+AO{contador+3}",
                    GastoVisitaObra = $"=AO{contador+4}+AP{contador+3}",
                    SondeoTierra = $"=AP{contador+4}+AQ{contador+3}",
                    SondeoBanqueta = $"=AQ{contador+4}+AR{contador+3}",
                    SondeoPavimento = $"=AR{contador+4}+AS{contador+3}",
                    RetiroTapones = $"=AS{contador+4}+AT{contador+3}"
                }, hoja);
                //hoja.Range($"AR{contador+5}:AS{contador+5}").Merge();
                ModificarOInsertarCuadExternasUnido(new ExcelDataRequestCuadExter
                {
                    SondeoBanqueta = "TOTAL",
                    RetiroTapones = $"=AT{contador+4}"
                }, hoja);

                // Guardar el archivo UNA vez al final usando SaveWorkbookSafely
                SaveWorkbookSafely(workbook, filePath);

                return $"Se procesaron {conceptos.Count} conceptos:\n{resultadoFinal}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al buscar registros en el intervalo de fechas");
                return $"Error al buscar registros: {ex.Message}";
            }
            finally
            {
                // Asegurar que el workbook se cierre correctamente
                workbook?.Dispose();
            }
        }


        public string ModificarOInsertarCuadExternas(ExcelDataRequestCuadExter data, IXLWorksheet hoja = null)
        {
            var disposeWorkbook = false;
            XLWorkbook workbook = null;
            if (hoja == null)
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "CALCULO_DE_PAGO_A_CUADRILLA_EXTERNAS.xlsx");
                workbook = new XLWorkbook(filePath);
                hoja = workbook.Worksheets.First();
                disposeWorkbook = true;
            }
            // Mapear columnas esperadas
            var columnasEsperadas = new Dictionary<string, string>()
            {
                { "NUMERO_OS", "Número OS" },
                { "INMUEBLE", "INMUEBLE" },
                { "NOMBRE_SERVICIO", "Nombre del servicio" },
                { "EQUIPO_EJECUTOR", "Equipo ejecutor" },
                { "TRABAJO_REALIZADO", "Trabajo realizado" },
                { "COLONIA", "Colonia" },
                { "CALLE", "Calle" },
                { "NUMERO", "Número" },
                { "RESULTADO_TRABAJO", "Resultado del trabajo" },
                { "CANTIDAD", "Cantidad" },
                { "FECHA_ASIGNACION", "Fecha asignación" },
                { "FECHA_EJECUCION", "Fecha ejecución" },
                { "DIAS", "Días" },
                { "AREA", "Área" },
                { "VALIDADO", "Validado" },
                { "OBSERVACIONES", "Observaciones" },
                { "INCIDENCIA", "INCIDENCIA" },
                { "RESANE_DE_BANQUETA", "RESANE DE BANQUETA" },
                { "FUGA_EN_MEDIDOR", "FUGA EN MEDIDOR" },
                { "FUGA_EN_BANQUETA", "FUGA EN BANQUETA" },
                { "INST_MEDIDOR_1_2_1_1_2_PISO", "INST. MEDIDOR 1/2\" - 1 1/2\" PISO" },
                { "INST_MEDIDOR_1_2_1_1_2_ARCO", "INST. MEDIDOR 1/2\" - 1 1/2\" ARCO" },
                { "INST_MEDIDOR_2_CAJA", "INST. MEDIDOR 2\" CONSTRUCCION DE CAJA" },
                { "INST_MEDIDOR_3_CAJA", "INST. MEDIDOR 3\" CONSTRUCCION DE CAJA" },
                { "INST_MEDIDOR_4_CAJA", "INST. MEDIDOR 4\" CONSTRUCCION DE CAJA" },
                { "INST_VALVULA_1_2", "INSTALACION DE VALVULA 1/2\"" },
                { "CAMBIO_MEDIDOR_1_2_1_1_2", "CAMBIO DE MEDIDOR 1/2\"- 1 1/2\"" },
                { "RECONEXION_ASFALTO", "RECONEXION EN ASFALTO" },
                { "CORTE_ASFALTO_RED", "CORTE EN ASFALTO (EN RED)" },
                { "CORTE_EXT_MEDIDOR_MADERA", "CORTE EN EXTREMIDAD DE MEDIDOR CON DISP. DE MADERA" },
                { "RECONEXION_BANQUETA", "RECONEXION BANQUETA" },
                { "RECONEXION_TIERRA", "RECONEXION EN TIERRA" },
                { "RECONEXION_MURO", "RECONEXION EN MURO" },
                { "CORTE_TOMA_TIERRA", "CORTE DE TOMA EN TIERRA" },
                { "CORTE_TOMA_MURO", "CORTE DE TOMA EN MURO" },
                { "CORTE_BANQUETA", "CORTE EN BANQUETA" },
                { "CORTE_TOMA_PAVIMENTO", "CORTE DE TOMA EN PAVIMENTO" },
                { "RECONEXION_DRENAJE", "RECONEXION DE DRENAJE" },
                { "CORTE_DRENAJE_TAPON", "CORTE DE DRENAJE CON TAPON" },
                { "CORTE_DRENAJE_REGISTRO", "CORTE DRENAJE REGISTRO" },
                { "GASTO_VISITA_OBRA", "GASTO POR VISITA DE OBRA" },
                { "SONDEO_TIERRA", "SONDEO EN TIERRA" },
                { "SONDEO_BANQUETA", "SONDEO EN BANQUETA" },
                { "SONDEO_PAVIMENTO", "SONDEO EN PAVIMENTO" },
                { "RETIRO_TAPONES", "RETIRO DE TAPONES" }
            };

            // Buscar y mapear columnas
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
            ActualizarFilaCuadExter(hoja, nuevaFila, columnas, data);

            // Solo guardar si abrimos el workbook nosotros mismos
            if (disposeWorkbook && workbook != null)
            {
                workbook.Save();
            }

            return $"Se añadió nueva fila en: {nuevaFila}";
        }
        
        public string ModificarOInsertarCuadExternasUnido(ExcelDataRequestCuadExter data, IXLWorksheet hoja = null)
        {
            var disposeWorkbook = false;
            XLWorkbook workbook = null;
            if (hoja == null)
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "CALCULO_DE_PAGO_A_CUADRILLA_EXTERNAS.xlsx");
                workbook = new XLWorkbook(filePath);
                hoja = workbook.Worksheets.First();
                disposeWorkbook = true;
            }
            // Mapear columnas esperadas
            var columnasEsperadas = new Dictionary<string, string>()
            {
                { "NUMERO_OS", "Número OS" },
                { "INMUEBLE", "INMUEBLE" },
                { "NOMBRE_SERVICIO", "Nombre del servicio" },
                { "EQUIPO_EJECUTOR", "Equipo ejecutor" },
                { "TRABAJO_REALIZADO", "Trabajo realizado" },
                { "COLONIA", "Colonia" },
                { "CALLE", "Calle" },
                { "NUMERO", "Número" },
                { "RESULTADO_TRABAJO", "Resultado del trabajo" },
                { "CANTIDAD", "Cantidad" },
                { "FECHA_ASIGNACION", "Fecha asignación" },
                { "FECHA_EJECUCION", "Fecha ejecución" },
                { "DIAS", "Días" },
                { "AREA", "Área" },
                { "VALIDADO", "Validado" },
                { "OBSERVACIONES", "Observaciones" },
                { "INCIDENCIA", "INCIDENCIA" },
                { "RESANE_DE_BANQUETA", "RESANE DE BANQUETA" },
                { "FUGA_EN_MEDIDOR", "FUGA EN MEDIDOR" },
                { "FUGA_EN_BANQUETA", "FUGA EN BANQUETA" },
                { "INST_MEDIDOR_1_2_1_1_2_PISO", "INST. MEDIDOR 1/2\" - 1 1/2\" PISO" },
                { "INST_MEDIDOR_1_2_1_1_2_ARCO", "INST. MEDIDOR 1/2\" - 1 1/2\" ARCO" },
                { "INST_MEDIDOR_2_CAJA", "INST. MEDIDOR 2\" CONSTRUCCION DE CAJA" },
                { "INST_MEDIDOR_3_CAJA", "INST. MEDIDOR 3\" CONSTRUCCION DE CAJA" },
                { "INST_MEDIDOR_4_CAJA", "INST. MEDIDOR 4\" CONSTRUCCION DE CAJA" },
                { "INST_VALVULA_1_2", "INSTALACION DE VALVULA 1/2\"" },
                { "CAMBIO_MEDIDOR_1_2_1_1_2", "CAMBIO DE MEDIDOR 1/2\"- 1 1/2\"" },
                { "RECONEXION_ASFALTO", "RECONEXION EN ASFALTO" },
                { "CORTE_ASFALTO_RED", "CORTE EN ASFALTO (EN RED)" },
                { "CORTE_EXT_MEDIDOR_MADERA", "CORTE EN EXTREMIDAD DE MEDIDOR CON DISP. DE MADERA" },
                { "RECONEXION_BANQUETA", "RECONEXION BANQUETA" },
                { "RECONEXION_TIERRA", "RECONEXION EN TIERRA" },
                { "RECONEXION_MURO", "RECONEXION EN MURO" },
                { "CORTE_TOMA_TIERRA", "CORTE DE TOMA EN TIERRA" },
                { "CORTE_TOMA_MURO", "CORTE DE TOMA EN MURO" },
                { "CORTE_BANQUETA", "CORTE EN BANQUETA" },
                { "CORTE_TOMA_PAVIMENTO", "CORTE DE TOMA EN PAVIMENTO" },
                { "RECONEXION_DRENAJE", "RECONEXION DE DRENAJE" },
                { "CORTE_DRENAJE_TAPON", "CORTE DE DRENAJE CON TAPON" },
                { "CORTE_DRENAJE_REGISTRO", "CORTE DRENAJE REGISTRO" },
                { "GASTO_VISITA_OBRA", "GASTO POR VISITA DE OBRA" },
                { "SONDEO_TIERRA", "SONDEO EN TIERRA" },
                { "SONDEO_BANQUETA", "SONDEO EN BANQUETA" },
                { "SONDEO_PAVIMENTO", "SONDEO EN PAVIMENTO" },
                { "RETIRO_TAPONES", "RETIRO DE TAPONES" }
            };

            // Buscar y mapear columnas
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
            ActualizarFilaCuadExter(hoja, nuevaFila, columnas, data);
            var rango = hoja.Range($"AR{nuevaFila}:AS{nuevaFila}");
            rango.Merge();
            _logger.LogInformation($"Sondeo en Banqueta: {data.SondeoBanqueta}");
            if (data.SondeoBanqueta == "TOTAL")
            {
            var rango1 = hoja.Range($"A2:AT{nuevaFila-5}");
            rango1.Style.Border.TopBorder = XLBorderStyleValues.Thin;
            rango1.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            rango1.Style.Border.LeftBorder = XLBorderStyleValues.Thin;
            rango1.Style.Border.RightBorder = XLBorderStyleValues.Thin;
            var rango2 = hoja.Range($"S{nuevaFila-4}:AT{nuevaFila-1}");
            rango2.Style.NumberFormat.Format = "\"$\" #,##0.00_);[Red](\"$\" #,##0.00)";
            rango2.Style.Fill.BackgroundColor = XLColor.Gray;
            rango2.Style.Border.TopBorder = XLBorderStyleValues.Thin;
            rango2.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            rango2.Style.Border.LeftBorder = XLBorderStyleValues.Thin;
            rango2.Style.Border.RightBorder = XLBorderStyleValues.Thin;
            var rango3 = hoja.Range($"AR{nuevaFila}:AS{nuevaFila}");
            rango3.Style.Fill.BackgroundColor = XLColor.Gray;
            rango3.Style.Border.TopBorder = XLBorderStyleValues.Thin;
            rango3.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            rango3.Style.Border.LeftBorder = XLBorderStyleValues.Thin;
            rango3.Style.Border.RightBorder = XLBorderStyleValues.Thin;
            var rango4 = hoja.Range($"AT{nuevaFila}:AT{nuevaFila}");
            rango4.Style.NumberFormat.Format = "\"$\" #,##0.00_);[Red](\"$\" #,##0.00)";
            rango4.Style.Border.TopBorder = XLBorderStyleValues.Thin;
            rango4.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            rango4.Style.Border.LeftBorder = XLBorderStyleValues.Thin;
            rango4.Style.Border.RightBorder = XLBorderStyleValues.Thin;
            }

            // Solo guardar si abrimos el workbook nosotros mismos
            if (disposeWorkbook && workbook != null)
            {
                workbook.Save();
            }

            return $"Se añadió nueva fila en: {nuevaFila}";
        }
        private void ActualizarFilaCuadExter(IXLWorksheet hoja, int fila, Dictionary<string, int> columnas, ExcelDataRequestCuadExter data)
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

            // Resane de Banqueta
            if (data.ResaneDeBanqueta is string formulaResane && formulaResane.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RESANE_DE_BANQUETA"]).FormulaA1 = formulaResane;
            }
            else if (data.ResaneDeBanqueta is decimal decResane)
            {
                hoja.Cell(fila, columnas["RESANE_DE_BANQUETA"]).Value = decResane;
            }
            else if (data.ResaneDeBanqueta != null)
            {
                hoja.Cell(fila, columnas["RESANE_DE_BANQUETA"]).Value = data.ResaneDeBanqueta.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RESANE_DE_BANQUETA"]).Clear();
            }

            // Fuga en Medidor
            if (data.FugaEnMedidor is string formulaFugaMedidor && formulaFugaMedidor.StartsWith("="))
            {
                hoja.Cell(fila, columnas["FUGA_EN_MEDIDOR"]).FormulaA1 = formulaFugaMedidor;
            }
            else if (data.FugaEnMedidor is decimal decFugaMedidor)
            {
                hoja.Cell(fila, columnas["FUGA_EN_MEDIDOR"]).Value = decFugaMedidor;
            }
            else if (data.FugaEnMedidor != null)
            {
                hoja.Cell(fila, columnas["FUGA_EN_MEDIDOR"]).Value = data.FugaEnMedidor.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["FUGA_EN_MEDIDOR"]).Clear();
            }

            // Fuga en Banqueta
            if (data.FugaEnBanqueta is string formulaFugaBanqueta && formulaFugaBanqueta.StartsWith("="))
            {
                hoja.Cell(fila, columnas["FUGA_EN_BANQUETA"]).FormulaA1 = formulaFugaBanqueta;
            }
            else if (data.FugaEnBanqueta is decimal decFugaBanqueta)
            {
                hoja.Cell(fila, columnas["FUGA_EN_BANQUETA"]).Value = decFugaBanqueta;
            }
            else if (data.FugaEnBanqueta != null)
            {
                hoja.Cell(fila, columnas["FUGA_EN_BANQUETA"]).Value = data.FugaEnBanqueta.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["FUGA_EN_BANQUETA"]).Clear();
            }

            // InstMedidor12112Piso
            if (data.InstMedidor12112Piso is string formulaMedidorPiso && formulaMedidorPiso.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_PISO"]).FormulaA1 = formulaMedidorPiso;
            }
            else if (data.InstMedidor12112Piso is decimal decMedidorPiso)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_PISO"]).Value = decMedidorPiso;
            }
            else if (data.InstMedidor12112Piso != null)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_PISO"]).Value = data.InstMedidor12112Piso.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_PISO"]).Clear();
            }

            // InstMedidor12112Arco
            if (data.InstMedidor12112Arco is string formulaMedidorArco && formulaMedidorArco.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_ARCO"]).FormulaA1 = formulaMedidorArco;
            }
            else if (data.InstMedidor12112Arco is decimal decMedidorArco)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_ARCO"]).Value = decMedidorArco;
            }
            else if (data.InstMedidor12112Arco != null)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_ARCO"]).Value = data.InstMedidor12112Arco.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_1_2_1_1_2_ARCO"]).Clear();
            }

            // InstMedidor2Caja
            if (data.InstMedidor2Caja is string formulaMedidor2Caja && formulaMedidor2Caja.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_2_CAJA"]).FormulaA1 = formulaMedidor2Caja;
            }
            else if (data.InstMedidor2Caja is decimal decMedidor2Caja)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_2_CAJA"]).Value = decMedidor2Caja;
            }
            else if (data.InstMedidor2Caja != null)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_2_CAJA"]).Value = data.InstMedidor2Caja.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_2_CAJA"]).Clear();
            }

            // InstMedidor3Caja
            if (data.InstMedidor3Caja is string formulaMedidor3Caja && formulaMedidor3Caja.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_3_CAJA"]).FormulaA1 = formulaMedidor3Caja;
            }
            else if (data.InstMedidor3Caja is decimal decMedidor3Caja)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_3_CAJA"]).Value = decMedidor3Caja;
            }
            else if (data.InstMedidor3Caja != null)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_3_CAJA"]).Value = data.InstMedidor3Caja.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_3_CAJA"]).Clear();
            }

            // InstMedidor4Caja
            if (data.InstMedidor4Caja is string formulaMedidor4Caja && formulaMedidor4Caja.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_4_CAJA"]).FormulaA1 = formulaMedidor4Caja;
            }
            else if (data.InstMedidor4Caja is decimal decMedidor4Caja)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_4_CAJA"]).Value = decMedidor4Caja;
            }
            else if (data.InstMedidor4Caja != null)
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_4_CAJA"]).Value = data.InstMedidor4Caja.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_MEDIDOR_4_CAJA"]).Clear();
            }

            // InstValvula12
            if (data.InstValvula12 is string formulaValvula12 && formulaValvula12.StartsWith("="))
            {
                hoja.Cell(fila, columnas["INST_VALVULA_1_2"]).FormulaA1 = formulaValvula12;
            }
            else if (data.InstValvula12 is decimal decValvula12)
            {
                hoja.Cell(fila, columnas["INST_VALVULA_1_2"]).Value = decValvula12;
            }
            else if (data.InstValvula12 != null)
            {
                hoja.Cell(fila, columnas["INST_VALVULA_1_2"]).Value = data.InstValvula12.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["INST_VALVULA_1_2"]).Clear();
            }

            // CambioMedidor12112
            if (data.CambioMedidor12112 is string formulaCambioMedidor && formulaCambioMedidor.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CAMBIO_MEDIDOR_1_2_1_1_2"]).FormulaA1 = formulaCambioMedidor;
            }
            else if (data.CambioMedidor12112 is decimal decCambioMedidor)
            {
                hoja.Cell(fila, columnas["CAMBIO_MEDIDOR_1_2_1_1_2"]).Value = decCambioMedidor;
            }
            else if (data.CambioMedidor12112 != null)
            {
                hoja.Cell(fila, columnas["CAMBIO_MEDIDOR_1_2_1_1_2"]).Value = data.CambioMedidor12112.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CAMBIO_MEDIDOR_1_2_1_1_2"]).Clear();
            }
            // ReconexionAsfalto
            if (data.ReconexionAsfalto is string formula3 && formula3.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RECONEXION_ASFALTO"]).FormulaA1 = formula3;
            }
            else if (data.ReconexionAsfalto is decimal dec3)
            {
                hoja.Cell(fila, columnas["RECONEXION_ASFALTO"]).Value = dec3;
            }
            else if (data.ReconexionAsfalto != null)
            {
                hoja.Cell(fila, columnas["RECONEXION_ASFALTO"]).Value = data.ReconexionAsfalto.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RECONEXION_ASFALTO"]).Clear();
            }

            // CorteAsfaltoRed
            if (data.CorteAsfaltoRed is string formula4 && formula4.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_ASFALTO_RED"]).FormulaA1 = formula4;
            }
            else if (data.CorteAsfaltoRed is decimal dec4)
            {
                hoja.Cell(fila, columnas["CORTE_ASFALTO_RED"]).Value = dec4;
            }
            else if (data.CorteAsfaltoRed != null)
            {
                hoja.Cell(fila, columnas["CORTE_ASFALTO_RED"]).Value = data.CorteAsfaltoRed.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_ASFALTO_RED"]).Clear();
            }

            // CorteExtMedidorMadera
            if (data.CorteExtMedidorMadera is string formula5 && formula5.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_EXT_MEDIDOR_MADERA"]).FormulaA1 = formula5;
            }
            else if (data.CorteExtMedidorMadera is decimal dec5)
            {
                hoja.Cell(fila, columnas["CORTE_EXT_MEDIDOR_MADERA"]).Value = dec5;
            }
            else if (data.CorteExtMedidorMadera != null)
            {
                hoja.Cell(fila, columnas["CORTE_EXT_MEDIDOR_MADERA"]).Value = data.CorteExtMedidorMadera.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_EXT_MEDIDOR_MADERA"]).Clear();
            }

            // ReconexionBanqueta
            if (data.ReconexionBanqueta is string formula6 && formula6.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RECONEXION_BANQUETA"]).FormulaA1 = formula6;
            }
            else if (data.ReconexionBanqueta is decimal dec6)
            {
                hoja.Cell(fila, columnas["RECONEXION_BANQUETA"]).Value = dec6;
            }
            else if (data.ReconexionBanqueta != null)
            {
                hoja.Cell(fila, columnas["RECONEXION_BANQUETA"]).Value = data.ReconexionBanqueta.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RECONEXION_BANQUETA"]).Clear();
            }

            // ReconexionTierra
            if (data.ReconexionTierra is string formula7 && formula7.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RECONEXION_TIERRA"]).FormulaA1 = formula7;
            }
            else if (data.ReconexionTierra is decimal dec7)
            {
                hoja.Cell(fila, columnas["RECONEXION_TIERRA"]).Value = dec7;
            }
            else if (data.ReconexionTierra != null)
            {
                hoja.Cell(fila, columnas["RECONEXION_TIERRA"]).Value = data.ReconexionTierra.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RECONEXION_TIERRA"]).Clear();
            }

            // ReconexionMuro
            if (data.ReconexionMuro is string formula8 && formula8.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RECONEXION_MURO"]).FormulaA1 = formula8;
            }
            else if (data.ReconexionMuro is decimal dec8)
            {
                hoja.Cell(fila, columnas["RECONEXION_MURO"]).Value = dec8;
            }
            else if (data.ReconexionMuro != null)
            {
                hoja.Cell(fila, columnas["RECONEXION_MURO"]).Value = data.ReconexionMuro.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RECONEXION_MURO"]).Clear();
            }

            // CorteTomaTierra
            if (data.CorteTomaTierra is string formula9 && formula9.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_TIERRA"]).FormulaA1 = formula9;
            }
            else if (data.CorteTomaTierra is decimal dec9)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_TIERRA"]).Value = dec9;
            }
            else if (data.CorteTomaTierra != null)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_TIERRA"]).Value = data.CorteTomaTierra.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_TIERRA"]).Clear();
            }

            // CorteTomaMuro
            if (data.CorteTomaMuro is string formula10 && formula10.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_MURO"]).FormulaA1 = formula10;
            }
            else if (data.CorteTomaMuro is decimal dec10)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_MURO"]).Value = dec10;
            }
            else if (data.CorteTomaMuro != null)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_MURO"]).Value = data.CorteTomaMuro.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_MURO"]).Clear();
            }

            // CorteBanqueta
            if (data.CorteBanqueta is string formula11 && formula11.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_BANQUETA"]).FormulaA1 = formula11;
            }
            else if (data.CorteBanqueta is decimal dec11)
            {
                hoja.Cell(fila, columnas["CORTE_BANQUETA"]).Value = dec11;
            }
            else if (data.CorteBanqueta != null)
            {
                hoja.Cell(fila, columnas["CORTE_BANQUETA"]).Value = data.CorteBanqueta.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_BANQUETA"]).Clear();
            }

            // CorteTomaPavimento
            if (data.CorteTomaPavimento is string formula12 && formula12.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_PAVIMENTO"]).FormulaA1 = formula12;
            }
            else if (data.CorteTomaPavimento is decimal dec12)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_PAVIMENTO"]).Value = dec12;
            }
            else if (data.CorteTomaPavimento != null)
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_PAVIMENTO"]).Value = data.CorteTomaPavimento.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_TOMA_PAVIMENTO"]).Clear();
            }

            // ReconexionDrenaje
            if (data.ReconexionDrenaje is string formula13 && formula13.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RECONEXION_DRENAJE"]).FormulaA1 = formula13;
            }
            else if (data.ReconexionDrenaje is decimal dec13)
            {
                hoja.Cell(fila, columnas["RECONEXION_DRENAJE"]).Value = dec13;
            }
            else if (data.ReconexionDrenaje != null)
            {
                hoja.Cell(fila, columnas["RECONEXION_DRENAJE"]).Value = data.ReconexionDrenaje.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RECONEXION_DRENAJE"]).Clear();
            }

            // CorteDrenajeTapon
            if (data.CorteDrenajeTapon is string formula14 && formula14.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_TAPON"]).FormulaA1 = formula14;
            }
            else if (data.CorteDrenajeTapon is decimal dec14)
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_TAPON"]).Value = dec14;
            }
            else if (data.CorteDrenajeTapon != null)
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_TAPON"]).Value = data.CorteDrenajeTapon.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_TAPON"]).Clear();
            }

            // CorteDrenajeRegistro
            if (data.CorteDrenajeRegistro is string formula15 && formula15.StartsWith("="))
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_REGISTRO"]).FormulaA1 = formula15;
            }
            else if (data.CorteDrenajeRegistro is decimal dec15)
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_REGISTRO"]).Value = dec15;
            }
            else if (data.CorteDrenajeRegistro != null)
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_REGISTRO"]).Value = data.CorteDrenajeRegistro.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["CORTE_DRENAJE_REGISTRO"]).Clear();
            }

            // GastoVisitaObra
            if (data.GastoVisitaObra is string formula16 && formula16.StartsWith("="))
            {
                hoja.Cell(fila, columnas["GASTO_VISITA_OBRA"]).FormulaA1 = formula16;
            }
            else if (data.GastoVisitaObra is decimal dec16)
            {
                hoja.Cell(fila, columnas["GASTO_VISITA_OBRA"]).Value = dec16;
            }
            else if (data.GastoVisitaObra != null)
            {
                hoja.Cell(fila, columnas["GASTO_VISITA_OBRA"]).Value = data.GastoVisitaObra.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["GASTO_VISITA_OBRA"]).Clear();
            }

            // SondeoTierra
            if (data.SondeoTierra is string formula17 && formula17.StartsWith("="))
            {
                hoja.Cell(fila, columnas["SONDEO_TIERRA"]).FormulaA1 = formula17;
            }
            else if (data.SondeoTierra is decimal dec17)
            {
                hoja.Cell(fila, columnas["SONDEO_TIERRA"]).Value = dec17;
            }
            else if (data.SondeoTierra != null)
            {
                hoja.Cell(fila, columnas["SONDEO_TIERRA"]).Value = data.SondeoTierra.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["SONDEO_TIERRA"]).Clear();
            }

            // SondeoBanqueta
            if (data.SondeoBanqueta is string formula18 && formula18.StartsWith("="))
            {
                hoja.Cell(fila, columnas["SONDEO_BANQUETA"]).FormulaA1 = formula18;
            }
            else if (data.SondeoBanqueta is decimal dec18)
            {
                hoja.Cell(fila, columnas["SONDEO_BANQUETA"]).Value = dec18;
            }
            else if (data.SondeoBanqueta != null)
            {
                hoja.Cell(fila, columnas["SONDEO_BANQUETA"]).Value = data.SondeoBanqueta.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["SONDEO_BANQUETA"]).Clear();
            }


            // SondeoPavimento
            if (data.SondeoPavimento is string formula19 && formula19.StartsWith("="))
            {
                hoja.Cell(fila, columnas["SONDEO_PAVIMENTO"]).FormulaA1 = formula19;
            }
            else if (data.SondeoPavimento is decimal dec19)
            {
                hoja.Cell(fila, columnas["SONDEO_PAVIMENTO"]).Value = dec19;
            }
            else if (data.SondeoPavimento != null)
            {
                hoja.Cell(fila, columnas["SONDEO_PAVIMENTO"]).Value = data.SondeoPavimento.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["SONDEO_PAVIMENTO"]).Clear();
            }


            // RetiroTapones
            if (data.RetiroTapones is string formula20 && formula20.StartsWith("="))
            {
                hoja.Cell(fila, columnas["RETIRO_TAPONES"]).FormulaA1 = formula20;
            }
            else if (data.RetiroTapones is decimal dec20)
            {
                hoja.Cell(fila, columnas["RETIRO_TAPONES"]).Value = dec20;
            }
            else if (data.RetiroTapones != null)
            {
                hoja.Cell(fila, columnas["RETIRO_TAPONES"]).Value = data.RetiroTapones.ToString();
            }
            else
            {
                hoja.Cell(fila, columnas["RETIRO_TAPONES"]).Clear();
            }

        }

        public byte[] GetExcelFileCuadExter()
        {
            try
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "xlsx", "CALCULO_DE_PAGO_A_CUADRILLA_EXTERNAS.xlsx");
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

    public interface IUpdateExcelServiceExternas
    {
        string SearchIntervalCuadExter(DateTime dateStart, DateTime dateEnd, List<string> seleccionados);
        string ModificarOInsertarCuadExternas(ExcelDataRequestCuadExter data, IXLWorksheet hoja = null);
        byte[] GetExcelFileCuadExter();
    }
}