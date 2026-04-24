using SMP.Models.context;
using SMP.Models;
using SMP.Models.TD;
using SMP.Models.DTO;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using System.Text;
using System.Text.RegularExpressions;
using System.Globalization;
using CsvHelper;
using System.Text.Json;
using DocumentFormat.OpenXml.Spreadsheet;

namespace SMP.Services.TD
{

    public class OTService : IOTService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<OTService> _logger;
        private readonly IDateTimeService _dateTimeService;

        public OTService(DbSmpContext context, ILogger<OTService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _dateTimeService = new DateTimeService();
        }

        public async Task<List<OT>> GetAll()
        {
            try
            {
                var result = await _context.OTs
                    .Where(c => c.Active == true && c.IdProject == 760)
                    //.OrderByDescending(c => c.Id)
                    .OrderByDescending(c => c.RegisterDate)

                    .AsNoTracking()
                    .ToListAsync();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No records found");
                    return result;
                }

                _logger.LogInformation($"Records found {result.Count}");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                throw;
            }
        }

        public async Task<List<Object>> Get2fields(int idProject)
        {
            try
            {
                var result = await _context.OTs
                    .Where(c => c.Active == true && c.IdProject == idProject && c.ClosedApp == false )
                    .OrderByDescending(c => c.RegisterDate)
                    .Select(c => new 
                    {
                        Id = c.Id,
                        Description = c.OtNumber + " " +  c.Description 
                    })  

                    .AsNoTracking()
                    .ToListAsync<Object>();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No records found");
                    return result;
                }

                _logger.LogInformation($"Records found {result.Count}");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                throw;
            }
        }

        public async Task<List<OtReportView>> GetOtReportsByCompany(int companyId)
        {

            var allReports = await _context.OtReportViews
                .Where(r => r.CompanyId == companyId)
                .OrderByDescending(r => r.Date)
                .ToListAsync();

            return allReports;
        }

        public async Task<List<object>> GetById(int id)
        {
            try
            {
                var result = await _context.OTs
                    .Where(ot => ot.Id == id && ot.Active == true)
                    .Join(_context.Projects, ot => ot.IdProject, p => p.Id, (ot, p) => new { OT = ot, Project = p })
                    .Join(_context.Contracts, otp => otp.Project.IdContrato, c => c.Id,
                        (otp, c) => new { OTP = otp, Contract = c })
                    .Join(_context.Branchs, otpc => otpc.Contract.IdBranch, b => b.Id, (otpc, b) => new
                    {
                        otpc.OTP.OT.Id,
                        otpc.OTP.OT.CuentaHoja,
                        otpc.OTP.OT.IdProject,
                        otpc.OTP.OT.OtNumber,
                        otpc.OTP.OT.AssignedTo,
                        otpc.OTP.OT.Description,
                        otpc.OTP.OT.TimeLimit,
                        otpc.OTP.OT.NameConsumer,
                        otpc.OTP.OT.PropertyNumber,
                        otpc.OTP.OT.ContractNumber,
                        otpc.OTP.OT.PhoneConsumer,
                        otpc.OTP.OT.Address,
                        otpc.OTP.OT.AddressNumber,
                        otpc.OTP.OT.OldAddressNumber,
                        otpc.OTP.OT.Neighborhood,
                        otpc.OTP.OT.AddressReferences,
                        otpc.OTP.OT.AddressCrossings,
                        otpc.OTP.OT.ChargePhase,
                        otpc.OTP.OT.CDC,
                        otpc.OTP.OT.HydrometerNumber,
                        otpc.OTP.OT.Period,
                        otpc.OTP.OT.LectureWater,
                        otpc.OTP.OT.Observations,
                        otpc.OTP.OT.Results,
                        otpc.OTP.OT.Area,
                        otpc.OTP.OT.RegisterDate,
                        otpc.OTP.OT.Active,
                        otpc.OTP.OT.Closed,
                        otpc.OTP.OT.ClosedAt,
                        otpc.OTP.OT.ClosedApp,
                        IdCompany = b.IdCompany
                    })
                    .AsNoTracking()
                    .ToListAsync();

                return result.Cast<object>().ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                throw;
            }
        }

        public async Task<List<OT>> GetOtByProject(int idProject, bool close)
        {
            try
            {
                var result = await _context.OTs
                    .Where(c => c.IdProject == idProject && c.Closed == close && c.Active == true)
                    .OrderBy(c => c.Id)
                    .AsNoTracking()
                    .ToListAsync();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No OTs found for project ID {idProject}", idProject);
                    return result;
                }

                _logger.LogInformation("Found {Count} OTs for project ID {idProject}", result.Count, idProject);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs for project ID {idProject}", idProject);
                throw;
            }
        }

        public async Task<List<OT>> OtByProjectforApp(int idProject)
        {
            try
            {
                var result = await _context.OTs
                    .Where(c => c.IdProject == idProject && c.ClosedApp == false && c.Active == true)
                    .OrderBy(c => c.Id)
                    .AsNoTracking()
                    .ToListAsync();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No OTs found for project ID {idProject}", idProject);
                    return result;
                }

                _logger.LogInformation("Found {Count} OTs for project ID {idProject}", result.Count, idProject);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs for project ID {idProject}", idProject);
                throw;
            }
        }

        public async Task Save(OT ot)
        {
            try
            {
                _context.OTs.Add(ot);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving OT");
                throw;
            }
        }

        public async Task<bool> UpdateOT(int id, OT updatedOT)
        {
            try
            {
                var existingOT = await _context.OTs
                    .Where(ot => ot.Id == id && ot.Active == true)
                    .FirstOrDefaultAsync();

                if (existingOT == null)
                {
                    _logger.LogWarning("OT with ID {Id} not found or inactive", id);
                    return false;
                }

                // Update properties
                existingOT.IdProject = updatedOT.IdProject;
                existingOT.CuentaHoja = updatedOT.CuentaHoja;
                existingOT.OtNumber = updatedOT.OtNumber;
                existingOT.AssignedTo = updatedOT.AssignedTo;
                existingOT.Description = updatedOT.Description;
                existingOT.TimeLimit = updatedOT.TimeLimit;
                existingOT.NameConsumer = updatedOT.NameConsumer;
                existingOT.PropertyNumber = updatedOT.PropertyNumber;
                existingOT.ContractNumber = updatedOT.ContractNumber;
                existingOT.PhoneConsumer = updatedOT.PhoneConsumer;
                existingOT.Address = updatedOT.Address;
                existingOT.AddressNumber = updatedOT.AddressNumber;
                existingOT.OldAddressNumber = updatedOT.OldAddressNumber;
                existingOT.Neighborhood = updatedOT.Neighborhood;
                existingOT.AddressReferences = updatedOT.AddressReferences;
                existingOT.AddressCrossings = updatedOT.AddressCrossings;
                existingOT.ChargePhase = updatedOT.ChargePhase;
                existingOT.CDC = updatedOT.CDC;
                existingOT.HydrometerNumber = updatedOT.HydrometerNumber;
                existingOT.Period = updatedOT.Period;
                existingOT.LectureWater = updatedOT.LectureWater;
                existingOT.Observations = updatedOT.Observations;
                existingOT.Results = updatedOT.Results;
                existingOT.Area = updatedOT.Area;
                existingOT.ClosedApp = updatedOT.ClosedApp;
                existingOT.Closed = updatedOT.Closed;
                existingOT.ClosedAt = updatedOT.ClosedAt;

                _context.OTs.Update(existingOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation("OT with ID {Id} updated successfully", id);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating OT with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> DeleteOT(int id)
        {
            try
            {
                var existingOT = await _context.OTs
                    .Where(ot => ot.Id == id && ot.Active == true)
                    .FirstOrDefaultAsync();

                if (existingOT == null)
                {
                    _logger.LogWarning("OT with ID {Id} not found or already inactive", id);
                    return false;
                }

                // Soft delete: set Active to false
                existingOT.Active = false;

                _context.OTs.Update(existingOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation("OT with ID {Id} deleted successfully (soft delete)", id);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting OT with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Reopen(int id)
        {
            try
            {
                var existingOT = await _context.OTs
                    .Where(ot => ot.Id == id && ot.Active == true)
                    .FirstOrDefaultAsync();

                if (existingOT == null)
                {
                    _logger.LogWarning("OT with ID {Id} not found or inactive", id);
                    return false;
                }

                // Reopen OT: set Closed and ClosedApp to false
                existingOT.Closed = false;
                existingOT.ClosedApp = false;

                _context.OTs.Update(existingOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation("OT with ID {Id} reopened successfully", id);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening OT with ID {Id}", id);
                throw;
            }
        }

        public async Task<RegistrarOTResponse> RegistrarOT(RegistrarOTRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Log del JSON recibido desde Android
                var requestJson = System.Text.Json.JsonSerializer.Serialize(request);
                _logger.LogInformation(
                    "-------------- OT SERVICE -------------- JSON recibido desde Android: {RequestJson}", requestJson);

                // 
                // Obtener la OT por ID para obtener sus datos
                var ordenTrabajo = await _context.OTs
                    .Where(ot => ot.Id == request.Id && ot.Active == true)
                    .FirstOrDefaultAsync();

                if (ordenTrabajo == null)
                {
                    return new RegistrarOTResponse
                    {
                        Success = false,
                        Message = $"Orden de trabajo con ID {request.Id} no encontrada"
                    };
                }

                DailyReport newDailyReport;

                var existingReport = await _context.DailyReports
                    .Where(dr => dr.IdOt == request.Id && dr.Active == true && dr.Date == DateTime.UtcNow.Date)
                    .FirstOrDefaultAsync();

                if (existingReport == null)
                {
                    _logger.LogWarning("No DailyReport found for OT ID {Id}", request.Id);
                    _logger.LogWarning("OT ID {Id} no tiene DailyReport asociado", request.Id);

                    newDailyReport = new DailyReport
                    {
                        IdOt = request.Id,
                        Date = DateTime.UtcNow.Date,
                        TotalPay = 0.0m,
                        Description = "DESDE APP ANDROID",
                        Type = "OT",
                        Active = true
                    };

                    _context.DailyReports.Add(newDailyReport);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    _logger.LogInformation("DailyReport found for OT ID {Id} with Report ID {ReportId}", request.Id,
                        existingReport.Id);
                    newDailyReport = existingReport;
                }

                var mexicoDateTime = _dateTimeService.GetMexicoDateTime();

                // Lista para acumular todos los registros de LogBook
                var logbookEntries = new List<Logbook>();

                // 1. Registrar PERSONAL - Un registro por cada EmployeeId
                if (request.EmployeeIds?.Any() == true)
                {
                    var personalEntries = request.EmployeeIds.Select(employeeId => new Logbook
                    {
                        IdProject = request.IdProject,
                        IdOt = request.Id,
                        IdResource = employeeId,
                        IdReporte = newDailyReport.Id, // Usamos el ID de la OT como IdReporte  
                        Date = mexicoDateTime.Date,
                        Timexnote = mexicoDateTime.TimeOfDay,
                        TypeNote = "PERSONAL",
                        Description = $"Personal asignado a OT {ordenTrabajo.OtNumber}",
                        ImageAzure = "NO FILE",
                        Orden = 0
                    }).ToList();

                    logbookEntries.AddRange(personalEntries);
                }

                // 2. Registrar EVIDENCIAS - Un registro por cada evidencia
                if (request.Evidencias?.Any() == true)
                {
                    var evidenciaEntries = request.Evidencias.Select(evidencia => new Logbook
                    {
                        IdProject = request.IdProject,
                        IdOt = request.Id,
                        IdReporte = newDailyReport.Id, // Usamos el ID de la OT como IdReporte
                        Date = mexicoDateTime.Date,
                        Timexnote = mexicoDateTime.TimeOfDay,
                        TypeNote = evidencia.Tipo.Trim(), // "FOTO" o "VIDEO"
                        ImageUrl = evidencia.Url,
                        Description = evidencia.Nota,
                        Supervisor = evidencia.Metadata?.Usuario,
                        ImageAzure = "NO FILE",
                        Metadata = evidencia.Metadata != null ? JsonSerializer.Serialize(evidencia.Metadata) : null,
                        Orden = 0
                    }).ToList();

                    logbookEntries.AddRange(evidenciaEntries);
                }

                // 3. Registrar TIPO RESULTADO - Un registro por cada TipoResultadoId
                if (request.TipoResultadoId?.Any() == true)
                {
                    var tipoResultadoEntries = request.TipoResultadoId.Select(tipoResultadoId => new Logbook
                    {
                        IdProject = request.IdProject,
                        IdOt = request.Id,
                        IdResource = tipoResultadoId,
                        IdReporte = newDailyReport.Id, // Usamos el ID de la OT como IdReporte
                        Date = mexicoDateTime.Date,
                        Timexnote = mexicoDateTime.TimeOfDay,
                        TypeNote = "TIPORESULTADOSERVICIO",
                        Description = request.Resultados,
                        ImageAzure = "NO FILE",
                        Orden = 0
                    }).ToList();

                    logbookEntries.AddRange(tipoResultadoEntries);
                }

                // Insertar todos los registros de LogBook
                if (logbookEntries.Any())
                {
                    _context.Logbooks.AddRange(logbookEntries);
                    _logger.LogInformation(
                        "Se insertaron {Count} registros en LogBook para OT ID: {OtId} - Personal: {Personal}, Evidencias: {Evidencias}, TipoResultado: {TipoResultado}",
                        logbookEntries.Count, request.Id,
                        request.EmployeeIds?.Count ?? 0,
                        request.Evidencias?.Count ?? 0,
                        request.TipoResultadoId?.Count ?? 0);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Registros LogBook creados exitosamente para OT ID: {OtId}", request.Id);

                return new RegistrarOTResponse
                {
                    Success = true,
                    Message = "Registros de LogBook creados exitosamente",
                    RegistroId = request.Id, // Devolvemos el ID de la OT
                    FechaCreacion = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error al registrar OT ID: {OtId}", request.Id);

                return new RegistrarOTResponse
                {
                    Success = false,
                    Message = "Error interno del servidor al registrar la OT"
                };
            }
        }

        public string BuscarValor(string texto, string inicio, string fin)
        {
            int idxInicio = texto.IndexOf(inicio);
            int idxFin = texto.IndexOf(fin);
            if (idxInicio >= 0 && idxFin > idxInicio)
            {
                var extraido = texto.Substring(idxInicio + inicio.Length, idxFin - (idxInicio + inicio.Length));
                return extraido.Trim();
            }

            return string.Empty;
        }

        public async Task<object> UpdateProjectForOt(int idOt, int newIdProject, int? oldIdProject = null)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _logger.LogInformation(
                    "Iniciando actualización de proyecto para OT ID: {IdOt} -> Nuevo proyecto: {NewIdProject}, OldIdProject proporcionado: {OldIdProject}",
                    idOt, newIdProject, oldIdProject);

                // Verificar que la OT existe y está activa
                var existingOT = await _context.OTs
                    .Where(ot => ot.Id == idOt && ot.Active == true)
                    .FirstOrDefaultAsync();

                if (existingOT == null)
                {
                    _logger.LogWarning("OT con ID {IdOt} no encontrada o inactiva", idOt);
                    return new
                    {
                        success = false,
                        message = $"OT con ID {idOt} no encontrada o inactiva",
                        updatedCount = 0
                    };
                }

                // Si no se proporcionó oldIdProject, usarlo de la OT actual
                // NOTA: Esto puede no funcionar si la OT ya fue actualizada antes de llamar este método
                if (!oldIdProject.HasValue)
                {
                    oldIdProject = existingOT.IdProject;
                    _logger.LogWarning(
                        "⚠️ No se proporcionó oldIdProject, usando el de la OT actual: {OldIdProject}. Esto puede causar problemas si la OT ya fue actualizada.",
                        oldIdProject);
                }

                // Verificar que el nuevo proyecto existe
                var existingProject = await _context.Projects
                    .Where(p => p.Id == newIdProject)
                    .FirstOrDefaultAsync();

                if (existingProject == null)
                {
                    _logger.LogWarning("Proyecto con ID {NewIdProject} no encontrado", newIdProject);
                    return new
                    {
                        success = false,
                        message = $"Proyecto con ID {newIdProject} no encontrado",
                        updatedCount = 0
                    };
                }

                // Calcular el nombre de la cuadrilla basado en el nombre del proyecto
                string cuadrillaName = "";
                if (existingProject.Name == "ADMON TD")
                {
                    cuadrillaName = ""; // o NULL según prefieras
                }
                else
                {
                    // Extraer número de "Cuadrilla-1" -> "Cuadrilla 1"
                    var parts = existingProject.Name.Split('-');
                    if (parts.Length > 1 && int.TryParse(parts[1], out int numero))
                    {
                        cuadrillaName = $"Cuadrilla {numero}";
                    }
                    else
                    {
                        cuadrillaName = existingProject.Name; // fallback
                    }
                }

                _logger.LogInformation("Nombre de cuadrilla calculado: {CuadrillaName}", cuadrillaName);
                _logger.LogInformation("Proyecto antiguo: {OldIdProject}, Proyecto nuevo: {NewProjectId}", oldIdProject,
                    newIdProject);

                // Actualizar todos los registros en Logbook donde IdOt = idOt
                var logbookEntries = await _context.Logbooks
                    .Where(l => l.IdOt == idOt)
                    .ToListAsync();

                if (!logbookEntries.Any())
                {
                    _logger.LogInformation("No se encontraron registros en Logbook para OT ID: {IdOt}", idOt);
                    return new
                    {
                        success = true,
                        message = $"No se encontraron registros en Logbook para OT ID {idOt}",
                        updatedCount = 0,
                        newCuadrilla = cuadrillaName
                    };
                }

                // Obtener todos los workprograms del proyecto antiguo y nuevo para mapear
                var oldProjectWorkprograms = await _context.Workprograms
                    .Where(w => w.IdProject == oldIdProject.Value && w.Active == 1)
                    .ToListAsync();

                var newProjectWorkprograms = await _context.Workprograms
                    .Where(w => w.IdProject == newIdProject && w.Active == 1)
                    .ToListAsync();

                _logger.LogInformation(
                    "Workprograms encontrados - Proyecto anterior: {OldCount}, Proyecto nuevo: {NewCount}",
                    oldProjectWorkprograms.Count, newProjectWorkprograms.Count);

                // Actualizar el campo IdProject y Cuadrilla en todos los registros encontrados
                int personalUpdated = 0;
                int workprogramUpdated = 0;
                int workprogramNotMapped = 0;

                foreach (var logbookEntry in logbookEntries)
                {
                    logbookEntry.IdProject = newIdProject;

                    _logger.LogInformation(
                        "Procesando registro Logbook ID: {Id}, TypeNote: {TypeNote}, IdResource: {IdResource}",
                        logbookEntry.Id, logbookEntry.TypeNote, logbookEntry.IdResource);

                    // Solo actualizar cuadrilla si el registro es de tipo PERSONAL
                    if (logbookEntry.TypeNote == "PERSONAL")
                    {
                        logbookEntry.Cuadrilla = cuadrillaName;
                        personalUpdated++;
                    }

                    // Actualizar idResource para registros de tipo CONCEPT
                    if (logbookEntry.TypeNote == "CONCEPT" && logbookEntry.IdResource.HasValue)
                    {
                        _logger.LogInformation(
                            "🔍 Encontrado registro CONCEPT - ID Logbook: {LogbookId}, IdResource: {IdResource}",
                            logbookEntry.Id, logbookEntry.IdResource.Value);

                        // Buscar el workprogram actual (del proyecto antiguo)
                        var oldWorkprogram = oldProjectWorkprograms
                            .FirstOrDefault(w => w.Id == logbookEntry.IdResource.Value);

                        if (oldWorkprogram != null)
                        {
                            _logger.LogInformation(
                                "✅ Workprogram encontrado en proyecto antiguo: ID={Id}, Text={Text}, IdProject={IdProject}",
                                oldWorkprogram.Id, oldWorkprogram.Text, oldWorkprogram.IdProject);
                            _logger.LogInformation("Buscando equivalente para: {Description}", oldWorkprogram.Text);

                            // Buscar el workprogram equivalente en el nuevo proyecto
                            // Primero buscar coincidencia exacta
                            var newWorkprogram = newProjectWorkprograms
                                .FirstOrDefault(w =>
                                    w.Text.Equals(oldWorkprogram.Text, StringComparison.OrdinalIgnoreCase));

                            // Si no hay coincidencia exacta, buscar la más similar
                            if (newWorkprogram == null && !string.IsNullOrEmpty(oldWorkprogram.Text))
                            {
                                newWorkprogram =
                                    FindMostSimilarWorkprogram(oldWorkprogram.Text, newProjectWorkprograms);
                            }

                            if (newWorkprogram != null)
                            {
                                _logger.LogInformation(
                                    "Mapeando workprogram: '{OldDesc}' (ID: {OldId}) -> '{NewDesc}' (ID: {NewId})",
                                    oldWorkprogram.Text, oldWorkprogram.Id, newWorkprogram.Text, newWorkprogram.Id);

                                logbookEntry.IdResource = newWorkprogram.Id;
                                workprogramUpdated++;
                            }
                            else
                            {
                                _logger.LogWarning(
                                    "❌ No se encontró equivalente para workprogram: '{Description}' (ID: {Id})",
                                    oldWorkprogram.Text, oldWorkprogram.Id);
                                workprogramNotMapped++;
                            }
                        }
                        else
                        {
                            _logger.LogWarning(
                                "⚠️ No se encontró el workprogram con ID {IdResource} en el proyecto antiguo (IdProject: {OldIdProject})",
                                logbookEntry.IdResource.Value, oldIdProject.Value);
                        }
                    }

                    _context.Logbooks.Update(logbookEntry);
                }

                _logger.LogInformation(
                    "Actualización de registros - PERSONAL: {PersonalCount}, Workprogram mapeados: {WorkprogramMapped}, No mapeados: {NotMapped}",
                    personalUpdated, workprogramUpdated, workprogramNotMapped);

                // También actualizar el IdProject en la OT principal
                existingOT.IdProject = newIdProject;
                _context.OTs.Update(existingOT);

                // Guardar todos los cambios
                var updatedCount = await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Actualización completada: {UpdatedCount} registros actualizados para OT ID: {IdOt}", updatedCount,
                    idOt);

                return new
                {
                    success = true,
                    message = $"Se actualizaron {updatedCount} registros del logbook",
                    updatedCount = updatedCount,
                    newCuadrilla = cuadrillaName,
                    personalUpdated = personalUpdated,
                    workprogramUpdated = workprogramUpdated,
                    workprogramNotMapped = workprogramNotMapped
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error al actualizar proyecto para OT ID: {IdOt}", idOt);

                return new
                {
                    success = false,
                    message = "Error interno del servidor al actualizar el proyecto",
                    updatedCount = 0
                };
            }
        }

        private DateTime ParsearFecha(Match match, CultureInfo cultura)
        {
            var fechaBase = match.Groups[1].Value;
            var hora = match.Groups[2].Value;

            if (!string.IsNullOrEmpty(hora))
            {
                // Con hora
                if (DateTime.TryParseExact(fechaBase + hora, "dd/MM/yyyy HH:mm",
                        cultura, DateTimeStyles.None, out DateTime fechaConHora))
                    return fechaConHora;
            }
            else
            {
                // Sin hora
                if (DateTime.TryParseExact(fechaBase, "dd/MM/yyyy",
                        cultura, DateTimeStyles.None, out DateTime fechaSinHora))
                    return fechaSinHora;
            }

            return DateTime.MinValue;
        }

        public DateTime BuscarPrimeraFecha(string texto)
        {
            var cultura = new CultureInfo("es-MX");
            var regex = new Regex(@"\b(\d{2}/\d{2}/\d{4})(\s+\d{2}:\d{2})?\b");
            var match = regex.Match(texto); // Solo el primer match

            if (match.Success)
            {
                return ParsearFecha(match, cultura);
            }

            return DateTime.MinValue;
        }

        public DateTime BuscarSegundaFecha(string texto)
        {
            var cultura = new CultureInfo("es-MX");
            var regex = new Regex(@"\b(\d{2}/\d{2}/\d{4})(\s+\d{2}:\d{2})?\b");
            var matches = regex.Matches(texto);

            if (matches.Count >= 2)
            {
                return ParsearFecha(matches[1], cultura); // El segundo match
            }

            return DateTime.MinValue;
        }

        public DateTime BuscarPlazo(string texto, string campo)
        {
            var regex = new Regex(@"(\d{2}/\d{2}/\d{4})");
            var match = regex.Match(texto);
            if (match.Success && DateTime.TryParse(match.Groups[1].Value, out DateTime fecha))
            {
                return fecha;
            }

            return DateTime.MinValue;
        }

        public DateTime BuscarFechaHoraAntesDeDatos(string texto)
        {
            var regex = new Regex(@"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})\s+Datos");
            var match = regex.Match(texto);
            var culturaMx = new System.Globalization.CultureInfo("es-MX");

            if (match.Success && DateTime.TryParseExact(
                    match.Groups[1].Value,
                    "dd/MM/yyyy HH:mm",
                    culturaMx,
                    System.Globalization.DateTimeStyles.None,
                    out DateTime fechaHora))
            {
                return fechaHora;
            }

            return DateTime.MinValue;
        }

        public string BuscarOT(string texto)
        {
            var regex = new Regex("Fecha\\s+(\\d+)");
            var match = regex.Match(texto);
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        public string BuscarObservacionesCompletas(string texto)
        {
            var regex = new Regex(@"Observaciones:\s*(.*?)\s*Datos Generales", RegexOptions.Singleline);
            var match = regex.Match(texto);
            return match.Success ? match.Groups[1].Value.Trim() : string.Empty;
        }

        public OT ExtractOrder(string texto)
        {
            try
            {

                var orden = new OT
                {
                    NameConsumer = BuscarValor(texto, "Consumidor", "Usuario"),
                    Address = BuscarValor(texto, "Dirección", "Nr. Actual"),
                    OtNumber = BuscarOT(texto),
                    RegisterDate = BuscarPrimeraFecha(texto),
                    TimeLimit = BuscarSegundaFecha(texto),
                    /* Barrio = BuscarValor(texto, "Barrio", "Complemento"),
                     TipoFacturacion = BuscarValor(texto, "Tipo Facturación", "Fase de Cobro"),
                     CodigoServicio = BuscarValor(texto, "Código", "Descripción"),
                     DescripcionServicio = BuscarValor(texto, "Descripción del servicío solicitante", "Plazo"),
                     FechaServicio = BuscarFecha(texto, "Fecha"),
                     Empleado = BuscarValor(texto, "Empleado", "Fecha"),
                     Unidad = BuscarValor(texto, "Unidad", "Empleado"),
                     NumeroHidrometro = BuscarValor(texto, "Nr. Hidrómetro", "Categoría"), */
                    Observations = BuscarObservacionesCompletas(texto)
                };
                return orden;
            }
            catch
            {
                return null;
            }
        }

        public void ShowPdfText(string pathPdf)
        {
            using (var pdf = PdfDocument.Open(pathPdf))
            {
                foreach (var page in pdf.GetPages())
                {
                    Console.WriteLine("---------------------------------------------------");
                    Console.WriteLine($"Page {page.Number}");
                    Console.WriteLine("---------------------------------------------------");
                    Console.WriteLine(page.Text); // 🔹 Muestra todo el texto de la página
                    Console.WriteLine(); // Línea en blanco para separar
                }
            }
        }

        /// Extrae el número de hoja buscando un número dentro de un área específica de la página (esquina superior derecha).
        /// <param name="page">La página del PDF a procesar.</param>
        /// <returns>El número de hoja encontrado, o null si no se encuentra ninguno.</returns>
        private int? ExtractSheetNumberFromPage(UglyToad.PdfPig.Content.Page page)
        {
            try
            {
                // Definimos el área de búsqueda en la esquina superior derecha.
                // Las coordenadas en PDF se miden desde la esquina inferior izquierda (0,0).
                // Asumimos una página tamaño carta (aprox. 612x792 puntos).
                // Buscaremos en el 25% superior de la página y en el 30% más a la derecha.
                var searchArea = new UglyToad.PdfPig.Core.PdfRectangle(
                    page.Width * 0.70, // x1: Desde el 70% del ancho
                    page.Height * 0.75, // y1: Desde el 75% de la altura
                    page.Width, // x2: Hasta el borde derecho
                    page.Height // y2: Hasta el borde superior
                );

                // Filtra las palabras que están dentro del área de búsqueda
                var wordsInArea = page.GetWords()
                    .Where(w =>
                        w.BoundingBox.Left >= searchArea.Left && w.BoundingBox.Right <= searchArea.Right &&
                        w.BoundingBox.Bottom >= searchArea.Bottom && w.BoundingBox.Top <= searchArea.Top)
                    .ToList();

                // Buscar si existe texto contextual como "Hoja", "Página", "Pág" en el área
                var contextKeywords = new[] { "Hoja", "hoja", "HOJA", "Página", "página", "PÁGINA", "Pág", "pág", "PÁG", "Pag", "pag", "PAG" };
                bool hasContextKeyword = wordsInArea.Any(w => contextKeywords.Any(k => w.Text.Contains(k)));

                if (!hasContextKeyword)
                {
                    // No hay contexto que indique número de hoja, usar índice de página
                    _logger.LogInformation(
                        "ℹ️ No se encontró texto contextual (Hoja/Página) en el área de búsqueda para la página {PageNumber}. Se usará el índice de página.",
                        page.Number);
                    return null;
                }

                // Ordenar palabras: prioridad a las más arriba y más a la derecha
                var sortedWords = wordsInArea
                    .OrderByDescending(w => w.BoundingBox.Top)
                    .ThenByDescending(w => w.BoundingBox.Right);

                foreach (var word in sortedWords)
                {
                    // Intentamos convertir el texto de la palabra a un número.
                    if (int.TryParse(word.Text, out int potentialSheetNumber))
                    {
                        // VALIDACIÓN: Un número de hoja real no debería ser un número muy grande.
                        if (potentialSheetNumber > 0 && potentialSheetNumber < 500)
                        {
                            _logger.LogInformation(
                                "✅ Número de hoja válido encontrado por coordenadas en página {PageNumber}: {SheetNumber}",
                                page.Number, potentialSheetNumber);
                            return potentialSheetNumber;
                        }
                    }
                }

                _logger.LogWarning(
                    "⚠️ Se encontró contexto pero no un número de hoja válido en el área para la página {PageNumber}.",
                    page.Number);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al extraer número de hoja por coordenadas en la página {PageNumber}.",
                    page.Number);
                return null;
            }
        }

        public async Task<PdfProcessResult> PDFProcessMaster(string pathPdf, int? idProject)
        {
            var result = new PdfProcessResult();
            try
            {
                _logger.LogInformation("🚀 Iniciando PDFProcessMaster para archivo: {PathPdf}", pathPdf);

                // Extraer el nombre del archivo sin la extensión .pdf
                string fileName = System.IO.Path.GetFileNameWithoutExtension(pathPdf);
                _logger.LogInformation("📦 Nombre del archivo (Package): {FileName}", fileName);

                using var pdf = PdfDocument.Open(pathPdf);
                result.TotalPages = pdf.NumberOfPages;
                OT processedOT = null;

                _logger.LogInformation("📄 PDF abierto exitosamente. Total de páginas: {TotalPages}",
                    result.TotalPages);

                for (int i = 1; i <= result.TotalPages; i++)
                {
                    var page = pdf.GetPage(i);
                    var pageText = page.Text;

                    _logger.LogInformation(
                        "📖 Procesando página {PaginaActual}/{TotalPaginas} - Longitud del texto: {LongitudTexto}", i,
                        result.TotalPages, pageText?.Length ?? 0);

                    int sheetNumber = ExtractSheetNumberFromPage(page) ?? i;

                    var pageType = DetectPageType(pageText);
                    _logger.LogInformation(
                        "📄 Hoja {PaginaActual}/{TotalPaginas} (N° Hoja Asignado: {NumeroHojaAsignado}): Tipo detectado -> {TipoPagina}",
                        i, result.TotalPages, sheetNumber, pageType);

                    processedOT = null; // Reset for each page
                    switch (pageType)
                    {
                        case PageType.Formato1:
                            _logger.LogInformation("🔄 Procesando como Formato1...");
                            processedOT = await PDFProcess(pageText, sheetNumber, idProject, fileName);
                            break;
                        case PageType.Formato2:
                            _logger.LogInformation("🔄 Procesando como Formato2...");
                            processedOT = await PDFProcessCopy(pageText, sheetNumber, idProject, fileName);
                            break;
                        case PageType.Formato3:
                            _logger.LogInformation("🔄 Procesando como Formato3...");
                            processedOT = await PDFProcessCopy2(pageText, sheetNumber, idProject, fileName);
                            break;
                        case PageType.Desconocido:
                            _logger.LogWarning("⚠️ Página {Pagina} no reconocida", i);
                            break;
                    }

                    if (processedOT != null)
                    {
                        result.CreatedCount++;
                        _logger.LogInformation("✅ Página {Pagina} procesada exitosamente. OT Creada: {OTId}", i,
                            processedOT.Id);
                    }
                    else
                    {
                        result.SkippedCount++;
                        _logger.LogWarning("⚠️ No se generó OT para la página {Pagina}", i);
                    }
                }

                _logger.LogInformation(
                    "🏁 PDFProcessMaster completado. Total: {TotalPages}, Creadas: {CreatedCount}, Omitidas: {SkippedCount}",
                    result.TotalPages, result.CreatedCount, result.SkippedCount);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error fatal en PDFProcessMaster para el archivo {PathPdf}", pathPdf);
                return result; // Return partial results in case of error
            }
        }

        public async Task<OT> PDFProcess(string pageText, int pageNumber, int? idProject, string fileName)
        {
            try
            {

                _logger.LogInformation(
                    "---------------------------------------------------------------------------- Bloque de página {Pagina}",
                    pageNumber);

                var orden = ExtractOrder(pageText);
                if (idProject.HasValue)
                {
                    var exists = await _context.Projects.AnyAsync(p => p.Id == idProject.Value);
                    if (!exists)
                    {
                        _logger.LogWarning(
                            "El proyecto con ID {IdProject} no existe. Se omitirá la OT de la página {Pagina}.",
                            idProject, pageNumber);
                        return null;
                    }
                }

                // 👇 Aquí va EXACTAMENTE la misma lógica que ya tienes:
                var labels = new[]
                {
                    "Unidad", "Empleado", "Fecha", "Datos de Servicío Código", "Descripción del servicío solicitante",
                    "Plazo", "Origen",
                    "Prioridad", "Datos Catastrales Consumidor", "Usuario / Contacto", "Teléfono", "Cód", "Dirección",
                    "Nr. Actual",
                    "Nr. Antiguo", "Barrio", "Complemento de la Calle", "Punto de Referencia", "Tipo Facturación",
                    "Fase de Cobro",
                    "Identificación", "CDC", "Nr. Hidrómetro", "Categoría / Ahorros", "Período", "Lectura", "RFC",
                    "Residentes", "Media",
                    "Sello", "Dispositivo Anti-Fraude", "Observaciones:", "Datos Generales Fecha e Hora Inicio",
                    "Fecha e Hora de Ruptura",
                    "Vehículo (placa)", "Consumidor", "Equipo", "Equipo:", "Nueva Conexión?", "Inspección?", "Acera",
                    "Asfalto", "Agua Pluvial", "Casa",
                    "Conectado", "Material", "Longitud", "Ancho", "Comercio", "No Conectado", "Local Sinalizado e",
                    "Construcción",
                    "Interconectado", "Industria", "Escombro de la Acera", "Terreno", "Escombro en la Calle",
                    "Resultado del Servicio",
                    "Miembro:", "Cliente:"
                };

                var dict = new Dictionary<string, string>();
                for (int j = 0; j < labels.Length; j++)
                {
                    var startLabel = labels[j];
                    var startIndex = pageText.IndexOf(startLabel, StringComparison.Ordinal);
                    if (startIndex < 0) continue;

                    var valueStart = startIndex + startLabel.Length;
                    var nextIndex = pageText.Length;

                    for (int k = j + 1; k < labels.Length; k++)
                    {
                        var idx = pageText.IndexOf(labels[k], valueStart, StringComparison.Ordinal);
                        if (idx > -1 && idx < nextIndex)
                            nextIndex = idx;
                    }

                    var rawVal = pageText.Substring(valueStart, nextIndex - valueStart);
                    // Preserve line breaks for Observaciones, but trim other fields normally
                    var labelKey = startLabel.TrimEnd(':');
                    if (labelKey == "Observaciones")
                    {
                        // Only trim leading/trailing spaces but preserve line breaks for observaciones
                        dict[labelKey] = rawVal.TrimStart(' ').TrimEnd(' ');
                    }
                    else
                    {
                        dict[labelKey] = rawVal.Trim();
                    }
                }

                foreach (var kv in dict)
                    _logger.LogInformation("----------------------------------------------{Key} => {Value}", kv.Key,
                        kv.Value);

                _logger.LogInformation("📦 Package asignado para Formato1: {Package}", fileName);

                var match = Regex.Match(dict.GetValueOrDefault("Escombro en la Calle", ""), @"(\d+)\s*$");
                string folio = match.Success ? match.Groups[1].Value : "";
                var match2 = Regex.Match(pageText,
                    @"\d{2}[A-Z]+25\s+\d+\s+(.*?)(?=\s+Datos de Servicío)",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);

                string resultadosOt = match2.Success ? match2.Groups[1].Value.Trim() : "";
                _logger.LogInformation("******************** {resultadosOt}", resultadosOt);
                var descripcion = dict.GetValueOrDefault("Descripción del servicío solicitante", "");
                var newOT = new OT
                {
                    CuentaHoja = pageNumber,
                    Package = fileName, // Nombre del archivo sin extensión
                    RegisterDate = orden?.RegisterDate ?? DateTime.Now,
                    IdProject = idProject,
                    OtNumber = folio, //orden?.OtNumber ?? dict.GetValueOrDefault("Datos de Servicío Código", ""),
                    AssignedTo = dict.GetValueOrDefault("Empleado", ""),
                    Description = descripcion,
                    Area = descripcion.StartsWith("RECONEXION", StringComparison.OrdinalIgnoreCase) ? "RECONEXIONES"
                        : descripcion.StartsWith("SUSPENSION", StringComparison.OrdinalIgnoreCase) ? "CORTES"
                        : descripcion.StartsWith("INSPECCION", StringComparison.OrdinalIgnoreCase) ? "INSPECCIONES"
                        : descripcion.Contains("MEDIDOR", StringComparison.OrdinalIgnoreCase) ? "MEDIDORES"
                        : "SIN AREA",
                    TimeLimit = orden?.TimeLimit,
                    NameConsumer = orden?.NameConsumer ?? dict.GetValueOrDefault("Datos Catastrales Consumidor", ""),
                    PropertyNumber = orden?.PropertyNumber ?? dict.GetValueOrDefault("Nr. Actual", ""),
                    ContractNumber = dict.GetValueOrDefault("Identificación", ""),
                    PhoneConsumer = dict.GetValueOrDefault("Teléfono", ""),
                    Address = orden?.Address ?? dict.GetValueOrDefault("Dirección", ""),
                    AddressNumber = dict.GetValueOrDefault("Nr. Actual", ""),
                    OldAddressNumber = dict.GetValueOrDefault("Nr. Antiguo", ""),
                    Neighborhood = dict.GetValueOrDefault("Barrio", ""),
                    AddressReferences = dict.GetValueOrDefault("Punto de Referencia", ""),
                    AddressCrossings = dict.GetValueOrDefault("Complemento de la Calle", ""),
                    ChargePhase = dict.GetValueOrDefault("Fase de Cobro", ""),
                    CDC = dict.GetValueOrDefault("CDC", ""),
                    HydrometerNumber = dict.GetValueOrDefault("Nr. Hidrómetro", ""),
                    Period = dict.GetValueOrDefault("Período", ""),
                    LectureWater = dict.GetValueOrDefault("Lectura", ""),
                    Observations = resultadosOt, //orden?.Observations ?? dict.GetValueOrDefault("Observaciones", ""),
                    Results = dict.GetValueOrDefault("Resultado del Servicio", ""),
                    Active = true
                };

                _logger.LogInformation(
                    "➡️  Valores a guardar - CuentaHoja: {CuentaHoja}, OtNumber: {OtNumber}, CDC: {CDC}",
                    newOT.CuentaHoja, newOT.OtNumber, newOT.CDC);

                var existingOT = await _context.OTs.FirstOrDefaultAsync(o =>
                    o.OtNumber == newOT.OtNumber && o.CDC == newOT.CDC && o.Active);
                if (existingOT != null)
                {
                    _logger.LogWarning(
                        "⚠️ OT duplicada encontrada en la base de datos. OtNumber: {OtNumber}, CDC: {CDC}. No se guardará.",
                        newOT.OtNumber, newOT.CDC);
                    return null;
                }

                _context.OTs.Add(newOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "---------------------------------------------------------------------------- OT guardada exitosamente con ID: {Id}",
                    newOT.Id);

                return newOT;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error inesperado en PDFProcess página {Pagina}", pageNumber);
                throw;
            }
        }

        public async Task<OT> PDFProcessCopy(string pageText, int pageNumber, int? idProject, string fileName)
        {
            try
            {
                _logger.LogInformation(
                    "---------------------------------------------------------------------------- Bloque de página {Pagina}",
                    pageNumber);

                var orden = ExtractOrder(pageText);
                if (idProject.HasValue)
                {
                    var exists = await _context.Projects.AnyAsync(p => p.Id == idProject.Value);
                    if (!exists)
                    {
                        _logger.LogWarning(
                            "El proyecto con ID {IdProject} no existe. Se omitirá la OT de la página {Pagina}.",
                            idProject, pageNumber);
                        return null;
                    }
                }

                if (orden != null)
                {
                    _logger.LogInformation("------------------------------- Orden encontrada Nombre: {Orden}",
                        orden.NameConsumer);
                    _logger.LogInformation("------------------------------- Orden encontrada Direccion: {Orden}",
                        orden.Address);
                    _logger.LogInformation("------------------------------- Orden encontrada Observaciones: {Orden}",
                        orden.Observations);
                    _logger.LogInformation("------------------------------- Orden encontrada OT: {Orden}",
                        orden.OtNumber);
                    _logger.LogInformation("------------------------------- Orden encontrada Fecha 1: {Orden}",
                        orden.RegisterDate);
                    _logger.LogInformation("------------------------------- Orden encontrada Fecha 2: {Orden}",
                        orden.TimeLimit);
                }

                // 🔹 Extraer etiquetas
                var labels = new[]
                {
                    "Unidad", "Empleado", "Fecha", "Datos de Servicío Código", "Descripción del servicío solicitante",
                    "Plazo", "Origen",
                    "Prioridad", "Datos Catastrales Consumidor", "Usuario / Contacto", "Teléfono", "Cód", "Dirección",
                    "Nr. Actual",
                    "Nr. Antiguo", "Barrio", "Complemento de la Calle", "Punto de Referencia", "Tipo Facturación",
                    "Fase de Cobro",
                    "Identificación", "CDC", "Nr. Hidrómetro", "Categoría / Ahorros", "Período", "Lectura", "RFC",
                    "Residentes", "Media",
                    "Sello", "Dispositivo Anti-Fraude", "Observaciones:", "Datos Generales Fecha e Hora Inicio",
                    "Fecha e Hora de Ruptura",
                    "Vehículo (placa)", "Consumidor", "Equipo", "Equipo:", "Nueva Conexión?", "Inspección?", "Acera",
                    "Asfalto", "Agua Pluvial", "Casa",
                    "Conectado", "Material", "Longitud", "Ancho", "Comercio", "No Conectado", "Local Sinalizado e",
                    "Construcción",
                    "Interconectado", "Industria", "Escombro de la Acera", "Terreno", "Escombro en la Calle",
                    "Resultado del Servicio",
                    "Miembro:", "Cliente:"
                };

                var dict = new Dictionary<string, string>();
                for (int j = 0; j < labels.Length; j++)
                {
                    var startLabel = labels[j];
                    var startIndex = pageText.IndexOf(startLabel, StringComparison.Ordinal);
                    if (startIndex < 0) continue;

                    var valueStart = startIndex + startLabel.Length;
                    var nextIndex = pageText.Length;

                    for (int k = j + 1; k < labels.Length; k++)
                    {
                        var idx = pageText.IndexOf(labels[k], valueStart, StringComparison.Ordinal);
                        if (idx > -1 && idx < nextIndex)
                            nextIndex = idx;
                    }

                    var rawVal = pageText.Substring(valueStart, nextIndex - valueStart);
                    // Preserve line breaks for Observaciones, but trim other fields normally
                    var labelKey = startLabel.TrimEnd(':');
                    if (labelKey == "Observaciones")
                    {
                        // Only trim leading/trailing spaces but preserve line breaks for observaciones
                        dict[labelKey] = rawVal.TrimStart(' ').TrimEnd(' ');
                    }
                    else
                    {
                        dict[labelKey] = rawVal.Trim();
                    }
                }

                foreach (var kv in dict)
                    _logger.LogInformation("----------------------------------------------{Key} => {Value}", kv.Key,
                        kv.Value);

                // 🔹 Regex y cálculos adicionales
                var datos = ExtraerCDC(dict.GetValueOrDefault("Período", ""));
                _logger.LogInformation(
                    "---------------------------------------------------------------------------- Datos extraídos de CDC: {Periodo}",
                    dict.GetValueOrDefault("Período", ""));
                Console.WriteLine("Periodo: " + datos.Periodo);
                Console.WriteLine("NumeroCDC: " + datos.NumeroCDC);

                var matchFecha = Regex.Match(dict.GetValueOrDefault("Fase de Cobro", ""), @"\d{2}/\d{2}/\d{4}");
                DateTime? fechaFinal = null;
                if (matchFecha.Success && DateTime.TryParseExact(matchFecha.Value, "dd/MM/yyyy",
                        CultureInfo.InvariantCulture, DateTimeStyles.None, out var fechaConvertida))
                {
                    fechaFinal = fechaConvertida;
                }

                // Regex para extraer el nombre del empleado (formato: Nombre Apellido Apellido)
                // IMPORTANTE: NO usamos IgnoreCase porque necesitamos distinguir nombres propios
                // (Primera letra Mayúscula + resto minúsculas) de palabras en mayúsculas como "SE LE GENERA"
                // El lookahead busca que después del nombre venga una palabra de 2+ letras mayúsculas (como "SE", "DERIVADO", etc.)
                var match = Regex.Match(pageText,
                    @"\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}(?<name>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)(?=\s+[A-ZÁÉÍÓÚÑ]{2,}\s|$)"
                );
                string nombreEmpleado = match.Success ? match.Groups["name"].Value.Trim() : "";

                var match2 = Regex.Match(pageText,
                    @"Código\s*(?<desc>[A-ZÁÉÍÓÚÑ\s\.\-]+?)\s*Descripci[oó]n del servic[ií]o", RegexOptions.IgnoreCase);
                string Descripción = match2.Success ? match2.Groups["desc"].Value.Trim() : "";

                var match3 = Regex.Match(pageText, @"Facturaci[oó]n\s*(?<valor>[A-ZÁÉÍÓÚÑ\s\-]+?)\s*Fase de Cobro",
                    RegexOptions.IgnoreCase);
                string Fase = match3.Success ? match3.Groups["valor"].Value.Trim() : "";

                // Extraer datos desde la cadena de Observaciones
                string observacionesText = dict.GetValueOrDefault("Observaciones", "");

                // Extraer nombre del consumidor
                var matchConsumidor = Regex.Match(observacionesText, @"Datos Catastrales([A-ZÁÉÍÓÚÑ\s]+?)Usuario",
                    RegexOptions.IgnoreCase);
                string nombreConsumidor = matchConsumidor.Success ? matchConsumidor.Groups[1].Value.Trim() : "";
                _logger.LogInformation("✅ Nombre del consumidor extraído: {NombreConsumidor}", nombreConsumidor);

                // Extraer dirección (entre "Cód" y "Dirección")
                var matchDireccion = Regex.Match(observacionesText, @"Cód([A-ZÁÉÍÓÚÑ\s]+?)Dirección",
                    RegexOptions.IgnoreCase);
                string direccionExtraida = matchDireccion.Success ? matchDireccion.Groups[1].Value.Trim() : "";
                _logger.LogInformation("✅ Dirección extraída de observaciones: {Direccion}", direccionExtraida);

                // Extraer Nr. Actual (capturar solo el valor inmediatamente antes de "Nr. Actual")
                var matchNumeroActual = Regex.Match(observacionesText,
                    @"([A-Z]*\s*)([0-9]+(?:[-\s]*[A-Z0-9]*)?)\s*Nr\.\s*Actual", RegexOptions.IgnoreCase);
                string numeroActualExtraido = matchNumeroActual.Success ? matchNumeroActual.Groups[2].Value.Trim() : "";
                _logger.LogInformation("✅ Nr. Actual extraído de observaciones: {NumeroActual}", numeroActualExtraido);

                // Extraer Nr. Antiguo (entre "Dirección" y "Nr. Antiguo")
                var matchNumeroAntiguo = Regex.Match(observacionesText,
                    @"Dirección([0-9]+(?:[-\s]*[A-Z0-9]*)?)?Nr\.\s*Antiguo", RegexOptions.IgnoreCase);
                string numeroAntiguoExtraido =
                    matchNumeroAntiguo.Success ? matchNumeroAntiguo.Groups[1].Value.Trim() : "";
                _logger.LogInformation("✅ Nr. Antiguo extraído de observaciones: {NumeroAntiguo}",
                    numeroAntiguoExtraido);

                // Procesar las observaciones reales del documento - están en "Vehículo (placa)" después de la fecha de expedición
                string vehiculoRaw = dict.GetValueOrDefault("Vehículo (placa)", "");
                Console.WriteLine(
                    $"🔍 DEBUG - Vehículo campo completo: '{vehiculoRaw}' (length: {vehiculoRaw.Length})");
                Console.WriteLine($"🔍 DEBUG SIMPLE - dict contiene {dict.Count} elementos");
                Console.WriteLine($"🔍 DEBUG SIMPLE - Dict keys: {string.Join(", ", dict.Keys)}");
                string observacionesProcesadas = ProcesarObservacionesFormato2(vehiculoRaw);
                _logger.LogInformation("✅ Observaciones procesadas: {ObservacionesProcesadas}",
                    observacionesProcesadas);

                // Eliminar las dos primeras palabras de las observaciones
                if (!string.IsNullOrEmpty(observacionesProcesadas))
                {
                    var palabrasObservaciones =
                        observacionesProcesadas.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (palabrasObservaciones.Length > 2)
                    {
                        observacionesProcesadas = string.Join(" ", palabrasObservaciones.Skip(2));
                        _logger.LogInformation(
                            "✅ Observaciones después de eliminar las dos primeras palabras: {ObservacionesFinales}",
                            observacionesProcesadas);
                    }
                    else if (palabrasObservaciones.Length <= 2)
                    {
                        observacionesProcesadas = ""; // Si hay 2 palabras o menos, queda vacío
                        _logger.LogInformation("⚠️ Observaciones tenían 2 palabras o menos, se dejaron vacías");
                    }
                }

                string nombreCalle = "";
                string numeroDireccion = "";
                var match4 = Regex.Match(orden?.Address, @"(?<calle>Calle\s+[A-ZÁÉÍÓÚÑ\s]+?)\s+(?<numero>\d+)\b",
                    RegexOptions.IgnoreCase);
                if (match4.Success)
                {
                    nombreCalle = match4.Groups["calle"].Value.Trim();
                    numeroDireccion = match4.Groups["numero"].Value.Trim();
                    _logger.LogInformation("✅ Calle extraída: {Calle}", nombreCalle);
                    _logger.LogInformation("✅ Número extraído: {Numero}", numeroDireccion);
                }


                var match5 = Regex.Match(dict.GetValueOrDefault("Nr. Antiguo", ""),
                    @"(?<colonia>[A-ZÁÉÍÓÚÑ\s\.]+?)(?<numero>\d{1,5})Nr\. Actual", RegexOptions.IgnoreCase);
                var colonia = match5.Groups["colonia"].Value.Trim();
                var match7 = Regex.Match(pageText,
                    @"ORDEN(\d{7})",
                    RegexOptions.IgnoreCase);

                string codigoOrden = match7.Success ? match7.Groups[1].Value : ""; // Lógica original restaurada
                var match8 = Regex.Match(dict.GetValueOrDefault("Equipo", ""),
                    @"Expedición:\s*\d{2}/\d{2}/\d{4} \d{2}:\d{2}(.*?)(?=\bUnidad\b)",
                    RegexOptions.Singleline | RegexOptions.IgnoreCase);

                string textoExtraido = match8.Success ? match8.Groups[1].Value.Trim() : "";
                _logger.LogInformation("******************** {textoExtraido}", textoExtraido);

                // 🔹 Extraer consumidor del campo Equipo si está mezclado
                string consumidorDesdeEquipo = "";
                string equipoRaw = dict.GetValueOrDefault("Equipo", "");
                if (!string.IsNullOrEmpty(equipoRaw))
                {
                    // Regex flexible para capturar "TD TAURINO" (con o sin espacios) seguido del nombre y antes de "Consumidor"
                    var matchConsumidorEquipo = Regex.Match(equipoRaw, @"TD\s*TAURINO\s*([A-ZÁÉÍÓÚÑ\s\.]+?)Consumidor",
                        RegexOptions.IgnoreCase);
                    if (matchConsumidorEquipo.Success)
                    {
                        // Si encontramos el patrón, extraer y limpiar el nombre
                        consumidorDesdeEquipo = matchConsumidorEquipo.Groups[1].Value.Trim();
                        consumidorDesdeEquipo = Regex.Replace(consumidorDesdeEquipo, @"\s+", " ").Trim();
                        _logger.LogInformation(
                            "🔍 Consumidor extraído del patrón 'TD TAURINO...Consumidor': '{Consumidor}'",
                            consumidorDesdeEquipo);
                    }
                    else
                    {
                        // Patrón alternativo si está todo pegado sin espacios
                        var matchPegado = Regex.Match(equipoRaw, @"TDTAURINO([A-ZÁÉÍÓÚÑ]+)Consumidor",
                            RegexOptions.IgnoreCase);
                        if (matchPegado.Success)
                        {
                            string textoCompleto = matchPegado.Groups[1].Value;
                            _logger.LogInformation("🔍 Texto pegado extraído: '{TextoPegado}'", textoCompleto);

                            // Separar palabras usando regex para detectar patrones de mayúsculas
                            var palabrasEncontradas = Regex.Matches(textoCompleto, @"[A-ZÁÉÍÓÚÑ][a-záéíóúñ]*")
                                .Cast<Match>()
                                .Select(m => m.Value)
                                .Where(palabra => palabra.Length >= 3) // Filtrar palabras muy cortas
                                .ToList();

                            _logger.LogInformation("🔍 Palabras del nombre separadas: {Palabras}",
                                string.Join(", ", palabrasEncontradas));

                            if (palabrasEncontradas.Count > 0)
                            {
                                consumidorDesdeEquipo = string.Join(" ", palabrasEncontradas);
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(consumidorDesdeEquipo))
                    {
                        _logger.LogInformation("🏢 Consumidor final extraído del campo Equipo: '{ConsumidorFinal}'",
                            consumidorDesdeEquipo);
                    }
                    else
                    {
                        _logger.LogWarning(
                            "⚠️ No se pudo extraer el consumidor del campo Equipo. Contenido: '{EquipoRaw}'",
                            equipoRaw);
                    }
                }

                // 🔹 Construir la OT
                var newOT = new OT
                {
                    CuentaHoja = pageNumber,
                    Package = fileName, // Nombre del archivo sin extensión
                    RegisterDate = orden?.RegisterDate ?? DateTime.Now,
                    IdProject = idProject,
                    OtNumber = codigoOrden, // Se mantiene la lógica original para OtNumber
                    AssignedTo = nombreEmpleado,
                    Description = Descripción,
                    Area = Descripción.StartsWith("RECONEXION", StringComparison.OrdinalIgnoreCase) ? "RECONEXION"
                        : Descripción.StartsWith("SUSPENSION", StringComparison.OrdinalIgnoreCase) ? "CORTES"
                        : "SIN AREA",
                    TimeLimit = fechaFinal,
                    NameConsumer = consumidorDesdeEquipo.Length > 0
                        ? consumidorDesdeEquipo
                        : (nombreConsumidor.Length > 0
                            ? nombreConsumidor
                            : (orden?.NameConsumer ?? dict.GetValueOrDefault("Datos Catastrales Consumidor", ""))),
                    PropertyNumber = numeroDireccion,
                    ContractNumber = dict.GetValueOrDefault("Complemento de la Calle", ""),
                    PhoneConsumer = "",
                    Address = direccionExtraida.Length > 0 ? direccionExtraida : nombreCalle,
                    AddressNumber = numeroActualExtraido.Length > 0
                        ? numeroActualExtraido
                        : dict.GetValueOrDefault("Nr. Actual", ""),
                    OldAddressNumber = "", // Por ahora vacío hasta tener ejemplos de cuándo se usa
                    Neighborhood = colonia,
                    AddressReferences = "",
                    AddressCrossings = dict.GetValueOrDefault("Barrio", ""),
                    ChargePhase = Fase,
                    CDC = datos.NumeroCDC,
                    HydrometerNumber = dict.GetValueOrDefault("Nr. Hidrómetro", ""),
                    Period = dict.GetValueOrDefault("Identificación", ""),
                    LectureWater = ExtractNumericValue(dict.GetValueOrDefault("Lectura", "")),
                    Observations = observacionesProcesadas.Length > 0 ? observacionesProcesadas : textoExtraido,
                    Results = dict.GetValueOrDefault("Resultado del Servicio", ""),
                    Active = true
                };

                _logger.LogInformation("📦 Package asignado para Formato2: {Package}", fileName);

                _logger.LogInformation(
                    "➡️  Valores a guardar - CuentaHoja: {CuentaHoja}, OtNumber: {OtNumber}, CDC: {CDC}",
                    newOT.CuentaHoja, newOT.OtNumber, newOT.CDC);
                _logger.LogInformation("🔍 DEBUG - LectureWater extraído: '{LectureWater}' desde: '{LecturaOriginal}'",
                    newOT.LectureWater, dict.GetValueOrDefault("Lectura", ""));

                var existingOT = await _context.OTs.FirstOrDefaultAsync(o =>
                    o.OtNumber == newOT.OtNumber && o.CDC == newOT.CDC && o.Active);
                if (existingOT != null)
                {
                    _logger.LogWarning(
                        "⚠️ OT duplicada encontrada en la base de datos. OtNumber: {OtNumber}, CDC: {CDC}. No se guardará.",
                        newOT.OtNumber, newOT.CDC);
                    return null;
                }

                _context.OTs.Add(newOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "---------------------------------------------------------------------------- OT guardada exitosamente con ID: {Id}",
                    newOT.Id);

                return newOT;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error inesperado en PDFProcessCopy página {Pagina}", pageNumber);
                throw;
            }
        }

        public async Task<OT> PDFProcessCopy2(string pageText, int pageNumber, int? idProject, string fileName)
        {
            try
            {
                _logger.LogInformation(
                    "---------------------------------------------------------------------------- Bloque de página {Pagina}",
                    pageNumber);

                var orden = ExtractOrder(pageText);
                if (idProject.HasValue)
                {
                    var exists = await _context.Projects.AnyAsync(p => p.Id == idProject.Value);
                    if (!exists)
                    {
                        _logger.LogWarning(
                            "El proyecto con ID {IdProject} no existe. Se omitirá la OT de la página {Pagina}.",
                            idProject, pageNumber);
                        return null;
                    }
                }

                if (orden != null)
                {
                    _logger.LogInformation("------------------------------- Orden encontrada Nombre: {Orden}",
                        orden.NameConsumer);
                    _logger.LogInformation("------------------------------- Orden encontrada Direccion: {Orden}",
                        orden.Address);
                    _logger.LogInformation("------------------------------- Orden encontrada Observaciones: {Orden}",
                        orden.Observations);
                    _logger.LogInformation("------------------------------- Orden encontrada OT: {Orden}",
                        orden.OtNumber);
                    _logger.LogInformation("------------------------------- Orden encontrada Fecha 1: {Orden}",
                        orden.RegisterDate);
                    _logger.LogInformation("------------------------------- Orden encontrada Fecha 2: {Orden}",
                        orden.TimeLimit);
                }

                // 🔹 Extraer etiquetas
                var labels = new[]
                {
                    "Unidad", "Empleado", "Fecha", "Datos de Servicío Código", "Descripción del servicío solicitante",
                    "Plazo", "Origen",
                    "Prioridad", "Datos Catastrales Consumidor", "Usuario / Contacto", "Teléfono", "Cód", "Dirección",
                    "Nr. Actual",
                    "Nr. Antiguo", "Barrio", "Complemento de la Calle", "Punto de Referencia", "Tipo Facturación",
                    "Fase de Cobro",
                    "Identificación", "CDC", "Nr. Hidrómetro", "Categoría / Ahorros", "Período", "Lectura", "RFC",
                    "Residentes", "Media",
                    "Sello", "Dispositivo Anti-Fraude", "Observaciones:", "Datos Generales Fecha e Hora Inicio",
                    "Fecha e Hora de Ruptura",
                    "Vehículo (placa)", "Consumidor", "Equipo", "Equipo:", "Nueva Conexión?", "Inspección?", "Acera",
                    "Asfalto", "Agua Pluvial", "Casa",
                    "Conectado", "Material", "Longitud", "Ancho", "Comercio", "No Conectado", "Local Sinalizado e",
                    "Construcción",
                    "Interconectado", "Industria", "Escombro de la Acera", "Terreno", "Escombro en la Calle",
                    "Resultado del Servicio",
                    "Miembro:", "Cliente:"
                };

                var dict = new Dictionary<string, string>();
                for (int j = 0; j < labels.Length; j++)
                {
                    var startLabel = labels[j];
                    var startIndex = pageText.IndexOf(startLabel, StringComparison.Ordinal);
                    if (startIndex < 0) continue;

                    var valueStart = startIndex + startLabel.Length;
                    var nextIndex = pageText.Length;

                    for (int k = j + 1; k < labels.Length; k++)
                    {
                        var idx = pageText.IndexOf(labels[k], valueStart, StringComparison.Ordinal);
                        if (idx > -1 && idx < nextIndex)
                            nextIndex = idx;
                    }

                    var rawVal = pageText.Substring(valueStart, nextIndex - valueStart);
                    // Preserve line breaks for Observaciones, but trim other fields normally
                    var labelKey = startLabel.TrimEnd(':');
                    if (labelKey == "Observaciones")
                    {
                        // Only trim leading/trailing spaces but preserve line breaks for observaciones
                        dict[labelKey] = rawVal.TrimStart(' ').TrimEnd(' ');
                    }
                    else
                    {
                        dict[labelKey] = rawVal.Trim();
                    }
                }

                foreach (var kv in dict)
                    _logger.LogInformation("----------------------------------------------{Key} => {Value}", kv.Key,
                        kv.Value);

                // 🔹 Regex y cálculos adicionales
                var datos = ExtraerCDC(dict.GetValueOrDefault("Período", ""));
                _logger.LogInformation(
                    "---------------------------------------------------------------------------- Datos extraídos de CDC: {Periodo}",
                    dict.GetValueOrDefault("Período", ""));
                Console.WriteLine("Periodo: " + datos.Periodo);
                Console.WriteLine("NumeroCDC: " + datos.NumeroCDC);

                var matchFecha = Regex.Match(dict.GetValueOrDefault("Fase de Cobro", ""), @"\d{2}/\d{2}/\d{4}");
                DateTime? fechaFinal = null;
                if (matchFecha.Success && DateTime.TryParseExact(matchFecha.Value, "dd/MM/yyyy",
                        CultureInfo.InvariantCulture, DateTimeStyles.None, out var fechaConvertida))
                {
                    fechaFinal = fechaConvertida;
                }

                // Regex para extraer el nombre del empleado (formato: Nombre Apellido Apellido)
                // IMPORTANTE: NO usamos IgnoreCase porque necesitamos distinguir nombres propios
                // (Primera letra Mayúscula + resto minúsculas) de palabras en mayúsculas como "SE LE GENERA"
                // El lookahead busca que después del nombre venga una palabra de 2+ letras mayúsculas (como "SE", "DERIVADO", etc.)
                var match = Regex.Match(pageText,
                    @"\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}(?<name>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)(?=\s+[A-ZÁÉÍÓÚÑ]{2,}\s|$)"
                );
                string nombreEmpleado = match.Success ? match.Groups["name"].Value.Trim() : "";

                var match2 = Regex.Match(dict.GetValueOrDefault("Cliente", ""),
                    @"Miembro:\s+TD\s+\d+\s+PAQ\d+\s+\d{1,2}\s+\w+\s+\d{4}\s+\d+\s+(.*?)(?=\s+Datos de Servicío)",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
                string resultadosOt = match2.Success ? match2.Groups[1].Value.Trim() : "";

                var match3 = Regex.Match(pageText, @"Facturaci[oó]n\s*(?<valor>[A-ZÁÉÍÓÚÑ\s\-]+?)\s*Fase de Cobro",
                    RegexOptions.IgnoreCase);
                string Fase = match3.Success ? match3.Groups["valor"].Value.Trim() : "";

                // Limpiar dirección removiendo "Nr. Actual" y todo lo que sigue
                string direccionLimpia = "";
                var direccionRaw = orden?.Address ?? dict.GetValueOrDefault("Dirección", "");
                if (!string.IsNullOrEmpty(direccionRaw))
                {
                    // Remover "Nr. Actual" y todo lo que sigue después
                    var indexNrActual = direccionRaw.IndexOf("Nr. Actual", StringComparison.OrdinalIgnoreCase);
                    if (indexNrActual >= 0)
                    {
                        direccionLimpia = direccionRaw.Substring(0, indexNrActual).Trim();
                    }
                    else
                    {
                        direccionLimpia = direccionRaw.Trim();
                    }
                }

                string nombreCalle = "";
                string numeroDireccion = "";
                var match4 = Regex.Match(direccionLimpia, @"(?<calle>Calle\s+[A-ZÁÉÍÓÚÑ\s]+?)\s+(?<numero>\d+)\b",
                    RegexOptions.IgnoreCase);
                if (match4.Success)
                {
                    nombreCalle = match4.Groups["calle"].Value.Trim();
                    numeroDireccion = match4.Groups["numero"].Value.Trim();
                    _logger.LogInformation("✅ Calle extraída: {Calle}", nombreCalle);
                    _logger.LogInformation("✅ Número extraído: {Numero}", numeroDireccion);
                }

                var match5 = Regex.Match(dict.GetValueOrDefault("Nr. Antiguo", ""),
                    @"(?<colonia>[A-ZÁÉÍÓÚÑ\s\.]+?)(?<numero>\d{1,5})Nr\. Actual", RegexOptions.IgnoreCase);
                var colonia = match5.Groups["colonia"].Value.Trim();
                var match7 = Regex.Match(dict.GetValueOrDefault("Escombro en la Calle", ""),
                    @"\d{2}/\d{2}/\d{4} \d{2}:\d{2}\s+(\d+)",
                    RegexOptions.IgnoreCase);

                string codigoOrden = match7.Success ? match7.Groups[1].Value : ""; // Lógica original restaurada
                var match8 = Regex.Match(dict.GetValueOrDefault("Equipo", ""),
                    @"Expedición:\s*\d{2}/\d{2}/\d{4} \d{2}:\d{2}(.*?)(?=\bUnidad\b)",
                    RegexOptions.Singleline | RegexOptions.IgnoreCase);

                string textoExtraido = match8.Success ? match8.Groups[1].Value.Trim() : "";
                _logger.LogInformation("******************** {textoExtraido}", textoExtraido);
                var descripcion = dict.GetValueOrDefault("Descripción del servicío solicitante", "");

                // 🔹 Construir la OT
                var newOT = new OT
                {
                    CuentaHoja = pageNumber,
                    Package = fileName, // Nombre del archivo sin extensión
                    RegisterDate = orden?.TimeLimit ?? DateTime.Now, // Fecha 2 es fecha de registro
                    IdProject = idProject,
                    OtNumber = codigoOrden, // Se mantiene la lógica original para OtNumber
                    AssignedTo = nombreEmpleado,
                    Description = descripcion,
                    Area = descripcion.StartsWith("RECONEXION", StringComparison.OrdinalIgnoreCase) ? "RECONEXION"
                        : descripcion.StartsWith("SUSPENSION", StringComparison.OrdinalIgnoreCase) ? "CORTES"
                        : "SIN AREA",
                    TimeLimit = orden?.RegisterDate, // Fecha 1 es fecha límite
                    NameConsumer = orden?.NameConsumer ?? dict.GetValueOrDefault("Datos Catastrales Consumidor", ""),
                    PropertyNumber = numeroDireccion,
                    ContractNumber = dict.GetValueOrDefault("Identificación", ""),
                    PhoneConsumer = dict.GetValueOrDefault("Teléfono", ""),
                    Address = direccionLimpia,
                    AddressNumber = dict.GetValueOrDefault("Nr. Actual", ""),
                    OldAddressNumber = dict.GetValueOrDefault("Nr. Antiguo", ""),
                    Neighborhood = dict.GetValueOrDefault("Barrio", ""),
                    AddressReferences = dict.GetValueOrDefault("Punto de Referencia", ""),
                    AddressCrossings = dict.GetValueOrDefault("Complemento de la Calle", ""),
                    ChargePhase = Fase,
                    CDC = dict.GetValueOrDefault("CDC", ""),
                    HydrometerNumber = dict.GetValueOrDefault("Nr. Hidrómetro", ""),
                    Period = dict.GetValueOrDefault("Período", ""),
                    LectureWater = dict.GetValueOrDefault("Lectura", ""),
                    Observations = resultadosOt, //orden?.Observations ?? dict.GetValueOrDefault("Observaciones", ""),
                    Results = dict.GetValueOrDefault("Resultado del Servicio", ""),
                    Active = true
                };

                _logger.LogInformation("📦 Package asignado para Formato3: {Package}", fileName);
                _logger.LogInformation(
                    "➡️  Valores a guardar - CuentaHoja: {CuentaHoja}, OtNumber: {OtNumber}, CDC: {CDC}",
                    newOT.CuentaHoja, newOT.OtNumber, newOT.CDC);

                var existingOT = await _context.OTs.FirstOrDefaultAsync(o =>
                    o.OtNumber == newOT.OtNumber && o.CDC == newOT.CDC && o.Active);
                if (existingOT != null)
                {
                    _logger.LogWarning(
                        "⚠️ OT duplicada encontrada en la base de datos. OtNumber: {OtNumber}, CDC: {CDC}. No se guardará.",
                        newOT.OtNumber, newOT.CDC);
                    return null;
                }

                _context.OTs.Add(newOT);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "---------------------------------------------------------------------------- OT guardada exitosamente con ID: {Id}",
                    newOT.Id);

                return newOT;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error inesperado en PDFProcessCopy página {Pagina}", pageNumber);
                throw;
            }
        }

        public enum PageType
        {
            Formato1, // Cliente: Miembro: ...
            Formato2, // Datos GeneralesFecha e Hora ...
            Formato3, // Otro tipo de Cliente: Miembro: ...
            Desconocido
        }

        public static PageType DetectPageType(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                Console.WriteLine("🔍 DEBUG - DetectPageType: texto vacío o null");
                return PageType.Desconocido;
            }

            // Normalizamos el texto para buscar patrones
            string normalized = text.Replace("\n", " ").Replace("\r", "").Trim();
            Console.WriteLine(
                $"🔍 DEBUG - DetectPageType: texto normalizado (primeros 200 chars): {normalized.Substring(0, Math.Min(200, normalized.Length))}");

            if (normalized.Contains("Datos GeneralesFecha e Hora InicioEquipo"))
            {
                Console.WriteLine("🔍 DEBUG - DetectPageType: Detectado como Formato2");
                return PageType.Formato2;
            }

            if (normalized.Contains("Cliente: Miembro:"))
            {
                Console.WriteLine("🔍 DEBUG - DetectPageType: Contiene 'Cliente: Miembro:'");
                // ¿Contiene fecha con nombre de mes?
                if (Regex.IsMatch(normalized,
                        @"\b\d{1,2}\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+\d{4}\b",
                        RegexOptions.IgnoreCase))
                {
                    Console.WriteLine("🔍 DEBUG - DetectPageType: Detectado como Formato3");
                    return PageType.Formato3;
                }

                Console.WriteLine("🔍 DEBUG - DetectPageType: Detectado como Formato1");
                return PageType.Formato1;
            }

            Console.WriteLine("🔍 DEBUG - DetectPageType: No se detectó ningún formato conocido - Desconocido");
            return PageType.Desconocido;
        }


        private DatosCDC ExtraerCDC(string text)
        {
            var resultado = new DatosCDC();

            // Normalizar texto: quitar espacios duplicados
            text = Regex.Replace(text, @"\s+", " ").Trim();

            // Buscar Período (ej. MEN-08- antes de la palabra Período)
            var matchPeriodo = Regex.Match(text, @"([A-Z0-9\-]+)Per[ií]odo", RegexOptions.IgnoreCase);
            if (matchPeriodo.Success)
            {
                resultado.Periodo = matchPeriodo.Groups[1].Value.Trim();
            }


            // Buscar CDC: número después de Período y antes de CDC
            var matchCdcDespuesPeriodo = Regex.Match(
                text,
                @"Per[ií]odo\s*[:\-]?\s*[A-Z0-9\-]*\s*([0-9]{3,})\s*CDC",
                RegexOptions.IgnoreCase
            );
            if (matchCdcDespuesPeriodo.Success)
            {
                resultado.NumeroCDC = matchCdcDespuesPeriodo.Groups[1].Value.Trim();
            }
            else
            {
                // Patrón alternativo: buscar cualquier número seguido de CDC
                var matchCDC = Regex.Match(text, @"([0-9]{3,})\s*CDC", RegexOptions.IgnoreCase);
                if (matchCDC.Success)
                {
                    resultado.NumeroCDC = matchCDC.Groups[1].Value.Trim();
                }
            }

            return resultado;

        }

        /// <summary>
        /// Extrae las observaciones reales del documento Formato2 respetando el formato original
        /// </summary>
        private string ProcesarObservacionesFormato2(string vehiculoRaw)
        {
            if (string.IsNullOrWhiteSpace(vehiculoRaw))
            {
                Console.WriteLine("🔍 DEBUG - vehiculoRaw está vacío o null");
                return "";
            }

            Console.WriteLine($"🔍 DEBUG - vehiculoRaw recibido: '{vehiculoRaw}'");
            Console.WriteLine($"🔍 DEBUG - Longitud: {vehiculoRaw.Length}");

            try
            {
                // Patrón: Encuentra el texto después de "Expedición: dd/mm/yyyy hh:mm" hasta antes de "Unidad"
                // Ejemplo: "Expedición: 27/08/2025 00:00PERLA ESMERALDA . SE GENERA..."
                var match = Regex.Match(vehiculoRaw,
                    @"Expedición:\s*\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}(.*?)(?=Unidad|$)",
                    RegexOptions.Singleline | RegexOptions.IgnoreCase);

                Console.WriteLine($"🔍 DEBUG - Regex principal match.Success: {match.Success}");

                if (match.Success)
                {
                    string observaciones = match.Groups[1].Value;
                    Console.WriteLine($"🔍 DEBUG - Observaciones encontradas: '{observaciones}'");

                    // Preservar line breaks pero limpiar espacios innecesarios al inicio y final
                    return observaciones.TrimStart(' ').TrimEnd(' ');
                }

                // Patrón alternativo más flexible: buscar después de cualquier fecha hasta "Unidad"
                var matchAlternativo = Regex.Match(vehiculoRaw,
                    @"\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}(.*?)(?=Unidad|$)",
                    RegexOptions.Singleline | RegexOptions.IgnoreCase);

                Console.WriteLine($"🔍 DEBUG - Regex alternativo matchAlternativo.Success: {matchAlternativo.Success}");

                if (matchAlternativo.Success)
                {
                    string observaciones = matchAlternativo.Groups[1].Value;
                    Console.WriteLine($"🔍 DEBUG - Observaciones alternativas encontradas: '{observaciones}'");
                    return observaciones.TrimStart(' ').TrimEnd(' ');
                }

                Console.WriteLine("🔍 DEBUG - No se encontraron patrones de observaciones");
                return "";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error extrayendo observaciones Formato2 desde vehículo");
                Console.WriteLine($"🔍 DEBUG - Error en regex: {ex.Message}");
                return "";
            }
        }

        private static string ExtractNumericValue(string input)
        {
            if (string.IsNullOrEmpty(input))
                return "";

            var match = Regex.Match(input, @"\d+");
            return match.Success ? match.Value : "";
        }

        /// <summary>
        /// Encuentra el workprogram más similar usando el algoritmo de distancia de Levenshtein
        /// </summary>
        private Workprogram FindMostSimilarWorkprogram(string targetDescription, List<Workprogram> workprograms)
        {
            if (string.IsNullOrEmpty(targetDescription) || workprograms == null || !workprograms.Any())
                return null;

            Workprogram mostSimilar = null;
            int minDistance = int.MaxValue;
            double minSimilarityThreshold = 0.6; // 60% de similitud mínima

            foreach (var workprogram in workprograms)
            {
                if (string.IsNullOrEmpty(workprogram.Text))
                    continue;

                int distance = LevenshteinDistance(targetDescription.ToLower(), workprogram.Text.ToLower());
                int maxLength = Math.Max(targetDescription.Length, workprogram.Text.Length);
                double similarity = 1.0 - ((double)distance / maxLength);

                _logger.LogInformation("Comparando '{Target}' vs '{Candidate}' - Similitud: {Similarity:P}",
                    targetDescription, workprogram.Text, similarity);

                if (similarity >= minSimilarityThreshold && distance < minDistance)
                {
                    minDistance = distance;
                    mostSimilar = workprogram;
                }
            }

            return mostSimilar;
        }

        /// <summary>
        /// Calcula la distancia de Levenshtein entre dos strings
        /// </summary>
        private static int LevenshteinDistance(string source, string target)
        {
            if (string.IsNullOrEmpty(source))
                return string.IsNullOrEmpty(target) ? 0 : target.Length;

            if (string.IsNullOrEmpty(target))
                return source.Length;

            int sourceLength = source.Length;
            int targetLength = target.Length;
            int[,] distance = new int[sourceLength + 1, targetLength + 1];

            for (int i = 0; i <= sourceLength; i++)
                distance[i, 0] = i;

            for (int j = 0; j <= targetLength; j++)
                distance[0, j] = j;

            for (int i = 1; i <= sourceLength; i++)
            {
                for (int j = 1; j <= targetLength; j++)
                {
                    int cost = (target[j - 1] == source[i - 1]) ? 0 : 1;
                    distance[i, j] = Math.Min(
                        Math.Min(distance[i - 1, j] + 1, distance[i, j - 1] + 1),
                        distance[i - 1, j - 1] + cost);
                }
            }

            return distance[sourceLength, targetLength];
        }

    }

    public class DatosCDC
    {
        public string NumeroCDC { get; set; }
        public string Periodo { get; set; }
    }

    public class CampoValor
    {
        public string Field { get; set; }
        public string Value { get; set; }

        public override string ToString()
        {
            return $"{Field}={Value}";
        }
    }



    // Implementación
    public class DateTimeService : IDateTimeService
    {
        private static readonly TimeZoneInfo MexicoTimeZone =
            TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");

        public DateTime GetMexicoDateTime()
        {
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, MexicoTimeZone);
        }

        public DateOnly GetMexicoDate()
        {
            return DateOnly.FromDateTime(GetMexicoDateTime());
        }

        public TimeOnly GetMexicoTime()
        {
            return TimeOnly.FromDateTime(GetMexicoDateTime());
        }
    }

    // Interface
    public interface IDateTimeService
    {
        DateTime GetMexicoDateTime();
        DateOnly GetMexicoDate();
        TimeOnly GetMexicoTime();
    }

    public interface IOTService
    {
        Task<List<OT>> GetAll();
        Task<List<Object>> Get2fields(int idProject);
        Task<List<object>> GetById(int id);
        Task<List<OT>> GetOtByProject(int idProject, bool close);
        Task<List<OT>> OtByProjectforApp(int idProject);
        Task<List<OtReportView>> GetOtReportsByCompany(int companyId);
        Task Save(OT ot);
        Task<bool> UpdateOT(int id, OT updatedOT);
        Task<bool> DeleteOT(int id);
        Task<bool> Reopen(int id);
        Task<RegistrarOTResponse> RegistrarOT(RegistrarOTRequest request);
        Task<object> UpdateProjectForOt(int idOt, int newIdProject, int? oldIdProject = null);
        Task<PdfProcessResult> PDFProcessMaster(string pathPdf, int? idProject = null);
        Task<OT> PDFProcess(string pathPdf, int pageNumber, int? idProject = null, string fileName = null);
        Task<OT> PDFProcessCopy(string pathPdf, int pageNumber, int? idProject = null, string fileName = null);
        Task<OT> PDFProcessCopy2(string pathPdf, int pageNumber, int? idProject = null, string fileName = null);
        OT ExtractOrder(string texto);
        DateTime BuscarPrimeraFecha(string texto);
        DateTime BuscarSegundaFecha(string texto);
        string BuscarOT(string texto);
        string BuscarValor(string texto, string inicio, string fin);
        string BuscarObservacionesCompletas(string texto);
        DateTime BuscarFechaHoraAntesDeDatos(string texto);
    }

    public class PdfProcessResult
    {
        public int CreatedCount { get; set; }
        public int SkippedCount { get; set; }
        public int TotalPages { get; set; }
    }
}
