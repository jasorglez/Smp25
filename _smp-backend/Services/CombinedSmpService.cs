using System.Text.Json;
using SMP.Models.context;
using System.Dynamic;
using System.Text.Json.Serialization;
using System.Net.Http.Headers;
using SMP.Services;
using Microsoft.EntityFrameworkCore;
using SMP.Models;

namespace SMP.Services
{
    public class CombinedSmpService : ISmpandSecurity
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<CombinedSmpService> _logger;        
        //mando a llamar los servicios donde tengo los get 
          private readonly IRootService _rootService;
          private readonly IContractService _contractService;
          private readonly IProjectService _projectService;
          private readonly IBranchService _branchService;
  
        private readonly HttpClient _httpClient;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CombinedSmpService(DbSmpContext context, ILogger<CombinedSmpService> logger , 
            IRootService rootService, IContractService contractService, 
            IProjectService projectService, IBranchService branchService, 
            HttpClient httpClient, IHttpContextAccessor httpContextAccessor)
        {
            _context         = context ?? throw new ArgumentNullException(nameof(context));
            _logger          = logger ?? throw new ArgumentNullException(nameof(logger));
            _rootService     = rootService;
            _contractService = contractService;
            _projectService  = projectService;
            _branchService  = branchService;

            _httpClient      = httpClient;
            _httpContextAccessor = httpContextAccessor;
        }

     public async Task<List<CombinedData>> GetCombinedDataRoot(int idUser)
        {
            try
            {
                var userBranchPermission = await _context.Companyandbranch
                    .Where(x => x.Id_User == idUser )
                    .OrderBy(x => x.Orden)
                    .ToListAsync();

                var combinedData = userBranchPermission.Select(x => new CombinedData
                {
                    Id         = x.Id,
                    InternalId = x.IdPerm,
                    IdUser     = x.Id_User,
                    Type       = x.Type,
                    Advanced   = x.Advanced,
                    Name       = x.Namesmall,
                    Orden      = x.Orden
                }).ToList();


                return combinedData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener y combinar datos");
                throw;
            }

        }

     public async Task<List<CombinedData>> GetCombinedDataBranch(int idUser, int idBussines)
        {

            try
            {
                var userBranchPermission = await _context.Allbranchs
                    .Where(x => x.Id_User == idUser && x.Id_Company == idBussines)
                    .ToListAsync();

                var combinedData = userBranchPermission.Select(x => new CombinedData
                {
                    Id = x.Id,
                    InternalId = x.IdPerm,
                    IdUser = x.Id_User,
                    Type = x.Type,
                    Name = x.Name
                }).ToList();

                Console.WriteLine($"-----------IdUser: {idUser} IdBussines: {idBussines}");
                Console.WriteLine($"-----------CombinedData: {JsonSerializer.Serialize(combinedData)}");

                return combinedData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener y combinar datos");
                throw;
            }

        }      

    //estos NOP
    public async Task<List<CombinedData>> GetCombinedDataContract(int idUser, int idBussines)
        {
            try
            {
                // Aqui consulto 2 Campos de root Name e Id y obtengo datos locales y convertirlos al tipo correcto
                var rlocalData = await _contractService.Contract2fields(idBussines);
                var localData = rlocalData.Select(item => new local
                {
                    Id = ((dynamic)item).Id,                                      
                    Name = ((dynamic)item).NumberContract
                }).ToList();

                // y aqui el endpoint de los permisos por type=contract y idUse=13 ejemplo
                List<ApiData> apiData = await GetExternalApiData("contract", idUser);
                var combinedData = (from api in apiData
                                    join local in localData on Convert.ToInt32(api.IdPermission) equals local.Id
                                    select new CombinedData
                                    {
                                        Id = local.Id,
                                        InternalId = api.Id,
                                        IdUser = api.IdUser,
                                        Type = api.Type,
                                        Name = local.Name
                                    }).ToList();

                return combinedData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener y combinar datos");
                throw;
            }

        }

    public async Task<List<CombinedData>> GetCombinedDataProject(int idUser, int idContract)
        {
            try
            {
                // Aqui consulto 2 Campos de root Name e Id y obtengo datos locales y convertirlos al tipo correcto
                var rlocalData = await _projectService.GetProjectsxContract(idContract);
                var localData = rlocalData.Select(item => new local
                {
                    Id = ((dynamic)item).Id,
                    Name = ((dynamic)item).Name
                }).ToList();

                // y aqui el endpoint de los permisos por type=contract y idUse=13 ejemplo
                List<ApiData> apiData = await GetExternalApiData("project", idUser);
                var combinedData = (from api in apiData
                                    join local in localData on Convert.ToInt32(api.IdPermission) equals local.Id
                                    select new CombinedData
                                    {
                                        Id = local.Id,
                                        InternalId = api.Id,
                                        IdUser = api.IdUser,
                                        Type = api.Type,
                                        Name = local.Name
                                    }).ToList();

                return combinedData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener y combinar datos");
                throw;
            }

        }

    private object? GetPropertyValue(object obj, string propertyName)
        {
            if (obj is ExpandoObject expando)
            {
                if (((IDictionary<string, object?>)expando).TryGetValue(propertyName, out object? value))
                {
                    return value;
                }
            }
            else
            {
                var property = obj.GetType().GetProperty(propertyName);
                if (property != null)
                {
                    return property.GetValue(obj);
                }
            }
            return null;
        }

    private async Task<List<ApiData>> GetExternalApiData(string type, int idUser)
        {
            try
            {
                var token = ObtenerTokenDeAutorizacion();
                   var request = new HttpRequestMessage(HttpMethod.Get, $"http://5.181.218.92:5003/api/Usersxpermission/idUser?type={type}&idUser={idUser}");
               // var request = new HttpRequestMessage(HttpMethod.Get, $"http://bi2.com.mx/smp/api/Usersxpermission/idUser?type={type}&idUser={idUser}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString
                };

                var result = JsonSerializer.Deserialize<List<ApiData>>(content, options);

                _logger.LogInformation($"JSON recibido: {content}");
                _logger.LogInformation($"Datos deserializados: {JsonSerializer.Serialize(result)}");

                if (result == null || !result.Any())
                {
                    _logger.LogWarning("No se obtuvieron datos de la API o la deserialización falló");
                    return new List<ApiData>();
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener datos de la API externa");
                throw;
            }
        }


        private string ObtenerTokenDeAutorizacion()
        {
            var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault()?.Split(" ").Last();
            if (string.IsNullOrEmpty(token))
            {
                throw new UnauthorizedAccessException("No se encontró el token de autorización");
            }
            return token;
        }

    }

    public interface ISmpandSecurity
    {
        Task<List<CombinedData>> GetCombinedDataRoot(int idUser);
        Task<List<CombinedData>> GetCombinedDataContract(int idUser, int idBussines);
        Task<List<CombinedData>> GetCombinedDataProject(int idUser, int idContract);
        Task<List<CombinedData>> GetCombinedDataBranch(int idUser, int idBussines);
    }


    public class local
    {
        public int Id { get; set; }        
        public string? Name { get; set; }
    }



}