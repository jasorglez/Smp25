
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("attach")]
    public class Attach
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("idTabla")]
        public int? IdTabla { get; set; } // Foreign key reference (nullable)

        [Column("docto", TypeName = "varchar(250)")]
        public string? Docto { get; set; } // Column for storing image file paths

        [Column("typedocto", TypeName = "varchar(10)")]
        public string? TypeDocto { get; set; } // Column for storing type

        [Column("type", TypeName = "varchar(10)")]
        public string? Type { get; set; } // Column for storing type

        [Column("active")]
        public short Active { get; set; } = 1;
    }
}
