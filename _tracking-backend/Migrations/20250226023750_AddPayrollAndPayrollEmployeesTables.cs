using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroServicioTracking.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollAndPayrollEmployeesTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
           

            migrationBuilder.CreateTable(
                name: "PayrollRecords",
                columns: table => new
                {
                    PayrollId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Company = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Period = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FiscalYear = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollRecords", x => x.PayrollId);
                });

           

            migrationBuilder.CreateTable(
                name: "PayrollEmployees",
                columns: table => new
                {
                    PayrollEmployeeId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WorkedDays = table.Column<int>(type: "int", nullable: false),
                    IntegratedDailySalary = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    DailySalary = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    Wages = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    TotalEarnings = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    OtherIncome = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    TaxableEarnings = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    Article96Tax = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    Article114Subsidy = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    TotalArticle115EmploymentSubsidy = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    AccreditedEmploymentSubsidy = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    IncomeTax = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    EmploymentSubsidy = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    MedicalInsurance = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    RetirementInsurance = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    SocialSecurity = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    HousingFundWithholding = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    ChildSupport = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    NetPay = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    Signature = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PayrollId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollEmployees", x => x.PayrollEmployeeId);
                    table.ForeignKey(
                        name: "FK_PayrollEmployees_PayrollRecords_PayrollId",
                        column: x => x.PayrollId,
                        principalTable: "PayrollRecords",
                        principalColumn: "PayrollId",
                        onDelete: ReferentialAction.Cascade);
                });

           

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEmployees_Name",
                table: "PayrollEmployees",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEmployees_PayrollId",
                table: "PayrollEmployees",
                column: "PayrollId");

           
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
           
        }
    }
}
