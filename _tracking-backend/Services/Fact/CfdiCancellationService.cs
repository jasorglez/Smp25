using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Xml.Linq;

namespace MicroServicioTracking.Services.Fact;

/// <summary>
/// Servicio para cancelar CFDIs usando Finkok
/// </summary>
public class CfdiCancellationService : ICfdiCancellationService
{
    private readonly DbTrackingContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CfdiCancellationService> _logger;
    private readonly IConfiguration _configuration;

    public CfdiCancellationService(
        DbTrackingContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<CfdiCancellationService> logger,
        IConfiguration configuration)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Cancela un CFDI timbrado con Finkok
    /// </summary>
    public async Task<CancellationResult> CancelCfdi(int idIncomeExpense, CancellationRequest request)
    {
        _logger.LogInformation("Starting CFDI cancellation for income/expense ID: {Id}", idIncomeExpense);

        // 1. Obtener la factura
        var income = await _context.Incomeandexpenses
            .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

        if (income == null)
            throw new Exception($"Income/Expense with ID {idIncomeExpense} not found");

        if (income.Facturado != true)
            throw new Exception("Esta factura no ha sido timbrada");

        if (string.IsNullOrEmpty(income.Uuid))
            throw new Exception("UUID no encontrado en la factura");

        if (income.Cancelado == true)
            throw new Exception("Esta factura ya fue cancelada previamente");

        // 2. Obtener configuración de facturación
        var config = await _context.BillingManagement
            .FirstOrDefaultAsync(b => b.Id == income.IdBillingConfig && b.Active);

        if (config == null)
            throw new Exception("Billing configuration not found");

        if (string.IsNullOrEmpty(config.EmisorRfc))
            throw new Exception("RFC del emisor no configurado");

        // 3. Enviar solicitud de cancelación a Finkok
        var cancellationResult = await SendCancellationToFinkok(
            income.Uuid,
            config.EmisorRfc,
            request.MotivoCancelacion ?? "02",
            request.FolioSustitucion);

        // 4. Actualizar registro en BD si fue exitoso
        if (cancellationResult.Success)
        {
            income.Cancelado = true;
            income.FechaCancelacion = DateTime.Now;
            income.MotivoCancelacion = request.MotivoCancelacion;
            // Nota: FolioSustitucion y AcuseRecibo no existen en la tabla actual
            // Si los necesitas, agrega las columnas a la BD primero

            await _context.SaveChangesAsync();

            _logger.LogInformation("CFDI cancelled successfully. UUID: {UUID}", income.Uuid);
        }

        return cancellationResult;
    }

    private async Task<CancellationResult> SendCancellationToFinkok(
        string uuid,
        string rfcEmisor,
        string motivoCancelacion,
        string? folioSustitucion)
    {
        var username = _configuration["Finkok:Username"];
        var password = _configuration["Finkok:Password"];
        var environment = _configuration["Finkok:Environment"] ?? "demo";
        var url = environment.ToLower() == "demo"
            ? _configuration["Finkok:CancelUrlDemo"]
            : _configuration["Finkok:CancelUrlProd"];

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            _logger.LogError("Finkok credentials not configured");
            throw new Exception("Finkok credentials not configured. Verifica la configuración en appsettings.json");
        }

        if (string.IsNullOrEmpty(url))
        {
            _logger.LogError("Finkok cancellation URL not configured for environment: {Environment}", environment);
            throw new Exception($"Finkok cancellation URL not configured for environment: {environment}");
        }

        _logger.LogInformation(
            "Sending cancellation request to Finkok. Environment: {Environment}, UUID: {UUID}",
            environment, uuid);

        // Construir XML de cancelación según CFDI 4.0
        var cancellationXml = BuildCancellationXml(uuid, rfcEmisor, motivoCancelacion, folioSustitucion);

        var soapEnvelope = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<soapenv:Envelope xmlns:soapenv=""http://schemas.xmlsoap.org/soap/envelope/""
                  xmlns:apps=""apps.services.soap.1.0.finkok.com"">
   <soapenv:Header/>
   <soapenv:Body>
      <apps:cancel>
         <apps:UUIDS>
            <apps:uuids>{uuid}</apps:uuids>
         </apps:UUIDS>
         <apps:username>{username}</apps:username>
         <apps:password>{password}</apps:password>
         <apps:taxpayer_id>{rfcEmisor}</apps:taxpayer_id>
         <apps:cer></apps:cer>
         <apps:key></apps:key>
         <apps:store_pending>false</apps:store_pending>
      </apps:cancel>
   </soapenv:Body>
</soapenv:Envelope>";

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(60);

            var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
            content.Headers.Add("SOAPAction", "http://facturacion.finkok.com/cancel");

            _logger.LogDebug("Sending cancellation SOAP request to Finkok...");
            var response = await client.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogDebug("Finkok cancellation response status: {StatusCode}", response.StatusCode);
            _logger.LogDebug("Finkok cancellation response: {Response}", responseContent);

            return ParseCancellationResponse(responseContent, uuid);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error calling Finkok cancellation service");
            throw new Exception($"Error de conexión con Finkok: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, "Timeout calling Finkok cancellation service");
            throw new Exception("Tiempo de espera agotado al conectar con Finkok", ex);
        }
    }

    private string BuildCancellationXml(string uuid, string rfcEmisor, string motivoCancelacion, string? folioSustitucion)
    {
        var xml = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<Cancelacion xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance""
             xmlns:xsd=""http://www.w3.org/2001/XMLSchema""
             RfcEmisor=""{rfcEmisor}""
             Fecha=""{DateTime.Now:yyyy-MM-ddTHH:mm:ss}""
             xmlns=""http://cancelacfd.sat.gob.mx"">
  <Folios>
    <Folio UUID=""{uuid}"" Motivo=""{motivoCancelacion}""";

        if (!string.IsNullOrEmpty(folioSustitucion))
        {
            xml += $@" FolioSustitucion=""{folioSustitucion}""";
        }

        xml += @" />
  </Folios>
