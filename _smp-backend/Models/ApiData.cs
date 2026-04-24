using System.Text.Json.Serialization;

namespace SMP.Models
{
    public class ApiData
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("idUser")]
        public int IdUser { get; set; }

        [JsonPropertyName("idPermission")]
        public int IdPermission { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("active")]
        public int Active { get; set; }
    }
}
