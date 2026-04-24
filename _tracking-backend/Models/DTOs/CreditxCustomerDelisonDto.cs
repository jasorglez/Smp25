namespace MicroServicioTracking.Models.DTOs;

public class CreditxCustomerDelisonDto
{
    public int CustomerId { get; set; }
    public int ProveedorXTablasId { get; set; }
    public decimal Total { get; set; }
    public DateTime Date { get; set; }
    public string Type { get; set; }
    public string Comments { get; set; }
    public int Active { get; set; }
}
