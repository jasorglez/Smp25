using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Xml;
using System.Net.Http;
using System.Text;
using System.Xml.Linq;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Services;

public class BillingManagementService : IBillingManagementService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<BillingManagementService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IInvoiceXmlService _invoiceXmlService;
    private readonly ICadenaOriginalService _cadenaOriginalService;

    public BillingManagementService(
        DbTrackingContext context,
        ILogger<BillingManagementService> logger,
        IConfiguration configuration,
        IInvoiceXmlService invoiceXmlService,
        ICadenaOriginalService cadenaOriginalService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _invoiceXmlService = invoiceXmlService ?? throw new ArgumentNullException(nameof(invoiceXmlService));
        _cadenaOriginalService = cadenaOriginalService ?? throw new ArgumentNullException(nameof(cadenaOriginalService));
    }

    public async Task<List<BillingManagement>> ConfigByRoot(int idRoot)
    {
        try
        {
            return await _context.BillingManagement
                .Where(sm => sm.IdRoot == idRoot && sm.Active == true)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving billing config for Root ID {IdRoot}", idRoot);
            throw;
        }
    }

    public async Task Save(BillingManagement billingManagement)
    {
        try
        {
            _context.BillingManagement.Add(billingManagement);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving billing management");
            throw;
        }
    }

    public async Task<BillingManagement?> Update(int idRoot, BillingManagement billingManagement)
    {
        var existingBillingManagement = await _context.BillingManagement
            .FirstOrDefaultAsync(sm => sm.IdRoot == idRoot && sm.Active == true);

        if (existingBillingManagement == null)
        {
            _logger.LogWarning("Attempted to update non-existent billing config with ID Root {IdRoot}", idRoot);
            return null;
        }

        try
        {
            existingBillingManagement.FiscalYear = billingManagement.FiscalYear;
            existingBillingManagement.FiscalRegime = billingManagement.FiscalRegime;
            existingBillingManagement.Prefix = billingManagement.Prefix;
            existingBillingManagement.Consecutive = billingManagement.Consecutive;

            //soriano para Consecutivos de Egresos
            existingBillingManagement.Prefixexp = billingManagement.Prefixexp;
            existingBillingManagement.Consecutivexp = billingManagement.Consecutivexp;

            existingBillingManagement.IIva = billingManagement.IIva;
            existingBillingManagement.IIeps = billingManagement.IIeps;
            existingBillingManagement.II3 = billingManagement.II3;
            existingBillingManagement.RIva = billingManagement.RIva;
            existingBillingManagement.RIeps = billingManagement.RIeps;

            if (billingManagement.CerFileContent != null)
                existingBillingManagement.CerFileContent = billingManagement.CerFileContent;

            if (billingManagement.KeyFileContent != null)
                existingBillingManagement.KeyFileContent = billingManagement.KeyFileContent;

            if (!string.IsNullOrEmpty(billingManagement.EfirmaPass))
                existingBillingManagement.EfirmaPass = billingManagement.EfirmaPass;

            existingBillingManagement.DateStart = billingManagement.DateStart;
            existingBillingManagement.DateEnd = billingManagement.DateEnd;
            existingBillingManagement.Active = billingManagement.Active;

            await _context.SaveChangesAsync();
            return existingBillingManagement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating billing config with ID {IdRoot}", idRoot);
            throw;
        }
    }

    // Servicio
    public async Task<BillingManagement?> UpdateConsecutiveAsync(int idRoot, int nuevoConsecutivo)
    {
        var existingBillingManagement = await _context.BillingManagement
            .FirstOrDefaultAsync(sm => sm.IdRoot == idRoot && sm.Active == true);

        if (existingBillingManagement == null)
            return null;

        existingBillingManagement.Consecutive = nuevoConsecutivo;
        await _context.SaveChangesAsync();

        return existingBillingManagement;
    }


    public async Task<InvoiceStampResult> GenerateAndStampInvoice(int idIncomeExpense)
    {
        _logger.LogInformation("Starting invoice generation and stamping for income/expense ID: {Id}", idIncomeExpense);

        // 1. Generar XML desde la BD
        var xmlInvoice = await _invoiceXmlService.GenerateInvoiceXml(idIncomeExpense);

        _logger.LogInformation("XML generated successfully for ID: {Id}", idIncomeExpense);

        // 2. Obtener informaci�n para timbrado
        var income = await _context.Incomeandexpenses
            .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

        if (income == null)
            throw new Exception($"Income/Expense with ID {idIncomeExpense} not found");

        if (income.Facturado == true)
            throw new Exception("This invoice has already been stamped");

        var config = await _context.BillingManagement
            .FirstOrDefaultAsync(b => b.Id == income.IdBillingConfig && b.Active);

        if (config == null)
            throw new Exception("Billing configuration not found");

        // 3. Firmar el XML
        var signedXml = await SignXml(xmlInvoice, config);

        _logger.LogInformation("XML signed successfully");

        // 4. Timbrar con Finkok
        var stampResult = await StampWithFinkok(signedXml, idIncomeExpense);

        // 5. Actualizar registro en BD
        await UpdateInvoiceAfterStamp(idIncomeExpense, config, stampResult);

        _logger.LogInformation("Invoice stamped and saved successfully. UUID: {UUID}", stampResult.Uuid);

        return stampResult;
    }
        
    private async Task<string> SignXml(string xml, BillingManagement config)
    {
        _logger.LogDebug("Starting XML signing process");

        if (config.CerFileContent == null || config.CerFileContent.Length == 0)
        {
            _logger.LogError("Certificate file (.cer) not found or empty");
            throw new Exception("Archivo de certificado (.cer) no encontrado. Debes subir el certificado antes de timbrar.");
        }

        if (config.KeyFileContent == null || config.KeyFileContent.Length == 0)
        {
            _logger.LogError("Key file (.key) not found or empty");
            throw new Exception("Archivo de llave privada (.key) no encontrado. Debes subir la llave privada antes de timbrar.");
        }

        if (string.IsNullOrEmpty(config.EfirmaPass))
        {
            _logger.LogError("E-firma password not configured");
            throw new Exception("Contraseña de la e.firma no configurada. Debes configurar la contraseña del certificado.");
        }

        try
        {
            var doc = new XmlDocument();
            doc.PreserveWhitespace = true;
            doc.LoadXml(xml);

            var comprobante = doc.DocumentElement;
            if (comprobante == null)
            {
                _logger.LogError("XML document element is null");
                throw new Exception("Estructura del XML inválida: no se encontró el elemento raíz");
            }

            _logger.LogDebug("Loading certificate (.cer)...");

            // Cargar certificado
            X509Certificate2 cert;
            try
            {
                cert = new X509Certificate2(config.CerFileContent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load certificate");
                throw new Exception("Error al cargar el certificado (.cer). Verifica que el archivo sea válido.", ex);
            }

            // Validar que el certificado no haya expirado
            if (cert.NotAfter < DateTime.Now)
            {
                _logger.LogError("Certificate expired on {ExpirationDate}", cert.NotAfter);
                throw new Exception($"El certificado ha expirado el {cert.NotAfter:yyyy-MM-dd}. Renueva tu certificado ante el SAT.");
            }

            if (cert.NotBefore > DateTime.Now)
            {
                _logger.LogError("Certificate not yet valid. Valid from {ValidFrom}", cert.NotBefore);
                throw new Exception($"El certificado aún no es válido. Será válido desde {cert.NotBefore:yyyy-MM-dd}.");
            }

            var certBase64 = Convert.ToBase64String(cert.GetRawCertData());

            // Obtener número de certificado en formato correcto (decimal ASCII, no hex invertido)
            // El SerialNumber de Windows devuelve hex invertido, necesitamos el formato SAT
            var noCertificado = GetCertificateNumber(cert);

            _logger.LogInformation("Certificate loaded successfully. Serial: {Serial}, Valid until: {ValidTo}",
                noCertificado, cert.NotAfter);

            // IMPORTANTE: Reordenar atributos del Comprobante en el orden correcto del SAT
            // NO agregamos Certificado aquí, solo NoCertificado y otros atributos
            // Certificado se agregará DESPUÉS de generar el sello
            ReorderComprobanteAttributes(comprobante, noCertificado);

            _logger.LogDebug("Generating cadena original...");

            // DEBUG: Log COMPLETE XML y atributos del Comprobante
            _logger.LogInformation("=== XML COMPLETE BEFORE CADENA ORIGINAL ===");
            _logger.LogInformation("{Xml}", doc.OuterXml);
            _logger.LogInformation("=== COMPROBANTE ATTRIBUTES ===");
            foreach (System.Xml.XmlAttribute attr in comprobante.Attributes)
            {
                _logger.LogInformation("  {Name} = {Value}", attr.Name,
                    attr.Value.Length > 100 ? attr.Value.Substring(0, 100) + "..." : attr.Value);
            }

            // Generar cadena original usando el XSLT del SAT (sin Certificado ni Sello)
            var cadenaOriginal = await GenerateCadenaOriginal(doc);

            _logger.LogInformation("Cadena original generated. Length: {Length}", cadenaOriginal.Length);
            _logger.LogInformation("Cadena original (first 200 chars): {Cadena}",
                cadenaOriginal.Substring(0, Math.Min(200, cadenaOriginal.Length)));
            _logger.LogDebug("Generating digital seal...");

            // Cargar llave privada y firmar
            string sello;
            try
            {
                sello = GenerateSello(cadenaOriginal, config.KeyFileContent, config.EfirmaPass);
            }
            catch (CryptographicException ex)
            {
                _logger.LogError(ex, "Cryptographic error generating seal");
                throw new Exception("Error al generar el sello digital. Verifica que la contraseña de la e.firma sea correcta y que la llave privada (.key) sea válida.", ex);
            }

            _logger.LogInformation("Digital seal generated successfully. Seal (first 50 chars): {Sello}",
                sello.Substring(0, Math.Min(50, sello.Length)));

            // IMPORTANTE: Agregar Certificado y Sello en las posiciones correctas
            // Necesitamos reordenar TODOS los atributos para que queden en el orden del SAT
            AddCertificadoAndSelloInCorrectOrder(comprobante, certBase64, sello);

            // Convertir el XML a string con encoding UTF-8 (Finkok requiere UTF-8, no UTF-16)
            var xmlString = ConvertXmlToUtf8String(doc);

            _logger.LogInformation("XML signed successfully. Final XML (first 500 chars): {Xml}",
                xmlString.Substring(0, Math.Min(500, xmlString.Length)));

            return xmlString;
        }
        catch (Exception ex) when (ex.Message.Contains("Verifica") || ex.Message.Contains("Error al") || ex.Message.Contains("expirado"))
        {
            // Re-lanzar excepciones que ya tienen mensajes amigables
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error signing XML");
            throw new Exception($"Error inesperado al firmar el XML: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Genera la cadena original usando el servicio configurado
    /// Por defecto intenta usar XSLT del SAT, si falla usa método manual
    /// </summary>
    private async Task<string> GenerateCadenaOriginal(XmlDocument doc)
    {
        var useXslt = _configuration.GetValue<bool>("Finkok:UseXsltForCadenaOriginal", true);

        try
        {
            if (useXslt)
            {
                _logger.LogDebug("Using SAT official XSLT for cadena original");
                return await _cadenaOriginalService.GenerateCadenaOriginalWithXslt(doc);
            }
            else
            {
                _logger.LogDebug("Using manual method for cadena original");
                return _cadenaOriginalService.GenerateCadenaOriginalManual(doc);
            }
        }
        catch (Exception ex) when (useXslt)
        {
            _logger.LogWarning(ex, "Failed to generate cadena original with XSLT, falling back to manual method");
            return _cadenaOriginalService.GenerateCadenaOriginalManual(doc);
        }
    }

    /// <summary>
    /// Reordena los atributos del elemento Comprobante en el orden exacto del SAT
    /// Esto es crítico porque el sello se genera a partir del orden de la cadena original
    /// IMPORTANTE: NO agrega Certificado ni Sello, solo reordena atributos existentes
    /// </summary>
    private void ReorderComprobanteAttributes(XmlElement comprobante, string noCertificado)
    {
        // Guardar TODOS los atributos existentes (incluyendo xmlns)
        var attrs = new Dictionary<string, string>();
        var namespaces = new Dictionary<string, string>();

        foreach (XmlAttribute attr in comprobante.Attributes)
        {
            if (attr.Name.StartsWith("xmlns:") || attr.Name == "xmlns")
            {
                namespaces[attr.Name] = attr.Value;
            }
            else if (attr.Prefix == "xsi")
            {
                namespaces[attr.Name] = attr.Value;
            }
            else
            {
                attrs[attr.Name] = attr.Value;
            }
        }

        // Remover TODOS los atributos
        comprobante.RemoveAllAttributes();

        // 1. PRIMERO: Agregar namespaces en el ORDEN EXACTO del SAT
        comprobante.SetAttribute("xmlns:cfdi", "http://www.sat.gob.mx/cfd/4");
        comprobante.SetAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");

        // IMPORTANTE: Crear el atributo xsi:schemaLocation correctamente
        // Debemos crear un atributo con prefijo usando CreateAttribute
        var schemaLocationAttr = comprobante.OwnerDocument!.CreateAttribute("xsi", "schemaLocation", "http://www.w3.org/2001/XMLSchema-instance");
        schemaLocationAttr.Value = "http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd";
        comprobante.Attributes.Append(schemaLocationAttr);

        // 2. SEGUNDO: Agregar atributos de datos en el ORDEN EXACTO del SAT
        // Este orden DEBE coincidir con CadenaOriginalService.GenerateCadenaOriginalManual
        SetAttrIfExists(comprobante, attrs, "Version");
        SetAttrIfExists(comprobante, attrs, "Serie");
        SetAttrIfExists(comprobante, attrs, "Folio");
        SetAttrIfExists(comprobante, attrs, "Fecha");
        SetAttrIfExists(comprobante, attrs, "FormaPago");
        comprobante.SetAttribute("NoCertificado", noCertificado); // Posición 6
        SetAttrIfExists(comprobante, attrs, "CondicionesDePago");
        SetAttrIfExists(comprobante, attrs, "SubTotal");
        SetAttrIfExists(comprobante, attrs, "Descuento");
        SetAttrIfExists(comprobante, attrs, "Moneda");
        SetAttrIfExists(comprobante, attrs, "TipoCambio");
        SetAttrIfExists(comprobante, attrs, "Total");
        SetAttrIfExists(comprobante, attrs, "TipoDeComprobante");
        SetAttrIfExists(comprobante, attrs, "Exportacion");
        SetAttrIfExists(comprobante, attrs, "MetodoPago");
        SetAttrIfExists(comprobante, attrs, "LugarExpedicion");
        SetAttrIfExists(comprobante, attrs, "Confirmacion");
        // IMPORTANTE: NO agregar Certificado aquí
        // Certificado y Sello se agregan DESPUÉS de generar la cadena original
    }

    private void SetAttrIfExists(XmlElement element, Dictionary<string, string> attrs, string name)
    {
        if (attrs.ContainsKey(name))
            element.SetAttribute(name, attrs[name]);
    }

    /// <summary>
    /// Convierte un XmlDocument a string con encoding UTF-8 correctamente formateado
    /// </summary>
    private string ConvertXmlToUtf8String(XmlDocument doc)
    {
        using var stringWriter = new StringWriter();
        using var xmlWriter = XmlWriter.Create(stringWriter, new XmlWriterSettings
        {
            Encoding = Encoding.UTF8,
            Indent = false,
            OmitXmlDeclaration = false
        });

        doc.Save(xmlWriter);
        xmlWriter.Flush();

        var result = stringWriter.ToString();

        // Asegurar que la declaración XML tenga encoding="UTF-8"
        // StringWriter genera UTF-16 en la declaración, necesitamos cambiarlo
        if (result.StartsWith("<?xml version=\"1.0\" encoding=\"utf-16\"?>"))
        {
            result = result.Replace("<?xml version=\"1.0\" encoding=\"utf-16\"?>",
                                   "<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        }

        return result;
    }

    /// <summary>
    /// Agrega Certificado y Sello al XML en las posiciones exactas del Anexo 20.
    /// IMPORTANTE: Aunque Certificado y Sello NO están en la cadena original,
    /// deben ir en posiciones específicas en el XML según el estándar SAT.
    /// </summary>
    private void AddCertificadoAndSelloInCorrectOrder(XmlElement comprobante, string certificado, string sello)
    {
        // IMPORTANTE: Certificado y Sello NO se incluyen en la cadena original,
        // por lo tanto PODEMOS reordenar para cumplir con el formato del Anexo 20
        // sin afectar la validación del sello.

        // Guardar TODOS los atributos actuales (excepto xmlns)
        var attrs = new Dictionary<string, string>();
        foreach (XmlAttribute attr in comprobante.Attributes)
        {
            if (!attr.Name.StartsWith("xmlns") && attr.Prefix != "xsi")
            {
                attrs[attr.Name] = attr.Value;
            }
        }

        // Remover atributos de datos (mantener namespaces)
        var attrsToRemove = comprobante.Attributes.Cast<XmlAttribute>()
            .Where(a => !a.Name.StartsWith("xmlns") && a.Prefix != "xsi")
            .ToList();

        foreach (var attr in attrsToRemove)
            comprobante.RemoveAttributeNode(attr);

        // Agregar en ORDEN EXACTO del Anexo 20 (incluyendo Certificado y Sello)
        // Este orden NO afecta la cadena original porque Certificado y Sello no están en ella
        SetAttrIfExists(comprobante, attrs, "Version");
        SetAttrIfExists(comprobante, attrs, "Serie");
        SetAttrIfExists(comprobante, attrs, "Folio");
        SetAttrIfExists(comprobante, attrs, "Fecha");
        SetAttrIfExists(comprobante, attrs, "FormaPago");
        SetAttrIfExists(comprobante, attrs, "NoCertificado");
        comprobante.SetAttribute("Certificado", certificado); // Posición 7 - después de NoCertificado
        SetAttrIfExists(comprobante, attrs, "CondicionesDePago");
        SetAttrIfExists(comprobante, attrs, "SubTotal");
        SetAttrIfExists(comprobante, attrs, "Descuento");
        SetAttrIfExists(comprobante, attrs, "Moneda");
        SetAttrIfExists(comprobante, attrs, "TipoCambio");
        SetAttrIfExists(comprobante, attrs, "Total");
        SetAttrIfExists(comprobante, attrs, "TipoDeComprobante");
        SetAttrIfExists(comprobante, attrs, "Exportacion");
        SetAttrIfExists(comprobante, attrs, "MetodoPago");
        SetAttrIfExists(comprobante, attrs, "LugarExpedicion");
        SetAttrIfExists(comprobante, attrs, "Confirmacion");
        comprobante.SetAttribute("Sello", sello); // Último atributo
    }

    /// <summary>
    /// Extrae el número de certificado en el formato correcto para el SAT
    /// Los certificados del SAT codifican el número como una cadena ASCII en el campo SerialNumber
    /// </summary>
    private string GetCertificateNumber(X509Certificate2 cert)
    {
        try
        {
            // Obtener los bytes del número de serie (vienen en little-endian)
            var serialBytes = cert.GetSerialNumber();

            // Invertir para obtener big-endian (orden correcto para leer)
            Array.Reverse(serialBytes);

            // El SAT codifica el número de certificado como ASCII en el serial number
            // Por ejemplo: "30001000000500003416" está codificado como bytes ASCII
            var certNumber = Encoding.ASCII.GetString(serialBytes);

            _logger.LogDebug("Certificate number extracted: {CertNumber} (length: {Length})",
                certNumber, certNumber.Length);

            return certNumber;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting certificate number, falling back to SerialNumber");
            // Fallback al método anterior si hay error
            return cert.SerialNumber;
        }
    }

    // En BillingManagementService
    public async Task<BillingManagement?> UpdateCertificates(int idRoot, byte[]? cerFileContent, byte[]? keyFileContent)
    {
        var existingBillingManagement = await _context.BillingManagement
            .FirstOrDefaultAsync(sm => sm.IdRoot == idRoot && sm.Active == true);

        if (existingBillingManagement == null)
        {
            _logger.LogWarning("Attempted to update certificates for non-existent billing config with ID Root {IdRoot}", idRoot);
            return null;
        }

        try
        {
            // Actualizar certificado (.cer) si se proporciona
            if (cerFileContent != null && cerFileContent.Length > 0)
            {
                existingBillingManagement.CerFileContent = cerFileContent;
                _logger.LogInformation("Certificate updated for idRoot {IdRoot}. Size: {Size} bytes",
                    idRoot, cerFileContent.Length);
            }

            // Actualizar llave privada (.key) si se proporciona
            if (keyFileContent != null && keyFileContent.Length > 0)
            {
                existingBillingManagement.KeyFileContent = keyFileContent;
                _logger.LogInformation("Key file updated for idRoot {IdRoot}. Size: {Size} bytes",
                    idRoot, keyFileContent.Length);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Certificates updated successfully for idRoot {IdRoot}", idRoot);
            return existingBillingManagement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating certificates for billing config with ID {IdRoot}", idRoot);
            throw;
        }
    }

    private string GenerateSello(string cadenaOriginal, byte[] keyFileContent, string password)
    {
        try
        {
            using var rsa = RSA.Create();

            // Detectar si el contenido es PEM (texto) o DER (binario)
            var isPem = keyFileContent.Length > 0 && keyFileContent[0] == 0x2D; // '-' (starts with "-----BEGIN")

            if (isPem)
            {
                // Es PEM, convertir a string e importar
                var keyPem = Encoding.UTF8.GetString(keyFileContent);
                _logger.LogDebug("Detected PEM format key file");

                try
                {
                    rsa.ImportFromEncryptedPem(keyPem, password);
                    _logger.LogDebug("Successfully imported PEM key");
                }
                catch (CryptographicException ex)
                {
                    _logger.LogError(ex, "Failed to import PEM key - invalid password or corrupted file");
                    throw new CryptographicException("Contraseña incorrecta o archivo .key PEM corrupto", ex);
                }
            }
            else
            {
                // Es DER (PKCS#8 encriptado) - formato nativo del SAT
                _logger.LogDebug("Detected DER/PKCS#8 format key file (SAT native format)");

                var passwordBytes = Encoding.UTF8.GetBytes(password);

                try
                {
                    rsa.ImportEncryptedPkcs8PrivateKey(passwordBytes, keyFileContent, out _);
                    _logger.LogDebug("Successfully imported DER/PKCS#8 encrypted key");
                }
                catch (CryptographicException ex)
                {
                    _logger.LogError(ex, "Failed to import DER key - invalid password or corrupted file");
                    throw new CryptographicException("Contraseña incorrecta o archivo .key corrupto", ex);
                }
            }

            // Generar firma
            var dataBytes = Encoding.UTF8.GetBytes(cadenaOriginal);
            var signedBytes = rsa.SignData(dataBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

            return Convert.ToBase64String(signedBytes);
        }
        catch (CryptographicException)
        {
            // Re-lanzar excepciones criptográficas (ya tienen mensaje apropiado)
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating sello");
            throw new Exception("Error al generar el sello digital: " + ex.Message, ex);
        }
    }

    private async Task<InvoiceStampResult> StampWithFinkok(string signedXml, int idIncomeExpense)
    {
        var username = _configuration["Finkok:Username"];
        var password = _configuration["Finkok:Password"];
        var environment = _configuration["Finkok:Environment"] ?? "demo";
        var url = environment.ToLower() == "demo"
            ? _configuration["Finkok:UrlDemo"]
            : _configuration["Finkok:UrlProd"];

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            _logger.LogError("Finkok credentials not configured in appsettings.json");
            throw new Exception("Finkok credentials not configured. Verifica la configuración en appsettings.json");
        }

        if (string.IsNullOrEmpty(url))
        {
            _logger.LogError("Finkok URL not configured for environment: {Environment}", environment);
            throw new Exception($"Finkok URL not configured for environment: {environment}");
        }

        _logger.LogInformation("Attempting to stamp invoice with Finkok. Environment: {Environment}, URL: {Url}",
            environment, url);

        // DEBUG: Log del XML COMPLETO que se va a enviar a Finkok
        _logger.LogInformation("=== XML COMPLETO A ENVIAR A FINKOK ===");
        _logger.LogInformation("{SignedXml}", signedXml);
        _logger.LogInformation("=== FIN XML ===");

        var xmlBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(signedXml));

        var soapEnvelope = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<soap:Envelope xmlns:soap=""http://schemas.xmlsoap.org/soap/envelope/"" xmlns:tns=""http://facturacion.finkok.com/stamp"">
   <soap:Body>
      <tns:stamp>
         <tns:xml>{xmlBase64}</tns:xml>
         <tns:username>{username}</tns:username>
         <tns:password>{password}</tns:password>
      </tns:stamp>
   </soap:Body>
</soap:Envelope>";

        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
        content.Headers.Add("SOAPAction", "");

        try
        {
            _logger.LogDebug("Sending SOAP request to Finkok...");
            var response = await client.PostAsync(url, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogDebug("Finkok response status: {StatusCode}", response.StatusCode);
            _logger.LogDebug("Finkok response: {Response}", responseContent);

            // Parsear la respuesta (puede contener éxito o error)
            var finkokResponse = ParseFinkokResponse(responseContent);

            if (!finkokResponse.Success)
            {
                _logger.LogError("Finkok returned error: Code={Code}, Message={Message}, Detail={Detail}",
                    finkokResponse.Error?.Code,
                    finkokResponse.Error?.Message,
                    finkokResponse.Error?.DetailedMessage);

                var errorMsg = finkokResponse.Error != null
                    ? $"Error {finkokResponse.Error.Code}: {finkokResponse.Error.DetailedMessage}"
                    : "Error desconocido en el timbrado";

                throw new FinkokStampException(errorMsg, finkokResponse.Error);
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Finkok HTTP error. Status: {Status}, Response: {Response}",
                    response.StatusCode, responseContent);
                throw new Exception($"Finkok HTTP error {response.StatusCode}: {responseContent}");
            }

            return new InvoiceStampResult
            {
                Uuid = finkokResponse.Uuid!,
                StampedXml = finkokResponse.StampedXml!,
                FechaTimbrado = finkokResponse.FechaTimbrado ?? DateTime.Now,
                SelloSat = finkokResponse.SelloSat,
                NoCertificadoSat = finkokResponse.NoCertificadoSat,
                Success = true
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error calling Finkok service at {Url}", url);
            throw new Exception($"Error de conexión con Finkok: {ex.Message}. Verifica tu conexión a internet y que la URL sea correcta.", ex);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogError(ex, "Timeout calling Finkok service");
            throw new Exception("Tiempo de espera agotado al conectar con Finkok. El servicio puede estar temporalmente no disponible.", ex);
        }
        catch (FinkokStampException)
        {
            // Re-lanzar excepciones de Finkok sin modificar
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Finkok stamping");
            throw new Exception($"Error inesperado durante el timbrado: {ex.Message}", ex);
        }
    }

    private FinkokStampResponse ParseFinkokResponse(string soapResponse)
    {
        try
        {
            var doc = XDocument.Parse(soapResponse);
            XNamespace soapNs = "http://schemas.xmlsoap.org/soap/envelope/";

            // Primero buscar errores en el SOAP Fault
            var fault = doc.Descendants(soapNs + "Fault").FirstOrDefault();
            if (fault != null)
            {
                var faultCode = fault.Element("faultcode")?.Value ?? "SOAP_ERROR";
                var faultString = fault.Element("faultstring")?.Value ?? "Error en SOAP";

                _logger.LogError("SOAP Fault detected: {FaultCode} - {FaultString}", faultCode, faultString);

                return new FinkokStampResponse
                {
                    Success = false,
                    Error = new FinkokError
                    {
                        Code = faultCode,
                        Message = "Error SOAP",
                        DetailedMessage = faultString
                    }
                };
            }

            // Buscar la respuesta de stamp - buscar sin namespace primero
            var stampResult = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "stampResult");
            if (stampResult == null)
            {
                _logger.LogError("stampResult element not found in response");
                throw new Exception("Formato de respuesta de Finkok inválido: no se encontró stampResult");
            }

            // Verificar si hay errores en la respuesta
            var errorElement = stampResult.Descendants().FirstOrDefault(e => e.Name.LocalName == "Incidencias")
                ?? stampResult.Descendants().FirstOrDefault(e => e.Name.LocalName == "error");

            if (errorElement != null)
            {
                _logger.LogDebug("Error element found in Finkok response: {ErrorElement}",
                    errorElement.ToString().Substring(0, Math.Min(500, errorElement.ToString().Length)));

                var errorIncidencias = errorElement.Descendants().FirstOrDefault(e => e.Name.LocalName == "Incidencia");
                if (errorIncidencias != null)
                {
                    var errorCode = errorIncidencias.Descendants().FirstOrDefault(e => e.Name.LocalName == "CodigoError")?.Value ?? "UNKNOWN";
                    var errorMsg = errorIncidencias.Descendants().FirstOrDefault(e => e.Name.LocalName == "MensajeIncidencia")?.Value ?? "Error desconocido";
                    var incidenceId = errorIncidencias.Descendants().FirstOrDefault(e => e.Name.LocalName == "IdIncidencia")?.Value;

                    var detailedMsg = FinkokErrorCodes.GetErrorDescription(errorCode);
                    if (detailedMsg.StartsWith("Error desconocido"))
                    {
                        detailedMsg = errorMsg; // Usar el mensaje de Finkok si no tenemos uno mapeado
                    }

                    _logger.LogError("Finkok error detected: Code={Code}, Message={Message}, IncidenceId={Id}",
                        errorCode, errorMsg, incidenceId);

                    return new FinkokStampResponse
                    {
                        Success = false,
                        Error = new FinkokError
                        {
                            Code = errorCode,
                            Message = errorMsg,
                            DetailedMessage = detailedMsg,
                            IncidenceId = incidenceId
                        }
                    };
                }
            }

            // Si no hay errores, procesar el XML timbrado
            var xmlElement = stampResult.Descendants().FirstOrDefault(e => e.Name.LocalName == "xml");
            var uuidElement = stampResult.Descendants().FirstOrDefault(e => e.Name.LocalName == "UUID");
            var fechaElement = stampResult.Descendants().FirstOrDefault(e => e.Name.LocalName == "Fecha");

            if (xmlElement == null || string.IsNullOrEmpty(xmlElement.Value))
            {
                _logger.LogError("XML element not found or empty in Finkok response");
                return new FinkokStampResponse
                {
                    Success = false,
                    Error = new FinkokError
                    {
                        Code = "NO_XML",
                        Message = "XML timbrado no encontrado",
                        DetailedMessage = "La respuesta de Finkok no contiene el XML timbrado. Puede ser un error de comunicación."
                    }
                };
            }

            // Decodificar el XML
            var stampedXmlBase64 = xmlElement.Value;

            // Log para debug
            _logger.LogDebug("XML element value (first 100 chars): {Value}",
                stampedXmlBase64?.Substring(0, Math.Min(100, stampedXmlBase64?.Length ?? 0)));

            if (string.IsNullOrWhiteSpace(stampedXmlBase64))
            {
                _logger.LogError("XML element is empty or whitespace");
                return new FinkokStampResponse
                {
                    Success = false,
                    Error = new FinkokError
                    {
                        Code = "EMPTY_XML",
                        Message = "El XML devuelto por Finkok está vacío",
                        DetailedMessage = "La respuesta de Finkok no contiene datos en el elemento XML."
                    }
                };
            }

            string stampedXml;

            // Verificar si el contenido ya es XML (sin codificar en Base64)
            // Finkok devuelve XML plano cuando hay un timbre previo (error 307)
            if (stampedXmlBase64.TrimStart().StartsWith("<?xml") || stampedXmlBase64.TrimStart().StartsWith("<cfdi:"))
            {
                _logger.LogDebug("XML element contains plain XML (not Base64)");
                stampedXml = stampedXmlBase64;
            }
            else
            {
                // Intentar decodificar Base64
                try
                {
                    stampedXml = Encoding.UTF8.GetString(Convert.FromBase64String(stampedXmlBase64));
                }
                catch (FormatException ex)
                {
                    _logger.LogError(ex, "Invalid Base64 in XML element. Content: {Content}",
                        stampedXmlBase64.Substring(0, Math.Min(200, stampedXmlBase64.Length)));
                    return new FinkokStampResponse
                    {
                        Success = false,
                        Error = new FinkokError
                        {
                            Code = "INVALID_BASE64",
                            Message = "El XML devuelto no está en formato Base64 válido",
                            DetailedMessage = $"Contenido recibido: {stampedXmlBase64.Substring(0, Math.Min(200, stampedXmlBase64.Length))}"
                        }
                    };
                }
            }

            _logger.LogDebug("Stamped XML decoded successfully");

            // Extraer información del timbre fiscal del XML
            var xmlDoc = XDocument.Parse(stampedXml);
            XNamespace cfdi = "http://www.sat.gob.mx/cfd/4";
            XNamespace tfd = "http://www.sat.gob.mx/TimbreFiscalDigital";

            var timbre = xmlDoc.Descendants(tfd + "TimbreFiscalDigital").FirstOrDefault();

            if (timbre == null)
            {
                _logger.LogWarning("TimbreFiscalDigital not found in stamped XML");
            }

            var uuid = timbre?.Attribute("UUID")?.Value
                ?? uuidElement?.Value;

            if (string.IsNullOrEmpty(uuid))
            {
                _logger.LogError("UUID not found in stamped XML or Finkok response");
                return new FinkokStampResponse
                {
                    Success = false,
                    Error = new FinkokError
                    {
                        Code = "NO_UUID",
                        Message = "UUID no encontrado",
                        DetailedMessage = "No se pudo obtener el UUID del comprobante timbrado."
                    }
                };
            }

            var fechaTimbrado = timbre?.Attribute("FechaTimbrado")?.Value;
            var selloSat = timbre?.Attribute("SelloSAT")?.Value;
            var noCertificadoSat = timbre?.Attribute("NoCertificadoSAT")?.Value;

            DateTime parsedFecha = DateTime.Now;
            if (!string.IsNullOrEmpty(fechaTimbrado))
            {
                if (!DateTime.TryParse(fechaTimbrado, out parsedFecha))
                {
                    _logger.LogWarning("Could not parse FechaTimbrado: {Fecha}", fechaTimbrado);
                }
            }

            _logger.LogInformation("Invoice stamped successfully. UUID: {UUID}", uuid);

            return new FinkokStampResponse
            {
                Success = true,
                Uuid = uuid,
                StampedXml = stampedXml,
                FechaTimbrado = parsedFecha,
                SelloSat = selloSat,
                NoCertificadoSat = noCertificadoSat
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Finkok response. Response content: {Response}",
                soapResponse.Substring(0, Math.Min(500, soapResponse.Length)));

            return new FinkokStampResponse
            {
                Success = false,
                Error = new FinkokError
                {
                    Code = "PARSE_ERROR",
                    Message = "Error al interpretar respuesta de Finkok",
                    DetailedMessage = $"No se pudo procesar la respuesta del PAC: {ex.Message}"
                }
            };
        }
    }

    private async Task UpdateInvoiceAfterStamp(
        int idIncomeExpense,
        BillingManagement config,
        InvoiceStampResult stampResult)
    {
        var income = await _context.Incomeandexpenses.FindAsync(idIncomeExpense);
        if (income == null)
            throw new Exception("Income/Expense not found for update");

        income.Uuid = stampResult.Uuid;
        income.XmlTimbrado = stampResult.StampedXml;
        income.FechaCertificacion = stampResult.FechaTimbrado;
        income.SelloSat = stampResult.SelloSat;
        income.CertificadoNum = stampResult.NoCertificadoSat;
        income.RfcProveedorCertif = "SAT970701NN3";
        income.Facturado = true;
        income.DateStamped = DateTime.Now;

        // Asignar serie y folio si no los ten�a
        if (string.IsNullOrEmpty(income.Serie))
            income.Serie = config.Prefix;

        if (string.IsNullOrEmpty(income.Folio))
            income.Folio = config.Consecutive.ToString();

        // Incrementar consecutivo para la siguiente factura
        config.Consecutive++;

        // Marcar el config como modificado para que Entity Framework lo actualice
        _context.BillingManagement.Update(config);

        await _context.SaveChangesAsync();

        _logger.LogInformation("Invoice updated successfully. UUID: {UUID}, Folio: {Folio}, Next consecutive: {Next}",
            income.Uuid, income.Folio, config.Consecutive);
    }
}

public interface IBillingManagementService
{
    Task<List<BillingManagement>> ConfigByRoot(int idRoot);
    Task Save(BillingManagement billingManagement);
    Task<BillingManagement?> Update(int idRoot, BillingManagement billingManagement);
    Task<InvoiceStampResult> GenerateAndStampInvoice(int idIncomeExpense);
    Task<BillingManagement?> UpdateCertificates(int idRoot, byte[]? cerFileContent, byte[]? keyFileContent);
    Task<BillingManagement?> UpdateConsecutiveAsync(int idRoot, int nuevoConsecutivo);
}

public class InvoiceStampResult
{
    public string Uuid { get; set; } = string.Empty;
    public string StampedXml { get; set; } = string.Empty;
    public DateTime FechaTimbrado { get; set; }
    public string? SelloSat { get; set; }
    public string? NoCertificadoSat { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}