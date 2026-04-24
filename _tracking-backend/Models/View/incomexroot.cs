using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("incomexroot")]
    public class Incomexroot
    {
        [Column("idroot")]
        public int Idroot { get; set; }

        [Column("nameroot")]
        public string Nameroot { get; set; }

        [Column("namebranch")]
        public string Namebranch { get; set; }

        [Column("idIncome")]
        public int IdIncome { get; set; }

        [Column("fechaingreso")]
        public DateTime Fechaingreso { get; set; }

        [Column("incomemonth")]
        public string? Incomemonth { get; set; }

        [Column("Descriptionincome")]
        public string? Descriptionincome { get; set; }

        [Column("totalincome", TypeName = "decimal(18,2)")]
        public decimal Totalincome { get; set; }

        [Column("statusincome")]
        public string? Statusincome { get; set; }

        [Column("typeincome")]
        public string? Typeincome { get; set; }

        [Column("id_incorexp")]
        public int? Id_incorexp { get; set; }

        [Column("quantity", TypeName = "decimal(18,2)")]
        public decimal Quantity { get; set; }

        [Column("descconcepto")]
        public string? Descconcepto { get; set; }

        [Column("unit")]
        public string? Unit { get; set; }

        [Column("price", TypeName = "decimal(18,2)")]
        public decimal? Price { get; set; }

        [Column("totalconcepto", TypeName = "decimal(18,2)")]
        public decimal Totalconcepto { get; set; }

        [Column("idcustomer")]
        public int Idcustomer { get; set; }

        [Column("countitems")]
        public int? Countitems { get; set; }

        [Column("oc")]
        [StringLength(20)]
        public string? Oc { get; set; }

        [Column("id_project")]
        public int? IdProject { get; set; }

        [Column("company")]
        public string Company { get; set; }
    }
}