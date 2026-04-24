using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ContractService : IContractService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ContractService> _logger;

        public ContractService(DbSmpContext dbContext, ILogger<ContractService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        }


        public async Task<List<object>> GetContractStateAnalysis(int idBranch)
        {
            try
            {
                // Obtener los contratos activos del negocio específico
                var contracts = await _context.Contracts
                    .Where(c => c.IdBranch == idBranch && c.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();

                // Obtener todas las especialidades y estados únicos
                var specialities = contracts.Select(c => c.Speciality).Distinct();
                var states = contracts.Select(c => c.StateContract).Distinct();


                // Generar todas las combinaciones y contar
                var result = (
                    from speciality in specialities
                    from state in states
                    select new
                    {
                        Speciality = speciality,
                        StateContract = state,
                        Count = contracts.Count(c =>
                            c.Speciality == speciality &&
                            c.StateContract == state)
                    })
                    .OrderBy(r => r.Speciality)
                    .ThenBy(r => r.StateContract)
                    .ToList<object>();

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing contract states for business {idBranch}", idBranch);
                throw;
            }
        }

        public async Task<List<object>> GetAmount(int idBranch)
        {
            var result = await (
                from e in _context.Estimates
                join c in _context.Contracts on e.IdContract equals c.Id
                join r in _context.Roots     on c.IdBranch equals r.Id 
                where e.Active==true && r.Id == idBranch
                group new { e, c } by 1 into g
                select new
                {
                    EstMx            = g.Sum(x => x.e.AmountMX),
                    EstDLL           = g.Sum(x => x.e.AmountDLL),
                    TotalContratoMX  = g.Sum(y => y.c.AmountMx),
                    TotalContratoDLL = g.Sum(y => y.c.AmountDll),
                    RemainingMX      = g.Sum(x => x.c.AmountMx)  - g.Sum(x => x.e.AmountMX),
                    RemainingDLL     = g.Sum(x => x.c.AmountDll) - g.Sum(x => x.e.AmountDLL)
                })
                .AsNoTracking()
                .ToListAsync<object>();

            return result;
        }
        
        public async Task<List<object>> GetAmountxSpeciality(int idBranch)
        {
            var result = await (
                from e in _context.Estimates
                join c in _context.Contracts on e.IdContract equals c.Id
                join r in _context.Roots on c.IdBranch equals r.Id
                where e.Active == true && r.Id == idBranch
                group new { e, c } by c.Speciality into g
                select new
                {
                    Speciality = g.Key,
                    EstMx = g.Sum(x => x.e.AmountMX),
                    EstDLL = g.Sum(x => x.e.AmountDLL),
                    TotalContratoMX = g.Sum(y => y.c.AmountMx),
                    TotalContratoDLL = g.Sum(y => y.c.AmountDll),
                    RemainingMX = g.Sum(x => x.c.AmountMx) - g.Sum(x => x.e.AmountMX),
                    RemainingDLL = g.Sum(x => x.c.AmountDll) - g.Sum(x => x.e.AmountDLL)
                })
                .AsNoTracking()
                .ToListAsync<object>();

            return result;
        }
        public async Task<List<object>> GetContractCountByOilfieldState()
        {
            try
            {
                var result = await _context.Projects
                    .Include(p => p.NavContract)
                    .Include(p => p.NavOilfield)
                    .Where(p => p.NavContract.Active == 1)  // Solo contratos activos si es necesario
                    .GroupBy(p => p.NavOilfield.NameState)
                    .Select(group => new
                    {
                        NameState = group.Key,
                        TotalContratos = group.Count()
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting contract count by oilfield state");
                throw;
            }
        }

        public async Task<List<object>> GetContracts(int idBranch)
        {
            try
            {
                IQueryable<Contract> query = _context.Contracts.Where(c => c.Active == 1);

                if (idBranch < 0)
                {
                    // Si es negativo, buscamos por IdCompany usando las sucursales
                    int idCompany = Math.Abs(idBranch);
                    var branchIds = await _context.Branchs
                        .Where(b => b.IdCompany == idCompany && b.Active == true)
                        .Select(b => b.Id)
                        .ToListAsync();
            
                    query = query.Where(c => branchIds.Contains(c.IdBranch));
                }
                else
                {
                    query = query.Where(c => c.IdBranch == idBranch);
                }

                return await query
                    .Select(c => new
                    {
                        idContrato = c.Id,
                        c.IdBranch,
                        c.Consecutive,
                        c.Speciality,
                        c.NumberContract,
                        c.Description,
                        c.DescripSmall,
                        c.IdProvider,
                        c.StateContract,
                        c.DateStar,
                        c.DateEnd,
                        c.Term,
                        c.AmountMx,
                        c.AmountDll,
                        c.Resident,
                        c.Supervisor,c.Project, 
                        c.Active,
                       
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contract for company and project, idBranch: {idBranch}", idBranch);
                throw;
            }
        }

        public async Task<List<object>> GetContractsxProvider(int provider)
        {
            try
            {
                return await _context.Contracts
                .Where(c => (c.Active == 1) && c.IdProvider == provider)
               .OrderBy(p => p.NumberContract)
               .AsNoTracking()
               .ToListAsync<object>();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Project ,  idCompany");
                throw;
            }
        }

        public async Task<List<object>> Contract2fields(int idBranch)
        {
            try
            {
                IQueryable<Contract> query = _context.Contracts.Where(c => c.Active == 1);

                if (idBranch < 0)
                {
                    // Si es negativo, buscamos por IdCompany usando las sucursales
                    int idCompany = Math.Abs(idBranch);
                    var branchIds = await _context.Branchs
                        .Where(b => b.IdCompany == idCompany && b.Active == true)
                        .Select(b => b.Id)
                        .ToListAsync();
            
                    query = query.Where(c => branchIds.Contains(c.IdBranch));
                }
                else
                {
                    query = query.Where(c => c.IdBranch == idBranch);
                }

                return await query
                    .Select(co => new
                    {
                        co.NumberContract,
                        co.Id
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts");
                throw;
            }
        }

        public async Task Save(Contract cont)
        {
            try
            {
                _context.Contracts.Add(cont);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Contracts");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Contracts");
                throw;
            }
        }

        public async Task<Contract?> Update(int id, Contract cont)
        {
            var existingContract = await _context.Contracts.FindAsync(id);
            if (existingContract == null)
            {
                _logger.LogWarning("Attempted to update non-existent Contract with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified                                
                existingContract.Speciality     = cont.Speciality;
                existingContract.NumberContract = cont.NumberContract;
                existingContract.Description    = cont.Description;
                existingContract.DescripSmall   = cont.DescripSmall;
                existingContract.IdProvider     = cont.IdProvider;
                existingContract.StateContract  = cont.StateContract;
                existingContract.DateStar       = cont.DateStar;
                existingContract.DateEnd        = cont.DateEnd;
                existingContract.Term           = cont.Term;
                existingContract.AmountMx       = cont.AmountMx;
                existingContract.AmountDll      = cont.AmountDll;
                existingContract.Resident       = cont.Resident;
                existingContract.Supervisor     = cont.Supervisor;                
                existingContract.Project        = cont.Project;

                await _context.SaveChangesAsync();
                return existingContract;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Contract with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Contract with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingCt = await _context.Contracts.FindAsync(id);
            if (existingCt == null)
            {
                _logger.LogWarning("Attempted to update non-existent Contracts With ID {Id}", id);
                return false;
            }
            try
            {
                existingCt.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Contract with ID {ContractId}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Contract with ID {ContractId}", id);
                throw;
            }
        }

        public async Task<object?> GetById(int id)
        {
            var c = await _context.Contracts.FindAsync(id);
            if (c == null) return null;
            return new
            {
                id             = c.Id,
                numberContract = c.NumberContract,
                description    = c.Description,
                descripSmall   = c.DescripSmall,
                idBranch       = c.IdBranch,
            };
        }

    }

    public interface IContractService
    {
        Task<List<object>> GetContractStateAnalysis(int idBranch);
        Task<List<object>> GetAmount(int idBranch);
        Task<List<object>> GetAmountxSpeciality(int idBranch);
        Task<List<object>> GetContractCountByOilfieldState();
        Task<List<object>> GetContracts(int idBranch);
        Task<List<object>> GetContractsxProvider(int provider);
        Task<List<object>> Contract2fields(int idBranch);
        Task Save(Contract cont);
        Task<Contract?> Update(int id, Contract cont);
        Task<bool> Delete(int id);
        Task<object?> GetById(int id);
    }
}