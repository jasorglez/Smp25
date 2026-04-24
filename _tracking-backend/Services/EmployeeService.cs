using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{

    public class EmployeeService : IEmployeeService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<EmployeeService> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly HttpClient _httpClient;
        private readonly IGetBranchesByCompanyService _branchesService;

        public EmployeeService(
            DbTrackingContext context,
            ILogger<EmployeeService> logger,
            IHttpContextAccessor httpContextAccessor,
            HttpClient httpClient,
            IGetBranchesByCompanyService branchesService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
        }

        public async Task<List<object>> EmployeesByBranchClinica(int branchId, string Type)
        {
            try
            {
                if (branchId >= 0)
                {
                    return await _context.Employeexbranchs
                        .Where(e => e.IdBranch == branchId && e.Active == true && e.Vigente == true && e.Type == Type)
                        .Select(e => new
                        {
                            e.Id,
                            e.IdBranch,
                            e.Namebranch,
                            e.Name,
                            e.Cedula,
                            e.EmployeeCode,
                            e.Type,
                            e.Address,
                            e.City,
                            e.Cp,
                            e.ValueAdded,
                            e.State,
                            e.Neighborhood,
                            e.Phone,
                            e.Email,
                            e.Loan,
                            e.Saving,
                            e.IdBank,
                            e.Rfc,
                            e.ClockPassword,
                            e.Picture,
                            e.Vigente,
                            e.PriceXHour,
                            e.BaseHours,
                            e.IdPosition,
                            e.IngressDate,
                            e.IdDepto,
                            e.Active
                        })
                        .OrderByDescending(e => e.Vigente)
                        .ThenBy(e => e.Namebranch)
                        .ThenBy(e => e.Name)
                        .AsNoTracking()
                        .ToListAsync<object>();
                }
                else
                {
                    
                        var employees = await _context.Employeexbranchs
                            .Where(e => e.IdRoot == -branchId && e.Type == Type && e.Vigente == true && e.Active == true)
                            .Select(e => new
                            {
                                e.Id,
                                e.IdBranch,
                                e.Namebranch,
                                e.Name,
                                e.Cedula,
                                e.EmployeeCode,
                                e.Address,
                                e.Type,
                                e.City,
                                e.Cp,
                                e.State,
                                e.Neighborhood,
                                e.ValueAdded,
                                e.Phone,
                                e.Email,
                                e.Loan,
                                e.Saving,
                                e.IdBank,
                                e.Rfc,
                                e.ClockPassword,
                                e.Picture,
                                e.Vigente,
                                e.PriceXHour,
                                e.BaseHours,
                                e.IdPosition,
                                e.IngressDate,
                                e.IdDepto,
                                e.Active
                            })
                            .OrderByDescending(e => e.Vigente)
                            .ThenBy(e => e.Namebranch)
                            .ThenBy(e => e.Name)
                            .AsNoTracking()
                            .ToListAsync<object>();

                    return employees;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employees for Branch ID {Id}", branchId);
                throw;
            }
        }
        public async Task<List<object>> EmployeesByBranch(int branchId)
        {
            try
            {
                if (branchId >= 0)
                {
                    return await _context.Employeexbranchs
                        .Where(e => e.IdBranch == branchId && e.Active == true)
                        .Select(e => new
                        {
                            e.Id,
                            e.IdBranch,
                            e.Namebranch,
                            e.Name,
                            e.Cedula,
                            e.EmployeeCode,
                            e.Address,
                            e.ValueAdded,
                            e.City,
                            e.Type,
                            e.Cp,
                            e.State,
                            e.Neighborhood,
                            e.Phone,
                            e.Email,
                            e.Loan,
                            e.Saving,
                            e.IdBank,
                            e.Rfc,
                            e.ClockPassword,
                            e.Picture,
                            e.Vigente,
                            e.PriceXHour,
                            e.BaseHours,
                            e.IdPosition,
                            e.IngressDate,
                            e.IdDepto,
                            e.Active
                        })
                        .OrderByDescending(e => e.Vigente)
                        .ThenBy(e => e.Namebranch)
                        .ThenBy(e => e.Name)
                        .AsNoTracking()
                        .ToListAsync<object>();
                }
                else
                {
                    
                        var employees = await _context.Employeexbranchs
                            .Where(e => e.IdRoot == -branchId)
                            .Select(e => new
                            {
                                e.Id,
                                e.IdBranch,
                                e.Namebranch,
                                e.Name,
                                e.Cedula,
                                e.EmployeeCode,
                                e.ValueAdded,
                                e.Address,
                                e.City,
                                e.Type,
                                e.Cp,
                                e.State,
                                e.Neighborhood,
                                e.Phone,
                                e.Email,
                                e.Loan,
                                e.Saving,
                                e.IdBank,
                                e.Rfc,
                                e.ClockPassword,
                                e.Picture,
                                e.Vigente,
                                e.PriceXHour,
                                e.BaseHours,
                                e.IdPosition,
                                e.IngressDate,
                                e.IdDepto,
                                e.Active
                            })
                            .OrderByDescending(e => e.Vigente)
                            .ThenBy(e => e.Namebranch)
                            .ThenBy(e => e.Name)
                            .AsNoTracking()
                            .ToListAsync<object>();

                    return employees;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employees for Branch ID {Id}", branchId);
                throw;
            }
        }
        public async Task<List<object>> EmployeesByBranchVigente(int branchId)
        {
            try
            {
                if (branchId >= 0)
                {
                    return await _context.Employeexbranchs
                        .Where(e => e.IdBranch == branchId && e.Active == true && e.Vigente == true)
                        .Select(e => new
                        {
                            e.Id,
                            e.IdBranch,
                            e.Namebranch,
                            e.Name,
                            e.EmployeeCode,
                            e.Address,
                            e.City,
                            e.Cp,
                            e.State,
                            e.Neighborhood,
                            e.Phone,
                            e.Email,
                            e.Loan,
                            e.Saving,
                            e.Cedula,
                            e.IdBank,
                            e.Rfc,
                            e.ClockPassword,
                            e.Picture,
                            e.Vigente,
                            e.PriceXHour,
                            e.BaseHours,
                            e.IdPosition,
                            e.IngressDate,
                            e.IdDepto,
                            e.Active
                        })
                        .OrderByDescending(e => e.Vigente)
                        .ThenBy(e => e.Namebranch)
                        .ThenBy(e => e.Name)
                        .AsNoTracking()
                        .ToListAsync<object>();
                }
                else
                {
                    
                        var employees = await _context.Employeexbranchs
                            .Where(e => e.IdRoot == -branchId && e.Vigente == true)
                            .Select(e => new
                            {
                                e.Id,
                                e.IdBranch,
                                e.Namebranch,
                                e.Name,
                                e.EmployeeCode,
                                e.Address,
                                e.City,
                                e.Cedula,
                                e.Cp,
                                e.State,
                                e.Neighborhood,
                                e.Phone,
                                e.Email,
                                e.Loan,
                                e.Saving,
                                e.IdBank,
                                e.Rfc,
                                e.ClockPassword,
                                e.Picture,
                                e.Vigente,
                                e.PriceXHour,
                                e.BaseHours,
                                e.IdPosition,
                                e.IngressDate,
                                e.IdDepto,
                                e.Active
                            })
                            .OrderByDescending(e => e.Vigente)
                            .ThenBy(e => e.Name)
                            .AsNoTracking()
                            .ToListAsync<object>();

                    return employees;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employees for Branch ID {Id}", branchId);
                throw;
            }
        }

        public async Task<List<object>> AllEmployees(int branchId)
        {
            try
            {
                return await _context.Employees
                    .Where(e => e.IdBranch == branchId && e.Active == true)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBranch,
                        e.Name,
                        e.EmployeeCode,
                        e.Address,
                        e.City,
                        e.Cp,
                        e.State,
                        e.Neighborhood,
                        e.Phone,
                        e.Email,
                        e.Loan,
                        e.Saving,
                        e.ValueAdded,
                        e.IdBank,
                        e.Rfc,
                        e.ClockPassword,
                        e.Picture,
                        e.Vigente,
                        e.PriceXHour,
                        e.BaseHours,
                        e.IdPosition,
                        e.IngressDate,
                        e.IdDepto,
                        e.Active
                    })
                    .OrderByDescending(e => e.Vigente).ThenBy(e => e.Name)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employees for Branch ID {Id}", branchId);
                throw;
            }
        }

public async Task<List<object>> findEmployees(string name)
{
    try
    {
        return await _context.Employees
            .Where(e => e.Name.Contains(name) && e.Active==true)
            .Select(e => new
            {
                e.Id,
                e.IdBranch,
                e.Name,
                e.Email,
                e.IdPosition,
                e.IdDepto,
                e.Active
            })
            .OrderBy(e => e.Name)
            .AsNoTracking()
            .ToListAsync<object>();
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error retrieving Employees for Name {name}", name);
        throw;
    }
}


        public async Task<List<object>> Employee(int id)
        {
            try
            {
                return await _context.Employees
                    .Where(e => e.Id == id && e.Active == true)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBranch,
                        e.Name,
                        e.EmployeeCode,
                        e.Address,
                        e.City,
                        e.Cp,
                        e.State,
                        e.Neighborhood,
                        e.Phone,
                        e.Type,
                        e.Email,
                        e.Loan,
                        e.Saving,
                        e.IdBank,
                        e.ValueAdded,
                        e.Rfc,
                        e.ClockPassword,
                        e.Picture,
                        e.Vigente,
                        e.PriceXHour,
                        e.BaseHours,
                        e.Cedula,
                        e.IdPosition,
                        e.IngressDate,
                        e.IdDepto,
                        HasClock = _context.EmployeesXClocks
                            .Count(ec => ec.IdEmployee == e.Id && ec.Enabled && ec.Active) > 0,
                        e.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employees for ID {Id}", id);
                throw;
            }
        }

        public async Task<List<object>> IdUserAndPassword(string email, string clockPassword)
        {
            try
            {
                // Primero, verificar si el empleado existe
                var employee = await _context.Employees
                    .Where(e => e.Email == email || e.EmployeeCode == email
                                && e.ClockPassword == clockPassword
                                && e.Active == true)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBranch,
                        e.Name
                    })
                    .FirstOrDefaultAsync();

                if (employee == null)
                {
                    // Si el empleado no existe, retornar una lista vacía o lanzar una excepción, según tu lógica
                    _logger.LogWarning("Employee with code {Email} and password {ClockPassword} not found", email,
                        clockPassword);
                    return new List<object>(); // O lanzar una excepción
                }

                // Si el empleado existe, buscar sus registros en EmployeesxChecks
                var checks = await _context.EmployeesxChecks
                    .Where(c => c.IdEmployee == employee.Id)
                    .OrderByDescending(c => c.TimeStamp)
                    .FirstOrDefaultAsync();

                // Si no hay registros en EmployeesxChecks, devolver los valores por defecto
                if (checks == null)
                {
                    var defaultResult = new List<object>
                    {
                        new
                        {
                            idEmployee = employee.Id,
                            employee.Name,
                            employee.IdBranch,
                            LastCheck = new DateTime(2000, 1, 1),
                            LastValid = true,
                            HasClock = _context.EmployeesXClocks
                                .Count(ec => ec.IdEmployee == employee.Id && ec.Enabled && ec.Active) > 0,
                            LastType = "OUT"
                        }
                    };

                    return defaultResult;
                }

                // Si hay registros, devolver los valores reales
                var result = new List<object>
                {
                    new
                    {
                        idEmployee = employee.Id,
                        employee.Name,
                        employee.IdBranch,
                        LastCheck = checks.TimeStamp,
                        LastValid = checks.Valid,
                        HasClock = _context.EmployeesXClocks
                            .Count(ec => ec.IdEmployee == employee.Id && ec.Enabled && ec.Active) > 0,
                        LastType = checks.Type
                    }
                };

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Employee given");
                throw;
            }
        }

        public async Task Save(Employee employee)
        {
            try
            {
                _context.Employees.Add(employee);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Employee");
                throw;
            }
        }

        public async Task<Employee?> Update(int id, Employee employee)
        {
            var existingEmployee = await _context.Employees.FindAsync(id);
            if (existingEmployee == null)
            {
                _logger.LogWarning("Attempted to update non-existent Employee with ID {Id}", id);
                return null;
            }

            try
            {
                existingEmployee.IdBranch = employee.IdBranch;
                existingEmployee.Email = employee.Email;
                existingEmployee.Name = employee.Name;
                existingEmployee.EmployeeCode = employee.EmployeeCode;
                existingEmployee.Address = employee.Address;
                existingEmployee.City = employee.City;
                existingEmployee.Cp = employee.Cp;
                existingEmployee.State = employee.State;
                existingEmployee.Neighborhood = employee.Neighborhood;
                existingEmployee.Phone = employee.Phone;
                existingEmployee.Rfc = employee.Rfc;
                existingEmployee.IdBank = employee.IdBank;
                existingEmployee.ClockPassword = employee.ClockPassword;
                existingEmployee.Picture = employee.Picture;
                existingEmployee.Cedula = employee.Cedula;
                existingEmployee.Vigente = employee.Vigente;
                existingEmployee.IdPosition = employee.IdPosition;
                existingEmployee.BaseHours = employee.BaseHours;
                existingEmployee.PriceXHour = employee.PriceXHour;
                existingEmployee.ValueAdded = employee.ValueAdded;
                existingEmployee.IngressDate = employee.IngressDate;
                existingEmployee.Type = employee.Type;
                existingEmployee.IdDepto = employee.IdDepto;
                existingEmployee.Active = employee.Active;

                await _context.SaveChangesAsync();
                return existingEmployee;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Employee with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingEmployee = await _context.Employees.FindAsync(id);
            if (existingEmployee == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Employee with ID {Id}", id);
                return false;
            }

            try
            {
                existingEmployee.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Employee with ID {Id}", id);
                throw;
            }
        }

    }
}

public interface IEmployeeService
    {
        Task<List<object>> EmployeesByBranch(int branchId);
        Task<List<object>> EmployeesByBranchClinica(int branchId, string Type);
        Task<List<object>> EmployeesByBranchVigente(int branchId);
        Task<List<object>> findEmployees(string name);
        Task<List<object>> Employee(int id);
        Task<List<object>> IdUserAndPassword(string email, string clockPassword);
        Task Save(Employee employee);
        Task<Employee?> Update(int id, Employee employee);
        Task<bool> Delete(int id);
    }