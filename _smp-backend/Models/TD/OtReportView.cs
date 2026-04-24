using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.TD
{
    [Table("vw_OtReports")]
    public class OtReportView
    {
        [Column("id")]
        public int Id { get; set; }

        [Column("idOt")]
        public int idOt { get; set; }

        [Column("namesmall")]
        public string? NameSmall { get; set; }

        [Column("ot_number")]
        public string? OtNumber { get; set; }

        [Column("cdc")]
        public string? Cdc { get; set; }

        [Column("area")]
        public string? Area { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("ProjectName")]
        public string? ProjectName { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("starttime")]
        public TimeSpan? StartTime { get; set; }

        [Column("endtime")]
        public TimeSpan? EndTime { get; set; }

        [Column("totalpay")]
        public decimal? TotalPay { get; set; }

        [Column("CompanyId")]
        public int CompanyId { get; set; }

        [Column("observations")]
        public string? Observations { get; set; }

        [Column("closed")]
        public bool Closed { get; set; }

        [Column("closedapp")]
        public bool ClosedApp { get; set; }

        
    }
}