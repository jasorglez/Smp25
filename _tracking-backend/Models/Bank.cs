  
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{

    [Table("banks")]
    public class Bank
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("name")]
        [StringLength(45)]
        public string Name { get; set; } = "NOMBRE";

        [Column("branch")]
        [StringLength(45)]
        public string Branch { get; set; } = "BRANCH";

        [Column("numbranch")]
        [StringLength(6)]
        public string NumBranch { get; set; } = "NUMBER";

        [Column("contact")]
        [StringLength(145)]
        public string Contact { get; set; } = "NAME";

        [Column("phone")]
        [StringLength(20)]
        public string Phone { get; set; } = "(0-0-0)";

        [Column("picture")]
        [StringLength(250)]
        public string Picture { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2FBI.jpg?alt=media&token=2b73d977-5f18-4ae4-91a1-e715bf535f83";

        [Column("code")]
        [StringLength(10)]
        public string Code { get; set; } = "00";

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}
