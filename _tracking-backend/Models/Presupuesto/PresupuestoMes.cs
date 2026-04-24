using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("presupuesto_mes", Schema = "presupuesto")]
    public class PresupuestoMes
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_linea")]
        [JsonPropertyName("id_linea")]
        public int IdLinea { get; set; }

        [Column("mes")]
        public byte Mes { get; set; }

        [Column("anio")]
        public short Anio { get; set; }

        [Column("monto")]
        public decimal Monto { get; set; } = 0;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
