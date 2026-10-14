using AeppGenerator.Api.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
namespace AeppGenerator.Api.Gamification;

public sealed class StudentProfile {
 [JsonIgnore] public int TotalXP {get;set;}
 [JsonIgnore] public int CurrentStreak {get;set;}
 [JsonIgnore] public string? LastActivityDate {get;set;}
 [JsonIgnore] public List<bool> RecentLoops {get;set;}=[];
 public string Id {get;set;}=Guid.NewGuid().ToString();
 public string PublicCode {get;set;}=Guid.NewGuid().ToString("N")[..12];
 public string Username {get;set;}="Μαθητής";
 public string Avatar {get;set;}="🦉";
 public string Group {get;set;}="";
 public List<string> Friends {get;set;}=[];
 public List<ChallengeCompletion> Completions {get;set;}=[];
 public List<string> Freezes {get;set;}=[];
 public List<string> Studies {get;set;}=[];
 public List<string> Badges {get;set;}=[];
 public ChallengeAttempt? Attempt {get;set;}
}
public sealed class ChallengeAttempt {
 public string Day {get;set;}="";
 public DateTimeOffset StartedAt {get;set;}
 public string? TheoryAnswer {get;set;}
}
public sealed class ChallengeCompletion {
 public string Day {get;set;}="";
 public DateTimeOffset StartedAt {get;set;}
 public DateTimeOffset CompletedAt {get;set;}
 public int DurationSeconds {get;set;}
 public Dictionary<string,string> Answers {get;set;}=[];
 public List<AnswerFeedback> Feedback {get;set;}=[];
 public int CorrectCount {get;set;}
 public int Xp {get;set;}
 public double Multiplier {get;set;}
 public int Streak {get;set;}
 public List<string> NewBadges {get;set;}=[];
 public List<bool> LoopResults {get;set;}=[];
}
public sealed record AnswerFeedback(bool Correct,string Expected,string Explanation,JsonNode Reference);
public sealed record RankingRow(int Rank,string Username,string Avatar,int Streak,int TotalXp,int RankingXp,bool Self);
public sealed class GamificationService {
 private static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
 private readonly SemaphoreSlim gate=new(1,1);
 private readonly string path;
 private readonly AccountStore? store;
 private readonly TimeProvider clock;
 private readonly JsonArray packs;
 private readonly string rotationStartsOn;
 private readonly int legacyPackCount;
 private readonly int firstPackIndex;
 private static readonly TimeZoneInfo Athens=TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens");
 public GamificationService(string path,TimeProvider? clock=null,AccountStore? store=null) {
  this.path=path;this.store=store;this.clock=clock??TimeProvider.System;
  using var stream=typeof(GamificationService).Assembly.GetManifestResourceStream("AeppGenerator.DailyChallengeBank")??throw new InvalidOperationException("Daily bank missing");
  var bank=JsonNode.Parse(stream)!;
  packs=bank["packs"]!.AsArray();
  rotationStartsOn=bank["rotation"]!["startsOn"]!.GetValue<string>();
  legacyPackCount=bank["rotation"]!["legacyPackCount"]!.GetValue<int>();
  firstPackIndex=bank["rotation"]!["firstPackIndex"]!.GetValue<int>();
 }
 public DateTimeOffset Now=>clock.GetUtcNow();
 public string Day=>TimeZoneInfo.ConvertTime(Now,Athens).ToString("yyyy-MM-dd");
 private static int Number(string day)=>DateOnly.ParseExact(day,"yyyy-MM-dd").DayNumber-DateOnly.FromDateTime(DateTime.UnixEpoch).DayNumber;
 private static int Week(string day){var n=Number(day);return n-((n+3)%7+7)%7;}
 private JsonObject Pack {
  get {
   var delta=Number(Day)-Number(rotationStartsOn);
   var index=delta<0?((Number(Day)%legacyPackCount)+legacyPackCount)%legacyPackCount:(firstPackIndex+delta)%packs.Count;
   return packs[index]!.AsObject();
  }
 }
 public static int Streak(StudentProfile p,string day){var entries=p.Completions.Select(c=>(c.Day,true)).Concat(p.Freezes.Where(d=>!p.Completions.Any(c=>c.Day==d)).Select(d=>(d,false))).OrderBy(e=>e.Item1);var count=0;var last=int.MinValue;foreach(var e in entries){var n=Number(e.Item1);if(n>Number(day))continue;if(n!=last+1)count=0;if(e.Item2)count++;last=n;}return last>=Number(day)-1?count:0;}
 private static string Normalize(string s)=>string.Concat(s.Normalize().Trim().Where(c=>!char.IsWhiteSpace(c))).ToUpperInvariant().Replace("≤","<=").Replace("≥",">=");
 private AnswerFeedback Grade(int i,Dictionary<string,string> answers){var q=Pack["questions"]![i]!;var id=q["id"]!.GetValue<string>();var kind=q["kind"]!.GetValue<string>();var blanks=q["blanks"]!.AsArray();var expected=kind=="fill"?string.Join(", ",blanks.Select(b=>b!["accepted"]![0]!.GetValue<string>())):q["answer"]!.GetValue<string>();var correct=kind=="fill"?blanks.All(b=>b!["accepted"]!.AsArray().Any(a=>Normalize(a!.GetValue<string>())==Normalize(answers.GetValueOrDefault(id+":"+b["id"]!.GetValue<string>(),"")))):Normalize(expected)==Normalize(answers.GetValueOrDefault(id,""));return new(correct,kind=="theory"?(expected=="true"?"Σωστό":"Λάθος"):expected,q["explanation"]!.GetValue<string>(),q["reference"]!.DeepClone());}
 private object State(StudentProfile p){var questions=Pack["questions"]!.AsArray().Select(q=>new {id=q!["id"]!.GetValue<string>(),kind=q["kind"]!.GetValue<string>(),prompt=q["prompt"]!.GetValue<string>(),code=q["code"]?.GetValue<string>(),declarations=q["declarations"]?.GetValue<string>(),blanks=q["blanks"]!.AsArray().Select(b=>new{id=b!["id"]!.GetValue<string>(),options=b["options"]!.DeepClone()})});return new{profile=p,day=Day,title=Pack["title"]!.GetValue<string>(),questions,streak=store is null?Streak(p,Day):p.CurrentStreak,xp=store is null?p.Completions.Sum(c=>c.Xp):p.TotalXP,completion=p.Completions.FirstOrDefault(c=>c.Day==Day),theoryFeedback=p.Attempt?.Day==Day&&p.Attempt.TheoryAnswer!=null?Grade(0,new(){[Pack["questions"]![0]!["id"]!.GetValue<string>()]=p.Attempt.TheoryAnswer}):null,serverNow=Now};}
 public async Task<T> Transaction<T>(string id,Func<StudentProfile,List<StudentProfile>,T> action){if(store!=null)return await store.ProfileTransaction(id,Day,p=>action(p,[]));await gate.WaitAsync();try{var profiles=File.Exists(path)?JsonSerializer.Deserialize<List<StudentProfile>>(await File.ReadAllTextAsync(path),Json)??[]:[];var p=profiles.Find(p=>p.Id==id);if(p==null){p=new(){Id=id};profiles.Add(p);}var result=action(p,profiles);Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);var temp=path+".tmp";await File.WriteAllTextAsync(temp,JsonSerializer.Serialize(profiles,Json));File.Move(temp,path,true);return result;}finally{gate.Release();}}
 public Task<object> Get(string id)=>store is null?Transaction(id,(p,_)=>State(p)):Task.FromResult(State(store.ReadProfile(id,Day)));
 public Task<object> Start(string id)=>Transaction(id,(p,_)=>{if(!p.Completions.Any(c=>c.Day==Day)&&p.Attempt?.Day!=Day)p.Attempt=new(){Day=Day,StartedAt=Now};return State(p);});
 public Task<object> Theory(string id,string day,string answer)=>Transaction(id,(p,_)=>{EnsureDay(day);if(p.Completions.Any(c=>c.Day==Day))return State(p);if(p.Attempt?.Day!=Day)throw new ArgumentException("Ξεκίνα πρώτα το challenge.");if(answer is not("true" or "false"))throw new ArgumentException("Μη έγκυρη επιλογή.");if((Now-p.Attempt.StartedAt).TotalSeconds>=600)throw new ArgumentException("Ο χρόνος τελείωσε. Υπόβαλε τις απαντήσεις σου.");p.Attempt.TheoryAnswer??=answer;return State(p);});
 private void EnsureDay(string day){if(day!=Day)throw new ArgumentException("Η ημέρα άλλαξε. Άνοιξε το νέο challenge.");}
 public Task<object> Complete(string id,string day,Dictionary<string,string> answers)=>Transaction(id,(p,_)=>{
 EnsureDay(day);if(p.Completions.Any(c=>c.Day==Day))return State(p);if(p.Attempt?.Day!=Day)throw new ArgumentException("Ξεκίνα πρώτα το challenge.");if(answers.Count>8||answers.Any(a=>a.Key.Length>100||a.Value is null||a.Value.Length>200))throw new ArgumentException("Μη έγκυρες απαντήσεις.");
 var duration=Math.Max(0,(int)(Now-p.Attempt.StartedAt).TotalSeconds);
 if(duration>605)answers=[];
 answers[Pack["questions"]![0]!["id"]!.GetValue<string>()]=p.Attempt.TheoryAnswer??"";
 var results=Enumerable.Range(0,3).Select(i=>Grade(i,answers)).ToList();var count=results.Count(f=>f.Correct);
 var c=new ChallengeCompletion{Day=Day,StartedAt=p.Attempt.StartedAt,CompletedAt=Now,DurationSeconds=duration,Answers=answers,Feedback=results,CorrectCount=count,LoopResults=Enumerable.Range(0,3).Where(i=>Pack["questions"]![i]!["tags"]!.AsArray().Any(t=>t!.GetValue<string>()=="loops")).Select(i=>results[i].Correct).ToList()};
 p.Completions.Add(c);c.Streak=store is null?Streak(p,Day):p.CurrentStreak+1;if(store is not null){p.CurrentStreak=c.Streak;p.LastActivityDate=Day;}c.Multiplier=Math.Min(2,1+Math.Floor(c.Streak/7d)*0.1);c.Xp=(int)Math.Floor((10+30*count+(duration<180?10*count:duration<600?5*count:0))*c.Multiplier+0.5);
 if(store is not null)p.TotalXP+=c.Xp;
 List<string> eligible=["first"];if(duration<180)eligible.Add("lightning");if(c.Streak>=30)eligible.Add("month");var loops=(store is null?p.Completions.SelectMany(c=>c.LoopResults):p.RecentLoops.Concat(c.LoopResults)).TakeLast(5).ToArray();if(store is not null)p.RecentLoops=loops.ToList();if(loops.Length==5&&loops.All(x=>x))eligible.Add("loops");if(count==3&&(Pack["id"]!.GetValue<string>() is "search" or "sort" || (Pack["id"]!.GetValue<string>().StartsWith("daily-",StringComparison.Ordinal) && Pack["questions"]!.AsArray().Any(q=>q!["tags"]!.AsArray().Any(t=>t!.GetValue<string>()=="search")))))eligible.Add("arrays");c.NewBadges=eligible.Where(b=>!p.Badges.Contains(b)).ToList();p.Badges.AddRange(c.NewBadges);return State(p);});
 public Task<object> Study(string id,string lesson)=>Transaction(id,(p,_)=>{if(!System.Text.RegularExpressions.Regex.IsMatch(lesson,@"^lesson-(?:[1-9]|1[0-6]|5a|5b)$"))throw new ArgumentException("Μη έγκυρο μάθημα.");if(!p.Studies.Contains(Day))p.Studies.Add(Day);return State(p);});
 public Task<object> Freeze(string id)=>Transaction(id,(p,_)=>{if(p.Freezes.Contains(Day))return State(p);if(p.Completions.Any(c=>c.Day==Day)||(store is null?Streak(p,Day):p.CurrentStreak)==0||!p.Studies.Contains(Day)||p.Freezes.Any(d=>Week(d)==Week(Day)))throw new ArgumentException("Το freeze απαιτεί ενεργό σερί, μελέτη σήμερα και διαθέσιμη εβδομαδιαία χρήση.");p.Freezes.Add(Day);if(store is not null)p.LastActivityDate=Day;return State(p);});
 public Task<object> Update(string id,string username,string avatar,string group,string[] friends)=>Transaction(id,(p,all)=>{username=username.Trim();group=group.Trim().ToUpperInvariant();if(username.Length is <2 or >24||group.Length>30||friends.Length>30||!new[]{"🦉","🐢","🦊","🐱","🚀"}.Contains(avatar)||username.Any(char.IsControl)||group.Any(char.IsControl))throw new ArgumentException("Έλεγξε το ψευδώνυμο (2–24 χαρακτήρες), το avatar και την ομάδα.");if(store is null?friends.Any(f=>f!=p.PublicCode&&!all.Any(s=>s.PublicCode==f)):!store.ValidFriends(id,friends))throw new ArgumentException("Ο κωδικός φίλου δεν βρέθηκε.");p.Username=username;p.Avatar=avatar;p.Group=group;p.Friends=friends.Where(f=>f!=p.PublicCode).Distinct().ToList();return State(p);});
 public Task<List<RankingRow>> Leaderboard(string id,string period,string scope)=>store is not null?DatabaseRanking(id,period,scope):Transaction(id,(p,all)=>{if(period is not("weekly" or "all")||scope is not("national" or "group" or "friends"))throw new ArgumentException("Μη έγκυρο φίλτρο.");var sorted=all.Where(s=>scope=="national"||s.Id==id||(scope=="group"?p.Group!=""&&s.Group==p.Group:p.Friends.Contains(s.PublicCode))).Select(s=>new RankingRow(0,s.Username,s.Avatar,Streak(s,Day),s.Completions.Sum(c=>c.Xp),s.Completions.Where(c=>period=="all"||Week(c.Day)==Week(Day)).Sum(c=>c.Xp),s.Id==id)).OrderByDescending(s=>s.RankingXp).ThenBy(s=>s.Username,StringComparer.Ordinal).ToList();return sorted.Select((r,i)=>r with{Rank=sorted.FindIndex(x=>x.RankingXp==r.RankingXp)+1}).ToList();});
 private async Task<List<RankingRow>> DatabaseRanking(string id,string period,string scope){var page=await store!.Leaderboard(id,Day,period,scope,1,50);return page.Items.Select(row=>new RankingRow(row.Rank,row.Username,row.Avatar,row.CurrentStreak,row.TotalXP,row.RankingXP,row.Self)).ToList();}
 public Task<LeaderboardPage> RankingPage(string id,string period,string scope,int page,int pageSize)=>store is not null?store.Leaderboard(id,Day,period,scope,page,pageSize):throw new InvalidOperationException("Η κατάταξη απαιτεί βάση λογαριασμών.");

}
