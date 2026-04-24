using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("preregistro_gasto", Schema = "presupuesto")]
    public class PreregistroGasto
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_project")]
        [JsonPropertyName("id_project")]
        public int IdProject { get; set; }

        [Column("id_cuenta")]
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }

        [Column("concepto")]
        public string Concepto { get; set; } = string.Empty;

        [Column("monto")]
        public decimal Monto { get; set; } = 0;

        [Column("fecha")]
        public DateTime Fecha { get; set; } = DateTime.Today;

        [Column("usuario")]
        public string? Usuario { get; set; }

        [Column("idCompany")]
        public int IdCompany { get; set; }

        [Column("fecha_creacion")]
        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
