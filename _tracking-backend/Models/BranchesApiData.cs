using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models;

public class BranchesApiData
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("idCompany")] public int IdCompany { get; set; }
    [JsonPropertyName("idEstado")] public int IdEstado { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("administrator")] public bool Administrator { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("orden")] public int Orden { get; set; }
    [JsonPropertyName("active")] public bool Active { get; set; }
    
    public string? Type { get; set; }
    public int? InternalId { get; set; }
    public int? IdUser { get; set; }
}