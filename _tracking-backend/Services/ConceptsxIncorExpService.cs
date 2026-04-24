using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{

    public class ConceptsxIncorExpService : IConceptsxIncorExpService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<ConceptsxIncorExpService> _logger;

        public ConceptsxIncorExpService(DbTrackingContext context, ILogger<ConceptsxIncorExpService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<ConceptsxIncorExp>> GetByIncorExpId(int idIncorExp)
        {
            try
            {
                var concepts = await _context.ConceptsxIncorExps
                    .Where(c => c.IdIncorExp == idIncorExp && c.Active)
                    .OrderBy(c => c.DateExpend)
                    .Select(c => new ConceptsxIncorExp
                    {
                        Id = c.Id,
                        IdIncorExp  = c.IdIncorExp,
                        TypeExpense = c.TypeExpense,
                        IdExpense   = c.IdExpense,
                        DateExpend  = c.DateExpend,
                        Quantity    = c.Quantity,
                        Description = c.Description,
                        Unit        = c.Unit,
                        Price       = c.Price, ClaveProdServ = c.ClaveProdServ,
                        ClaveUnidad = c.ClaveUnidad,
                        ObjetoImp   = c.ObjetoImp,
                        NumeroIdentificacion = c.NumeroIdentificacion,
                        Descuento  = c.Descuento,
                        Iva         = c.Iva,
                        Iva2        = c.Iva2,
                        IdContribuyente = c.IdContribuyente,    
                        Isr         = c.Isr,    
                        IdCatIng      = c.IdCatIng,
                        AplicaIsr   = c.AplicaIsr,
                        Comment     = c.Comment,
                        Active      = c.Active
                        // Nota: Total es un campo calculado => lo calculas en la propiedad
                    })
                    .AsNoTracking()
                    .ToListAsync();

                if (concepts == null || !concepts.Any())
                {
                    _logger.LogWarning("No concepts found for IncorExp ID {Id}", idIncorExp);
                }

                return concepts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concepts for IncorExp ID {Id}", idIncorExp);
                throw;
            }
        }

        

        // En ConceptsxIncorExpService agregar:
        public async Task<List<ConceptsxIncorExp>> GetAllByIncorExpId(int idIncorExp)
        {
            try
            {
                var concepts = await _context.ConceptsxIncorExps
                    .Where(c => c.IdIncorExp == idIncorExp)  // SIN && c.Active
                    .OrderBy(c => c.DateExpend)
                    .Select(c => new ConceptsxIncorExp
                    {
                        Id = c.Id,
                        IdIncorExp = c.IdIncorExp,
                        TypeExpense = c.TypeExpense,
                        IdExpense = c.IdExpense,
                        DateExpend = c.DateExpend,
                        Quantity = c.Quantity,
                        Description = c.Description,
                        Unit = c.Unit,
                        Price = c.Price,
                        ClaveProdServ = c.ClaveProdServ,
                        ClaveUnidad = c.ClaveUnidad,
                        ObjetoImp = c.ObjetoImp,
                        NumeroIdentificacion = c.NumeroIdentificacion,
                        Descuento = c.Descuento,
                        Iva = c.Iva,
                        Iva2 = c.Iva2,
                        IdContribuyente = c.IdContribuyente,
                        Isr = c.Isr,
                        IdCatIng = c.IdCatIng,
                        AplicaIsr = c.AplicaIsr,
                        Comment = c.Comment,
                        Active = c.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();

                return concepts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all concepts for IncorExp ID {Id}", idIncorExp);
                throw;
            }
        }


        public async Task<List<ConceptsxIncorExp>> GetByUUI(string uuid)
        {
            try
            {
                var concepts = await _context.ConceptsxIncorExps
                    .Where(c =>
                        EF.Functions.Like(c.NumeroIdentificacion, $"%{uuid}%") &&
                        c.Active
                    )
                    .OrderBy(c => c.DateExpend)
                    .Select(c => new ConceptsxIncorExp
                    {
                        Id = c.Id,
                        IdIncorExp = c.IdIncorExp,
                        TypeExpense = c.TypeExpense,
                        IdExpense = c.IdExpense,
                        DateExpend = c.DateExpend,
                        Quantity = c.Quantity,
                        Description = c.Description,
                        Unit = c.Unit,
                        Price = c.Price,
                        ClaveProdServ = c.ClaveProdServ,
                        ClaveUnidad = c.ClaveUnidad,
                        ObjetoImp = c.ObjetoImp,
                        NumeroIdentificacion = c.NumeroIdentificacion,
                        Descuento = c.Descuento,
                        Iva = c.Iva,
                        Iva2 = c.Iva2,
                        IdContribuyente = c.IdContribuyente,
                        Isr = c.Isr,
                        IdCatIng = c.IdCatIng,
                        AplicaIsr = c.AplicaIsr,
                        Comment = c.Comment,
                        Active = c.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();

                if (!concepts.Any())
                {
                    _logger.LogWarning("No concepts found for IncorExp LIKE {Uuid}", uuid);
                }

                return concepts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concepts for IncorExp LIKE {Uuid}", uuid);
                throw;
            }
        }


        public async Task<List<object>> GetByCfdi(string cfdi)
        {
            try
            {
                var concepts = await _context.ConceptsxIncorExps
                    .Where(c => c.NumeroIdentificacion == cfdi && c.Active)
                    .OrderBy(c => c.DateExpend)
                    .Select(c => new  // Tipo anónimo
                    {
                        c.Id,
                        c.Description,
                        c.Quantity
                    })
                    .AsNoTracking()
                    .ToListAsync();

                return concepts.Cast<object>().ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concepts for CFDI {cfdi}", cfdi);
                throw;
            }
        }


        public async Task<ConceptsxIncorExp?> GetById(int id)
        {
            try
            {
                var concept = await _context.ConceptsxIncorExps
                    .Where(c => c.Id == id && c.Active)
                    .Select(c => new ConceptsxIncorExp
                    {
                        Id = c.Id,
                        IdIncorExp = c.IdIncorExp,
                        TypeExpense = c.TypeExpense,
                        IdExpense = c.IdExpense,
                        DateExpend = c.DateExpend,
                        Quantity = c.Quantity,
                        Description = c.Description,
                        Unit = c.Unit,
                        Price = c.Price,                        
                        ClaveProdServ = c.ClaveProdServ,
                        ClaveUnidad = c.ClaveUnidad,
                        ObjetoImp = c.ObjetoImp,
                        NumeroIdentificacion = c.NumeroIdentificacion,
                        Descuento = c.Descuento,
                        Iva = c.Iva,
                        Iva2 = c.Iva2,
                        Isr = c.Isr,
                        IdContribuyente = c.IdContribuyente,
                        AplicaIsr = c.AplicaIsr,
                        IdCatIng = c.IdCatIng,
                        Comment = c.Comment,
                        Active = c.Active
                        // Total se calcula en la propiedad
                    })
                    .AsNoTracking()
                    .FirstOrDefaultAsync();

                if (concept == null)
                {
                    _logger.LogWarning("Concept with ID {Id} not found or inactive", id);
                }

                return concept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concept with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(ConceptsxIncorExp concept)
        {
            try
            {
                _context.ConceptsxIncorExps.Add(concept);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving concept");
                throw;
            }
        }

        public async Task<ConceptsxIncorExp?> Update(int id, ConceptsxIncorExp concept)
        {
            var existingConcept = await _context.ConceptsxIncorExps.FindAsync(id);
            if (existingConcept == null)
            {
                _logger.LogWarning("Attempted to update non-existent concept with ID {Id}", id);
                return null;
            }

            try
            {
                existingConcept.IdIncorExp = concept.IdIncorExp;
                existingConcept.TypeExpense = concept.TypeExpense;
                existingConcept.IdExpense = concept.IdExpense;
                existingConcept.DateExpend = concept.DateExpend;
                existingConcept.Quantity = concept.Quantity;
                existingConcept.Description = concept.Description;
                existingConcept.Unit = concept.Unit;
                existingConcept.Price = concept.Price;
                existingConcept.ClaveProdServ = concept.ClaveProdServ;
                existingConcept.ClaveUnidad   = concept.ClaveUnidad;    
                existingConcept.ObjetoImp     = concept.ObjetoImp;
                existingConcept.NumeroIdentificacion = concept.NumeroIdentificacion;
                existingConcept.Descuento = concept.Descuento; 
                existingConcept.Iva = concept.Iva;
                existingConcept.Iva2 = concept.Iva2;
                existingConcept.Isr = concept.Isr;
                existingConcept.IdContribuyente = concept.IdContribuyente;
                existingConcept.AplicaIsr = concept.AplicaIsr;
                existingConcept.IdCatIng = concept.IdCatIng;
                existingConcept.Comment = concept.Comment;
                existingConcept.Active = concept.Active;

                await _context.SaveChangesAsync();
                return existingConcept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating concept with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingConcept = await _context.ConceptsxIncorExps.FindAsync(id);
            if (existingConcept == null)
            {
                _logger.LogWarning("Attempted to delete non-existent concept with ID {Id}", id);
                return false;
            }

            try
            {
                existingConcept.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting concept with ID {Id}", id);
                throw;
            }
        }

        public async Task<List<ConceptDailyDto>> GetDailyByRoot(int idRoot)
        {
            try
            {
                var result = await (
                    from c in _context.ConceptsxIncorExps
                    join ie in _context.Incomeandexpenses
                        on c.IdIncorExp equals ie.Id
                    join cuJoin in _context.Customers
                        on c.IdExpense equals cuJoin.Id into cuGroup
                    from cu in cuGroup.DefaultIfEmpty()
                    join emJoin in _context.Employees
                        on c.IdExpense equals emJoin.Id into emGroup
                    from em in emGroup.DefaultIfEmpty()
                    where ie.IdBusinnes == idRoot
                       && ie.Type == "GASTO"
                       && ie.Active
                       && c.Active
                       && c.DateExpend.HasValue
                    select new ConceptDailyDto
                    {
                        DateExpend     = c.DateExpend!.Value,
                        Total          = c.Quantity * c.Price,
                        Iva2           = c.Iva2,
                        TotalFinal     = c.Quantity * c.Price + c.Iva2,
                        TypeExpense    = c.TypeExpense,
                        EntityName     = c.TypeExpense == "PROVEEDORES" ? cu.Company
                                       : c.TypeExpense == "EMPLEADOS"   ? em.Name
                                       : "Otros",
                        EntityType     = c.TypeExpense == "PROVEEDORES" ? "PROVEEDOR"
                                       : c.TypeExpense == "EMPLEADOS"   ? "EMPLEADO"
                                       : "OTRO",
                        IdAccount      = ie.IdAccount,
                        Description    = c.Description,
                        Quantity       = c.Quantity,
                        Price          = c.Price,
                        NumberDocument = ie.NumberDocument
                    }
                )
                .OrderBy(x => x.DateExpend)
                .AsNoTracking()
                .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving daily concepts for root {IdRoot}", idRoot);
                throw;
            }
        }

    }

    public interface IConceptsxIncorExpService
    {
        Task<List<ConceptsxIncorExp>> GetByIncorExpId(int idIncorExp);
        Task<List<ConceptsxIncorExp>> GetAllByIncorExpId(int idIncorExp);
        Task<List<ConceptsxIncorExp>> GetByUUI(string uuid);
        Task<List<object>> GetByCfdi(string cfdi);
        Task<ConceptsxIncorExp?> GetById(int id);
        Task Save(ConceptsxIncorExp concept);
        Task<ConceptsxIncorExp?> Update(int id, ConceptsxIncorExp concept);
        Task<bool> Delete(int id);
        Task<List<ConceptDailyDto>> GetDailyByRoot(int idRoot);
    }
}
