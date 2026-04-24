# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the SMP (Sistema de Monitoreo de Proyectos) microservice - an ASP.NET Core Web API built on .NET 8.0 that handles project management, risk analysis, and document processing for oil industry operations. The service follows a layered architecture with Controllers, Services, and Entity Framework Core for data access.

## Architecture

**Technology Stack:**
- ASP.NET Core 8.0 Web API
- Entity Framework Core with SQL Server
- JWT Bearer Authentication  
- SignalR for real-time communication
- Docker containerization
- Swagger/OpenAPI documentation

**Key Components:**
- **Controllers/**: API endpoints organized by functional area (Project, Contract, Risk management, etc.)
- **Services/**: Business logic layer implementing service interfaces
- **Models/**: Entity models and DTOs, with `DbSmpContext` as the main EF Core context
- **Models/context/DbSmpContext.cs**: Central database context with all entity configurations
- **Hub/StorageHub.cs**: SignalR hub for real-time notifications
- **Controllers/TD/**: Specialized controllers for technical documents (OT processing, PDF handling)
- **Services/TD/**: Services for document processing including PDF extraction and OT (Orden de Trabajo) management

**Database Context:** The `DbSmpContext` class in `Models/context/DbSmpContext.cs` defines all entity sets including Projects, Contracts, Risks, Branches, and specialized TD (Technical Documents) entities like OT and RegistroOT.

## Development Commands

**Build and Run:**
```bash
# Build the solution
dotnet build SMP.csproj

# Run in development mode  
dotnet run --project SMP.csproj

# Restore NuGet packages
dotnet restore SMP.csproj
```

**Docker Development:**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Rebuild container (full deployment workflow)
./rebuildContainer.sh  # Note: Contains hardcoded credentials - use with caution

# Stop containers
docker-compose down

# Build image only
docker-compose build
```

**Database Operations:**
```bash
# Add new migration
dotnet ef migrations add MigrationName --project SMP.csproj

# Update database
dotnet ef database update --project SMP.csproj

# Drop database (development only)
dotnet ef database drop --project SMP.csproj
```

## Configuration

**Connection Strings:** Database connection is configured in `appsettings.json` with the connection string name "dbSMP".

**JWT Authentication:** JWT settings are in `appsettings.json` under the "Jwt" section.

**CORS Configuration:** The API is configured to accept requests from multiple origins including localhost development servers and production domains.

**File Upload Limits:** PDF file uploads are limited to 50MB as configured in `Program.cs`.

## Key Dependencies

- **CsvHelper (33.1.0)**: CSV data processing
- **Microsoft.EntityFrameworkCore.SqlServer (8.0.8)**: SQL Server data access
- **Microsoft.AspNetCore.Authentication.JwtBearer (8.0.8)**: JWT authentication
- **Microsoft.AspNetCore.SignalR (1.2.0)**: Real-time communication
- **PdfPig (0.1.10)**: PDF document processing
- **Swashbuckle.AspNetCore (6.4.0)**: API documentation

## Development Environment

**API Documentation:** Swagger UI is available at `/swagger` when running in development mode (version v2.88).

**File Storage:** The `Uploads/` directory contains uploaded PDF files for OT processing.

**SSL Certificates:** Development SSL certificates are present (`cert.crt`, `cert.key`) for HTTPS testing.

**HTTP Testing:** Use `SMP.http` file for API endpoint testing during development.

## Service Layer Pattern

All business logic is implemented in the `Services/` directory with corresponding interfaces. Services are registered in `Program.cs` using dependency injection. Key service areas include:
- Contract and Project management
- Risk analysis (Identification, Analysis, Planification, Implementation)  
- Document processing (especially TD/OT services for technical documents)
- Branch and Provider management
- Logbook and Daily Report services

## Important Notes

**No Test Projects:** This solution currently has no unit or integration tests configured.

**Security:** The `rebuildContainer.sh` script contains hardcoded credentials and should be used with caution in production environments.

**Database Views:** The context includes several database views for complex queries (CanDeleteBranchView, ActiveBranchIdsView, etc.).

**File Processing:** The TD (Technical Documents) module handles PDF processing and OT (Orden de Trabajo) document workflows.