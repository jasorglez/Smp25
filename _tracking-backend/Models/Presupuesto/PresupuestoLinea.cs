using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("presupuesto_linea", Schema = "presupuesto")]
    public class PresupuestoLinea
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_presupuesto")]
        [JsonPropertyName("id_presupuesto")]
        public int IdPresupuesto { get; set; }

        [Column("id_cuenta")]
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }

        [Column("descripcion")]
        public string? Descripcion { get; set; }

        [Column("monto")]
        public decimal Monto { get; set; } = 0;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
