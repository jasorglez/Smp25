using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

    [Table("stakeholders")]
    public class Stakeholder
    {
                
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("id_project")]
        public int? IdProject { get; set; } = 0;

        [Column("id_provider")]
        public int? IdProvider { get; set; } = 0;

        [Required]
        [Column("image1")]
        [StringLength(170)]
        public string Image1 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0";

        [Required]
        [Column("image2")]
        [StringLength(170)]
        public string Image2 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0";

        [Required]
        [Column("image3")]
        [StringLength(170)]
        public string Image3 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0";

        [Required]
        [Column("image4")]
        [StringLength(170)]
        public string Image4 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0";

        [Required]
        [Column("image5")]
        [StringLength(170)]
        public string Image5 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Festrella%20llena.png?alt=media&token=1af55f2b-e910-44a0-935c-c48e9fcafbe0";

        [Required]
        [Column("authorizeuser")]
        [StringLength(40)]
        public string AuthorizeUser { get; set; }

        [Required]
        [Column("active")]
        public bool Active { get; set; } = true;

        [ForeignKey("IdProvider")]
        public virtual Provider? NavProvider { get; set; }
    }
}