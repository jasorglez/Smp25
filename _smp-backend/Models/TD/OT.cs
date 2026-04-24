using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.TD
{
    [Table("ot", Schema = "TD")]
    public class OT
    {
        [Key]
        public int Id { get; set; }

        [Column("cuentahoja")]
        public int CuentaHoja { get; set; } 

        [Column("register_date")]
        public DateTime? RegisterDate { get; set; } = DateTime.Now;
        
        [Column("id_project")]
        public int? IdProject { get; set; }

        [Column("ot_number")]
        public string? OtNumber { get; set; }
        
        [Column("package")]
        public string? Package { get; set; }

        [Column("assigned_to")]
        public string? AssignedTo { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("time_limit")]
        public DateTime? TimeLimit { get; set; }

        [Column("name_consumer")]
        public string? NameConsumer { get; set; }

        [Column("property_number")]
        public string? PropertyNumber { get; set; }

        [Column("contract_number")]
        public string? ContractNumber { get; set; }

        [Column("phone_consumer")]
        public string? PhoneConsumer { get; set; }

        [Column("address")]
        [StringLength(50)]
        public string? Address { get; set; }

        [Column("address_number")]
        [StringLength(20)]
        public string? AddressNumber { get; set; }

        [Column("old_address_number")]
        [StringLength(100)]
        public string? OldAddressNumber { get; set; }

        [Column("neighborhood")]
        [StringLength(50)]
        public string? Neighborhood { get; set; }

        [Column("address_references")]
        public string? AddressReferences { get; set; }

        [Column("address_crossings")]
        [StringLength(250)]
        public string? AddressCrossings { get; set; }

        [Column("charge_phase")]
        [StringLength(50)]
        public string? ChargePhase { get; set; }

        [Column("cdc")]
        public string? CDC { get; set; }

        [Column("area")]
        public string? Area { get; set; }

        [Column("hydrometer_number")]
        public string? HydrometerNumber { get; set; }

        [Column("period")]
        [StringLength(50)]
        public string? Period { get; set; }

        [Column("lecture_water")]
        public string? LectureWater { get; set; }

        [Column("observations")]
        public string? Observations { get; set; }

        [Column("results")]
        public string? Results { get; set; }

        [Column("closed")] 
        public bool Closed { get; set; } = false;

        [Column("closedapp")]
        public bool ClosedApp { get; set; } = false;

        [Column("closed_at")]
        public DateTime? ClosedAt { get; set; }

        [Column("downloaded")]
        public bool? Downloaded { get; set; } = false;

        [Column("media_items")]
        public int? MediaItems { get; set; }
        
        [Column("last_time_downloaded")]
        public DateTime? LastTimeDownloaded { get; set; }
        
        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}