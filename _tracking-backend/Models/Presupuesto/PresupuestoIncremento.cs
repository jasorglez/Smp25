using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("presupuesto_incremento", Schema = "presupuesto")]
    public class PresupuestoIncremento
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

        [Column("monto_solicitado")]
        [JsonPropertyName("monto_solicitado")]
        public decimal MontoSolicitado { get; set; }

        [Column("motivo")]
        public string? Motivo { get; set; }

        [Column("estado")]
        public string Estado { get; set; } = "pendiente";

        [Column("usuario_solicito")]
        [JsonPropertyName("usuario_solicito")]
        public string? UsuarioSolicito { get; set; }

        [Column("usuario_autorizo")]
        [JsonPropertyName("usuario_autorizo")]
        public string? UsuarioAutorizo { get; set; }

        [Column("fecha_solicitud")]
        [JsonPropertyName("fecha_solicitud")]
        public DateTime FechaSolicitud { get; set; } = DateTime.Now;

        [Column("fecha_autorizacion")]
        [JsonPropertyName("fecha_autorizacion")]
        public DateTime? FechaAutorizacion { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
