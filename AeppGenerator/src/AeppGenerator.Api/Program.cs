using System.Text.Json.Serialization;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Assessment;
using AeppGenerator.Api.Security;
using AeppGenerator.Application;
using AeppGenerator.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.AddAccounts();
builder.AddExamAttempts();
builder.Services.AddRateLimiter(ApiRateLimiting.Configure);
builder.Services.AddSingleton(services => new AeppGenerator.Api.Gamification.GamificationService(
    builder.Configuration["Gamification:StorePath"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "gamification.json"), store: services.GetRequiredService<AeppGenerator.Api.Data.AccountStore>()));
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddPolicy("ReactClient", policy =>
    policy.WithOrigins((builder.Configuration["Auth:FrontendOrigins"] ?? "http://localhost:5173,http://127.0.0.1:5173").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
var promotion = Array.IndexOf(args, "--promote-teacher");
if (promotion >= 0) {
    if (promotion + 1 >= args.Length || !app.Services.GetRequiredService<AeppGenerator.Api.Data.AccountStore>().PromoteTeacher(args[promotion + 1])) throw new ArgumentException("Ο λογαριασμός για προαγωγή δεν βρέθηκε.");
    Console.WriteLine("Ο λογαριασμός έγινε καθηγητής. Απαιτείται νέα σύνδεση.");
    return;
}
await app.InitializeExamAttempts();
if (args.Contains("--migrate-assessments")) { Console.WriteLine("Η βάση ιστορικού διαγωνισμάτων ενημερώθηκε."); return; }
// Η τράπεζα επικυρώνεται στην εκκίνηση, πριν γίνει αποδεκτή κλήση δημιουργίας.
_ = app.Services.GetRequiredService<AeppGenerator.Infrastructure.Services.LocalExamBank>();
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
