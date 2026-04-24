# Usa la imagen oficial de .NET como la base para ejecutar la aplicación
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

# Configura variables de entorno para producción
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:80;https://+:443

# Usa la imagen de .NET SDK para construir la aplicación
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copia solo el archivo de proyecto primero para optimizar el cache de Docker
COPY ["SMP.csproj", "./"]

# Restaura las dependencias (incluyendo ClosedXML)
RUN dotnet restore "./SMP.csproj"

# Copia el resto del código fuente
COPY . .

# Construye la aplicación en modo Release
WORKDIR "/src/."
RUN dotnet build "SMP.csproj" -c Release -o /app/build

# Publica la aplicación
FROM build AS publish
RUN dotnet publish "SMP.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Crea la imagen final
FROM base AS final
WORKDIR /app

# Copia los archivos publicados desde la etapa de publish
COPY --from=publish /app/publish .
COPY xlsx/ ./xlsx/
# Asegurar que el directorio xlsx existe y tiene permisos correctos
RUN mkdir -p ./xlsx && chmod -R 777 ./xlsx

# Crear directorios necesarios para la aplicación
RUN mkdir -p /app/Uploads/TempZips

# Define el punto de entrada de la aplicación
ENTRYPOINT ["dotnet", "SMP.dll"]
