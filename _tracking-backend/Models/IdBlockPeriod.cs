
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("idBlockPeriod")]
    public class IdBlockPeriod
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_branch")]
        public int IdBranch { get; set; }

        [Column("id_block_period")]
        public string BlockPeriodCode { get; set; }

        [Column("start_date")]
        public DateTime StartDate { get; set; }

        [Column("end_date")]
        public DateTime EndDate { get; set; }

        [Column("active")]
        public bool Active { get; set; }
    }
}
