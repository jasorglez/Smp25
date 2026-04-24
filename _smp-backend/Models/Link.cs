using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    public class Link
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id", TypeName = "int")]
        public int Id { get; set; }

        [Column("id_workprogram", TypeName = "int")]
        public int? IdWorkprogram { get; set; }

        [Column("source", TypeName = "int")]
        public int? Source { get; set; }

        [Column("target", TypeName = "int")]
        public int? Target { get; set; }

        [Column("type", TypeName = "int")]
        public int? Type { get; set; }

        [Column("active")]
        public short? Active { get; set; } = 1;
    }
}
