using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class WorkprogramService : IWorkprogramService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<WorkprogramService> _logger;
        
        public WorkprogramService(DbSmpContext dbContext, ILogger<WorkprogramService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));       
        }

        public async Task<List<Workprogram>> Get(int idproject)
        {
            try
            {
                return await _context.Workprograms
                    .Where(wk => wk.IdProject == idproject && wk.Active == 1)
                    .OrderBy(w => w.Sortorder)
                    .Select(w => new Workprogram
                    {
                         Id           = w.Id,
                         IdTask       = w.IdTask,
                         IdContract   = w.IdContract,
                         IdProject    = w.IdProject,
                         IdConvention = w.IdConvention,
                         Type         = w.Type,
                         CriticRoute  = w.CriticRoute,
                         Progress     = w.Progress,
                         Parent       = w.Parent,
                         Activity     = w.Activity,
                         TypeActivity = w.TypeActivity,
                        Especification= w.Especification,
                        Text          = w.Text,
                        StartDate     = w.StartDate,
                        EndDate       = w.EndDate,
                        Distribution  = w.Distribution,
                        CostMX        = w.CostMX,
                        CostDLL       = w.CostDLL,
                        Total         = w.Total,
                        Ponderado     = w.Ponderado,
                        Quantity      = w.Quantity,
                        Measure       = w.Measure,
                        Phase         = w.Phase,
                        Color         = w.Color,
                        Predecesor    = w.Predecesor,
                        Active        = w.Active,
                        Sortorder     = w.Sortorder
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Data");
                throw;
            }
        }

        /// Obtiene los avances dependiendo del tipo: "Contrato" o "Proyecto".
        public async Task<IEnumerable<Workprogram>> Get(int id, string? tipo = null)
        {
            try
            {
                IQueryable<Workprogram> query = _context.Workprograms.AsNoTracking();

                if (string.IsNullOrEmpty(tipo))
                {
                    query = query.Where(a => a.Id == id && a.Active == 1);
                }
                else if (tipo.Equals("Contract", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdContract == id && a.Active==1);
                }
                else if (tipo.Equals("Project", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdProject == id && a.Active == 1);
                }
                else
                {
                    throw new ArgumentException("Type Should be 'Contract' or 'Project'.");
                }

                return await query.OrderBy(w => w.Sortorder).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Data");
                throw;
            }
        }

        public async Task<List<object>> wk2fields(int idproject)
        {
            try
            {
                return await _context.Workprograms
                    .Where(wk => (wk.IdProject == idproject && wk.Active == 1 
                    && wk.Parent == 0))
                    .Select(w => new
                    {
                        w.Id,
                        w.Activity, w.StartDate, w.EndDate, w.CriticRoute,                     
                        w.Text, w.Phase, w.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Workprogram for company and project");
                throw;
            }
        }

        public async Task<List<object>> OnlyActivity(int idproject)
        {
            try
            {
                return await _context.Workprograms
                    .Where(wk => wk.IdProject == idproject
                              && !string.IsNullOrEmpty(wk.Activity)
                              && wk.Active == 1)
                    .Select(w => new
                    {
                        w.Id,
                        w.Activity,
                        w.Text,
                        w.CostMX,
                        ActandNom = w.Activity + " " + w.Text,
                        w.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Workprogram for company and project");
                throw;
            }
        }

        public async Task<List<object>> OnlyFathers(int idproject)
        {
            try
            {
                return await _context.Workprograms
                    .Where(wk => wk.IdProject == idproject
                              && wk.TypeActivity == "Parent"
                              && wk.Parent != 0)
                    .Select(w => new
                    {
                        w.Id,
                        w.Activity,
                        w.Text,

                        w.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Workprogram for company and project");
                throw;
            }
        }


    

        public async Task<List<WorkprogramConceptSystemDto>> GetConceptsHierarchy(int idproject, int? idConvention = null)
        {
            try
            {
                var query = _context.Workprograms
                    .Where(wk => wk.IdProject == idproject && wk.Active == 1);

                // Filtrar por convenio: si se especifica, usar ese convenio; si no, usar registros sin convenio
                query = idConvention.HasValue
                    ? query.Where(wk => wk.IdConvention == idConvention.Value)
                    : query.Where(wk => wk.IdConvention == null);

                var items = await query
                    .Select(w => new { w.Id, w.IdTask, w.Parent, w.Activity, w.Text, w.Quantity, w.Measure, w.IdConvention })
                    .AsNoTracking()
                    .ToListAsync();

                var byIdTask = items
                    .GroupBy(i => i.IdTask)
                    .ToDictionary(g => g.Key, g => g.First());
                var systems = new Dictionary<long, WorkprogramConceptSystemDto>();

                WorkprogramConceptSystemDto GetOrCreateSystem(long idTask, string? activity, string? text)
                {
                    if (!systems.TryGetValue(idTask, out var dto))
                    {
                        dto = new WorkprogramConceptSystemDto
                        {
                            IdTask = idTask,
                            Activity = activity ?? string.Empty,
                            Text = text ?? string.Empty,
                        };
                        systems[idTask] = dto;
                    }
                    return dto;
                }

                foreach (var concept in items.Where(i => string.Equals(i.Measure, "CONCEPTO", StringComparison.OrdinalIgnoreCase)))
                {
                    if (concept.Parent == 0) continue;
                    if (!byIdTask.TryGetValue(concept.Parent, out var sub)) continue;

                    WorkprogramConceptSystemDto systemDto;
                    if (sub.Parent != 0 && byIdTask.TryGetValue(sub.Parent, out var sys))
                    {
                        systemDto = GetOrCreateSystem(sys.IdTask, sys.Activity, sys.Text);
                    }
                    else
                    {
                        systemDto = GetOrCreateSystem(0, "SIN SISTEMA", "SIN SISTEMA");
                    }

                    var subDto = systemDto.Subpartidas.FirstOrDefault(s => s.IdTask == sub.IdTask);
                    if (subDto == null)
                    {
                        subDto = new WorkprogramConceptSubpartidaDto
                        {
                            Id = sub.Id,
                            IdTask = sub.IdTask,
                            Activity = sub.Activity ?? string.Empty,
                            Text = sub.Text ?? string.Empty,
                        };
                        systemDto.Subpartidas.Add(subDto);
                    }

                    subDto.Conceptos.Add(new WorkprogramConceptoDto
                    {
                        IdTask = concept.IdTask,
                        Activity = concept.Activity ?? string.Empty,
                        Text = concept.Text ?? string.Empty,
                        Quantity = concept.Quantity
                    });
                }

                return systems.Values.ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concept hierarchy for project {IdProject}", idproject);
                throw;
            }
        }
            
            public async Task<List<WorkprogramConceptSubpartidaDto>> GetConceptsBySubpartida(int idproject)
        {
            var hierarchy = await GetConceptsHierarchy(idproject);
            return hierarchy.SelectMany(s => s.Subpartidas).ToList();
        }


        public async Task<int> CopyFromConvention(int sourceConventionId, int targetConventionId, int? idProject = null)
        {
            try
            {
                var query = _context.Workprograms
                    .Where(w => w.IdConvention == sourceConventionId && w.Active == 1);

                if (idProject.HasValue && idProject.Value > 0)
                    query = query.Where(w => w.IdProject == idProject.Value);

                var source = await query.AsNoTracking().ToListAsync();

                if (!source.Any()) return 0;

                foreach (var wp in source)
                {
                    _context.Workprograms.Add(new Workprogram
                    {
                        IdContract     = wp.IdContract,
                        IdProject      = (idProject.HasValue && idProject.Value > 0) ? idProject.Value : wp.IdProject,
                        IdConvention   = targetConventionId,
                        IdTask         = wp.IdTask,
                        Type           = wp.Type,
                        Parent         = wp.Parent,
                        CriticRoute    = wp.CriticRoute,
                        Progress       = 0,
                        Activity       = wp.Activity,
                        TypeActivity   = wp.TypeActivity,
                        Especification = wp.Especification,
                        Text           = wp.Text,
                        StartDate      = wp.StartDate,
                        EndDate        = wp.EndDate,
                        Distribution   = wp.Distribution,
                        CostMX         = wp.CostMX,
                        CostDLL        = wp.CostDLL,
                        Quantity       = wp.Quantity,
                        Ponderado      = wp.Ponderado,
                        Measure        = wp.Measure,
                        Phase          = wp.Phase,
                        Predecesor     = wp.Predecesor,
                        Color          = wp.Color,
                        Active         = 1
                    });
                }

                await _context.SaveChangesAsync();
                return source.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error copying workprogram from convention {Source} to {Target}", sourceConventionId, targetConventionId);
                throw;
            }
        }

        public async Task<List<Workprogram>> GetByConvention(int idConvention, int? idProject = null)
        {
            try
            {
                var query = _context.Workprograms
                    .Where(wk => wk.IdConvention == idConvention && wk.Active == 1);

                if (idProject.HasValue && idProject.Value > 0)
                    query = query.Where(wk => wk.IdProject == idProject.Value);

                return await query.OrderBy(w => w.Sortorder).AsNoTracking().ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Workprogram by convention {IdConvention} project {IdProject}", idConvention, idProject);
                throw;
            }
        }

        public async Task<Workprogram> Save(Workprogram wp)
        {
            try
            {
                _logger.LogInformation($"Attempting to save Workprogram. Id before save: {wp.Id}");
                wp.Id = 0;
                _logger.LogInformation($"Id set to 0. Attempting to add to context.");
                _context.Workprograms.Add(wp);
                _logger.LogInformation("Calling SaveChangesAsync.");
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Save successful. New Id: {wp.Id}");
                return wp;
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Workprogram");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Workprogram");
                throw;
            }
        }

        public async Task<Workprogram?> Update(int id, Workprogram wp)
        {
            var existing = await _context.Workprograms.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Workprogram with ID {Id}", id);
                return null;
            }
            try
            {
                // Update only the properties that are allowed to be modified
                existing.IdContract    = wp.IdContract;
                existing.IdProject     = wp.IdProject;
                existing.IdConvention  = wp.IdConvention;
                existing.IdTask        = wp.IdTask;
                existing.Type          = wp.Type;
                existing.CriticRoute   = wp.CriticRoute;
                existing.Progress       = wp.Progress;
                existing.Parent         = wp.Parent;
                existing.Activity       = wp.Activity;
                existing.TypeActivity   = wp.TypeActivity;
                existing.Especification = wp.Especification;
                existing.Text           = wp.Text;
                existing.StartDate      = wp.StartDate;
                existing.EndDate        = wp.EndDate;
                existing.Distribution   = wp.Distribution;
                existing.CostMX         = wp.CostMX;
                existing.CostDLL        = wp.CostDLL;
                existing.Measure        = wp.Measure;
                existing.Quantity       = wp.Quantity;
                existing.Ponderado      = wp.Ponderado;
                existing.Phase          = wp.Phase;
                existing.Predecesor     = wp.Predecesor;
                existing.Color          = wp.Color;
                existing.Active         = wp.Active;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Workprogram with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Workprogram with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingwp = await _context.Workprograms.FindAsync(id);
            if (existingwp == null)
            {
                _logger.LogWarning("Attempted to update non-existent Workprogram With ID {Id}", id);
                return false;
            }
            try
            {
                existingwp.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Workprogram with ID {ContractId}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Workprogram with ID {ContractId}", id);
                throw;
            }
        }

}

    public interface IWorkprogramService
    {
        Task<List<Workprogram>> Get(int idproject);
        Task<IEnumerable<Workprogram>> Get(int id, string? tipo = null);
        Task<int> CopyFromConvention(int sourceConventionId, int targetConventionId, int? idProject = null);
        Task<List<Workprogram>> GetByConvention(int idConvention, int? idProject = null);
        Task<List<object>> wk2fields(int idproject);
        Task<List<object>> OnlyActivity(int idproject);
        Task<List<object>> OnlyFathers(int idproject);
        Task<List<WorkprogramConceptSystemDto>> GetConceptsHierarchy(int idproject, int? idConvention = null);
        Task<List<WorkprogramConceptSubpartidaDto>> GetConceptsBySubpartida(int idproject);
        Task<Workprogram> Save(Workprogram wp);
        Task<Workprogram?> Update(int id, Workprogram wp);
        Task<bool> Delete(int id);
    }
}

