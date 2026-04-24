
using Newtonsoft.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using SMP.Hubs;
using SMP.Models.TD;
using System.IO.Compression;

namespace SMP.Services
{
    public class LogbookService : ILogbookService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<LogbookService> _logger;
        private readonly IHubContext<StorageHub> _hubContext;
        private readonly IHttpClientFactory _httpClientFactory;

        public LogbookService(DbSmpContext dbContext, ILogger<LogbookService> logger, IHubContext<StorageHub> hubContext, IHttpClientFactory httpClientFactory)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _hubContext = hubContext;
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        }

        public async Task<List<otandlogbookxreport>> GetOtReportsByCompany(int companyId, DateTime fecha1, DateTime fecha2)
        {

            var allReports = await _context.Otandlogbookxreports
                .Where(r => r.IdRoot == companyId 
                            && r.FechaLogbook >= fecha1 
                            && r.FechaLogbook <= fecha2)
                .OrderByDescending(r => r.FechaLogbook)
                .ToListAsync();

            return allReports;
        }

        public async Task<int> GetPhotoCountForProject(int projectId)
        {
            return await _context.Logbooks
                .CountAsync(l => l.IdProject == projectId && l.TypeNote == "Photo");
        }

        public async Task<List<Logbook>> Showlogbook(DateTime dateLog, int id, string type)
        {
            try
            {
                return await _context.Logbooks
                    .Where(l => l.Date == dateLog.Date && l.IdOt == id && l.TypeNote == type)
                     .OrderBy(lb => lb.Orden)
                     .AsNoTracking()
                     .ToListAsync<Logbook>();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbooks details");
                throw;
            }
        }

        public async Task<List<Logbook>> ShowLogPhotosByOt(DateTime dateLog, int otId)
        {
            try
            {
                return await _context.Logbooks
                    .Where(l => l.Date == dateLog.Date && l.IdOt == otId && l.TypeNote == "Photo")               
                    .OrderBy(lb => lb.Orden)
                    .AsNoTracking()
                    .ToListAsync<Logbook>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbooks photos by OT");
                throw;
            }
        }

        public async Task<List<Logbook>> showlogPhotosByProject(DateTime dateLog, int projectId)
        {
            try
            {
                return await _context.Logbooks
                    .Where(l => l.Date == dateLog.Date && l.IdProject == projectId && l.TypeNote == "Photo")                    
                     .OrderBy(lb => lb.Orden)
                     .AsNoTracking()
                     .ToListAsync<Logbook>();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbooks details");
                throw;
            }
        }

        public async Task Save(Logbook lbh)
        {
            try
            {
                _context.Logbooks.Add(lbh);
                await _context.SaveChangesAsync();

                var newData = new Logbook()
                {
                    Id = lbh.Id,
                    IdProject = lbh.IdProject,
                    IdOt = lbh.IdOt,
                    IdResource = lbh.IdResource,
                    Timexnote = lbh.Timexnote,
                    IdPadre = lbh.IdPadre,
                    Date = lbh.Date,
                    IdReporte = lbh.IdReporte,
                    Description = lbh.Description,
                    Descriptionconcept = lbh.Descriptionconcept,
                    ImageAzure = lbh.ImageAzure,
                    ImageUrl = lbh.ImageUrl,
                    Orden = lbh.Orden,
                    Supervisor = lbh.Supervisor,
                    TypeNote = lbh.TypeNote,
                    Start = lbh.Start,
                    End = lbh.End,
                    Quantity = lbh.Quantity,
                    Position = lbh.Position,
                    Validado = lbh.Validado,
                    Cuadrilla = lbh.Cuadrilla
                };
                string jsonString = JsonConvert.SerializeObject(newData);
                _logger.LogInformation("Logbook saved with ID: {Id}", jsonString);

                if (newData.Orden == 4 && newData.TypeNote == "Photo")
                {
                    await _hubContext.Clients.All.SendAsync("ReceivePhotoUpdate", jsonString);
                    _logger.LogInformation("Logbook and SendAsync SignalR With Photo");
                }
                else
                {
                    await _hubContext.Clients.All.SendAsync("ReceiveTextUpdate", jsonString);
                    _logger.LogInformation("Logbook and SendAsync SignalR With Tex");
                }

            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Logbooks");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving logbooks");
                throw;
            }
        }

        public async Task<bool> Update(int id, Logbook lgs)
        {
            var existingWarehouse = await _context.Logbooks.FindAsync(id);
            if (existingWarehouse == null)
            {
                return false;
            }

            try
            {
                lgs.Id = id; // Preservar la PK — el frontend no la manda en el body
                _context.Entry(existingWarehouse).CurrentValues.SetValues(lgs);
                await _context.SaveChangesAsync();
                //await NotifyWarehouseUpdate(existingWarehouse.IdCompany, existingWarehouse.IdProject);
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error while updating Logbooks with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Logbooks with ID {Id}", id);
                throw;
            }
        }

        public async Task Delete(int id)
        {
            var warehouse = await _context.Logbooks.FindAsync(id);
            if (warehouse != null)
            {
                try
                {
                    _context.Logbooks.Remove(warehouse);
                    await _context.SaveChangesAsync();
                    // await NotifyWarehouseUpdate(warehouse.IdCompany, warehouse.IdProject);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error deleting warehouse with ID {Id}", id);
                    throw;
                }
            }
        }

        public async Task<int> GetPhotoCountForOt(int ot)
        {
            return await _context.Logbooks
                .CountAsync(l => l.IdOt == ot &&
                                 l.TypeNote == "Photo" &&
                                 l.Date == DateTimeHelper.GetCurrentMexicoDateTime());
        }

        public async Task<List<Logbook>> GetLogbooksByReporte(int IdReporte, string typeNote = null)
        {
            try
            {
                var query = _context.Logbooks.Where(l => l.IdReporte == IdReporte);

                if (!string.IsNullOrEmpty(typeNote))
                {
                    query = query.Where(l => l.TypeNote == typeNote);
                }

                return await query
                    .OrderBy(l => l.Date)
                    .ThenBy(l => l.Orden)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbooks by OT ID {OtId} and TypeNote {TypeNote}", IdReporte, typeNote);
                throw;
            }
        }

        public async Task<Logbook> GetLogbookById(int id)
        {
            try
            {
                return await _context.Logbooks
                    .AsNoTracking()
                    .FirstOrDefaultAsync(l => l.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbook by ID {Id}", id);
                throw;
            }
        }
        
        public async Task<List<Logbook>> GetLogbooksByOt(int otId, string typeNote = null)
        {
            try
            {
                var query = _context.Logbooks.Where(l => l.IdOt == otId);

                if (!string.IsNullOrEmpty(typeNote))
                {
                    query = query.Where(l => l.TypeNote == typeNote);
                }

                return await query
                    .OrderBy(l => l.Date)
                    .ThenBy(l => l.Orden)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting logbooks by OT ID {OtId} and TypeNote {TypeNote}", otId, typeNote);
                throw;
            }
        }

        public async Task<MediaZipResult> GetMediaByOt(int otId)
        {
            try
            {
                _logger.LogInformation("Starting GetMediaByOt for OT ID: {OtId}", otId);

                // 1. Obtener el CDC de la tabla td.ot
                var ot = await _context.OTs.FirstOrDefaultAsync(o => o.Id == otId);
                if (ot == null)
                {
                    _logger.LogWarning("OT not found with ID: {OtId}", otId);
                    return new MediaZipResult
                    {
                        Success = false,
                        Message = "No se encontró la OT especificada",
                        FileCount = 0
                    };
                }

                var cdc = ot.CDC ?? "UNKNOWN";
                var area = ot.Area ?? "UNKNOWN";
                _logger.LogInformation("Found CDC: {CDC} and Area: {Area} for OT ID: {OtId}", cdc, area, otId);

                // 2. Obtener fotos y videos
                var photos = await GetLogbooksByOt(otId, "Photo");
                var videos = await GetLogbooksByOt(otId, "Video");

                // 2. Combinar y extraer URLs
                var allMedia = photos.Concat(videos).ToList();
                var mediaUrls = allMedia
                    .Where(m => !string.IsNullOrEmpty(m.ImageUrl) &&
                                m.ImageUrl != "SIN FOTO" &&
                                m.ImageUrl != "NO FILE")
                    .Select(m => new { m.ImageUrl, m.TypeNote, m.Id })
                    .ToList();

                if (!mediaUrls.Any())
                {
                    _logger.LogWarning("No media found for OT ID: {OtId}", otId);
                    return new MediaZipResult
                    {
                        Success = false,
                        Message = "No se encontraron archivos multimedia para esta OT",
                        FileCount = 0
                    };
                }

                var currentFileCount = mediaUrls.Count;
                _logger.LogInformation("Found {Count} media files for OT ID: {OtId}", currentFileCount, otId);

                // 3. Verificar si existe un ZIP reciente (caché)
                var zipDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "TempZips");
                Directory.CreateDirectory(zipDir);

                var zipFileName = $"CDC_{cdc}.zip";
                var zipFilePath = Path.Combine(zipDir, zipFileName);

                if (File.Exists(zipFilePath))
                {
                    var zipFile = new FileInfo(zipFilePath);

                    // Verificar si el ZIP es reciente (menos de 1 hora)
                    if (zipFile.CreationTime > DateTime.Now.AddHours(-1))
                    {
                        var downloadUrl = $"https://endpoints.biapp.com.mx/uploads/TempZips/{zipFileName}";

                        _logger.LogInformation("Returning cached ZIP for OT ID: {OtId}. File: {FileName}, Age: {Age} minutes",
                            otId, zipFileName, (DateTime.Now - zipFile.CreationTime).TotalMinutes);

                        // Actualizar las columnas MediaItems y LastTimeDownloaded
                        ot.MediaItems = currentFileCount;
                        ot.LastTimeDownloaded = DateTime.Now;
                        ot.Downloaded = true;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Updated MediaItems={MediaItems}, LastTimeDownloaded and Downloaded for OT ID: {OtId}", currentFileCount, otId);

                        return new MediaZipResult
                        {
                            Success = true,
                            Message = $"ZIP en caché ({currentFileCount} archivos, creado hace {(int)(DateTime.Now - zipFile.CreationTime).TotalMinutes} minutos)",
                            ZipFileName = zipFileName,
                            ZipFilePath = zipFile.FullName,
                            DownloadUrl = downloadUrl,
                            FileCount = currentFileCount,
                            FailedCount = 0
                        };
                    }
                    else
                    {
                        _logger.LogInformation("Found cached ZIP for OT ID: {OtId} but it's too old. Deleting and creating new one.", otId);
                        try
                        {
                            File.Delete(zipFilePath);
                            _logger.LogInformation("Deleted old ZIP: {FileName}", zipFileName);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to delete old ZIP: {FileName}", zipFileName);
                        }
                    }
                }

                // 4. Crear directorios temporales para nuevas descargas con estructura Area/CDC
                var tempDir = Path.Combine(Path.GetTempPath(), $"CDC_{cdc}_{Guid.NewGuid()}");
                var mediaDir = Path.Combine(tempDir, area, cdc);
                Directory.CreateDirectory(mediaDir);

                try
                {
                    // 6. Descargar archivos
                    var httpClient = _httpClientFactory.CreateClient();
                    httpClient.Timeout = TimeSpan.FromMinutes(5);

                    int successCount = 0;
                    int failCount = 0;

                    foreach (var media in mediaUrls)
                    {
                        try
                        {
                            _logger.LogInformation("Downloading file from URL: {Url}", media.ImageUrl);

                            var response = await httpClient.GetAsync(media.ImageUrl);
                            if (response.IsSuccessStatusCode)
                            {
                                var fileBytes = await response.Content.ReadAsByteArrayAsync();

                                // Obtener extensión del archivo desde la URL o content-type
                                var extension = Path.GetExtension(media.ImageUrl.Split('?')[0]);
                                if (string.IsNullOrEmpty(extension))
                                {
                                    var contentType = response.Content.Headers.ContentType?.MediaType;
                                    extension = contentType switch
                                    {
                                        "image/jpeg" => ".jpg",
                                        "image/png" => ".png",
                                        "image/gif" => ".gif",
                                        "video/mp4" => ".mp4",
                                        "video/quicktime" => ".mov",
                                        _ => ".bin"
                                    };
                                }

                                var fileName = $"{media.TypeNote}_{media.Id}{extension}";
                                var filePath = Path.Combine(mediaDir, fileName);

                                await File.WriteAllBytesAsync(filePath, fileBytes);
                                successCount++;
                                _logger.LogInformation("Successfully downloaded: {FileName}", fileName);
                            }
                            else
                            {
                                failCount++;
                                _logger.LogWarning("Failed to download file from {Url}. Status: {Status}",
                                    media.ImageUrl, response.StatusCode);
                            }
                        }
                        catch (Exception ex)
                        {
                            failCount++;
                            _logger.LogError(ex, "Error downloading file from {Url}", media.ImageUrl);
                        }
                    }

                    if (successCount == 0)
                    {
                        _logger.LogError("No files were successfully downloaded for OT ID: {OtId}", otId);
                        return new MediaZipResult
                        {
                            Success = false,
                            Message = "No se pudieron descargar los archivos multimedia",
                            FileCount = 0
                        };
                    }

                    // 7. Crear archivo ZIP
                    _logger.LogInformation("Creating ZIP file: {ZipPath}", zipFilePath);
                    ZipFile.CreateFromDirectory(tempDir, zipFilePath, CompressionLevel.Optimal, false);

                    // 8. Generar URL de descarga
                    var downloadUrl = $"https://endpoints.biapp.com.mx/uploads/TempZips/{zipFileName}";

                    _logger.LogInformation("ZIP file created successfully for OT ID: {OtId}", otId);

                    // Actualizar las columnas MediaItems, LastTimeDownloaded y Downloaded
                    ot.MediaItems = successCount;
                    ot.LastTimeDownloaded = DateTime.Now;
                    ot.Downloaded = true;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Updated MediaItems={MediaItems}, LastTimeDownloaded and Downloaded for OT ID: {OtId}", successCount, otId);

                    return new MediaZipResult
                    {
                        Success = true,
                        Message = $"ZIP creado exitosamente con {successCount} archivos",
                        ZipFileName = zipFileName,
                        ZipFilePath = zipFilePath,
                        DownloadUrl = downloadUrl,
                        FileCount = successCount,
                        FailedCount = failCount
                    };
                }
                finally
                {
                    // 9. Limpiar directorio temporal
                    if (Directory.Exists(tempDir))
                    {
                        try
                        {
                            Directory.Delete(tempDir, true);
                            _logger.LogInformation("Temporary directory cleaned: {TempDir}", tempDir);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to clean temporary directory: {TempDir}", tempDir);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetMediaByOt for OT ID: {OtId}", otId);
                throw;
            }
        }

        public static class DateTimeHelper
        {
            private static readonly TimeZoneInfo _zonaHorariaMexico =
                TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time (Mexico)");

            public static DateTime GetCurrentMexicoDateTime() =>
                TimeZoneInfo.ConvertTime(DateTime.Now, _zonaHorariaMexico);
        }

    }


    public interface ILogbookService
    {
        Task<List<otandlogbookxreport>> GetOtReportsByCompany(int companyId, DateTime fecha1, DateTime fecha2);
        Task<int> GetPhotoCountForProject(int projectId);
        Task<List<Logbook>> Showlogbook(DateTime dateLog, int id, string type);
        Task<List<Logbook>> ShowLogPhotosByOt(DateTime dateLog, int otId);
        Task<List<Logbook>> showlogPhotosByProject(DateTime dateLog, int projectid);
        Task Save(Logbook lbh);
        Task<bool> Update(int id, Logbook lgs);
        Task Delete(int id);
        Task<int> GetPhotoCountForOt(int ot);
        Task<List<Logbook>> GetLogbooksByOt(int otId, string typeNote = null);
        Task<List<Logbook>> GetLogbooksByReporte(int IdReporte, string typeNote = null);
        Task<Logbook> GetLogbookById(int id);
        Task<MediaZipResult> GetMediaByOt(int otId);
    }

    public class MediaZipResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? ZipFileName { get; set; }
        public string? ZipFilePath { get; set; }
        public string? DownloadUrl { get; set; }
        public int FileCount { get; set; }
        public int FailedCount { get; set; }
    }
}
