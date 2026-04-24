using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("vw_LogisticaRemisionesResumen", Schema = "logistica")]
    public class LogisticaRemisionResumen
    {
        public int Id { get; set; }
        public int IdCompany { get; set; }
        public int IdCliente { get; set; }
        public string? Folio { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaCierre { get; set; }
        public string? Estado { get; set; }
        public string? Comentario { get; set; }
        public string? CreatedBy { get; set; }
        public string? ClosedBy { get; set; }
        public bool Active { get; set; }
        public int DiasTranscurridos { get; set; }
        public int TotalRenglones { get; set; }
        public decimal TotalCantidadRemitida { get; set; }
        public decimal TotalImporte { get; set; }
    }
}
