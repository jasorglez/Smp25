using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace SMP.Models
{
    [Table("vw_EmployeesFromAdministration")]
    public class EmployeesFromAdministrationView
    {
        [Key]
        [Column("Id")]
        public int Id { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("name")]
        public string? Name { get; set; }
        public bool? Active { get; set; } = true;
    }
}