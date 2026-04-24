using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using ClosedXML.Excel;
using SMP.Models.TD;
using System.IO;
using Microsoft.Data.SqlClient;
using System;

namespace SMP.Services
{
    public class ProcesadorExcelResult
    {
        public string Resumen { get; set; }
        public byte[] ArchivoBytes { get; set; }
        public string NombreArchivo { get; set; }
        public string ErrorMessage { get; set; }
    }

    public class ProcesadorExcel : IProcesadorExcel
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ProcesadorExcel> _logger;
        private readonly ILogbookService _logbookService;

        public ProcesadorExcel(DbSmpContext dbContext, ILogger<ProcesadorExcel> logger, ILogbookService logbookService)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _logbookService = logbookService ?? throw new ArgumentNullException(nameof(logbookService));
        }

        public async Task<ProcesadorExcelResult> ProcesarArchivoExcelAsync(Stream fileStream)
        {
            string mensaje = "";
            try
            {
                // Usamos la librería ClosedXML para abrir el archivo Excel desde el stream.
                using (var workbook = new XLWorkbook(fileStream))
                {
                    // Seleccionamos la primera hoja de cálculo del libro.
                    var worksheet = workbook.Worksheet(1);
                    if (worksheet.LastCellUsed() == null)
                    {
                        _logger.LogWarning("El archivo Excel está vacío o no tiene un formato válido.");
                        return new ProcesadorExcelResult { ErrorMessage = "El archivo Excel está vacío o no tiene un formato válido." };
                    }

                    _logger.LogInformation("--- Leyendo datos del archivo Excel ---");
                    // Iteramos sobre cada fila que contiene datos, saltando la primera si es una cabecera.
                    foreach (var row in worksheet.RowsUsed().Skip(1)) // Usamos .Skip(1) para omitir la fila de cabecera
                    {
                        int NumberOT = 0;
                        string OtNum = "";
                        int NumberReport = 0;
                        int NumberTrabajo = 0;
                        int NumberProyect = 0;
                        

                        var valorOt = row.Cell(2).GetValue<string>();
                        var valorInmueble = row.Cell(3).GetValue<string>();
                        string valorTrabajo = row.Cell(9).GetValue<string>();
                        string valorCuadrillaStr = row.Cell(5).GetValue<string>().Trim();

                        // Hacemos la lectura de la fecha más robusta para evitar errores de conversión.
                        DateTime? valorAsignacion;
                        if (row.Cell(12).TryGetValue(out DateTime fechaAsignacion))
                        {
                            valorAsignacion = fechaAsignacion;
                        }
                        else
                        {
                            valorAsignacion = null; // Asignamos null si la celda está vacía o no es una fecha válida.
                            _logger.LogWarning("No se pudo convertir a fecha el valor '{ValorCelda}' en la fila {NumeroFila}, celda L. Se usará un valor nulo.", row.Cell(12).GetString(), row.RowNumber());
                        }

                        // Hacemos la lectura de la fecha de ejecución, pero solo nos interesa la fecha.
                        DateTime? valorEjecucion;
                        if (row.Cell(13).TryGetValue(out DateTime fechaEjecucion))
                        {
                            valorEjecucion = fechaEjecucion.Date; // .Date extrae solo la parte de la fecha.
                        }
                        else
                        {
                            valorEjecucion = null; // Asignamos null si la celda está vacía o no es una fecha válida.
                            _logger.LogWarning("No se pudo convertir a fecha el valor '{ValorCelda}' en la fila {NumeroFila}, celda M. Se usará un valor nulo.", row.Cell(13).GetString(), row.RowNumber());
                        }

                        string valorArea = row.Cell(15).GetValue<string>();
                        decimal Cantidad;
                        if (row.Cell(11).TryGetValue(out decimal cantidadValue))
                        {
                            Cantidad = cantidadValue;
                        }
                        else
                        {
                            Cantidad = 0m; // Asignamos 0 si la celda está vacía o no es un número válido.
                            _logger.LogWarning("No se pudo convertir a decimal el valor '{ValorCelda}' en la fila {NumeroFila}, celda K. Se usará el valor 0.", row.Cell(11).GetString(), row.RowNumber());
                        }

                        string valorValidado = row.Cell(16).GetValue<string>();
                        _logger.LogInformation($"Fila {row.RowNumber()}: Columna B = [{valorOt}], Columna C = [{valorInmueble}], Columna I = [{valorTrabajo}], Columna L = [{valorAsignacion}], Columna M = [{valorEjecucion:yyyy-MM-dd}], Columna O = [{valorArea}], Columna P = [{valorValidado}]");
                        var Ot = _context.OTs
                        .Where(o => o.OtNumber == valorOt
                            && o.CDC == valorInmueble
                            && o.Active == true)
                        .FirstOrDefault();

                        if (valorOt != null && valorOt.Length > 0)
                        {
                            string resultado;

                            // Convertimos el valor a número para poder aplicar el formato de dos dígitos (D2).
                            if (int.TryParse(valorCuadrillaStr, out int numeroCuadrilla))
                            {
                                resultado = $"CUADR-{numeroCuadrilla:D2}"; // Ej: Convierte 4 a "04"
                            }
                            else
                            {
                                resultado = $"CUADR-{valorCuadrillaStr}"; // Fallback si no es un número
                                _logger.LogWarning("El valor de cuadrilla '{ValorCuadrilla}' en la fila {NumeroFila} no es un número y no se pudo formatear.", valorCuadrillaStr, row.RowNumber());
                            }
                            _logger.LogInformation($"+++++++++++++Creando nueva OT para el proyecto: {resultado}");
                            var proyect = _context.Projects
                            .Where(p => p.Name == resultado// Comparación insensible a mayúsculas/minúsculas.
                                && p.Active == 1) // Corregido: se compara con 1 (short) en lugar de true (bool).
                            .FirstOrDefault();
                            _logger.LogInformation($"*********************proyect Id: {proyect?.Id}, description: {proyect?.Description}");

                            if (Ot == null)
                            {
                                // Limpiamos el valor de la celda para evitar problemas con espacios en blanco.

                                                                var newOT = new OT
                                {
                                    CuentaHoja = 1,
                                    RegisterDate = valorAsignacion,
                                    IdProject = proyect?.Id ?? 775,
                                    OtNumber = valorOt, //orden?.OtNumber ?? dict.GetValueOrDefault("Datos de Servicío Código", ""),
                                    //AssignedTo     = ,
                                    Description = row.Cell(4).GetValue<string>(),
                                    Area = valorArea,
                                    //TimeLimit      = valorEjecucion,
                                    //NameConsumer   = ,
                                    //PropertyNumber = ,
                                    //ContractNumber = ,
                                    //PhoneConsumer  = ,
                                    Address = row.Cell(7).GetValue<string>(),
                                    AddressNumber = row.Cell(8).GetValue<string>(),
                                    //OldAddressNumber = ,
                                    Neighborhood = row.Cell(6).GetValue<string>(),
                                    //AddressReferences = ,
                                    //AddressCrossings  = ,
                                    //ChargePhase    = ,
                                    CDC = valorInmueble,
                                    //HydrometerNumber = ,
                                    //Period         = ,
                                    //LectureWater   = ,
                                    Observations = row.Cell(17).GetValue<string>(),
                                    //Results        = ,
                                    Active = true,
                                    //Description    = ,
                                    //AssignedTo     = 
                                };

                                _logger.LogInformation("➡️  Valores a guardar - CuentaHoja: {CuentaHoja}, OtNumber: {OtNumber}", newOT.CuentaHoja, newOT.OtNumber);
                                mensaje += $"Se creo la OT: {newOT.OtNumber}\n";
                                _context.OTs.Add(newOT);
                                await _context.SaveChangesAsync();
                                NumberOT = newOT.Id;
                                NumberProyect = proyect?.Id ?? 775;
                                OtNum = newOT.OtNumber;
                            }
                            if (Ot != null && proyect != null)
                            {
                                var cambioCaudrilla = _context.OTs
                                    .Where(o => o.Id == Ot.Id
                                        && o.IdProject != proyect.Id
                                        && o.Active == true)
                                    .FirstOrDefault();
                                if (cambioCaudrilla != null)
                                {
                                    var carAnt = _context.Projects
                                        .Where(p => p.Id == Ot.IdProject)
                                        .FirstOrDefault();
                                    var carNew = _context.Projects
                                        .Where(p => p.Id == proyect.Id)
                                        .FirstOrDefault();
                                    mensaje += $"Actualizando la cuadrilla de la OT: {Ot.OtNumber} del proyecto {carAnt?.Name} al proyecto {carNew?.Name}\n";
                                    _logger.LogInformation($"+++++++++++++Actualizando la cuadrilla de la OT: {Ot.OtNumber} del proyecto {carAnt?.Name} al proyecto {carNew?.Name}");
                                    cambioCaudrilla.IdProject = proyect.Id;
                                    _context.OTs.Update(cambioCaudrilla);
                                    await _context.SaveChangesAsync();
                                    var logbooks = _context.Logbooks
                                        .Where(l => l.IdOt == Ot.Id)
                                        .ToList();
                                    foreach (var log in logbooks)
                                    {
                                        log.IdProject = proyect.Id;
                                        _context.Logbooks.Update(log);
                                        await _context.SaveChangesAsync();
                                    }
                                    var logbooksCon = _context.Logbooks
                                        .Where(l => l.IdOt == Ot.Id && l.TypeNote == "CONCEPT")
                                        .ToList();
                                    foreach (var log in logbooksCon)
                                    {
                                        var nameCon = _context.Workprograms
                                            .Where(w => w.Id == log.IdResource)
                                            .FirstOrDefault();

                                        var newCon = _context.Workprograms
                                            .Where(w => w.Text == nameCon.Text
                                                && w.IdProject == proyect.Id
                                                && w.Active == 1)
                                            .FirstOrDefault();
                                        _logger.LogInformation("////////Trabajo encontrado para cambio de cuadrilla: {nameCon.Text}, Id: {newCon.Id}", nameCon?.Text, newCon?.Id);
                                        log.IdResource = newCon.Id;
                                        _context.Logbooks.Update(log);
                                        await _context.SaveChangesAsync();
                                    }
                                }
                                
                            }
                            NumberOT = Ot != null ? Ot.Id : NumberOT;
                            NumberProyect = Ot?.IdProject ?? NumberProyect;
                            OtNum = Ot?.OtNumber ?? OtNum;

                            var report = _context.DailyReports
                                .Where(r => r.IdOt == NumberOT
                                && r.Date == valorEjecucion)
                                .ToList();

                            if (report.Count == 0)
                            {
                                var newReport = new DailyReport
                                {
                                    IdOt = NumberOT,
                                    Date = valorEjecucion,
                                    StartTime = new TimeSpan(8, 00, 0),
                                    EndTime = new TimeSpan(19, 00, 0),
                                    Type = valorArea,
                                    Description = "DESDE EL MODAL DE CARGA DE EXCEL",
                                    Close = true,
                                    Paid = true,
                                    Active = true
                                };
                                _context.DailyReports.Add(newReport);
                                await _context.SaveChangesAsync();
                                var idpersonal = 0;
                                switch
                                    (valorCuadrillaStr)
                                {
                                    case "4":
                                        idpersonal = 585;
                                        break;
                                    case "6":
                                        idpersonal = 506;
                                        break;
                                    case "8":
                                        idpersonal = 588;
                                        break;
                                    case "9":
                                        idpersonal = 591;
                                        break;
                                    case "10":
                                        idpersonal = 583;
                                        break;
                                    default:
                                        idpersonal = 506;
                                        break;
                                }
                                NumberReport = newReport.Id;
                                var newLogbook = new Logbook
                                {
                                    IdProject = NumberProyect,
                                    IdOt = NumberOT,
                                    IdResource = idpersonal,
                                    Timexnote = new TimeSpan(8, 0, 0),
                                    Date = valorEjecucion, // Corregido: Usar el Id del DailyReport recién creado.
                                    IdReporte = NumberReport,
                                    Description = "Sin descripción",
                                    ImageAzure = "NO FILE",
                                    ImageUrl = "SIN FOTO",
                                    Start = new TimeOnly(8, 00),
                                    End = new TimeOnly(19, 00),
                                    Quantity = Cantidad,
                                    TypeNote = "PERSONAL",
                                    Cuadrilla = $"Cuadrilla {valorCuadrillaStr}",
                                    Supervisor = "",
                                    Orden = 1,
                                };
                                _context.Logbooks.Add(newLogbook);
                                await _context.SaveChangesAsync();
                                mensaje += $"A la OT: {OtNum} se le creo el Reporte del dia {valorEjecucion} y se asigno personal.\n";
                            }
                            NumberReport = report.Count > 0 ? report[0].Id : NumberReport;

                            var IDtrabajo = await _context.Workprograms
                                        .Where(w => w.Text == valorTrabajo
                                        && w.IdProject == NumberProyect
                                            && w.Active == 1)
                                        .FirstOrDefaultAsync();
                            //_logger.LogInformation("////////Trabajo encontrado: Count: {Count}, Id: {Id}, Text: {Text}", IDtrabajo != null ? 1 : 0, IDtrabajo?.Id, IDtrabajo?.Text);
                            var trabajoCargado = await _context.Logbooks
                                .Where(l => l.IdResource == (IDtrabajo != null ? IDtrabajo.Id : 0)
                                    && l.IdOt == NumberOT
                                    && l.Date == valorEjecucion
                                    && l.IdReporte == NumberReport
                                    && l.TypeNote == "CONCEPT")
                                .ToListAsync();

                            _logger.LogInformation("////////Logbook de trabajo cargado: Count: {Count}", trabajoCargado.Count);
                            if (trabajoCargado.Count == 0 && IDtrabajo != null)
                            {
                                var newLogbook = new Logbook
                                {
                                    IdProject = NumberProyect,
                                    IdOt = NumberOT,
                                    IdResource = IDtrabajo.Id,
                                    Timexnote = new TimeSpan(8, 0, 0),
                                    Date = valorEjecucion, // Corregido: Usar el Id del DailyReport recién creado.
                                    IdReporte = NumberReport,
                                    Description = "Sin descripción",
                                    ImageAzure = "NO FILE",
                                    ImageUrl = "SIN FOTO",
                                    Start = new TimeOnly(8, 00),
                                    End = new TimeOnly(19, 00),
                                    Quantity = Cantidad,
                                    TypeNote = "CONCEPT",
                                    Validado = valorValidado,
                                    Supervisor = "",
                                    Orden = 1,
                                };
                                _context.Logbooks.Add(newLogbook);
                                await _context.SaveChangesAsync();
                                NumberTrabajo = newLogbook.Id;
                                mensaje += $"A la OT: {OtNum}, se le asigno el trabajo: {IDtrabajo.Text}.\n";
                            }
                            else if (trabajoCargado.Count > 0)
                            {
                                var logbookExistente = trabajoCargado[0];
                                // Comparamos si la cantidad del Excel es diferente a la que ya está en la base de datos.
                                if (logbookExistente.Quantity != Cantidad)
                                {
                                    mensaje += $"A la OT: {OtNum}, se le actualizó la cantidad del trabajo: '{IDtrabajo.Text}' de {logbookExistente.Quantity} a {Cantidad}.\n";
                                    logbookExistente.Quantity = Cantidad; // Actualizamos la cantidad
                                    _context.Logbooks.Update(logbookExistente);
                                    await _context.SaveChangesAsync();
                                }
                                if (logbookExistente.Validado != valorValidado)
                                {
                                    mensaje += $"A la OT: {OtNum}, se le actualizó la validación del trabajo: '{IDtrabajo.Text}' de {logbookExistente.Validado} a {valorValidado}.\n";
                                    logbookExistente.Validado = valorValidado; // Actualizamos la validación
                                    _context.Logbooks.Update(logbookExistente);
                                    await _context.SaveChangesAsync();
                                }
                                // Si las cantidades son iguales, no hacemos nada y no se genera ningún mensaje.
                            }

                            try
                            {
                                string query = @"
                                    UPDATE d
                                    SET d.totalpay = w.costMX * CASE 
                                        WHEN l.validado = 'PAGO' THEN l.quantity
                                        ELSE 0
                                    END
                                    FROM smp.dbo.dailyreport d
                                    INNER JOIN smp.dbo.logbook l ON l.id_reporte = d.Id
                                    INNER JOIN smp.dbo.workprogram w ON w.id = l.id_resource
                                    WHERE l.typenote = 'CONCEPT';
                                ";
                                int rowsAffected = await _context.Database.ExecuteSqlRawAsync(query);
                                _logger.LogInformation("+++++++++++++Se ejecutó la actualización de totalpay. Filas afectadas: {RowsAffected}", rowsAffected);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "+++++++++++++Error al ejecutar la consulta de actualización de totalpay.");
                            }

                            NumberTrabajo = trabajoCargado.Count > 0 ? trabajoCargado[0].Id : NumberTrabajo;
                            _logger.LogInformation("********➡️  OT existente o recién creado con ID: {NumberOT}", OtNum);
                            _logger.LogInformation("********➡️  Reporte diario existente o recién creado con ID: {NumberReport}", NumberReport);
                            _logger.LogInformation("********➡️  Trabajo registrado en bitácora con ID: {NumberTrabajo}", NumberTrabajo);
                            _logger.LogInformation("********➡️  Trabajo registrado en bitácora con ID: {NumberProyect}", NumberProyect);


                        }

                    }

                    _logger.LogInformation("--- Fin de la lectura del archivo Excel. Guardando resumen. ---");

                    byte[] archivoBytes = null;
                    string nombreArchivo = null;

                    if (!string.IsNullOrWhiteSpace(mensaje))
                    {
                        // 1. Crear un nombre de archivo único con fecha y hora.
                        string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                        nombreArchivo = $"resumen_{timestamp}.txt";

                        // 2. Convertir el resumen a bytes.
                        archivoBytes = System.Text.Encoding.UTF8.GetBytes(mensaje);

                        _logger.LogInformation("Resumen del proceso generado como archivo: {NombreArchivo}", nombreArchivo);
                    }

                    return new ProcesadorExcelResult
                    {
                        Resumen = mensaje,
                        ArchivoBytes = archivoBytes,
                        NombreArchivo = nombreArchivo
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Excel file");
                return new ProcesadorExcelResult { ErrorMessage = $"Error al procesar el archivo: {ex.Message}" };
            }
        }
    }

    public interface IProcesadorExcel
    {
        Task<ProcesadorExcelResult> ProcesarArchivoExcelAsync(Stream fileStream);
    }
}