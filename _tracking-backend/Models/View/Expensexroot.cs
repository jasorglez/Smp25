using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("expensexroot")]
    public class Expensexroot
    {
        // Orden EXACTO según la vista SQL (sin active y activoconcepto)
        [Key]
        [Column("idroot")]
        public int Idroot { get; set; }

        [Column("name")]
        public string Name { get; set; }

        [Column("namebranch")]
        public string Namebranch { get; set; }

        [Column("idincomeorexpense")]
        public int Idincomeorexpense { get; set; }

        [Column("numberdocument")]
        public string? Numberdocument { get; set; }

        [Column("id_account")]
        public int? Id_account { get; set; }

        [Column("id_businnes")]
        public int? Id_businnes { get; set; }

        [Column("id_branch")]
        public int Id_branch { get; set; }

        [Column("date")]
        public DateTime Date { get; set; }

        [Column("id_customer")]
        public int? Id_customer { get; set; }

        [Column("id_expend")]
        public int? Id_expend { get; set; }

        [Column("uuid")]
        public string Uuid { get; set; }

        [Column("datestamped")]
        public DateTime? Datestamped { get; set; }

        [Column("payment_month")]
        public string? Payment_month { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("subtotal", TypeName = "decimal(18,2)")]
        public decimal? Subtotal { get; set; }

        [Column("tax", TypeName = "decimal(18,2)")]
        public decimal? Tax { get; set; }

        [Column("total", TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }

        [Column("status")]
        public string Status { get; set; }

        [Column("type")]
        public string? Type { get; set; }

        [Column("id_incorexp")]
        public int? Id_incorexp { get; set; }

        [Column("typeexpense")]
        public string Typeexpense { get; set; }

        [Column("id_spend")]
        public int? Id_spend { get; set; }

        [Column("dateexpend")]
        public DateTime? Dateexpend { get; set; }

        [Column("quantity", TypeName = "decimal(18,2)")]
        public decimal? Quantity { get; set; }

        [Column("descconcepto")]
        public string? Descconcepto { get; set; }

        [Column("unit")]
        public string? Unit { get; set; }

        [Column("price", TypeName = "decimal(18,2)")]
        public decimal? Price { get; set; }
  

        [Column("iva2", TypeName = "decimal(18,2)")]
        public decimal? Iva2 { get; set; }

        [Column("totalconcepto", TypeName = "decimal(18,4)")]
        public decimal? Totalconcepto { get; set; }

        [Column("comment")]
        public string? Comment { get; set; }

        [Column("idempleado")]
        public int? Idempleado { get; set; }

        [Column("nameempleado")]
        public string? Nameempleado { get; set; }

        [Column("idcustomer")]
        public int? Idcustomer { get; set; }

        [Column("company")]
        public string?   Company { get; set; }

        [Column("countitems")]
        public int? Countitems { get; set; }
    }
}