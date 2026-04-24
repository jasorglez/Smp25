namespace MicroServicioTracking.Models.DTOs
{
    public class UpdateTotalsDto
    {
        public decimal Subtotal { get; set; }
        public decimal Tax { get; set; }
        public decimal Total { get; set; }
        public string? ModifiedBy { get; set; } // Opcional, si quieres registrar quién lo modificó
    }
}
