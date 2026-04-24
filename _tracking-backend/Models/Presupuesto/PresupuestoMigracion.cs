using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("presupuesto_migracion", Schema = "presupuesto")]
    public class PresupuestoMigracion
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_presupuesto_nuevo")]
        [JsonPropertyName("id_presupuesto_nuevo")]
        public int IdPresupuestoNuevo { get; set; }

        [Column("id_cuenta_origen")]
        [JsonPropertyName("id_cuenta_origen")]
        public int IdCuentaOrigen { get; set; }

        [Column("id_cuenta_destino")]
        [JsonPropertyName("id_cuenta_destino")]
        public int IdCuentaDestino { get; set; }

        [Column("monto_transferido")]
        [JsonPropertyName("monto_transferido")]
        public decimal MontoTransferido { get; set; }

        [Column("motivo")]
        public string? Motivo { get; set; }

        [Column("usuario")]
        public string? Usuario { get; set; }

        [Column("fecha")]
        public DateTime Fecha { get; set; } = DateTime.Now;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
