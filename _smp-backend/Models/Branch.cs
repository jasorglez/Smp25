
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{
    [Table("branchs")]
    public class Branch
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [Column("id_estado")]
        public int? IdEstado { get; set; }

        [StringLength(20)]
        [Column("name", TypeName = "VARCHAR")]
        public string? Name { get; set; }

        [StringLength(50)]
        [Column("description", TypeName = "NVARCHAR")]
        public string? Description { get; set; }

        [StringLength(100)]
        [Column("address", TypeName = "NVARCHAR")]
        public string? Address { get; set; }
        
        [Column("orden")]
        public short? Orden { get; set; }

        [Column("vigente")]
        public bool? Vigente { get; set; } = true;

        [Column("active")]
        public bool? Active { get; set; } = true;
       
    }
}