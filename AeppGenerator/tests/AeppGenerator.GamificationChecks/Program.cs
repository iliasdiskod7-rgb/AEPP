using System.Text.Json;
using System.Text.Json.Nodes;
using AeppGenerator.Api.Gamification;
var clock=new TestClock{Time=DateTimeOffset.Parse("2026-10-08T10:00:00Z")};
var directory=Path.Combine(Path.GetTempPath(),"aepp-gamification-"+Guid.NewGuid().ToString("N"));
var path=Path.Combine(directory,"state.json");var service=new GamificationService(path,clock);var id=Guid.NewGuid().ToString();int checks=0;
var options=new JsonSerializerOptions(JsonSerializerDefaults.Web);
JsonNode Node(object o)=>JsonSerializer.SerializeToNode(o,options)!;
void Check(bool condition,string label){if(!condition)throw new Exception(label);checks++;Console.WriteLine("PASS "+label);}
async Task Reject(Func<Task<object>> call,string label){try{await call();throw new Exception("Expected rejection: "+label);}catch(ArgumentException){Check(true,label);}}
using var stream=typeof(GamificationService).Assembly.GetManifestResourceStream("AeppGenerator.DailyChallengeBank")!;
var packs=JsonNode.Parse(stream)!["packs"]!.AsArray();
Check(packs.Count==100,"embedded bank contains 100 packs");
JsonNode Pack(string day){var n=(int)(DateTime.Parse(day)-DateTime.UnixEpoch).TotalDays;var start=(int)(DateTime.Parse("2026-10-15")-DateTime.UnixEpoch).TotalDays;return packs[n<start?((n%21)+21)%21:(21+n-start)%packs.Count]!;}
Dictionary<string,string> Answers(string day)=>Pack(day)["questions"]!.AsArray().SelectMany(q=>q!["kind"]!.GetValue<string>()=="fill"?q["blanks"]!.AsArray().Select(b=>KeyValuePair.Create(q["id"]!.GetValue<string>()+":"+b!["id"]!.GetValue<string>(),b["accepted"]![0]!.GetValue<string>())):[KeyValuePair.Create(q["id"]!.GetValue<string>(),q["answer"]!.GetValue<string>())]).ToDictionary();
async Task<JsonNode> Finish(string identity,string day){clock.Time=DateTimeOffset.Parse(day+"T10:00:00Z");await service.Start(identity);await service.Theory(identity,day,Pack(day)["questions"]![0]!["answer"]!.GetValue<string>());clock.Time=clock.Time.AddSeconds(120);return Node(await service.Complete(identity,day,Answers(day)));}
var initial=Node(await service.Get(id));Check(initial["day"]!.GetValue<string>()=="2026-10-08","Athens day");Check(!initial["questions"]!.ToJsonString().Contains("accepted"),"public DTO strips solutions");
await Reject(()=>service.Complete(id,service.Day,[]),"cannot complete before start");await service.Start(id);var started=Node(await service.Get(id))["profile"]!["attempt"]!["startedAt"]!.GetValue<string>();clock.Time=clock.Time.AddSeconds(30);await service.Start(id);Check(Node(await service.Get(id))["profile"]!["attempt"]!["startedAt"]!.GetValue<string>()==started,"start idempotency");
await service.Theory(id,service.Day,"false");await service.Theory(id,service.Day,"true");Check(Node(await service.Get(id))["profile"]!["attempt"]!["theoryAnswer"]!.GetValue<string>()=="false","theory locks first choice");
await Task.WhenAll(Enumerable.Range(0,12).Select(_=>service.Complete(id,service.Day,Answers(service.Day))));var complete=Node(await service.Get(id));Check(complete["profile"]!["completions"]!.AsArray().Count==1,"12 concurrent submissions award once");var xp=complete["xp"]!.GetValue<int>();var restored=new GamificationService(path,clock);Check(Node(await restored.Get(id))["xp"]!.GetValue<int>()==xp,"durable state across service restart");await Reject(()=>service.Complete(id,"2026-10-07",[]),"stale day rejected");
var longId=Guid.NewGuid().ToString();for(int i=0;i<30;i++)await Finish(longId,DateOnly.Parse("2026-09-01").AddDays(i).ToString("yyyy-MM-dd"));var month=Node(await service.Get(longId));Check(month["streak"]!.GetValue<int>()==30,"30 consecutive days");Check(month["profile"]!["badges"]!.AsArray().Any(b=>b!.GetValue<string>()=="month"),"month badge");Check(month["profile"]!["badges"]!.AsArray().Any(b=>b!.GetValue<string>()=="loops"),"loop badge");Check(month["profile"]!["badges"]!.AsArray().Any(b=>b!.GetValue<string>()=="arrays"),"array badge");
var freezeId=Guid.NewGuid().ToString();await Finish(freezeId,"2026-10-05");clock.Time=DateTimeOffset.Parse("2026-10-06T10:00:00Z");await Reject(()=>service.Freeze(freezeId),"freeze requires study");await service.Study(freezeId,"lesson-1");await service.Freeze(freezeId);await service.Freeze(freezeId);Check(Node(await service.Get(freezeId))["streak"]!.GetValue<int>()==1,"freeze preserves count");Check(Node(await service.Get(freezeId))["xp"]!.GetValue<int>()==130,"freeze awards no XP");Check((await Finish(freezeId,"2026-10-07"))["streak"]!.GetValue<int>()==2,"freeze bridges one day");clock.Time=DateTimeOffset.Parse("2026-10-08T10:00:00Z");await service.Study(freezeId,"lesson-1");await Reject(()=>service.Freeze(freezeId),"one freeze per calendar week");clock.Time=DateTimeOffset.Parse("2026-10-09T10:00:00Z");Check(Node(await service.Get(freezeId))["streak"]!.GetValue<int>()==0,"gap expires streak");
var slow=Guid.NewGuid().ToString();clock.Time=DateTimeOffset.Parse("2026-10-08T10:00:00Z");await service.Start(slow);await service.Theory(slow,service.Day,Pack(service.Day)["questions"]![0]!["answer"]!.GetValue<string>());clock.Time=clock.Time.AddSeconds(606);Check(Node(await service.Complete(slow,service.Day,Answers(service.Day)))["completion"]!["correctCount"]!.GetValue<int>()==1,"late edited answers ignored");
clock.Time=DateTimeOffset.Parse("2026-10-07T20:59:59Z");Check(service.Day=="2026-10-07","Athens before midnight");clock.Time=clock.Time.AddSeconds(1);Check(service.Day=="2026-10-08","Athens rollover");clock.Time=DateTimeOffset.Parse("2026-12-01T22:00:00Z");Check(service.Day=="2026-12-02","Athens winter offset");
clock.Time=DateTimeOffset.Parse("2026-10-08T10:00:00Z");await service.Update(id,"Άλφα","🦉","A",[]);await service.Update(freezeId,"Βήτα","🐢","A",[]);await service.Update(slow,"Γάμμα","🦊","B",[]);Check((await service.Leaderboard(id,"all","group")).Count==2,"group filter");var friendCode=Node(await service.Get(slow))["profile"]!["publicCode"]!.GetValue<string>();await service.Update(id,"Άλφα","🦉","A",[friendCode]);Check((await service.Leaderboard(id,"all","friends")).Count==2,"friend filter");Check((await service.Leaderboard(id,"all","national")).Count==4,"real profiles only");await Reject(()=>service.Update(id,"Άλφα","🦉","A",["invalid"]),"unknown friend rejected");
var rankJson=JsonSerializer.Serialize(await service.Leaderboard(id,"weekly","national"),options);Check(!rankJson.Contains("publicCode")&&!rankJson.Contains("answers"),"leaderboard excludes private data");
var rotationIds=new HashSet<string>();
for(var i=0;i<100;i++){
 var day=DateOnly.Parse("2026-10-15").AddDays(i).ToString("yyyy-MM-dd");
 clock.Time=DateTimeOffset.Parse(day+"T10:00:00Z");
 var state=Node(await service.Get(id));
 var questionId=state["questions"]![0]!["id"]!.GetValue<string>();
 if(questionId!=Pack(day)["questions"]![0]!["id"]!.GetValue<string>())throw new Exception("Rotation mismatch on "+day);
 rotationIds.Add(questionId);
}
Check(rotationIds.Count==100,"backend rotates through all 100 distinct packs after cutover");
var newSearch=await Finish(Guid.NewGuid().ToString(),"2026-10-27");
Check(newSearch["profile"]!["badges"]!.AsArray().Any(b=>b!.GetValue<string>()=="arrays"),"new search variant awards array badge");
Console.WriteLine($"{checks} gamification checks passed. Store: {path}");
sealed class TestClock:TimeProvider{public DateTimeOffset Time{get;set;}public override DateTimeOffset GetUtcNow()=>Time;}
