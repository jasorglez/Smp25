using System.Text;
using System.Xml.Linq;

namespace MicroServicioTracking.Services.Fact;

/// <summary>
/// Servicio para validar facturas directamente con el SAT
/// </summary>
public class SatValidationService : ISatValidationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SatValidationService> _logger;

    private const string SAT_VALIDATION_URL = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

    public SatValidationService(
        IHttpClientFactory httpClientFactory,
        ILogger<SatValidationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Valida el estado de un CFDI en el SAT
    /// </summary>
    public async Task<SatValidationResult> ValidateCfdiWithSat(SatValidationRequest request)
    {
        _logger.LogInformation("Validating CFDI with SAT. UUID: {UUID}", request.Uuid);

        try
        {
            var soapRequest = BuildSatValidationSoapRequest(request);
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            var content = new StringContent(soapRequest, Encoding.UTF8, "text/xml");
            content.Headers.Add("SOAPAction", "http://tempuri.org/IConsultaCFDIService/Consulta");

            _logger.LogDebug("Sending validation request to SAT...");
            var response = await client.PostAsync(SAT_VALIDATION_URL, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogDebug("SAT validation response received. Status: {Status}", response.StatusCode);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("SAT validation HTTP error. Status: {Status}, Response: {Response}",
                    response.StatusCode, responseContent);
                throw new Exception($"Error en la consulta al SAT: HTTP {response.StatusCode}");
            }

            return ParseSatValidationResponse(responseContent);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error calling SAT validation service");
            throw new Exception("Error de conexión con el servicio de validación del SAT. Verifica tu conexión a internet.", ex);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, "Timeout calling SAT validation service");
            throw new Exception("Tiempo de espera agotado al consultar el SAT. El servicio puede estar temporalmente no disponible.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error validating CFDI with SAT");
            throw new Exception($"Error inesperado al validar con el SAT: {ex.Message}", ex);
        }
    }

    private string BuildSatValidationSoapRequest(SatValidationRequest request)
    {
        // Expresión regular para extraer solo el UUID sin guiones
        var uuid = request.Uuid.Replace("-", "");

        return $@"<?xml version=""1.0"" encoding=""utf-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/""
               xmlns:tem=""http://tempuri.org/"">
  <soap:Header/>
  <soap:Body>
    <tem:Consulta>
      <tem:expresionImpresa><![CDATA[?re={request.RfcEmisor}&rr={request.RfcReceptor}&tt={request.Total:F6}&id={uuid}]]></tem:expresionImpresa>
    </tem:Consulta>
  </soap:Body>
</soap:Envelope>";
    }

    private SatValidationResult ParseSatValidationResponse(string soapResponse)
    {
        try
        {
            var doc = XDocument.Parse(soapResponse);
            XNamespace soapNs = "http://schemas.xmlsoap.org/soap/envelope/";
            XNamespace tempUri = "http://tempuri.org/";

            var consultaResult = doc.Descendants(tempUri + "ConsultaResult").FirstOrDefault();

            if (consultaResult == null)
            {
                _logger.LogError("ConsultaResult not found in SAT response");
                throw new Exception("Formato de respuesta del SAT inválido");
            }

            var codigoEstatus = consultaResult.Element(tempUri + "CodigoEstatus")?.Value;
            var estado = consultaResult.Element(tempUri + "Estado")?.Value;
            var esCancelable = consultaResult.Element(tempUri + "EsCancelable")?.Value;
            var estatusCancelacion = consultaResult.Element(tempUri + "EstatusCancelacion")?.Value;
            var validacionEfos = consultaResult.Element(tempUri + "ValidacionEFOS")?.Value;

            _logger.LogInformation(
                "SAT validation result - Code: {Code}, Estado: {Estado}, Cancelable: {Cancelable}",
                codigoEstatus, estado, esCancelable);

            // Determinar si la factura es válida
            bool isValid = codigoEstatus == "S" && estado == "Vigente";

            return new SatValidationResult
            {
                IsValid = isValid,
                CodigoEstatus = codigoEstatus ?? "N",
                Estado = estado ?? "Desconocido",
                EsCancelable = esCancelable == "Cancelable sin aceptación" || esCancelable == "Cancelable con aceptación",
                EstatusCancelacion = estatusCancelacion,
                ValidacionEfos = validacionEfos,
                Message = GetValidationMessage(codigoEstatus, estado),
                RawResponse = soapResponse
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing SAT validation response");
            throw new Exception("Error al interpretar la respuesta del SAT", ex);
        }
    }

    private string GetValidationMessage(string? codigoEstatus, string? estado)
    {
        return codigoEstatus switch
        {
            "S" when estado == "Vigente" => "CFDI válido y vigente ante el SAT",
            "S" when estado == "Cancelado" => "CFDI cancelado ante el SAT",
            "N" => "CFDI no encontrado en el SAT. Verifica los datos o que haya sido timbrado correctamente.",
            _ => $"Estado desconocido: {codigoEstatus} - {estado}"
        };
    }
}

public interface ISatValidationService
{
    Task<SatValidationResult> ValidateCfdiWithSat(SatValidationRequest request);
}

/// <summary>
/// Datos necesarios para validar un CFDI con el SAT
/// </summary>
public class SatValidationRequest
{
    public string Uuid { get; set; } = string.Empty;
    public string RfcEmisor { get; set; } = string.Empty;
    public string RfcReceptor { get; set; } = string.Empty;
    public decimal Total { get; set; }
}

/// <summary>
/// Resultado de la validación con el SAT
/// </summary>
public class SatValidationResult
{
    public bool IsValid { get; set; }
    public string CodigoEstatus { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public bool EsCancelable { get; set; }
    public string? EstatusCancelacion { get; set; }
    public string? ValidacionEfos { get; set; }
    public string Message { get; set; } = string.Empty;
    public string RawResponse { get; set; } = string.Empty;
}
