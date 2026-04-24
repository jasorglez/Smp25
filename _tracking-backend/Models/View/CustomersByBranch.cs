using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("customersByBranch")]
    public class CustomersByBranch
    {
        [Column("idroot")]
        public int? idCompany { get; set; }

        [Column("namesmall")]
        public string? Namesmall { get; set; }

        [Column("id")]
        public int Id { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("nameBranch")]
        public string? NameBranch { get; set; }

        [Column("id_typecop")]
        public int? IdTypecop { get; set; }

        [Column("namecontact")]
        [MaxLength(150)]
        public string? NameContact { get; set; }

        [Column("company")]
        [MaxLength(150)]
        public string? Company { get; set; }

        [Column("rfc")]
        [MaxLength(15)]
        public string? Rfc { get; set; } = "SIN RFC";

        [Column("city")]
        [MaxLength(100)]
        public string? City { get; set; }

        [Column("address")]
        [MaxLength(200)]
        public string? Address { get; set; }

        [Column("addressfiscal")]
        [MaxLength(200)]
        public string? AddressFiscal { get; set; }

        [Column("cp")]
        [MaxLength(20)]
        public string? Cp { get; set; }

        [Column("state")]
        [MaxLength(35)]
        public string? State { get; set; }

        [Column("neighborhood")]
        [MaxLength(70)]
        public string? Neighborhood { get; set; }

        [Column("totalcredit", TypeName = "decimal(10,2)")]
        public decimal? Total { get; set; } = 0;

        [Column("radio")]
        public int? Radio { get; set; } = 20;

        [Column("phone")]
        [MaxLength(150)]
        public string? Phone { get; set; } = "SIN PHONE";

        [Column("mobile")]
        [MaxLength(20)]
        public string? Mobile { get; set; }

        [Column("email")]
        [MaxLength(40)]
        public string? Email { get; set; }

        [Column("vigente")]
        public bool? Vigente { get; set; } = true;

        [Column("Numcliente")]
        public int? NumCliente { get; set; }

        [Column("latitud")]
        [MaxLength(30)]
        public string? Latitud { get; set; }

        [Column("longitud")]
        [MaxLength(30)]
        public string? Longitud { get; set; }

        [Column("typecustomer")]
        [MaxLength(12)]
        public string? TypeCustomer { get; set; }

        [Column("type")]
        [MaxLength(10)]
        public string? Type { get; set; }
        
        [Column("type_int_or_ext")]
        public string? TypeIntOrExt { get; set; }

        [Column("fieldContact")]
        public int? FieldContact { get; set; }

        [Column("fieldBank")]
        public int? FieldBank { get; set; }

        [Column("fieldCuenta")]
        public int? FieldCuenta { get; set; }

        [Required]
        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
