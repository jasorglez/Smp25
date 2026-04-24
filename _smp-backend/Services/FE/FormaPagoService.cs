using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class FormaPagoService : IFormaPagoService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<FormaPagoService> _logger;

        public FormaPagoService(DbSmpContext context, ILogger<FormaPagoService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetFormaPago()
        {
            try
            {
                return await _context.FormaPagos
                    .Where(f => f.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving FormaPago");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.FormaPagos
                    .Where(f => f.Active)
                    .Select(f => new
                    {
                        f.Id,f.FormaPagoValue,
                        f.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(f => f.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving FormaPago fields");
                throw;
            }
        }

        public async Task<object> CreateFormaPago(FormaPago formaPago)
        {
            try
            {
                _context.FormaPagos.Add(formaPago);
                await _context.SaveChangesAsync();
                return formaPago;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating FormaPago");
                throw;
            }
        }

        public async Task<object> GetFormaPagoById(int id)
        {
            try
            {
                var formaPago = await _context.FormaPagos.FindAsync(id);
                if (formaPago == null)
                {
                    return new { Message = "No encontrado" };
                }
                return formaPago;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving FormaPago by id");
                throw;
            }
        }

        public async Task<FormaPago?> Update(int id, FormaPago formaPago)
        {
            var existingFormaPago = await _context.FormaPagos.FindAsync(id);
            if (existingFormaPago == null)
            {
                _logger.LogWarning("Attempted to update non-existent FormaPago with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingFormaPago.FormaPagoValue = formaPago.FormaPagoValue;
                existingFormaPago.Descripcion = formaPago.Descripcion;
                existingFormaPago.Bancarizado = formaPago.Bancarizado;
                existingFormaPago.NumeroOperacion = formaPago.NumeroOperacion;
                existingFormaPago.RfcEmisor = formaPago.RfcEmisor;
                existingFormaPago.CuentaOrdenante = formaPago.CuentaOrdenante;
                existingFormaPago.PatronOrdenante = formaPago.PatronOrdenante;
                existingFormaPago.RfcEmisorBeneficiario = formaPago.RfcEmisorBeneficiario;
                existingFormaPago.CuentaBeneficiario = formaPago.CuentaBeneficiario;
                existingFormaPago.PatronBeneficiario = formaPago.PatronBeneficiario;
                existingFormaPago.TipoCadena = formaPago.TipoCadena;
                existingFormaPago.NombreDelBanco = formaPago.NombreDelBanco;
                existingFormaPago.InicioVigencia = formaPago.InicioVigencia;
                existingFormaPago.FinVigencia = formaPago.FinVigencia;
                existingFormaPago.Active = formaPago.Active;

                await _context.SaveChangesAsync();
                return existingFormaPago;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating FormaPago with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating FormaPago with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var formaPago = await _context.FormaPagos.FindAsync(id);
                if (formaPago == null)
                {
                    return false;
                }
                _context.FormaPagos.Remove(formaPago);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting FormaPago with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IFormaPagoService
    {
        Task<List<object>> GetFormaPago();
        Task<List<object>> Get2fields();
        Task<object> GetFormaPagoById(int id);
        Task<object> CreateFormaPago(FormaPago formaPago);
        Task<FormaPago?> Update(int id, FormaPago formaPago);
        Task<bool> Delete(int id);
    }
}