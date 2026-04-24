using System.Text;
using System.Xml;
using System.Xml.Xsl;
using System.Xml.XPath;

namespace MicroServicioTracking.Services.Fact;

/// <summary>
/// Servicio para generar la cadena original del comprobante fiscal
/// usando el XSLT oficial del SAT o implementación manual
/// </summary>
public class CadenaOriginalService : ICadenaOriginalService
{
    private readonly ILogger<CadenaOriginalService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private static XslCompiledTransform? _xsltTransform;
    private static readonly SemaphoreSlim _xsltSemaphore = new SemaphoreSlim(1, 1);

    public CadenaOriginalService(
        ILogger<CadenaOriginalService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Genera la cadena original usando el XSLT oficial del SAT (OPCIÓN 1 - RECOMENDADA)
    /// </summary>
    public async Task<string> GenerateCadenaOriginalWithXslt(XmlDocument xmlDoc)
    {
        _logger.LogDebug("Generating cadena original using SAT official XSLT");

        try
        {
            // Cargar el XSLT si no está cargado
            if (_xsltTransform == null)
            {
                // Usar SemaphoreSlim en lugar de lock para código async
                await _xsltSemaphore.WaitAsync();
                try
                {
                    if (_xsltTransform == null)
                    {
                        _xsltTransform = await LoadSatXsltAsync();
                    }
                }
                finally
                {
                    _xsltSemaphore.Release();
                }
            }

            // Aplicar la transformación XSLT al XML
            var navigator = xmlDoc.CreateNavigator();
            if (navigator == null)
            {
                throw new Exception("Could not create XPathNavigator from XML document");
            }

            using var stringWriter = new StringWriter();
            using var xmlWriter = XmlWriter.Create(stringWriter, new XmlWriterSettings
            {
                Encoding = Encoding.UTF8,
                Indent = false,
                OmitXmlDeclaration = true
            });

            _xsltTransform.Transform(navigator, xmlWriter);
            var cadenaOriginal = stringWriter.ToString();

            _logger.LogDebug("Cadena original generated with XSLT. Length: {Length}", cadenaOriginal.Length);
            _logger.LogTrace("Cadena original: {CadenaOriginal}", cadenaOriginal);

            return cadenaOriginal;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating cadena original with XSLT");
            throw new Exception("Error al generar la cadena original con XSLT del SAT", ex);
        }
    }

    /// <summary>
    /// Genera la cadena original de forma manual según especificación del SAT (OPCIÓN 2)
    /// </summary>
    public string GenerateCadenaOriginalManual(XmlDocument xmlDoc)
    {
        _logger.LogDebug("Generating cadena original manually");

        try
        {
            var sb = new StringBuilder();
            var comprobante = xmlDoc.DocumentElement;

            if (comprobante == null)
            {
                throw new Exception("XML document element is null");
            }

            XmlNamespaceManager nsmgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsmgr.AddNamespace("cfdi", "http://www.sat.gob.mx/cfd/4");
            nsmgr.AddNamespace("tfd", "http://www.sat.gob.mx/TimbreFiscalDigital");

            // IMPORTANTE: El orden de los atributos es CRÍTICO según el SAT
            // Este orden está definido en el XSLT oficial del SAT:
            // http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0/cadenaoriginal_4_0.xslt
            // Según el XSLT raíz: <xsl:template match="/">|<xsl:apply-templates select="/cfdi:Comprobante"/>||</xsl:template>
            // Inicia con UN pipe, termina con DOS pipes
            sb.Append("|");

            // Atributos del Comprobante (ORDEN EXACTO DEL SAT)
            AppendAttribute(sb, comprobante, "Version");
            AppendAttribute(sb, comprobante, "Serie");
            AppendAttribute(sb, comprobante, "Folio");
            AppendAttribute(sb, comprobante, "Fecha");
            AppendAttribute(sb, comprobante, "FormaPago");
            AppendAttribute(sb, comprobante, "NoCertificado");
            AppendAttribute(sb, comprobante, "CondicionesDePago");
            AppendAttribute(sb, comprobante, "SubTotal");
            AppendAttribute(sb, comprobante, "Descuento");
            AppendAttribute(sb, comprobante, "Moneda");
            AppendAttribute(sb, comprobante, "TipoCambio");
            AppendAttribute(sb, comprobante, "Total");
            AppendAttribute(sb, comprobante, "TipoDeComprobante");
            AppendAttribute(sb, comprobante, "Exportacion");
            AppendAttribute(sb, comprobante, "MetodoPago");
            AppendAttribute(sb, comprobante, "LugarExpedicion");
            AppendAttribute(sb, comprobante, "Confirmacion");
            // NOTA: "Certificado" y "Sello" NO se incluyen en la cadena original

            // Información Global (si existe)
            var infoGlobal = comprobante.SelectSingleNode("cfdi:InformacionGlobal", nsmgr);
            if (infoGlobal != null)
            {
                // NO agregar pipe extra - AppendAttribute ya incluye el pipe
                AppendAttribute(sb, infoGlobal, "Periodicidad");
                AppendAttribute(sb, infoGlobal, "Meses");
                AppendAttribute(sb, infoGlobal, "Año");
            }

            // CfdiRelacionados (si existe)
            var relacionados = comprobante.SelectSingleNode("cfdi:CfdiRelacionados", nsmgr);
            if (relacionados != null)
            {
                // NO agregar pipe extra - AppendAttribute ya incluye el pipe
                AppendAttribute(sb, relacionados, "TipoRelacion");

                var uuids = relacionados.SelectNodes("cfdi:CfdiRelacionado", nsmgr);
                if (uuids != null)
                {
                    foreach (XmlNode uuid in uuids)
                    {
                        AppendAttribute(sb, uuid, "UUID");
                    }
                }
            }

            // Emisor
            var emisor = comprobante.SelectSingleNode("cfdi:Emisor", nsmgr);
            if (emisor != null)
            {
                // NO agregar pipe extra - AppendAttribute ya incluye el pipe
                AppendAttribute(sb, emisor, "Rfc");
                AppendAttribute(sb, emisor, "Nombre");
                AppendAttribute(sb, emisor, "RegimenFiscal");
                AppendAttribute(sb, emisor, "FacAtrAdquirente");
            }

            // Receptor
            var receptor = comprobante.SelectSingleNode("cfdi:Receptor", nsmgr);
            if (receptor != null)
            {
                // NO agregar pipe extra - AppendAttribute ya incluye el pipe
                AppendAttribute(sb, receptor, "Rfc");
                AppendAttribute(sb, receptor, "Nombre");
                AppendAttribute(sb, receptor, "DomicilioFiscalReceptor");
                AppendAttribute(sb, receptor, "ResidenciaFiscal");
                AppendAttribute(sb, receptor, "NumRegIdTrib");
                AppendAttribute(sb, receptor, "RegimenFiscalReceptor");
                AppendAttribute(sb, receptor, "UsoCFDI");
            }

            // Conceptos
            var conceptos = comprobante.SelectNodes("cfdi:Conceptos/cfdi:Concepto", nsmgr);
            _logger.LogInformation("DEBUG: Found {Count} conceptos in XML", conceptos?.Count ?? 0);

            if (conceptos != null && conceptos.Count > 0)
            {
                foreach (XmlNode concepto in conceptos)
                {
                    _logger.LogInformation("DEBUG: Processing concepto node. Has attributes: {HasAttrs}, Count: {Count}",
                        concepto.Attributes != null, concepto.Attributes?.Count ?? 0);

                    if (concepto.Attributes != null)
                    {
                        foreach (XmlAttribute attr in concepto.Attributes)
                        {
                            _logger.LogInformation("DEBUG: Concepto attribute: {Name} = {Value}", attr.Name, attr.Value);
                        }
                    }

                    var lengthBefore = sb.Length;
                    // NO agregar pipe extra - AppendAttribute ya incluye el pipe
                    AppendAttribute(sb, concepto, "ClaveProdServ");
                    AppendAttribute(sb, concepto, "NoIdentificacion");
                    AppendAttribute(sb, concepto, "Cantidad");
                    AppendAttribute(sb, concepto, "ClaveUnidad");
                    AppendAttribute(sb, concepto, "Unidad");
                    AppendAttribute(sb, concepto, "Descripcion");
                    AppendAttribute(sb, concepto, "ValorUnitario");
                    AppendAttribute(sb, concepto, "Importe");
                    AppendAttribute(sb, concepto, "Descuento");
                    AppendAttribute(sb, concepto, "ObjetoImp");

                    // Impuestos del concepto (si existen)
                    ProcessConceptoImpuestos(sb, concepto, nsmgr);

                    var lengthAfter = sb.Length;
                    _logger.LogInformation("DEBUG: Concepto added {Chars} characters to cadena", lengthAfter - lengthBefore);
                }
            }
            else
            {
                _logger.LogError("No conceptos found in XML! This will cause an incomplete cadena original.");
                _logger.LogError("XML Document: {Xml}", xmlDoc.OuterXml.Substring(0, Math.Min(1000, xmlDoc.OuterXml.Length)));
            }

            // Impuestos totales
            var impuestos = comprobante.SelectSingleNode("cfdi:Impuestos", nsmgr);
            _logger.LogInformation("DEBUG: Found impuestos totales node: {Found}", impuestos != null);
            if (impuestos != null)
            {
                var lengthBeforeImpuestos = sb.Length;

                // IMPORTANTE: Según XSLT SAT, el orden es:
                // 1. Retenciones (detalles)
                // 2. Traslados (detalles)
                // 3. TotalImpuestosRetenidos (total)
                // 4. TotalImpuestosTrasladados (total)

                // Retenciones
                var retenciones = impuestos.SelectNodes("cfdi:Retenciones/cfdi:Retencion", nsmgr);
                _logger.LogInformation("DEBUG: Found {Count} retenciones totales", retenciones?.Count ?? 0);
                if (retenciones != null && retenciones.Count > 0)
                {
                    foreach (XmlNode retencion in retenciones)
                    {
                        AppendAttribute(sb, retencion, "Impuesto");
                        AppendAttribute(sb, retencion, "Importe");
                    }
                }

                // Traslados
                var traslados = impuestos.SelectNodes("cfdi:Traslados/cfdi:Traslado", nsmgr);
                _logger.LogInformation("DEBUG: Found {Count} traslados totales", traslados?.Count ?? 0);
                if (traslados != null && traslados.Count > 0)
                {
                    foreach (XmlNode traslado in traslados)
                    {
                        AppendAttribute(sb, traslado, "Base");
                        AppendAttribute(sb, traslado, "Impuesto");
                        AppendAttribute(sb, traslado, "TipoFactor");
                        AppendAttribute(sb, traslado, "TasaOCuota");
                        AppendAttribute(sb, traslado, "Importe");
                    }
                }

                // DESPUÉS de retenciones y traslados, agregar los totales
                AppendAttribute(sb, impuestos, "TotalImpuestosRetenidos");
                AppendAttribute(sb, impuestos, "TotalImpuestosTrasladados");

                var lengthAfterImpuestos = sb.Length;
                _logger.LogInformation("DEBUG: Impuestos totales added {Chars} characters", lengthAfterImpuestos - lengthBeforeImpuestos);
            }

            sb.Append("||");

            var cadenaOriginal = sb.ToString();
            _logger.LogInformation("DEBUG: Cadena original generated manually. Length: {Length}", cadenaOriginal.Length);
            _logger.LogInformation("DEBUG: Cadena original COMPLETA:\n{CadenaOriginal}", cadenaOriginal);

            return cadenaOriginal;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating cadena original manually");
            throw new Exception("Error al generar la cadena original de forma manual", ex);
        }
    }

    private void ProcessConceptoImpuestos(StringBuilder sb, XmlNode concepto, XmlNamespaceManager nsmgr)
    {
        var impuestos = concepto.SelectSingleNode("cfdi:Impuestos", nsmgr);
        if (impuestos == null)
        {
            _logger.LogInformation("DEBUG: No impuestos node found in concepto");
            return;
        }

        _logger.LogInformation("DEBUG: Found impuestos node in concepto, processing traslados...");

        // Traslados del concepto
        var traslados = impuestos.SelectNodes("cfdi:Traslados/cfdi:Traslado", nsmgr);
        _logger.LogInformation("DEBUG: Found {Count} traslados in concepto", traslados?.Count ?? 0);

        if (traslados != null && traslados.Count > 0)
        {
            foreach (XmlNode traslado in traslados)
            {
                AppendAttribute(sb, traslado, "Base");
                AppendAttribute(sb, traslado, "Impuesto");
                AppendAttribute(sb, traslado, "TipoFactor");
                AppendAttribute(sb, traslado, "TasaOCuota");
                AppendAttribute(sb, traslado, "Importe");
            }
        }

        // Retenciones del concepto
        var retenciones = impuestos.SelectNodes("cfdi:Retenciones/cfdi:Retencion", nsmgr);
        if (retenciones != null)
        {
            foreach (XmlNode retencion in retenciones)
            {
                AppendAttribute(sb, retencion, "Base");
                AppendAttribute(sb, retencion, "Impuesto");
                AppendAttribute(sb, retencion, "TipoFactor");
                AppendAttribute(sb, retencion, "TasaOCuota");
                AppendAttribute(sb, retencion, "Importe");
            }
        }
    }

    private void AppendAttribute(StringBuilder sb, XmlNode? node, string attributeName)
    {
        if (node == null) return;

        var attribute = node.Attributes?[attributeName];
        if (attribute != null && !string.IsNullOrEmpty(attribute.Value))
        {
            // IMPORTANTE: Según el XSLT oficial del SAT, el template "Opcional" agrega
            // el pipe ANTES del valor: |valor (no valor|)
            // Ver: utilerias.xslt template "Opcional"
            sb.Append("|");
            sb.Append(attribute.Value);
        }
        // IMPORTANTE: NO agregar nada si el atributo no existe
        // Según el XSLT oficial del SAT: "Optional data not expressed do not appear
        // in the original string and have no delimiter whatsoever"
    }

    /// <summary>
    /// Descarga y compila el XSLT oficial del SAT
    /// </summary>
    private async Task<XslCompiledTransform> LoadSatXsltAsync()
    {
        _logger.LogInformation("Loading SAT official XSLT for CFDI 4.0");

        const string SAT_XSLT_URL = "http://www.sat.gob.mx/sitio_internet/cfd/4/cadenaoriginal_4_0.xslt";

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            var xsltContent = await client.GetStringAsync(SAT_XSLT_URL);

            if (string.IsNullOrEmpty(xsltContent))
            {
                throw new Exception("Downloaded XSLT content is empty");
            }

            var transform = new XslCompiledTransform();

            using var stringReader = new StringReader(xsltContent);
            using var xmlReader = XmlReader.Create(stringReader);

            transform.Load(xmlReader);

            _logger.LogInformation("SAT XSLT loaded and compiled successfully");

            return transform;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error downloading SAT XSLT from {Url}", SAT_XSLT_URL);
            throw new Exception($"Error al descargar el XSLT del SAT desde {SAT_XSLT_URL}. Verifica tu conexión a internet.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading SAT XSLT");
            throw new Exception("Error al cargar y compilar el XSLT oficial del SAT", ex);
        }
    }
}

public interface ICadenaOriginalService
{
    Task<string> GenerateCadenaOriginalWithXslt(XmlDocument xmlDoc);
    string GenerateCadenaOriginalManual(XmlDocument xmlDoc);
}
