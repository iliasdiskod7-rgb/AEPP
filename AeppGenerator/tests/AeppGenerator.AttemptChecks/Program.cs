using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Assessment;
using AeppGenerator.Api.Controllers;
using AeppGenerator.Application.Llm;
using AeppGenerator.Api.Data;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;

var directory = Path.Combine(Path.GetTempPath(), "aepp-attempts-" + Guid.NewGuid());
var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Configuration["Accounts:DatabasePath"] = Path.Combine(directory, "accounts.sqlite");
builder.Configuration["Auth:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.AddAccounts(); builder.AddExamAttempts();
builder.Services.AddControllers().AddApplicationPart(typeof(ExamAttemptsController).Assembly).AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
await using var app = builder.Build();
var accounts = app.Services.GetRequiredService<AccountStore>();
var student = await accounts.Register("student@example.test", "test-only", "Μαθητής");
var other = await accounts.Register("other@example.test", "test-only", "Άλλος μαθητής");
await accounts.Register("teacher@example.test", "test-only", "Καθηγητής");
accounts.PromoteTeacher("teacher@example.test");
var teacher = accounts.FindEmail("teacher@example.test")!;
var savedExam = accounts.SaveExam(student.Id, "Παλιό διαγώνισμα", "examJson", "{}");
await app.InitializeExamAttempts(); await app.InitializeExamAttempts();
using (var scope = app.Services.CreateScope())
{
 var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
 var practiceExam = await db.Exams.SingleAsync(exam => exam.Id == "aepp-practice-1");
 practiceExam.Title = "Παλιά έκδοση";
 practiceExam.DefinitionJson = "{}";
 await db.SaveChangesAsync();
}
await app.InitializeExamAttempts();
app.UseDeveloperExceptionPage(); app.UseRouting(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers(); await app.StartAsync();
using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
var json = new JsonSerializerOptions(JsonSerializerDefaults.Web); json.Converters.Add(new JsonStringEnumConverter());
int checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; Console.WriteLine("PASS " + label); }
using (var scope = app.Services.CreateScope())
{
 var practiceExam = await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.SingleAsync(exam => exam.Id == "aepp-practice-1");
 Check(practiceExam.Title == "Διαδραστικό διαγώνισμα εξάσκησης ΑΕΠΠ" && JsonDocument.Parse(practiceExam.DefinitionJson).RootElement.GetProperty("sections").GetArrayLength() == 4, "outdated seed is refreshed when no attempts reference it");
}
string Token(AccountUser user) => JsonSerializer.SerializeToElement(app.Services.GetRequiredService<AuthService>().Issue(user, new DefaultHttpContext().Response, false)).GetProperty("token").GetString()!;
var studentToken = Token(student); var otherToken = Token(other); var teacherToken = Token(teacher);
async Task<HttpResponseMessage> Request(string path, string? token, object? body = null) { var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, "/api/exams/attempts" + path); if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token); if (body != null) request.Content = JsonContent.Create(body); return await client.SendAsync(request); }
async Task<HttpResponseMessage> DirectGet(string path, string? token) { var request = new HttpRequestMessage(HttpMethod.Get, path); if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token); return await client.SendAsync(request); }
async Task<AttemptDetail> Detail(HttpResponseMessage response) { if (!response.IsSuccessStatusCode) throw new Exception(response.StatusCode + " " + (await response.Content.ReadAsStringAsync()).Split("HEADERS")[0]); return (await response.Content.ReadFromJsonAsync<AttemptDetail>(json))!; }
try {
 Check(accounts.Exam(student.Id, savedExam.Id) == "{}" && accounts.Progress(student.Id).TotalXP == 0, "migration preserves existing accounts, progress and saved exams");
 Check((await Request("/my-history", null)).StatusCode == HttpStatusCode.Unauthorized, "anonymous history 401");
 Check((await Request("/submit", null, new { })).StatusCode == HttpStatusCode.Unauthorized, "anonymous submission 401");
 Check((await Request("/review-history", studentToken)).StatusCode == HttpStatusCode.Forbidden, "student teacher queue 403");
 Check((await DirectGet("/api/exams/random", null)).StatusCode == HttpStatusCode.Unauthorized, "random exam bank requires authentication");
 var randomResponse = await DirectGet("/api/exams/random", studentToken);
 Check(randomResponse.IsSuccessStatusCode, "authenticated learner can fetch a random seeded exam");
 using (var randomJson = JsonDocument.Parse(await randomResponse.Content.ReadAsStringAsync()))
 {
  var random = randomJson.RootElement;
  var exam = random.GetProperty("exam");
  var bankQuestions = exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).ToList();
  Check(random.GetProperty("hiddenTestCases").GetInt32() == 7, "random exam reports hidden tests without exposing their contents");
  Check(exam.GetProperty("sections").GetArrayLength() == 4 && bankQuestions.Select(question => question.GetProperty("code").GetString()).Any(code => code == "Γ1") && bankQuestions.Any(question => question.GetProperty("code").GetString() == "Δ1"), "random exam includes all four themes");
  Check(bankQuestions.All(question => question.GetProperty("solution").GetString() == "") && bankQuestions.Where(question => question.GetProperty("kind").GetString() == "program").All(question => question.GetProperty("testCases").GetArrayLength() == 0 && question.GetProperty("referenceCode").GetString() == ""), "pre-submission response withholds solutions, code and test cases");
 }
 using (var scope = app.Services.CreateScope())
  Check(await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.CountAsync(exam => exam.Source == "practice") == 10, "database seed contains exactly ten model exams");
 var id = Guid.NewGuid();
 var attempt = await Detail(await Request("/start", studentToken, new StartAttemptRequest(id, "aepp-practice-1", null)));
 Check(attempt.AttemptId == id && attempt.Status == ExamAttemptStatus.IN_PROGRESS && attempt.SubmittedAt is null && attempt.StartedAt.Kind == DateTimeKind.Utc, "start persists server UTC timestamp");
 Check(attempt.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).All(question => question.GetProperty("solution").GetString() == ""), "attempt start keeps solution keys withheld");
 Check((await Detail(await Request("/start", studentToken, new StartAttemptRequest(id, attempt.ExamId, null)))).AttemptId == id, "start retry idempotent");
 Check((await Request("/" + id, otherToken)).StatusCode == HttpStatusCode.NotFound, "other student cannot read attempt");
 Check((await Request("/" + id, teacherToken)).StatusCode == HttpStatusCode.NotFound, "teacher cannot read unfinished student work");
 Check((await Request("/" + id + "/grade", studentToken, new { revisedScore = 100, teacherComments = "fake", expectedVersion = 1, role = "TEACHER" })).StatusCode == HttpStatusCode.Forbidden, "forged teacher role cannot grade");
 var questions = attempt.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).Select(question => new QuestionSubmissionRequest(question.GetProperty("id").GetString()!, "\"\"", "[]", question.GetProperty("kind").GetString() == "program" ? 0 : question.GetProperty("marks").GetDecimal(), question.GetProperty("marks").GetDecimal(), null, null, null)).ToList();
 var payload = new SubmitAttemptRequest(id, questions);
 var forgedProgram = questions.ToList(); var programIndex = forgedProgram.FindIndex(question => question.QuestionId.EndsWith("c1", StringComparison.Ordinal));
 forgedProgram[programIndex] = forgedProgram[programIndex] with { AutoPoints = forgedProgram[programIndex].MaxPoints };
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(id, forgedProgram))).StatusCode == HttpStatusCode.BadRequest, "client cannot award itself points for hidden-test program questions");
 var bad = questions.ToList(); bad[0] = bad[0] with { MaxPoints = 99 };
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(id, bad))).StatusCode == HttpStatusCode.BadRequest, "altered maximum rejected");
 using(var scope=app.Services.CreateScope()) Check(await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().QuestionSubmissions.CountAsync() == 0, "invalid submission writes no rows");
 bad = questions.ToList(); bad[0] = bad[0] with { StudentAnswerJson = "{bad" };
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(id, bad))).StatusCode == HttpStatusCode.BadRequest, "invalid answer JSON rejected");
 var submitted = await Detail(await Request("/submit", studentToken, payload));
 Check(submitted.Status == ExamAttemptStatus.SUBMITTED && submitted.QuestionSubmissions.Count == questions.Count && submitted.AutoGradeScore == 0 && submitted.Version == 1, "all questions saved and forged objective score recalculated");
 Check(submitted.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).Where(question => question.GetProperty("kind").GetString() == "program").All(question => question.GetProperty("testCases").GetArrayLength() == 0), "submitted attempt continues to withhold hidden test inputs");
 Check(submitted.Report!.Value.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).Any(question => !string.IsNullOrWhiteSpace(question.GetProperty("expectedAnswer").GetString())), "submitted report unlocks the answer explanations");
 Check(submitted.SubmittedAt >= submitted.StartedAt && submitted.Report.HasValue, "submission timestamp and detailed report saved");
 Check((await Detail(await Request("/submit", studentToken, payload))).Version == 1, "exact submission retry idempotent");
 bad=questions.ToList(); bad[0]=bad[0] with { StudentAnswerJson = "\"changed\"" };
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(id, bad))).StatusCode == HttpStatusCode.Conflict, "submitted answers immutable");
 Check((await Request("/submit", otherToken, payload)).StatusCode == HttpStatusCode.NotFound, "other student cannot submit owner attempt");
 Check((await Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(101, "Σχόλιο", 1))).StatusCode == HttpStatusCode.BadRequest, "grade range enforced");
 Check((await Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(90, "   ", 1))).StatusCode == HttpStatusCode.BadRequest, "blank comments rejected");
 var graded = await Detail(await Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(85.25m, "Ορθή μεθοδολογία", 1)));
 Check(graded.Status == ExamAttemptStatus.GRADED_BY_TEACHER && graded.FinalScore == 85.25m && graded.AutoGradeScore == 0 && graded.GradeRevisions.Single().TeacherId == teacher.Id, "official revision preserves auto score and teacher identity");
 Check((await Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(90, "Παλιός βαθμός", 1))).StatusCode == HttpStatusCode.Conflict, "stale revision rejected");
 var competing = await Task.WhenAll(Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(91, "Διόρθωση Α", 2)), Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(92, "Διόρθωση Β", 2)));
 Check(competing.Count(response => response.IsSuccessStatusCode) == 1 && competing.Count(response => response.StatusCode == HttpStatusCode.Conflict) == 1, "concurrent revisions exactly one winner");
 var latest = await Detail(await Request("/" + id, studentToken));
 Check(latest.GradeRevisions.Count == 2 && latest.Version == 3 && latest.GradeRevisions[0].RevisedScore == 85.25m, "student sees preserved revision history");
 Check((await Detail(await Request("/submit", studentToken, payload))).FinalScore == latest.FinalScore, "late submission retry cannot reset teacher grade");
 var history = (await (await Request("/my-history", studentToken)).Content.ReadFromJsonAsync<AttemptPage>(json))!;
 Check(history.Total == 1 && history.Items.Single().Sections.Count == 4 && history.Items.Single().FinalScore == latest.FinalScore, "own history includes section scores and official score");
 Check((await (await Request("/my-history", otherToken)).Content.ReadFromJsonAsync<AttemptPage>(json))!.Total == 0, "history isolated by owner");
 Check((await (await Request("/review-history", teacherToken)).Content.ReadFromJsonAsync<AttemptPage>(json))!.Total == 1, "teacher review queue includes submitted attempts");
 using(var scope=app.Services.CreateScope()) { var db=scope.ServiceProvider.GetRequiredService<AssessmentDbContext>(); Check(!db.Database.HasPendingModelChanges(), "migration snapshot matches EF model"); Check(await db.GradeRevisions.CountAsync()==2 && await db.QuestionSubmissions.CountAsync()==questions.Count, "reopening SQLite retains attempts and revisions without duplicates"); }
 var draft = await Detail(await Request("/start", studentToken, new StartAttemptRequest(Guid.NewGuid(), "aepp-practice-1", null)));
 Check((await Request("/" + draft.AttemptId + "/grade", teacherToken, new GradeAttemptRequest(50, "Πρόωρη αξιολόγηση", 1))).StatusCode == HttpStatusCode.Conflict, "unfinished attempts cannot be graded");
 Check((await Request("/my-history?page=2147483647", studentToken)).StatusCode == HttpStatusCode.BadRequest, "pagination overflow rejected");
 var duplicateQuestions=questions.ToList(); duplicateQuestions[1]=duplicateQuestions[0];
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(draft.AttemptId, duplicateQuestions))).StatusCode == HttpStatusCode.BadRequest, "duplicate questions rejected");
 var source = new ExamJsonResponseDto { Title = "Διαγώνισμα δοκιμής", DurationMinutes = 180, Sections = new[] { "Α", "Β", "Γ", "Δ" }.Select(letter => new ExamSectionDto { Theme = "Θέμα " + letter, TotalMarks = 25, Questions = [new QuestionDto { Code = letter + "1", QuestionText = "Ερώτημα δοκιμής", GlowCodeSnippet = null, SolutionText = "Λύση δοκιμής", Marks = 25 }] }).ToList() };
 var generated = await Detail(await Request("/start", studentToken, new StartAttemptRequest(Guid.NewGuid(), "generated-client", source)));
 Check(generated.ExamId.StartsWith("generated-") && generated.ExamId != "generated-client", "generated exam stored with server owner-specific identity");
 Check((await Request("/start", otherToken, new StartAttemptRequest(Guid.NewGuid(), generated.ExamId, null))).StatusCode == HttpStatusCode.NotFound, "generated exam private to owner");
 var generatedQuestions=generated.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).Select(question => new QuestionSubmissionRequest(question.GetProperty("id").GetString()!, "\"Απάντηση\"", "[]", 0, 25, null, null, null)).ToList();
 var generatedSubmitted=await Detail(await Request("/submit", studentToken, new SubmitAttemptRequest(generated.AttemptId, generatedQuestions)));
 Check(generatedSubmitted.AutoGradeScore==0 && generatedSubmitted.Report!.Value.GetProperty("pending").GetDecimal()==100, "generated questions await official teacher review");
 using (var scope = app.Services.CreateScope())
 {
  var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
  var seededExam = await db.Exams.SingleAsync(exam => exam.Id == "aepp-model-10");
  db.ExamAttempts.Add(new ExamAttempt { Id = Guid.NewGuid(), UserId = student.Id, ExamId = seededExam.Id, StartedAt = DateTime.UtcNow, Status = ExamAttemptStatus.IN_PROGRESS });
  seededExam.Title = "Ιστορική έκδοση";
  seededExam.DefinitionJson = "{}";
  await db.SaveChangesAsync();
 }
 await app.InitializeExamAttempts();
 using (var scope = app.Services.CreateScope())
 {
  var seededExam = await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.SingleAsync(exam => exam.Id == "aepp-model-10");
  Check(seededExam.Title == "Ιστορική έκδοση" && seededExam.DefinitionJson == "{}", "seed refresh preserves exam definitions referenced by existing attempts");
 }
 using(var scope=app.Services.CreateScope()) { var db=scope.ServiceProvider.GetRequiredService<AssessmentDbContext>(); db.GradeRevisions.Add(new GradeRevision { Id=Guid.NewGuid(), ExamAttemptId=id, TeacherId="missing-user", RevisedScore=10, TeacherComments="FK test", RevisedAt=DateTime.UtcNow, Version=99 }); bool rejected=false; try { await db.SaveChangesAsync(); } catch(DbUpdateException) { rejected=true; } Check(rejected, "SQLite foreign key rejects nonexistent teacher"); }
 Console.WriteLine(checks + " exam attempt checks passed.");
} finally { await app.StopAsync(); }
