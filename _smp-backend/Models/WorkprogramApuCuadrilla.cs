using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("workprogram_apu_cuadrilla", Schema = "pu")]
    public class WorkprogramApuCuadrilla
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_workprogram")]
        public int IdWorkprogram { get; set; }

        [Column("name", TypeName = "varchar(100)")]
        public string Name { get; set; } = string.Empty;

        [Column("cantidad", TypeName = "decimal(18,4)")]
        [DefaultValue(1)]
        public decimal Cantidad { get; set; } = 1;

        [Column("sort_order")]
        [DefaultValue(0)]
        public int SortOrder { get; set; }

        [Column("active")]
        [DefaultValue(true)]
        public bool Active { get; set; } = true;
    }
}
