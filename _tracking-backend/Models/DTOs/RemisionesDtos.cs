namespace MicroServicioTracking.Models.DTOs
{
    public class CreateOrReuseRemisionRequest
    {
        public int IdCompany { get; set; }
        public int IdCliente { get; set; }
        public string? Comentario { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class AddRemisionDetalleRequest
    {
        public int IdCompany { get; set; }
        public int IdCliente { get; set; }
        public int IdDetallePedido { get; set; }
        public decimal CantidadRemitida { get; set; }
        public string? Comentario { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class CloseRemisionRequest
    {
        public string? ClosedBy { get; set; }
        public string? Comentario { get; set; }
    }
}
