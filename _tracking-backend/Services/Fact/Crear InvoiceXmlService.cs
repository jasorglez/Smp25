
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;
using System.Net.NetworkInformation;
using System.Text;
using System.Xml;

namespace MicroServicioTracking.Services.Fact;

public class InvoiceXmlService : IInvoiceXmlService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<InvoiceXmlService> _logger;

    public InvoiceXmlService(DbTrackingContext context, ILogger<InvoiceXmlService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<string> GenerateInvoiceXml(int idIncomeExpense)
    {
        // 1. Obtener el ingreso/egreso
        var income = await _context.Incomeandexpenses
            .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

        if (income == null)
            throw new Exception($"Income/Expense with ID {idIncomeExpense} not found");

        // 2. Obtener configuración de facturación
        var billing = await _context.BillingManagement
            .FirstOrDefaultAsync(b => b.Id == income.IdBillingConfig && b.Active);

        if (billing == null)
            throw new Exception("Billing configuration not found");

        // Validar datos del emisor
        if (string.IsNullOrEmpty(billing.EmisorRfc))
            throw new Exception("Emisor RFC not configured in billing management");

        // 3. Obtener datos del cliente
        var customerBilling = await _context.CustomersBillings
            .FirstOrDefaultAsync(cb => cb.Id == income.IdCustomerBilling && cb.Active);

        if (customerBilling == null)
            throw new Exception("Customer billing information not found");

        // 4. Obtener conceptos
        var concepts = await _context.ConceptsxIncorExps
            .Where(c => c.IdIncorExp == idIncomeExpense && c.Active)
            .ToListAsync();

        if (!concepts.Any())
            throw new Exception("No concepts found for this invoice");

        // 5. Generar el XML
        return BuildCfdiXml(income, billing, customerBilling, concepts);
    }

    private string BuildCfdiXml(
        Incomeandexpense income,
        BillingManagement billing,
        CustomersBilling customer,
        List<ConceptsxIncorExp> concepts)
    {
        var sb = new StringBuilder();
        var settings = new XmlWriterSettings
        {
            Indent = false,
            OmitXmlDeclaration = false,
            Encoding = Encoding.UTF8
        };

        using (var writer = XmlWriter.Create(sb, settings))
        {
            writer.WriteStartDocument();

            // Comprobante
            writer.WriteStartElement("cfdi", "Comprobante", "http://www.sat.gob.mx/cfd/4");
            writer.WriteAttributeString("xmlns", "xsi", null, "http://www.w3.org/2001/XMLSchema-instance");
            writer.WriteAttributeString("xsi", "schemaLocation", null,
                "http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd");

            // IMPORTANTE: El orden de los atributos DEBE coincidir con el orden usado en la cadena original
            // Este orden está definido en el XSLT oficial del SAT
            writer.WriteAttributeString("Version", "4.0");
            writer.WriteAttributeString("Serie", income.Serie ?? billing.Prefix);
            writer.WriteAttributeString("Folio", income.Folio ?? billing.Consecutive.ToString());
            writer.WriteAttributeString("Fecha", income.Date?.ToString("yyyy-MM-ddTHH:mm:ss")
                ?? DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"));
            writer.WriteAttributeString("FormaPago", income.FormaPago ?? "99");

            // NoCertificado y Certificado se agregarán DESPUÉS en BillingManagementService (línea 226-227)
            // Aquí dejamos espacio conceptual para: NoCertificado, CondicionesDePago

            writer.WriteAttributeString("SubTotal", income.Subtotal.ToString("F2"));

            // Descuento - opcional, se omite si no existe
            // (income.Descuento no existe en el modelo actual)

            writer.WriteAttributeString("Moneda", income.Moneda ?? "MXN");

            if (income.TipoCambio.HasValue && income.Moneda != "MXN")
                writer.WriteAttributeString("TipoCambio", income.TipoCambio.Value.ToString("F6"));

            writer.WriteAttributeString("Total", income.Total.ToString("F2"));
            writer.WriteAttributeString("TipoDeComprobante", income.TipoComprobante ?? "I");
            writer.WriteAttributeString("Exportacion", "01");
            writer.WriteAttributeString("MetodoPago", income.MetodoPago ?? "PUE");
            writer.WriteAttributeString("LugarExpedicion", income.LugarExpedicion ?? billing.EmisorCp ?? "00000");

            // Emisor - usando datos de billing
            writer.WriteStartElement("cfdi", "Emisor", null);
            writer.WriteAttributeString("Rfc", billing.EmisorRfc);
            writer.WriteAttributeString("Nombre", billing.EmisorNombre ?? "");
            writer.WriteAttributeString("RegimenFiscal", billing.FiscalRegime.ToString());
            writer.WriteEndElement(); // Emisor

            // Receptor
            writer.WriteStartElement("cfdi", "Receptor", null);
            writer.WriteAttributeString("Rfc", customer.Rfc);
            writer.WriteAttributeString("Nombre", customer.NombreFiscal);
            writer.WriteAttributeString("DomicilioFiscalReceptor", customer.CodigoPostal);
            writer.WriteAttributeString("RegimenFiscalReceptor", customer.RegimenFiscal);
            writer.WriteAttributeString("UsoCFDI", customer.UsoCfdi);
            writer.WriteEndElement(); // Receptor

            // Conceptos
            writer.WriteStartElement("cfdi", "Conceptos", null);

            foreach (var concept in concepts)
            {
                writer.WriteStartElement("cfdi", "Concepto", null);
                writer.WriteAttributeString("ClaveProdServ", concept.ClaveProdServ ?? "01010101");
                writer.WriteAttributeString("ClaveUnidad", concept.ClaveUnidad ?? "ACT");

                if (!string.IsNullOrEmpty(concept.NumeroIdentificacion))
                    writer.WriteAttributeString("NoIdentificacion", concept.NumeroIdentificacion);

                // Quantity y Price NO son nullable
                writer.WriteAttributeString("Cantidad", concept.Quantity.ToString("F6"));
                writer.WriteAttributeString("Unidad", concept.Unit ?? "Servicio");
                writer.WriteAttributeString("Descripcion", concept.Description ?? "");
                writer.WriteAttributeString("ValorUnitario", concept.Price.ToString("F6"));

                var importe = concept.Quantity * concept.Price;
                writer.WriteAttributeString("Importe", importe.ToString("F2"));

                // Descuento SÍ es nullable
                if (concept.Descuento.HasValue && concept.Descuento.Value > 0)
                    writer.WriteAttributeString("Descuento", concept.Descuento.Value.ToString("F2"));

                writer.WriteAttributeString("ObjetoImp", concept.ObjetoImp ?? "02");

                // Si tiene impuestos (ObjetoImp = 02)
                if (concept.ObjetoImp == "02" && concept.Iva)
                {
                    writer.WriteStartElement("cfdi", "Impuestos", null);
                    writer.WriteStartElement("cfdi", "Traslados", null);
                    writer.WriteStartElement("cfdi", "Traslado", null);

                    var baseImponible = importe - (concept.Descuento ?? 0m);
                    writer.WriteAttributeString("Base", baseImponible.ToString("F2"));
                    writer.WriteAttributeString("Impuesto", "002"); // IVA
                    writer.WriteAttributeString("TipoFactor", "Tasa");
                    writer.WriteAttributeString("TasaOCuota", (billing.IIva / 100m).ToString("F6"));

                    var importeIva = baseImponible * (billing.IIva / 100m);
                    writer.WriteAttributeString("Importe", importeIva.ToString("F2"));

                    writer.WriteEndElement(); // Traslado
                    writer.WriteEndElement(); // Traslados
                    writer.WriteEndElement(); // Impuestos
                }

                writer.WriteEndElement(); // Concepto
            }

            writer.WriteEndElement(); // Conceptos

            // Impuestos totales (si hay IVA)
            // IMPORTANTE: Según Anexo 20 del SAT, cuando se usa ObjetoImp="02",
            // los impuestos van desglosados en los conceptos Y también se deben
            // incluir los nodos <cfdi:Traslados> a nivel raíz para validación CFDI40215.
            if (income.Tax > 0)
            {
                writer.WriteStartElement("cfdi", "Impuestos", null);
                writer.WriteAttributeString("TotalImpuestosTrasladados", income.Tax.ToString("F2"));

                // Nodo Traslados (requerido para validación CFDI40215)
                writer.WriteStartElement("cfdi", "Traslados", null);
                writer.WriteStartElement("cfdi", "Traslado", null);
                writer.WriteAttributeString("Base", income.Subtotal.ToString("F2"));
                writer.WriteAttributeString("Impuesto", "002");
                writer.WriteAttributeString("TipoFactor", "Tasa");
                writer.WriteAttributeString("TasaOCuota", (billing.IIva / 100m).ToString("F6"));
                writer.WriteAttributeString("Importe", income.Tax.ToString("F2"));
                writer.WriteEndElement(); // Traslado
                writer.WriteEndElement(); // Traslados

                writer.WriteEndElement(); // Impuestos
            }

            writer.WriteEndElement(); // Comprobante
            writer.WriteEndDocument();
        }

        return sb.ToString();
    }
}

public interface IInvoiceXmlService
{
    Task<string> GenerateInvoiceXml(int idIncomeExpense);
}