using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    public class ApiData
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("idCompany")]
        public int IdCompany { get; set; }

        [JsonPropertyName("description")]
        public string Description { get; set; }

        [JsonPropertyName("ValueAddition")]
        public string ValueAddition { get; set; }

        [JsonPropertyName("valueAddition2")]
        public string ValueAddition2 { get; set; }

        [JsonPropertyName("idElection")]
        public bool IdElection { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("parentId")]
        public int ParentId { get; set; }

        //[JsonPropertyName("active")
        public int Active { get; set; } // Se mapea como int porque el valor es 1.

    }
}
