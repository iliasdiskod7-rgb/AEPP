# AeppGenerator

.NET 8 clean architecture starter with four projects under `src/`:

```text
AeppGenerator.Domain         Entities and enums; no project dependencies
AeppGenerator.Application    Domain reference; commands, DTOs, service contract, DI
AeppGenerator.Infrastructure Application + Domain references; DI registration point
AeppGenerator.Api            Infrastructure + Application references; controllers, Swagger
```

From this directory:

```powershell
dotnet restore AeppGenerator.sln
dotnet build AeppGenerator.sln --no-restore
dotnet run --project src/AeppGenerator.Api --launch-profile http
```

Open the URL printed in the terminal followed by `/swagger`. Swagger UI and its OpenAPI document (`/swagger/v1/swagger.json`) are enabled in Development. `GET /api/health` is the starting controller endpoint.

`CreatedAt` is a `DateTime` initialized with `DateTime.UtcNow`. .NET has no built-in `DateTimeUtc` type; keep subsequent assigned values in UTC. `TargetTopic` is a string so topics can be extended without changing an enum. IDs and collections are initialized. DTOs include sections and questions, including nullable execution trace JSON.

Application registers MediatR and FluentValidation assembly scanning. There are no generation handler, validators, validation pipeline, LLM provider, database, or persistence implementations in this starter. Implement `ILlmExamGeneratorService` in Infrastructure and register it in `AddInfrastructure` when a provider is selected; add the command handler and generation controller when generation is implemented.

The accompanying `Create-AeppGenerator.ps1` contains the exact CLI commands and PowerShell file-generation commands. `dotnet-commands.txt` is the CLI-only extract; use the full script to generate the source classes too. The script refuses to overwrite an existing destination.

The SDK is pinned to 8.0.425 with latest-patch roll-forward. To recreate with .NET 9, adjust the script's SDK version to an installed 9.0 SDK and its four framework arguments to `net9.0`. The explicit Swagger registration also works with .NET 9; its template may additionally generate built-in OpenAPI dependencies.

Pinned package references: MediatR 12.5.0, FluentValidation.DependencyInjectionExtensions 11.11.0, Swashbuckle.AspNetCore 6.6.2.

Verification: the Domain project builds. Full restore/build could not be completed in the execution environment because NuGet HTTPS connections fail with NU1301 and Windows TLS error SEC_E_NO_CREDENTIALS, including after network access was granted. Run the restore and build commands above on a terminal with working NuGet HTTPS access.
