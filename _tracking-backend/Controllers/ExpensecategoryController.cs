
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ExpenseCategoryController : ControllerBase
    {
        private readonly IExpenseCategoryService _expenseCategoryService;

        public ExpenseCategoryController(IExpenseCategoryService expenseCategoryService)
        {
            _expenseCategoryService = expenseCategoryService ?? throw new ArgumentNullException(nameof(expenseCategoryService));
        }

        // GET: api/ExpenseCategories/business/5
        [HttpGet("business/{id}")]
        public async Task<IActionResult> GetByBusiness(int id)
        {
            try
            {
                var result = await _expenseCategoryService.GetByBusiness(id);
                if (result == null || !result.Any())
                {
                    return NotFound($"No expense categories found for business ID {id}.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // POST: api/ExpenseCategories
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] expensecategory expenseCategory)
        {
            if (expenseCategory == null)
            {
                return BadRequest("ExpenseCategory object is null.");
            }

            try
            {
                await _expenseCategoryService.Save(expenseCategory);
                return CreatedAtAction(nameof(GetByBusiness), new { id = expenseCategory.IdBusinnes }, expenseCategory);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // PUT: api/ExpenseCategories/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] expensecategory expenseCategory)
        {
            if (expenseCategory == null)
            {
                return BadRequest("ExpenseCategory object is null.");
            }

            if (id != expenseCategory.Id)
            {
                return BadRequest("ExpenseCategory ID mismatch.");
            }

            try
            {
                var updatedCategory = await _expenseCategoryService.Update(id, expenseCategory);
                if (updatedCategory == null)
                {
                    return NotFound($"ExpenseCategory with ID {id} not found.");
                }

                return Ok(updatedCategory);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // DELETE: api/ExpenseCategories/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _expenseCategoryService.Delete(id);
                if (!result)
                {
                    return NotFound($"ExpenseCategory with ID {id} not found.");
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}
