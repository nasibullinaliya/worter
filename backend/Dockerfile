FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY VocabApp.API/VocabApp.API.csproj VocabApp.API/
RUN dotnet restore VocabApp.API/VocabApp.API.csproj

COPY VocabApp.API/ VocabApp.API/
RUN dotnet publish VocabApp.API/VocabApp.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "VocabApp.API.dll"]
