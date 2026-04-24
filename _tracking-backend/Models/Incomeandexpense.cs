using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("incomeandexpense")]
    public class Incomeandexpense
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [StringLength(25)]
        public string? NumberDocument { get; set; }

        [Column("id_businnes")]
        public int? IdBusinnes { get; set; }

        [Column("id_project")]
        public int? IdProject { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("id_account")]
        public int? IdAccount { get; set; }

        public DateTime? Date { get; set; }

        [Column("id_customer")]
        public int? IdCustomer { get; set; }

        [Column("id_billing_config")]
        public int? IdBillingConfig { get; set; }

        [Column("id_customer_billing")]
        public int? IdCustomerBilling { get; set; }

        [Column("id_expend")]
        public int? IdExpend { get; set; }

        [Column("id_expendxcategr")]
        public int? idExpendxcategr { get; set; }

        [Column("id_cuenta_contable")]
        public int? IdCuentaContable { get; set; }

        [Column("id_objeto_gasto")]
        public int? IdObjetoGasto { get; set; }

        [Column("id_typecomp")]
        public int? IdTypeComp { get; set; }

        [Column("payment_month")]
        public string? PaymentMonth { get; set; }

        [StringLength(255)]
        public string? Uuid { get; set; }

        public DateTime? DateStamped { get; set; }

        public string? Description { get; set; }

        [StringLength(19)]
        public string? Type { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Subtotal { get; set; }

        [Column(TypeName = "decimal(14,2)")]
        public decimal Tax { get; set; }

        [Column(TypeName = "decimal(14,2)")]
        public decimal Isr { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalComp { get; set; }

        [StringLength(50)]
        public string? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; }

        [StringLength(50)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        [StringLength(20)]
        public string? Status { get; set; } = "Pendiente";

        // Campos nuevos para facturación
        [Column("serie")]
        [StringLength(25)]
        public string? Serie { get; set; }

        [Column("folio")]
        [StringLength(40)]
        public string? Folio { get; set; }
              
        [Column("forma_pago")]
        [StringLength(5)]
        public string? FormaPago { get; set; }

        [Column("metodo_pago")]
        [StringLength(10)]
        public string? MetodoPago { get; set; }

        [Column("tipo_comprobante")]
        [StringLength(2)]
        public string? TipoComprobante { get; set; }

        [Column("moneda")]
        [StringLength(5)]
        public string? Moneda { get; set; } = "MXN";

        [Column("tipo_cambio")]
        public decimal? TipoCambio { get; set; }

        [Column("lugar_expedicion")]
        [StringLength(5)]
        public string? LugarExpedicion { get; set; }

        [Column("certificado_num")]
        [StringLength(20)]
        public string? CertificadoNum { get; set; }

        [Column("sello_digital")]
        public string? SelloDigital { get; set; }

        [Column("sello_sat")]
        public string? SelloSat { get; set; }

        [Column("cadena_original")]
        public string? CadenaOriginal { get; set; }

        [Column("xml_original")]
        public string? XmlOriginal { get; set; }

        [Column("xml_timbrado")]
        public string? XmlTimbrado { get; set; }

        [Column("fecha_certificacion")]
        public DateTime? FechaCertificacion { get; set; }

        [Column("rfc_proveedor_certif")]
        [StringLength(13)]
        public string? RfcProveedorCertif { get; set; } = "SAT970701NN3";

        [Column("facturado")]
        public bool? Facturado { get; set; } = false;

        [Column("cancelado")]
        public bool? Cancelado { get; set; } = false;

        [Column("fecha_cancelacion")]
        public DateTime? FechaCancelacion { get; set; }

        [Column("motivo_cancelacion")]
        [StringLength(5)]
        public string? MotivoCancelacion { get; set; }

        [Column("countdocomps")]
        public int? CountDocomps { get; set; }

        [Column("countitems")]
        public int? CountItems { get; set; }

        [Column("mostrartodo")]

        public bool? Mostrartodo { get; set; } = false;

        [Column("oc")]
        [StringLength(20)]
        public string? Oc { get; set; } 

        public bool Active { get; set; } = true;

        [Column("id_authorize")]
        public int? IdAuthorize { get; set; }

        [Column("authorize_name")]
        [StringLength(100)]
        public string? AuthorizeName { get; set; }

        [Column("authorization_status")]
        [StringLength(20)]
        public string? AuthorizationStatus { get; set; } = "Pendiente";

        [Column("rejection_reason")]
        [StringLength(500)]
        public string? RejectionReason { get; set; }

        [Column("authorized_at")]
        public DateTime? AuthorizedAt { get; set; }

        [Column("id_transfer_ref")]
        public int? IdTransferRef { get; set; }
    }
}


