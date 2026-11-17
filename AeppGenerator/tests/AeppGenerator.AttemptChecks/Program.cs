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
app.UseDeveloperExceptionPage(); app.UseRouting(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers(); await app.StartAsync();
using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
var json = new JsonSerializerOptions(JsonSerializerDefaults.Web); json.Converters.Add(new JsonStringEnumConverter());
int checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; Console.WriteLine("PASS " + label); }
using (var scope = app.Services.CreateScope())
{
 var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
 var practiceExam = await db.Exams.SingleAsync(exam => exam.Id == "aepp-2026-01");
 Check(await db.Exams.CountAsync() == 5 && practiceExam.Title == "Πρότυπο διαγώνισμα 1 · Σχολικοί διαγωνισμοί και ενεργειακές μετρήσεις" && JsonDocument.Parse(practiceExam.DefinitionJson).RootElement.GetProperty("sections").GetArrayLength() == 4, "all five authored exams are seeded exactly once");
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
 Check((await Request("/review-history", studentToken)).StatusCode == HttpStatusCode.NotFound, "teacher queue removed");
 Check((await DirectGet("/api/exams/random", null)).StatusCode == HttpStatusCode.Unauthorized, "random exam bank requires authentication");
 var randomResponse = await DirectGet("/api/exams/random", studentToken);
 Check(randomResponse.IsSuccessStatusCode, "authenticated learner can fetch a random seeded exam");
 using (var randomJson = JsonDocument.Parse(await randomResponse.Content.ReadAsStringAsync()))
 {
  var random = randomJson.RootElement;
  var exam = random.GetProperty("exam");
  var bankQuestions = exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).ToList();
  Check(random.GetProperty("hiddenTestCases").GetInt32() == 8, "random exam reports hidden tests without exposing their contents");
  Check(exam.GetProperty("sections").GetArrayLength() == 4 && bankQuestions.Select(question => question.GetProperty("code").GetString()).Any(code => code == "Γ1") && bankQuestions.Any(question => question.GetProperty("code").GetString() == "Δ1"), "random exam includes all four themes");
  Check(bankQuestions.All(question => question.GetProperty("solution").GetString() == "") && bankQuestions.Where(question => question.GetProperty("kind").GetString() == "program").All(question => question.GetProperty("testCases").GetArrayLength() == 0 && question.GetProperty("referenceCode").GetString() == ""), "pre-submission response withholds solutions, code and test cases");
 }
 using (var scope = app.Services.CreateScope())
  Check(await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.CountAsync(exam => exam.Source == "practice") == 5, "database seed contains exactly five model exams");
 Check((await DirectGet("/api/exams", null)).StatusCode == HttpStatusCode.Unauthorized, "exam list requires authentication");
 using (var list = JsonDocument.Parse(await (await DirectGet("/api/exams", studentToken)).Content.ReadAsStringAsync()))
 {
  Check(list.RootElement.GetArrayLength() == 5, "lobby list contains five bank exams");
  Check(list.RootElement.EnumerateArray().All(item => item.GetProperty("exam").GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).All(q => q.GetProperty("solution").GetString() == "")), "lobby list withholds solutions");
  var excluded = list.RootElement[0].GetProperty("examId").GetString();
  using var shuffled = JsonDocument.Parse(await (await DirectGet("/api/exams/random?excludeId=" + excluded, studentToken)).Content.ReadAsStringAsync());
  Check(shuffled.RootElement.GetProperty("examId").GetString() != excluded, "shuffle avoids current exam");
 }
 using (var scope = app.Services.CreateScope())
 {
  var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
  var entry = await db.Exams.SingleAsync(exam => exam.Id == "aepp-2026-01");
  var legacy = System.Text.Json.Nodes.JsonNode.Parse(entry.DefinitionJson)!;
  var b = legacy["sections"]![1]!["questions"]!.AsArray();
  foreach (var q in b.Where(q => q!["id"]!.GetValue<string>() is "b2a" or "b2b"))
   q!["prompt"] = q["prompt"]!.GetValue<string>().Replace("i <- i + 1", "i <- i + (1)");
  b.Single(q => q!["id"]!.GetValue<string>() == "b3")!["columns"]!.AsArray().Add("ΕΞΟΔΟΣ");
  entry.DefinitionJson = legacy.ToJsonString();
  await db.SaveChangesAsync();
 }
 await app.InitializeExamAttempts();
 using (var scope = app.Services.CreateScope())
 {
  var entry = await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.SingleAsync(exam => exam.Id == "aepp-2026-01");
  var corrected = System.Text.Json.Nodes.JsonNode.Parse(entry.DefinitionJson)!["sections"]![1]!["questions"]!.AsArray();
  Check(corrected.Where(q => q!["id"]!.GetValue<string>() is "b2a" or "b2b").All(q => !q!["prompt"]!.GetValue<string>().Contains("i <- i + (1)")), "existing exam B2 increments corrected on startup");
  Check(corrected.Single(q => q!["id"]!.GetValue<string>() == "b3")!["columns"]!.AsArray().Count == 2, "existing exam B3 redundant output column removed on startup");
 }
 var id = Guid.NewGuid();
 var attempt = await Detail(await Request("/start", studentToken, new StartAttemptRequest(id, "aepp-2026-01", null)));
 Check(attempt.AttemptId == id && attempt.Status == ExamAttemptStatus.IN_PROGRESS && attempt.SubmittedAt is null && attempt.StartedAt.Kind == DateTimeKind.Utc, "start persists server UTC timestamp");
 Check(attempt.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).All(question => question.GetProperty("solution").GetString() == ""), "attempt start keeps solution keys withheld");
 Check((await Detail(await Request("/start", studentToken, new StartAttemptRequest(id, attempt.ExamId, null)))).AttemptId == id, "start retry idempotent");
 Check((await Request("/" + id, otherToken)).StatusCode == HttpStatusCode.NotFound, "other student cannot read attempt");
 Check((await Request("/" + id, teacherToken)).StatusCode == HttpStatusCode.NotFound, "teacher cannot read unfinished student work");
 Check((await Request("/" + id + "/grade", studentToken, new { revisedScore = 100, teacherComments = "fake", expectedVersion = 1, role = "TEACHER" })).StatusCode == HttpStatusCode.NotFound, "grading route removed");
 var questions = attempt.Exam.GetProperty("sections").EnumerateArray().SelectMany(section => section.GetProperty("questions").EnumerateArray()).Select(question => new QuestionSubmissionRequest(question.GetProperty("id").GetString()!, "\"\"", "[]", question.GetProperty("kind").GetString() is "program" or "open" ? 0 : question.GetProperty("marks").GetDecimal(), question.GetProperty("marks").GetDecimal(), null, null, null)).ToList();
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
 Check((await Request("/" + id + "/grade", teacherToken, new GradeAttemptRequest(85, "Δοκιμή", 1))).StatusCode == HttpStatusCode.NotFound, "legacy teacher cannot grade");
 Check((await Request("/" + id, teacherToken)).StatusCode == HttpStatusCode.NotFound, "legacy teacher cannot read submitted work owned by another user");
 Check((await Request("/review-history", teacherToken)).StatusCode == HttpStatusCode.NotFound, "legacy teacher queue removed");
 var history = (await (await Request("/my-history", studentToken)).Content.ReadFromJsonAsync<AttemptPage>(json))!;
 Check(history.Total == 1 && history.Items.Single().Sections.Count == 4, "own history includes section scores");
 Check((await (await Request("/my-history", otherToken)).Content.ReadFromJsonAsync<AttemptPage>(json))!.Total == 0, "history isolated by owner");
 using(var scope=app.Services.CreateScope()) { var db=scope.ServiceProvider.GetRequiredService<AssessmentDbContext>(); Check(!db.Database.HasPendingModelChanges(), "migration snapshot matches EF model"); Check(await db.GradeRevisions.CountAsync()==0 && await db.QuestionSubmissions.CountAsync()==questions.Count, "submissions preserved without teacher revisions"); }
 var draft = await Detail(await Request("/start", studentToken, new StartAttemptRequest(Guid.NewGuid(), "aepp-2026-01", null)));
 Check((await Request("/" + draft.AttemptId + "/grade", teacherToken, new GradeAttemptRequest(50, "Πρόωρη αξιολόγηση", 1))).StatusCode == HttpStatusCode.NotFound, "unfinished attempts have no grading route");
 Check((await Request("/my-history?page=2147483647", studentToken)).StatusCode == HttpStatusCode.BadRequest, "pagination overflow rejected");
 var duplicateQuestions=questions.ToList(); duplicateQuestions[1]=duplicateQuestions[0];
 Check((await Request("/submit", studentToken, new SubmitAttemptRequest(draft.AttemptId, duplicateQuestions))).StatusCode == HttpStatusCode.BadRequest, "duplicate questions rejected");
 var source = new ExamJsonResponseDto { Title = "Διαγώνισμα δοκιμής", DurationMinutes = 180, Sections = new[] { "Α", "Β", "Γ", "Δ" }.Select(letter => new ExamSectionDto { Theme = "Θέμα " + letter, TotalMarks = 25, Questions = [new QuestionDto { Code = letter + "1", QuestionText = "Ερώτημα δοκιμής", GlowCodeSnippet = null, SolutionText = "Λύση δοκιμής", Marks = 25 }] }).ToList() };
 Check((await Request("/start", studentToken, new StartAttemptRequest(Guid.NewGuid(), "generated-client", source))).StatusCode == HttpStatusCode.BadRequest, "generated exams rejected in public edition");
 using (var scope = app.Services.CreateScope())
 {
  var db = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
  var seededExam = await db.Exams.SingleAsync(exam => exam.Id == "aepp-2026-01");
  db.ExamAttempts.Add(new ExamAttempt { Id = Guid.NewGuid(), UserId = student.Id, ExamId = seededExam.Id, StartedAt = DateTime.UtcNow, Status = ExamAttemptStatus.IN_PROGRESS });
  seededExam.Title = "Ιστορική έκδοση";
  seededExam.DefinitionJson = "{}";
  await db.SaveChangesAsync();
 }
 await app.InitializeExamAttempts();
 using (var scope = app.Services.CreateScope())
 {
  var seededExam = await scope.ServiceProvider.GetRequiredService<AssessmentDbContext>().Exams.SingleAsync(exam => exam.Id == "aepp-2026-01");
  Check(seededExam.Title == "Ιστορική έκδοση" && seededExam.DefinitionJson == "{}", "seeding preserves exam definitions referenced by existing attempts");
 }
 using(var scope=app.Services.CreateScope()) { var db=scope.ServiceProvider.GetRequiredService<AssessmentDbContext>(); db.GradeRevisions.Add(new GradeRevision { Id=Guid.NewGuid(), ExamAttemptId=id, TeacherId="missing-user", RevisedScore=10, TeacherComments="FK test", RevisedAt=DateTime.UtcNow, Version=99 }); bool rejected=false; try { await db.SaveChangesAsync(); } catch(DbUpdateException) { rejected=true; } Check(rejected, "SQLite foreign key rejects nonexistent teacher"); }

 using(var stream=typeof(ExamCatalog).Assembly.GetManifestResourceStream("AeppGenerator.PracticeExam")!) {
  var trustedBank=await System.Text.Json.Nodes.JsonNode.ParseAsync(stream);
  var trusted=trustedBank!.AsArray().Single(exam=>exam!["id"]!.GetValue<string>()=="aepp-2026-02");
  var fresh=await Detail(await Request("/start",studentToken,new StartAttemptRequest(Guid.NewGuid(),"aepp-2026-02",null)));
  var referenceQuestions=trusted!["sections"]!.AsArray().SelectMany(section=>section!["questions"]!.AsArray()).Select(q=>new QuestionSubmissionRequest(q!["id"]!.GetValue<string>(),
   q["kind"]!.GetValue<string>()=="program"?JsonSerializer.Serialize(q["referenceCode"]!.GetValue<string>()):"\"\"", "[]", 0,q["marks"]!.GetValue<decimal>(),null,null,null)).ToList();
  var result=await Detail(await Request("/submit",studentToken,new SubmitAttemptRequest(fresh.AttemptId,referenceQuestions)));
  Check(result.AutoGradeScore==50,"server executes both reference programs and awards 50 code points independently of client scores");
  Check(result.Report!.Value.GetProperty("sections").EnumerateArray().SelectMany(section=>section.GetProperty("questions").EnumerateArray()).Where(question=>question.GetProperty("code").GetString() is "Γ1" or "Δ1").All(question=>question.GetProperty("pending").GetDecimal()==0),"runtime program marks do not remain pending teacher review");
  Check(result.QuestionSubmissions.Where(q=>q.QuestionId is "c1" or "d1").All(q=>q.AutoPoints==25),"server-derived code scores are persisted per theme");
 }
 Console.WriteLine(checks + " exam attempt checks passed.");
} finally { await app.StopAsync(); }
