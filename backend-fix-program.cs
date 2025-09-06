using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SMP.Services;
using SMP.Services.TD;
using Microsoft.OpenApi.Models;
using SMP.Models.context;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
//using SMP.Service;
using Microsoft.AspNetCore.Http.Features;
using SMP.Hubs;

var builder = WebApplication.CreateBuilder(args);

// No necesitas configurar Kestrel explícitamente para HTTPS aquí
// ya que el proxy inverso manejará SSL/TLS

// Add services to the container.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSMPOrigin",
        builder =>
        {
            builder
                .WithOrigins("https://be-app-five.vercel.app",
                "http://localhost:8100",
                "https://bi2.com.mx",
                "https://www.bi2.com.mx",
                "https://localhost:7118",
                "https://smp25-beta.netlify.app",
                "https://www.biapp.com.mx",
                "https://biapp.com.mx",
                "http://localhost:4200",
                "https://localhost:4200",
                "http://localhost:5003",
                "http://66.179.240.10:5003",
                "https://beap-prueba.netlify.app",
                "https://localhost") // Para Angular Capacitor
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
        });
});

builder.Services.AddControllers();

// AGREGAR SIGNALR CON CONFIGURACIÓN ESPECIAL
builder.Services.AddSignalR(options =>
{
    // Configuración para manejar CORS correctamente
    options.EnableDetailedErrors = true;
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v4.3", new OpenApiInfo { Title = "Microservicio SMP", Version = "v4.3 Mod. 2025-08-23 13:43 BSGK Server 66.179.240.10" });
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

//SMP Services
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


builder.Services.AddHttpContextAccessor();

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
        
        // CONFIGURACIÓN ESPECIAL PARA SIGNALR
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/SMP/storageHub"))
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
    // Límite de 50MB para archivos PDF
    options.MultipartBodyLengthLimit = 52428800;
});

var app = builder.Build();

// Configura el reenvío de encabezados del proxy
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v4.3/swagger.json", "Microservicio SMP V4.3");
        c.RoutePrefix = "swagger";
    });
}

// ORDEN IMPORTANTE PARA SIGNALR
// app.UseHttpsRedirection();
app.UseCors("AllowSMPOrigin");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// MAPEAR SIGNALR HUB CON CONFIGURACIÓN CORS
app.MapHub<StorageHub>("/SMP/storageHub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.All;
});

app.Run();