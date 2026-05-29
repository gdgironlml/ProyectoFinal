# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["SuperBodega.API/SuperBodega.API.csproj", "SuperBodega.API/"]
RUN dotnet restore "SuperBodega.API/SuperBodega.API.csproj"

COPY . .
WORKDIR "/src/SuperBodega.API"
RUN dotnet build "SuperBodega.API.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "SuperBodega.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=publish /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "SuperBodega.API.dll"]