</Cancelacion>";

        return xml;
    }

    private CancellationResult ParseCancellationResponse(string soapResponse, string uuid)
    {
        try
        {
            var doc = XDocument.Parse(soapResponse);
            XNamespace soapNs = "http://schemas.xmlsoap.org/soap/envelope/";
            XNamespace finkokNs = "apps.services.soap.1.0.finkok.com";

            // Buscar errores SOAP Fault
            var fault = doc.Descendants(soapNs + "Fault").FirstOrDefault();
            if (fault != null)
            {
                var faultString = fault.Element("faultstring")?.Value ?? "Error desconocido";
                _logger.LogError("SOAP Fault in cancellation: {FaultString}", faultString);

                return new CancellationResult
                {
                    Success = false,
                    ErrorMessage = faultString,
                    Uuid = uuid
                };
            }

            // Buscar resultado de cancelación
            var cancelResult = doc.Descendants(finkokNs + "cancelResult").FirstOrDefault();
            if (cancelResult == null)
            {
                _logger.LogError("cancelResult not found in Finkok response");
                throw new Exception("Formato de respuesta de Finkok inválido");
            }

            // Verificar si hay errores
            var folios = cancelResult.Descendants(finkokNs + "Folios").FirstOrDefault();
            if (folios != null)
            {
                var folio = folios.Descendants(finkokNs + "Folio").FirstOrDefault();
                if (folio != null)
                {
                    var estatusUUID = folio.Element(finkokNs + "EstatusUUID")?.Value;
                    var estatusCancelacion = folio.Element(finkokNs + "EstatusCancelacion")?.Value;

                    _logger.LogInformation(
                        "Cancellation result - EstatusUUID: {EstatusUUID}, EstatusCancelacion: {EstatusCancelacion}",
                        estatusUUID, estatusCancelacion);

                    // 201 = Cancelado exitosamente
                    // 202 = Ya fue cancelado previamente
                    bool success = estatusCancelacion == "201" || estatusCancelacion == "202";

                    return new CancellationResult
                    {
                        Success = success,
                        Uuid = uuid,
                        EstatusCancelacion = estatusCancelacion,
                        EstatusUUID = estatusUUID,
                        AcuseRecibo = doc.ToString(),
                        Message = GetCancellationMessage(estatusCancelacion)
                    };
                }
            }

            // Si llegamos aquí, verificar acuse
            var acuse = cancelResult.Element(finkokNs + "Acuse")?.Value;
            if (!string.IsNullOrEmpty(acuse))
            {
                _logger.LogInformation("CFDI cancellation successful. UUID: {UUID}", uuid);

                return new CancellationResult
                {
                    Success = true,
                    Uuid = uuid,
                    AcuseRecibo = acuse,
                    Message = "CFDI cancelado exitosamente"
                };
            }

            // Si no hay acuse ni folios, buscar error
            var error = cancelResult.Element(finkokNs + "CodEstatus")?.Value;
            var mensaje = cancelResult.Element(finkokNs + "Mensaje")?.Value;

            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogError("Finkok cancellation error: Code={Code}, Message={Message}", error, mensaje);

                return new CancellationResult
                {
                    Success = false,
                    Uuid = uuid,
                    ErrorMessage = mensaje ?? "Error desconocido al cancelar",
                    ErrorCode = error
                };
            }

            // Respuesta inesperada
            _logger.LogWarning("Unexpected Finkok cancellation response format");
            return new CancellationResult
            {
                Success = false,
                Uuid = uuid,
                ErrorMessage = "Formato de respuesta inesperado de Finkok"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Finkok cancellation response");
            throw new Exception("Error al interpretar la respuesta de Finkok", ex);
        }
    }

    private string GetCancellationMessage(string? estatusCancelacion)
    {
        return estatusCancelacion switch
        {
            "201" => "CFDI cancelado exitosamente",
            "202" => "CFDI previamente cancelado",
            "203" => "CFDI no corresponde al emisor",
            "204" => "CFDI no vigente",
            "205" => "CFDI no existe",
            "206" => "Solicitud de cancelación procesada pero requiere aceptación del receptor",
            "207" => "Solicitud rechazada",
            _ => $"Estado desconocido: {estatusCancelacion}"
        };
    }
}

public interface ICfdiCancellationService
{
    Task<CancellationResult> CancelCfdi(int idIncomeExpense, CancellationRequest request);
}

/// <summary>
/// Datos para solicitar la cancelación de un CFDI
/// </summary>
public class CancellationRequest
{
    /// <summary>
    /// Motivo de cancelación según catálogo del SAT:
    /// 01 = Comprobante emitido con errores con relación
    /// 02 = Comprobante emitido con errores sin relación (más común)
    /// 03 = No se llevó a cabo la operación
    /// 04 = Operación nominativa relacionada en una factura global
    /// </summary>
    public string? MotivoCancelacion { get; set; } = "02";

    /// <summary>
    /// UUID del CFDI que sustituye al cancelado (obligatorio si motivo = 01)
    /// </summary>
    public string? FolioSustitucion { get; set; }
}

/// <summary>
/// Resultado de la cancelación de un CFDI
/// </summary>
public class CancellationResult
{
    public bool Success { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public string? EstatusCancelacion { get; set; }
    public string? EstatusUUID { get; set; }
    public string? AcuseRecibo { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorCode { get; set; }
    public string Message { get; set; } = string.Empty;
}
