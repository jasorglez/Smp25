using MicroServicioTracking.Hubs;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using MicroServicioTracking.Services.Fact;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowTrackingOrigin",
        builder =>
        {
            builder
                .WithOrigins("https://localhost", 
                "http://localhost:4200",
                "https://localhost:7089", 
                "http://localhost:8100",
                "https://localhost:4200",
                "https://smp-beta.vercel.app",
                "https://smp-clinica.vercel.app",
                "https://biapp.com.mx",
                "https://clinica.biapp.com.mx",
                "https://www.mwdev.es",
                "http://localhost:5173",
                "https://www.biapp.com.mx",
                "https://www.bi2.com.mx",
                "https://smp-git-main-jasorglezs-projects.vercel.app",
                "https://bi2.com.mx") // Para Angular Capacitor
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
        });
});

// Add services to the container.
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();

builder.Services.AddScoped<ITrackingService,  TrackingService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IAccountBankService, AccountBankService>();
builder.Services.AddScoped<IExpenseCategoryService, ExpensecategoryService>();
builder.Services.AddScoped<IIncomeAndExpenseService, IncomeandexpenseService>();
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IPosSetupService, PosSetupService>();
builder.Services.AddScoped<ICustomerCreditService, CustomerCreditService>();    
builder.Services.AddScoped<ISalesxcustomerService, SalesxcustomerService>();
builder.Services.AddScoped<ISalesxconceptService, SalesxconceptService>();
builder.Services.AddScoped<IStoresService, StoresService>();
builder.Services.AddScoped<ICashRegistersService, CashRegistersService>();
builder.Services.AddScoped<IEmployeesxLoansService, EmployeesxLoansService>();
builder.Services.AddScoped<IZipCodesService, ZipCodesService>();
builder.Services.AddScoped<IConceptsxIncorExpService, ConceptsxIncorExpService>();
builder.Services.AddScoped<IDocumentoscomprobadosService, DocumentosComprobadosService>();
builder.Services.AddScoped<IInformationAditionalService, InformationAditionalService>();
builder.Services.AddScoped<ISetupManagementService, SetupManagementService>();
builder.Services.AddScoped<IBillingManagementService, BillingManagementService>();
builder.Services.AddScoped<IInvoiceXmlService, InvoiceXmlService>();
builder.Services.AddScoped<IFiscalRegimeService, FiscalRegimeService>();
builder.Services.AddScoped<IBankService, BankService>();
builder.Services.AddScoped<IHRManagementService, HRManagementService>();
builder.Services.AddScoped<IHRManagementByRootService, HRManagementByRootService>();
builder.Services.AddScoped<ILoansAndCreditsService, LoansAndCreditsService>();
builder.Services.AddScoped<IConceptsxLoansCreditsService, ConceptsxLoansCreditService>();
builder.Services.AddScoped<IIdBlockPeriodService, IdBlockPeriodService>();
builder.Services.AddScoped<IGeneradorIdBlockWorkerService, GeneradorIdBlockWorkerService>();
builder.Services.AddScoped<IGeneradorAutomaticCheckinsService, GeneradorAutomaticCheckinsService>();
builder.Services.AddScoped<PayrollService>();
builder.Services.AddScoped<IEmployeesXClockService, EmployeesXClockService>();
builder.Services.AddScoped<IEmployeesXCheckInsOutsService, EmployeesxCheckInsOutsService>();
builder.Services.AddScoped<IPaymentsCreditsxCustomersService, PaymentsCreditsxCustomersService>();
builder.Services.AddScoped<NormalPayrollService>();
builder.Services.AddScoped<IGetBranchesByCompanyService, GetBranchesByCompanyService>();
builder.Services.AddScoped<IEmployeeCheckInOutSummaryService, EmployeeCheckInOutSummaryService>();
builder.Services.AddScoped<ISpecialExtraHoursService, SpecialExtraHoursService>();
builder.Services.AddScoped<PayrollCalculationService>();
builder.Services.AddScoped<MicroServicioTracking.Services.Delison.ICustomerCreditDelisonService, MicroServicioTracking.Services.Delison.CustomerCreditDelisonService>();
builder.Services.AddScoped<IdBlockGeneratorWorker>();
builder.Services.AddScoped<ICuentasContablesService, CuentasContablesService>();
builder.Services.AddScoped<IObjetoGastoService, ObjetoGastoService>();
builder.Services.AddScoped<IPresupuestoService, PresupuestoService>();

builder.Services.AddScoped<ICourserInfoService, CourserInfoService>();


// Servicios Fact
builder.Services.AddScoped<IUsosCfdiService, UsosCfdiService>();
builder.Services.AddScoped<IRegimenesFiscalesService, RegimenesFiscalesService>();
builder.Services.AddScoped<IMetodosPagoService, MetodosPagoService>();
builder.Services.AddScoped<IProductosServiciosService, ProductosServiciosService>();
builder.Services.AddScoped<IClavesUnidadesService, ClavesUnidadesService>();
builder.Services.AddScoped<ICodigosPostalesService, CodigosPostalesService>();
builder.Services.AddScoped<IFormasPagoService, FormasPagoService>();
builder.Services.AddScoped<ICustomersBillingService, CustomersBillingService>();
builder.Services.AddScoped<ICadenaOriginalService, CadenaOriginalService>();
builder.Services.AddScoped<ICfdiCancellationService, CfdiCancellationService>();
builder.Services.AddScoped<ISatValidationService, SatValidationService>();
builder.Services.AddScoped<IInvoicePdfService, InvoicePdfService>();
builder.Services.AddScoped<IIngresosExcelService, IngresosExcelService>();
builder.Services.AddScoped<IEgresosExcelService, EgresosExcelService>();

builder.Services.AddDbContext<DbTrackingContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("dbTracking")));

builder.Services.AddSignalR();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = false,
        ValidateAudience         = false,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
    // SignalR WebSocket connections send token via query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/admonHub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{

    c.SwaggerDoc("v5.3.0", new OpenApiInfo { Title = "Microservicio Administrativo ", Version = "v5.3.0 Mod. 2026-04-10 20:00 BTSK" });

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


builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
//builder.Services.AddEndpointsApiExplorer();
//builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v5.3.0/swagger.json", "Microservicio Tracking V5.3.0");
        c.RoutePrefix = "swagger";
    });
}


app.UseHttpsRedirection();

app.UseCors("AllowTrackingOrigin");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AdmonHub>("/admonHub");

// Middleware de Prometheus para exponer métricas
app.UseHttpMetrics(); // Esto mide las solicitudes HTTP automáticamente

app.MapMetrics("/metricsTracking"); // Esto habilita el endpoint /metrics

app.Run();
