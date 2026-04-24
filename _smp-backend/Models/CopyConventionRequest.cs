namespace SMP.Models
{
    public class CopyConventionRequest
    {
        public int SourceConventionId { get; set; }
        public int TargetConventionId { get; set; }
        public int? IdProject { get; set; }
    }
}
