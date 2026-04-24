using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Xml.Linq;

namespace MicroServicioTracking.Services.Fact;

/// <summary>
/// Servicio para generar PDFs de facturas electrónicas
/// </summary>
public class InvoicePdfService : IInvoicePdfService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<InvoicePdfService> _logger;

    public InvoicePdfService(
        DbTrackingContext context,
        ILogger<InvoicePdfService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Genera el PDF de una factura timbrada
    /// </summary>
    public async Task<byte[]> GenerateInvoicePdf(int idIncomeExpense)
    {
        _logger.LogInformation("Starting PDF generation for income/expense ID: {Id}", idIncomeExpense);

        // 1. Obtener datos de la factura
        var income = await _context.Incomeandexpenses
            .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

        if (income == null)
            throw new Exception($"Income/Expense with ID {idIncomeExpense} not found");

        if (income.Facturado != true || string.IsNullOrEmpty(income.Uuid))
            throw new Exception("La factura no ha sido timbrada. No se puede generar el PDF.");

        if (string.IsNullOrEmpty(income.XmlTimbrado))
            throw new Exception("XML timbrado no encontrado en la base de datos");

        // 2. Obtener configuración de facturación
        var billingConfig = await _context.BillingManagement
            .FirstOrDefaultAsync(b => b.Id == income.IdBillingConfig && b.Active);

        if (billingConfig == null)
            throw new Exception("Billing configuration not found");

        // 3. Obtener datos del cliente
        var customerBilling = await _context.CustomersBillings
            .FirstOrDefaultAsync(cb => cb.Id == income.IdCustomerBilling && cb.Active);

        if (customerBilling == null)
            throw new Exception("Customer billing information not found");

        // 4. Obtener conceptos
        var concepts = await _context.ConceptsxIncorExps
            .Where(c => c.IdIncorExp == idIncomeExpense && c.Active)
            .ToListAsync();

        // 5. Parsear XML timbrado para obtener datos del timbre
        var xmlData = ParseStampedXml(income.XmlTimbrado);

        // 6. Generar código QR
        var qrCodeBytes = GenerateQrCode(
            income.Uuid,
            billingConfig.EmisorRfc ?? "",
            customerBilling.Rfc,
            income.Total,
            income.SelloSat ?? "");

        // 7. Generar HTML del PDF
        var htmlContent = BuildInvoiceHtml(income, billingConfig, customerBilling, concepts, xmlData, qrCodeBytes);

        // 7. Convertir HTML a PDF
        var pdfBytes = ConvertHtmlToPdf(htmlContent);

        _logger.LogInformation("PDF generated successfully. Size: {Size} bytes", pdfBytes.Length);

        return pdfBytes;
    }

    private Dictionary<string, string> ParseStampedXml(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);
            XNamespace cfdi = "http://www.sat.gob.mx/cfd/4";
            XNamespace tfd = "http://www.sat.gob.mx/TimbreFiscalDigital";

            var timbre = doc.Descendants(tfd + "TimbreFiscalDigital").FirstOrDefault();

            return new Dictionary<string, string>
            {
                ["UUID"] = timbre?.Attribute("UUID")?.Value ?? "",
                ["FechaTimbrado"] = timbre?.Attribute("FechaTimbrado")?.Value ?? "",
                ["SelloCFD"] = timbre?.Attribute("SelloCFD")?.Value ?? "",
                ["SelloSAT"] = timbre?.Attribute("SelloSAT")?.Value ?? "",
                ["NoCertificadoSAT"] = timbre?.Attribute("NoCertificadoSAT")?.Value ?? "",
                ["RfcProvCertif"] = timbre?.Attribute("RfcProvCertif")?.Value ?? ""
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing stamped XML");
            return new Dictionary<string, string>();
        }
    }

    private byte[] GenerateQrCode(string uuid, string rfcEmisor, string rfcReceptor, decimal total, string selloSat)
    {
        try
        {
            // Formato del código QR según especificación del SAT
            var totalFormatted = total.ToString("F6");
            var selloLast8 = selloSat.Length >= 8 ? selloSat.Substring(selloSat.Length - 8) : selloSat;

            var qrContent = $"https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?" +
                           $"&id={uuid}" +
                           $"&re={rfcEmisor}" +
                           $"&rr={rfcReceptor}" +
                           $"&tt={totalFormatted}" +
                           $"&fe={selloLast8}";

            _logger.LogInformation("QR Code URL generated: {Url}", qrContent);

            // NOTA: Para generar el QR como imagen, necesitas instalar QRCoder:
            // dotnet add package QRCoder
            // Por ahora, retornamos un placeholder
            _logger.LogWarning("QR Code image generation not implemented. Install QRCoder package.");

            return Array.Empty<byte>();

            // Con QRCoder instalado, descomenta esto:
            /*
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(qrContent, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            return qrCode.GetGraphic(20);
            */
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating QR code");
            return Array.Empty<byte>();
        }
    }

    

    private string BuildInvoiceHtml(
        Incomeandexpense income,
        BillingManagement billingConfig,
        CustomersBilling customer,
        List<ConceptsxIncorExp> concepts,
        Dictionary<string, string> xmlData,
        byte[] qrCodeBytes)
    {
        var qrBase64 = Convert.ToBase64String(qrCodeBytes);

        var html = new StringBuilder();
        html.Append(@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <style>
        body { font-family: Arial, sans-serif; font-size: 10pt; margin: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .company-name { font-size: 16pt; font-weight: bold; color: #333; }
        .section-title { background-color: #4CAF50; color: white; padding: 5px; font-weight: bold; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; }
        .totals { float: right; width: 300px; }
        .qr-code { text-align: center; margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 8pt; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
        .stamp-info { font-size: 8pt; word-break: break-all; }
    </style>
</head>
<body>");

        // Encabezado
        html.Append($@"
    <div class=""header"">
        <div class=""company-name"">{billingConfig.EmisorNombre ?? "Emisor"}</div>
        <div>RFC: {billingConfig.EmisorRfc ?? ""}</div>
        <div>Régimen Fiscal: {billingConfig.FiscalRegime}</div>
    </div>");

        // Folio fiscal
        html.Append($@"
    <div class=""section-title"">FACTURA ELECTRÓNICA</div>
    <table>
        <tr>
            <td><strong>Serie:</strong> {income.Serie ?? ""}</td>
            <td><strong>Folio:</strong> {income.Folio ?? ""}</td>
            <td><strong>Fecha:</strong> {income.Date:yyyy-MM-dd HH:mm:ss}</td>
        </tr>
        <tr>
            <td colspan=""3""><strong>Folio Fiscal (UUID):</strong> {income.Uuid}</td>
        </tr>
    </table>");

        // Receptor
        html.Append($@"
    <div class=""section-title"">RECEPTOR</div>
    <table>
        <tr>
            <td><strong>Nombre:</strong> {customer.NombreFiscal}</td>
            <td><strong>RFC:</strong> {customer.Rfc}</td>
        </tr>
        <tr>
            <td><strong>Uso CFDI:</strong> {customer.UsoCfdi}</td>
            <td><strong>Código Postal:</strong> {customer.CodigoPostal}</td>
        </tr>
    </table>");

        // Conceptos
        html.Append(@"
    <div class=""section-title"">CONCEPTOS</div>
    <table>
        <thead>
            <tr>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Descripción</th>
                <th class=""text-right"">Precio Unitario</th>
                <th class=""text-right"">Importe</th>
            </tr>
        </thead>
        <tbody>");

        foreach (var concept in concepts)
        {
            var importe = concept.Quantity * concept.Price;
            html.Append($@"
            <tr>
                <td>{concept.Quantity:F2}</td>
                <td>{concept.Unit ?? ""}</td>
                <td>{concept.Description ?? ""}</td>
                <td class=""text-right"">${concept.Price:F2}</td>
                <td class=""text-right"">${importe:F2}</td>
            </tr>");
        }

        html.Append(@"
        </tbody>
    </table>");

        // Totales
        html.Append($@"
    <div class=""totals"">
        <table>
            <tr>
                <td><strong>Subtotal:</strong></td>
                <td class=""text-right"">${income.Subtotal:F2}</td>
            </tr>
            <tr>
                <td><strong>IVA:</strong></td>
                <td class=""text-right"">${income.Tax:F2}</td>
            </tr>
            <tr style=""background-color: #f2f2f2;"">
                <td><strong>TOTAL:</strong></td>
                <td class=""text-right""><strong>${income.Total:F2} {income.Moneda ?? "MXN"}</strong></td>
            </tr>
        </table>
    </div>
    <div style=""clear: both;""></div>");

        // Código QR y enlace de verificación
        var verificationUrl = $"https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?" +
                            $"&id={income.Uuid}" +
                            $"&re={billingConfig.EmisorRfc ?? ""}" +
                            $"&rr={customer.Rfc}" +
                            $"&tt={income.Total:F6}" +
                            $"&fe={(income.SelloSat?.Length >= 8 ? income.SelloSat.Substring(income.SelloSat.Length - 8) : income.SelloSat ?? "")}";

        html.Append($@"
    <div class=""qr-code"">");

        if (qrCodeBytes.Length > 0)
        {
            html.Append($@"
        <img src=""data:image/png;base64,{qrBase64}"" alt=""QR Code"" />");
        }

        html.Append($@"
        <div style=""margin-top: 10px; font-size: 9pt;"">
            <strong>Verificación SAT:</strong><br/>
            <a href=""{verificationUrl}"" target=""_blank"">Haz clic aquí para verificar la validez de este comprobante</a>
        </div>
        <div style=""margin-top: 5px; font-size: 7pt; word-break: break-all; color: #666;"">
            {verificationUrl}
        </div>
    </div>");

        // Información del timbre
        html.Append($@"
    <div class=""section-title"">TIMBRE FISCAL DIGITAL</div>
    <div class=""stamp-info"">
        <p><strong>Fecha y Hora de Certificación:</strong> {xmlData.GetValueOrDefault("FechaTimbrado", "")}</p>
        <p><strong>No. Certificado SAT:</strong> {xmlData.GetValueOrDefault("NoCertificadoSAT", "")}</p>
        <p><strong>Sello Digital del CFDI:</strong><br/>{xmlData.GetValueOrDefault("SelloCFD", "")}</p>
        <p><strong>Sello Digital del SAT:</strong><br/>{xmlData.GetValueOrDefault("SelloSAT", "")}</p>
    </div>");

        // Footer
        html.Append($@"
    <div class=""footer"">
        <p>Este documento es una representación impresa de un CFDI versión 4.0</p>
        <p>Generado el {DateTime.Now:yyyy-MM-dd HH:mm:ss}</p>
    </div>

</body>
</html>");

        return html.ToString();
    }

    private byte[] ConvertHtmlToPdf(string htmlContent)
    {
        // Por ahora, guardamos como HTML
        // Para producción, deberías usar una librería como:
        // - SelectPdf
        // - IronPDF
        // - DinkToPdf (wrapper de wkhtmltopdf)
        // - PuppeteerSharp (headless Chrome)

        _logger.LogWarning("HTML to PDF conversion not fully implemented. Returning HTML as bytes.");
        _logger.LogInformation("Consider installing a PDF library like SelectPdf, IronPDF, or DinkToPdf");

        // TEMPORAL: Devolver el HTML
        // En producción, esto debería convertir el HTML a PDF real
        return Encoding.UTF8.GetBytes(htmlContent);

        // Ejemplo con IronPDF (comentado, requiere instalar el paquete):
        /*
        var renderer = new IronPdf.ChromePdfRenderer();
        var pdf = renderer.RenderHtmlAsPdf(htmlContent);
        return pdf.BinaryData;
        */
    }
}

public interface IInvoicePdfService
{
    Task<byte[]> GenerateInvoicePdf(int idIncomeExpense);
}
