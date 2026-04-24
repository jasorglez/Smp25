using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("auxiliar_cuadrilla", Schema = "pu")]
    public class AuxiliarCuadrilla
    {
        [Key][DatabaseGenerated(DatabaseGeneratedOption.Identity)][Column("id")]
        public int Id { get; set; }

        [Column("id_auxiliar")]
        public int IdAuxiliar { get; set; }

        [Column("name", TypeName = "varchar(100)")]
        public string Name { get; set; } = string.Empty;

        [Column("cantidad", TypeName = "decimal(18,4)")]
        public decimal Cantidad { get; set; } = 1;

        [Column("sort_order")]
        public int SortOrder { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
