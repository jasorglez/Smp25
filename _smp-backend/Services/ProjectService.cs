using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using SMP.Models.DTO;

namespace SMP.Services
{
    public class ProjectService : IProjectService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ProjectService> _logger;

        public ProjectService(DbSmpContext dbContext, ILogger<ProjectService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Project>> Projects()
        {
            try
            {
                return await _context.Projects
                    .Where(p => p.Active == 1)
                    .Select(p => new Project
                    {
                        Id = p.Id,
                        Number = p.Number ?? "",
                        Name = p.Name ?? "",
                        IdConsecutivo = p.IdConsecutivo,
                        IdContrato = p.IdContrato,
                        IdOilfield = p.IdOilfield,
                        IdActive = p.IdActive,
                        Year = p.Year ?? "",
                        Diameter = p.Diameter ?? "",
                        Length = p.Length,
                        Description = p.Description ?? "",
                        Priority = p.Priority,
                        BudgetManagement = p.BudgetManagement ?? "",
                        LineRight = p.LineRight ?? "",
                        Government = p.Government ?? "",
                        ReceivedEngineering = p.ReceivedEngineering ?? "",
                        DateDelivery = p.DateDelivery,
                        SupplyPipe = p.SupplyPipe ?? "",
                        Request = p.Request ?? "",
                        ProgramStart = p.ProgramStart,
                        ProgramEnd = p.ProgramEnd,
                        RealPronosticLPO = p.RealPronosticLPO,
                        RealPronosticTTT = p.RealPronosticTTT,
                        Classification = p.Classification ?? "",
                        State = p.State ?? "",
                        TypeConstruction = p.TypeConstruction ?? "",
                        Comment = p.Comment ?? "",
                        Active = p.Active
                    })
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Projects");
                throw;
            }
        }

        public async Task<List<object>> GetProjectsxContract(int contrato)
        {
            try
            {
                return await _context.Projects
                .Where(p => (p.Active == 1) && p.IdContrato == contrato)
               .OrderBy(p => p.Name)
               .AsNoTracking()
               .ToListAsync<object>();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Project ,  idCompany");
                throw;
            }
        }   
        
        public async Task<List<object>> GetProjectsxCompany(int idCompany)
    {
        try
        {
            return await _context.Projects
                .Where(p => p.Active == 1)
                .Join(_context.Contracts,
                    project => project.IdContrato,
                    contract => contract.Id,
                    (project, contract) => new { Project = project, Contract = contract })
                .Join(_context.Branchs,
                    pc => pc.Contract.IdBranch,
                    branch => branch.Id,
                    (pc, branch) => new { pc.Project, pc.Contract, Branch = branch })
                .Where(pcb => pcb.Branch.IdCompany == idCompany)
                .Select(pcb => new
                {
                    pcb.Project.Id,
                    pcb.Project.Number,
                    pcb.Project.Name,
                    pcb.Project.IdConsecutivo,
                    pcb.Project.IdContrato,
                    pcb.Project.IdOilfield,
                    pcb.Project.IdActive,
                    pcb.Project.Year,
                    pcb.Project.Diameter,
                    pcb.Project.Length,
                    pcb.Project.Description,
                    pcb.Project.Priority,
                    pcb.Project.BudgetManagement,
                    pcb.Project.LineRight,
                    pcb.Project.Government,
                    pcb.Project.ReceivedEngineering,
                    pcb.Project.DateDelivery,
                    pcb.Project.SupplyPipe,
                    pcb.Project.Request,
                    pcb.Project.ProgramStart,
                    pcb.Project.ProgramEnd,
                    pcb.Project.RealPronosticLPO,
                    pcb.Project.RealPronosticTTT,
                    pcb.Project.Classification,
                    pcb.Project.State,
                    pcb.Project.TypeConstruction,
                    pcb.Project.Comment,
                    pcb.Project.Active,
                    ContractNumber = pcb.Contract.NumberContract,
                    BranchName = pcb.Branch.Name
                })
                .OrderBy(p => p.Name)
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Projects for Company ID {IdCompany}", idCompany);
            throw;
        }
    }

        public async Task<ServiceResult<Project>> addProject(Project project)
        {
            try
            {
                _context.Projects.Add(project);
                await _context.SaveChangesAsync();
                return new ServiceResult<Project> { Success = true, Data = project };
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = GetDetailedErrorMessage(ex);
                _logger.LogError(ex, errorMessage);
                return new ServiceResult<Project> { Success = false, ErrorMessage = errorMessage };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inesperado al guardar el Proyecto");
                return new ServiceResult<Project> { Success = false, ErrorMessage = "Ocurri� un error inesperado al guardar el proyecto." };
            }
        }

        private string GetDetailedErrorMessage(DbUpdateException ex)
        {
            var innerException = ex.InnerException;
            if (innerException is Microsoft.Data.SqlClient.SqlException sqlEx)
            {
                switch (sqlEx.Number)
                {
                    case 8152: // Truncamiento de datos
                        return $"Error de truncamiento de datos: {sqlEx.Message}";
                    case 547: // Violaci�n de restricci�n
                        return $"Violaci�n de restricci�n en la base de datos: {sqlEx.Message}";
                    case 2627: // Violaci�n de clave �nica
                        return $"Violaci�n de clave �nica: {sqlEx.Message}";
                    default:
                        return $"Error de base de datos: {sqlEx.Message}";
                }
            }
            return "Ocurri� un error al guardar en la base de datos.";
        }

        public async Task<Project?> Update(int id, Project project)
        {
            var existingProject = await _context.Projects.FindAsync(id);
            if (existingProject == null)
            {
                _logger.LogWarning("Attempted to update non-existent Project with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingProject.IdConsecutivo       = project.IdConsecutivo;
                existingProject.Number              = project.Number;
                existingProject.IdContrato          = project.IdContrato;
                existingProject.IdOilfield          = project.IdOilfield;
                existingProject.IdActive            = project.IdActive;
                existingProject.Name                = project.Name;
                existingProject.Year                = project.Year;
                existingProject.Diameter            = project.Diameter;
                existingProject.Length              = project.Length;
                existingProject.Description         = project.Description;
                existingProject.Priority            = project.Priority;
                existingProject.BudgetManagement    = project.BudgetManagement;
                existingProject.LineRight           = project.LineRight;
                existingProject.Government          = project.Government;
                existingProject.ReceivedEngineering = project.ReceivedEngineering;
                existingProject.DateDelivery        = project.DateDelivery;
                existingProject.SupplyPipe          = project.SupplyPipe;
                existingProject.Request             = project.Request;
                existingProject.ProgramStart        = project.ProgramStart;
                existingProject.ProgramEnd          = project.ProgramEnd;
                existingProject.RealPronosticLPO    = project.RealPronosticLPO;
                existingProject.RealPronosticTTT    = project.RealPronosticTTT;
                existingProject.Classification      = project.Classification;
                existingProject.State               = project.State;
                existingProject.TypeConstruction    = project.TypeConstruction;
                existingProject.Comment             = project.Comment;                

                await _context.SaveChangesAsync();
                return existingProject;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Project with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Project with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingPj = await _context.Projects.FindAsync(id);
            if (existingPj == null)
            {
                _logger.LogWarning("Attempted to update non-existent Project With ID", id);
                return false;
            }
            try
            {
                existingPj.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Projects with ID ", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Projects with ID ", id);
                throw;
            }
        }
        
        public async Task<Project?> GetProjectById(int id)
        {
            try
            {
                return await _context.Projects
                    .Where(p => p.Active == 1 && p.Id == id)
                    .Select(p => new Project
                    {
                        Id = p.Id,
                        Number = p.Number ?? "",
                        Name = p.Name ?? "",
                        IdConsecutivo = p.IdConsecutivo,
                        IdContrato = p.IdContrato,
                        IdOilfield = p.IdOilfield,
                        IdActive = p.IdActive,
                        Year = p.Year ?? "",
                        Diameter = p.Diameter ?? "",
                        Length = p.Length,
                        Description = p.Description ?? "",
                        Priority = p.Priority,
                        BudgetManagement = p.BudgetManagement ?? "",
                        LineRight = p.LineRight ?? "",
                        Government = p.Government ?? "",
                        ReceivedEngineering = p.ReceivedEngineering ?? "",
                        DateDelivery = p.DateDelivery,
                        SupplyPipe = p.SupplyPipe ?? "",
                        Request = p.Request ?? "",
                        ProgramStart = p.ProgramStart,
                        ProgramEnd = p.ProgramEnd,
                        RealPronosticLPO = p.RealPronosticLPO,
                        RealPronosticTTT = p.RealPronosticTTT,
                        Classification = p.Classification ?? "",
                        State = p.State ?? "",
                        TypeConstruction = p.TypeConstruction ?? "",
                        Comment = p.Comment ?? "",
                        Active = p.Active
                    })
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Project by ID {Id}", id);
                throw;
            }
        }

    }

    public interface IProjectService
    {
        Task<IEnumerable<Project>> Projects();
        Task<List<object>> GetProjectsxContract(int contrato);
        Task<List<object>> GetProjectsxCompany(int idCompany);
        Task<ServiceResult<Project>> addProject(Project project);
        Task<Project?> Update(int id, Project project);
        Task<bool> Delete(int id);
        Task<Project?> GetProjectById(int id);
    }
    
    public class ServiceResult<T>
    {
        public bool Success { get; set; }
        public T Data { get; set; }
        public string ErrorMessage { get; set; }
    }
}