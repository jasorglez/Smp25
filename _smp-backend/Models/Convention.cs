using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace SMP.Models
{

    [Table("conventions")]
    public class Convention
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]

        [Column("id", TypeName = "int")]
        public int Id { get; set; }
        
        [Column("id_contract", TypeName = "int")]
        public int? IdContract { get; set; }

        [Column("id_project", TypeName = "int")]
        public int? IdProject { get; set; }

        [Column("id_type", TypeName = "int")]
        public int? IdType { get; set; }

        [StringLength(10)]
        [Column("type", TypeName = "nvarchar(10)")]
        public string Type { get; set; } = "Contract";

        [StringLength(10)]
        [Column("name", TypeName = "nvarchar(10)")]
        public string? Name { get; set; } = "C-";

        [StringLength(250)]
        [Column("description", TypeName = "nvarchar(250)")]
        [DefaultValue("DESCRIPCION DEL CONVENIO")]
        public string Description { get; set; } = "DESCRIPCION DEL CONVENIO";

        [Column("start", TypeName = "date")]
        public DateTime? Start { get; set; }

        [Column("end", TypeName = "date")]
        public DateTime? End { get; set; }

        [Column("amountMX",TypeName = "decimal(16, 2)")]
        [DefaultValue(0.0)]
        public decimal AmountMX { get; set; } = 0.0M;

        [Column("amountDLL", TypeName = "decimal(16, 2)")]
        [DefaultValue(0.0)]
        public decimal AmountDLL { get; set; } = 0.0M;

        [StringLength(50)]
        [Column("comment",TypeName = "nvarchar(50)")]
        public string? Comment { get; set; }

        [Column("vigente")]
        public bool Vigente { get; set; } = true;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}