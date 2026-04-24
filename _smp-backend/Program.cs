using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SMP.Services;
using SMP.Services.TD;
using SMP.Services.FE;
using Microsoft.OpenApi.Models;
using SMP.Models.context;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
using Microsoft.AspNetCore.Http.Features;
using SMP.Hubs;
using DocumentFormat.OpenXml.InkML;

var builder = WebApplication.CreateBuilder(args);

// Configuración CORS más específica para SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRCorsPolicy", policy =>
    {
        policy
            .WithOrigins(                
                "http://localhost:8100",
                "https://endpoints.biapp.com.mx",
                "https://endpoints.biapp.com.mx",
                "https://localhost:7118",
                "https://smp-beta.vercel.app",
                "https://www.biapp.com.mx",
                "https://biapp.com.mx",
                "https://clinica.biapp.com.mx",
                "http://localhost:4200",
                "https://localhost:4200",
                "http://localhost:5173",
                "http://localhost:5003",
                "http://76.13.28.145:5003",                
                "https://localhost",
                "https://pruebas.bi2.mx",
                "https://clinica-pruebas.bi2.mx"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .SetIsOriginAllowed(origin => true); // Para desarrollo
    });
});

builder.Services.AddControllers();

// Configuración SignalR optimizada
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 1024 * 1024; // 1MB
    options.StreamBufferCapacity = 10;
    options.MaximumParallelInvocationsPerClient = 1;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{

    c.SwaggerDoc("v5.9.0", new OpenApiInfo { Title = "Microservicio SMP", Version = "v5.9.0 Mod. 2026-04-09 — sistema licencias root" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Ejemplo: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddDbContext<DbSmpContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("dbSMP")));

builder.Services.AddHttpClient();

// Todos tus servicios existentes (los mantuve igual)
builder.Services.AddScoped<IContractService, ContractService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ILogbookService, LogbookService>();
builder.Services.AddScoped<IProviderService, ProviderService>();
builder.Services.AddScoped<IOilfieldService, OilfieldService>();
builder.Services.AddScoped<IConventionService, ConventionService>();
builder.Services.AddScoped<IRootService, RootService>();
builder.Services.AddScoped<ISmpandSecurity, CombinedSmpService>();
builder.Services.AddScoped<IAttachService, AttachService>();
builder.Services.AddScoped<IWorkprogramService, WorkprogramService>();
builder.Services.AddScoped<IAdvancedService, AdvancedService>();
builder.Services.AddScoped<ILinkService, LinkService>();
builder.Services.AddScoped<IPersonalByProyectService, PersonalByProyectService>();
builder.Services.AddScoped<IidentificationService, IdentificationServices>();
builder.Services.AddScoped<IAnalysisService, AnalysisServices>();
builder.Services.AddScoped<IContingencyActionService, ContingencyActionService>();
builder.Services.AddScoped<ITimeInactiveService, TimeInactiveService>();
builder.Services.AddScoped<IIdentificationRiskService, IdentificationRiskService>();
builder.Services.AddScoped<IAnalysisRiskService, AnalysisRiskService>();
builder.Services.AddScoped<IPlanificationRiskService, PlanificationRiskService>();
builder.Services.AddScoped<IGrallogService, GrallogService>();
builder.Services.AddScoped<IStakeholderService, StakeholderService>();
builder.Services.AddScoped<IImplementationriskService, ImplementationriskService>();
builder.Services.AddScoped<IEstimateService, EstimateService>();
builder.Services.AddScoped<IChangesControlService, ChangescontrolService>();
builder.Services.AddScoped<IBranchService, BranchService>();
builder.Services.AddScoped<IOTService, OTService>();
builder.Services.AddScoped<IPdfProcessingService, PdfProcessingService>();
builder.Services.AddScoped<IContractDetailsService, ContractDetailsService>();
builder.Services.AddScoped<IConventionDetailsService, ConventionDetailsService>();
builder.Services.AddScoped<IDailyReportService, DailyReportService>();
builder.Services.AddScoped<IEquipmentService, EquipmentService>();
builder.Services.AddScoped<IGeneratorService, GeneratorService>();
builder.Services.AddScoped<IItemsGeneradoresEstimateService, ItemsGeneradoresEstimateService>();
builder.Services.AddScoped<IDateTimeService, DateTimeService>();
builder.Services.AddScoped<IUpdateExcelServiceGenerador, UpdateExcelServiceGenerador>();
builder.Services.AddScoped<IUpdateExcelServiceInternas, UpdateExcelServiceInternas>();
builder.Services.AddScoped<IUpdateExcelServiceExternas, UpdateExcelServiceExternas>();
builder.Services.AddScoped<IProcesadorExcel, ProcesadorExcel>();
builder.Services.AddScoped<IProcesadorExcelInt, ProcesadorExcelInt>();
builder.Services.AddScoped<IClaveProdServService, ClaveProdServService>();
builder.Services.AddScoped<IClaveUnidadService, ClaveUnidadService>();
builder.Services.AddScoped<IFormaPagoService, FormaPagoService>();
builder.Services.AddScoped<IMetodoPagoService, MetodoPagoService>();
builder.Services.AddScoped<IMonedaService, MonedaService>();
builder.Services.AddScoped<IObjetoImpuestoService, ObjetoImpuestoService>();
builder.Services.AddScoped<ITipoComprobanteService, TipoComprobanteService>();
builder.Services.AddScoped<IUsoCfdiService, UsoCfdiService>();
builder.Services.AddScoped<IDatosXFechas, DatosXFechas>();
builder.Services.AddScoped<IConceptsService, ConceptsService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IGruposCorporativosService, GruposCorporativosService>();
builder.Services.AddScoped<IWorkprogramApuService, WorkprogramApuService>();
builder.Services.AddScoped<IWorkprogramApuFactorService, WorkprogramApuFactorService>();
builder.Services.AddScoped<IWorkprogramApuCuadrillaService, WorkprogramApuCuadrillaService>();
builder.Services.AddScoped<IHerramientaService, HerramientaService>();
builder.Services.AddScoped<IAuxiliarService, AuxiliarService>();
builder.Services.AddScoped<IAuxiliarItemsService, AuxiliarItemsService>();
builder.Services.AddScoped<IDistributionService, DistributionService>();
builder.Services.AddScoped<IManoObraService, ManoObraService>();

builder.Services.AddHttpContextAccessor();

// JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("La clave JWT no está configurada")))
        };

        // Configuración para SignalR (opcional si no usas JWT con SignalR)
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/storageHub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/root/.aspnet/DataProtection-Keys"))
    .UseCryptographicAlgorithms(new AuthenticatedEncryptorConfiguration()
    {
        EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC,
        ValidationAlgorithm = ValidationAlgorithm.HMACSHA256
    });

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 52428800;
});

var app = builder.Build();

// Configuración de archivos estáticos para descargas de ZIP
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "Uploads")),
    RequestPath = "/Uploads"
});

// Configuración de headers del proxy
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v5.9.0/swagger.json", "Microservicio SMP v5.9.0 2026-04-10 15:17");
        c.RoutePrefix = "swagger";
    });
}

// ⚠️ ORDEN CRÍTICO: CORS debe ir ANTES de Authentication/Authorization
app.UseCors("SignalRCorsPolicy");

// Authentication y Authorization (opcional para SignalR si no usas JWT)
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// 🔧 CONFIGURACIÓN CORREGIDA DEL HUB
app.MapHub<StorageHub>("storageHub");
Console.WriteLine("StorageHub mapeado en: storageHub");
app.Run();
