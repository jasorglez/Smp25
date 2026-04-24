using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class DocumentosComprobadosService : IDocumentoscomprobadosService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<DocumentosComprobadosService> _logger;

        public DocumentosComprobadosService(
            DbTrackingContext context,
            ILogger<DocumentosComprobadosService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /* ======================================================
           OBTENER POR CONCEPTO
           ====================================================== */
        public async Task<List<DocumentsComprobados>> GetByIE(int id)
        {
            try
            {
                return await _context.DocumentosComprobados
                    .Where(d => d.Idincorexp == id && d.Active)
                    .OrderByDescending(d => d.CreatedAt)
                    .Select(d => new DocumentsComprobados
                    {
                        Id = d.Id,
                        Idincorexp = d.Idincorexp,
                        IdSpend = d.IdSpend,
                        TipoDocumento = d.TipoDocumento,
                        UuidCfdi = d.UuidCfdi,
                        NombreArchivo = d.NombreArchivo,
        
                        Valido = d.Valido,
                        Active = d.Active,
                        CreatedBy = d.CreatedBy,
                        CreatedAt = d.CreatedAt,
                        ModifiedBy = d.ModifiedBy,
                        ModifiedAt = d.ModifiedAt
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error retrieving documents for Concept ID {Id}", id);
                throw;
            }
        }

        /* ======================================================
           OBTENER TODOS
           ====================================================== */
        public async Task<List<DocumentsComprobados>> GetAll()
        {
            try
            {
                return await _context.DocumentosComprobados
                    .Where(d => d.Active)
                    .OrderByDescending(d => d.CreatedAt)
                    .AsNoTracking()
                    .Select(d => new DocumentsComprobados
                    {
                        Id = d.Id,
                        TipoDocumento = d.TipoDocumento,
                        IdSpend = d.IdSpend,
                        UuidCfdi = d.UuidCfdi,

                        NombreArchivo = d.NombreArchivo,
                        Valido = d.Valido,
                        Active = d.Active,
                        CreatedAt = d.CreatedAt
                    })
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all documents");
                throw;
            }
        }

        /* ======================================================
           GUARDAR
           ====================================================== */

        public async Task<DocumentsComprobados> Save(DocumentsComprobados document)
        {
            try
            {

                // Regla CFDI: UUID único
                if (document.TipoDocumento == "XML" && !string.IsNullOrWhiteSpace(document.UuidCfdi))
                {
                    bool exists = await _context.DocumentosComprobados
                        .AnyAsync(d => d.UuidCfdi == document.UuidCfdi && d.Active);

                    if (exists)
                        throw new InvalidOperationException(
                            "El CFDI ya fue utilizado en otra comprobación.");
                }

                var entity = new DocumentsComprobados
                {
                    Idincorexp    = document.Idincorexp,
                    IdSpend       = document.IdSpend,
                    TipoDocumento = document.TipoDocumento,
                    UuidCfdi      = document.UuidCfdi,
                    NombreArchivo = document.NombreArchivo,
                    Valido        = document.Valido,
                    CreatedBy     = document.CreatedBy,
                    CreatedAt     = DateTime.Now,
                    Active        = true
                };

                _context.DocumentosComprobados.Add(entity);
                await _context.SaveChangesAsync();

                // Actualizar el objeto original con los valores de la base de datos
                document.Id = entity.Id;
                document.CreatedAt = entity.CreatedAt;

                return document;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving document");
                throw;
            }
        }

        /* ======================================================
           ACTUALIZAR
           ====================================================== */
        public async Task<DocumentsComprobados?> Update(int id, DocumentsComprobados dto)
        {
            var entity = await _context.DocumentosComprobados.FindAsync(id);
            if (entity == null || !entity.Active)
            {
                _logger.LogWarning(
                    "Attempted to update non-existent document with ID {Id}", id);
                return null;
            }

            try
            {
                entity.TipoDocumento = dto.TipoDocumento;
                entity.IdSpend = dto.IdSpend;
                entity.NombreArchivo = dto.NombreArchivo;
                entity.Valido = dto.Valido;
                entity.ModifiedBy = dto.ModifiedBy;
                entity.ModifiedAt = DateTime.Now;
                entity.UuidCfdi = dto.UuidCfdi;

                await _context.SaveChangesAsync();
                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error updating document with ID {Id}", id);
                throw;
            }
        }

        /* ======================================================
           ELIMINAR (LÓGICO)
           ====================================================== */
        public async Task<bool> Delete(int id)
        {
            var entity = await _context.DocumentosComprobados.FindAsync(id);
            if (entity == null)
            {
                _logger.LogWarning(
                    "Attempted to delete non-existent document with ID {Id}", id);
                return false;
            }

            try
            {
                entity.Active = false;
                entity.ModifiedAt = DateTime.Now;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error deleting document with ID {Id}", id);
                throw;
            }
        }
    }

    /* ======================================================
       INTERFAZ
       ====================================================== */
    public interface IDocumentoscomprobadosService
    {
        Task<List<DocumentsComprobados>> GetByIE(int id);
        Task<List<DocumentsComprobados>> GetAll();
        Task<DocumentsComprobados> Save(DocumentsComprobados detail);
        Task<DocumentsComprobados?> Update(int id, DocumentsComprobados detail);
        Task<bool> Delete(int id);
    }
}

