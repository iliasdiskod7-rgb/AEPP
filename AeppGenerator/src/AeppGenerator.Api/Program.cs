using System.Text.Json.Serialization;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Assessment;
using AeppGenerator.Api.Data;
using AeppGenerator.Api.Security;
using AeppGenerator.Application;
using AeppGenerator.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

var builder = WebApplication.CreateBuilder(args);
var knownProxy = builder.Configuration["ReverseProxy:KnownProxy"];
if (!string.IsNullOrWhiteSpace(knownProxy))
{
    var proxyAddress = IPAddress.Parse(knownProxy);
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        options.KnownProxies.Add(proxyAddress);
    });
}
builder.AddAccounts();
builder.AddExamAttempts();
builder.Services.AddRateLimiter(ApiRateLimiting.Configure);
builder.Services.AddSingleton(services => new AeppGenerator.Api.Gamification.GamificationService(
    builder.Configuration["Gamification:StorePath"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "gamification.json"), store: services.GetRequiredService<AeppGenerator.Api.Data.AccountStore>()));
builder.Services.AddApplication();
// Public edition does not register external AI services.
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddPolicy("ReactClient", policy =>
    policy.WithOrigins((builder.Configuration["Auth:FrontendOrigins"] ?? "http://localhost:5173,http://127.0.0.1:5173").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
app.UseForwardedHeaders();
if (args.Contains("--promote-teacher")) throw new InvalidOperationException("Η δημόσια έκδοση δεν υποστηρίζει ρόλους καθηγητών.");
if (args.Contains("--reset-exams"))
{
    if (!args.Contains("--confirm-reset-exams"))
        throw new InvalidOperationException("Η εκκαθάριση απαιτεί το ρητό όρισμα --confirm-reset-exams.");
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Η εκκαθάριση επιτρέπεται μόνο σε περιβάλλον Development.");

    var store = app.Services.GetRequiredService<AccountStore>();
    var databasePath = Path.GetFullPath(new SqliteConnectionStringBuilder(store.ConnectionString).DataSource);
    var expectedPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "App_Data", "accounts.sqlite"));
    if (!string.Equals(databasePath, expectedPath, StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException($"Η εκκαθάριση επιτρέπεται μόνο στην τοπική βάση {expectedPath}.");

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
    await db.Database.MigrateAsync();
    await using var transaction = await db.Database.BeginTransactionAsync();
    await db.GradeRevisions.ExecuteDeleteAsync();
    await db.QuestionSubmissions.ExecuteDeleteAsync();
    await db.ExamAttempts.ExecuteDeleteAsync();
    await db.Exams.ExecuteDeleteAsync();
    await db.Database.ExecuteSqlRawAsync("DELETE FROM SavedExams");
    await scope.ServiceProvider.GetRequiredService<ExamCatalog>().Seed(db, CancellationToken.None);
    var seededExams = await db.Exams.CountAsync();
    if (seededExams != 5)
        throw new InvalidOperationException($"Αναμένονταν 5 νέα διαγωνίσματα μετά το reset, βρέθηκαν {seededExams}.");
    await transaction.CommitAsync();
    Console.WriteLine($"Η τοπική βάση εκκαθαρίστηκε και φορτώθηκαν {seededExams} νέα πρότυπα. Διαγράφηκαν οι παλιές προσπάθειες, υποβολές, αναθεωρήσεις βαθμών και αποθηκευμένα διαγωνίσματα· λογαριασμοί και σημειώσεις διατηρήθηκαν. Βάση: {databasePath}");
    return;
}
await app.InitializeExamAttempts();
if (args.Contains("--migrate-assessments")) { Console.WriteLine("Η βάση ιστορικού διαγωνισμάτων ενημερώθηκε."); return; }
// Η τράπεζα επικυρώνεται στην εκκίνηση, πριν γίνει αποδεκτή κλήση δημιουργίας.
// Practice exams are initialized by InitializeExamAttempts.
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("ReactClient");
app.UseAccountOriginGuard();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.MapControllers();
app.Run();
