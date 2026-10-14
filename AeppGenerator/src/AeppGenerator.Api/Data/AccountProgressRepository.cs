using System.Text.Json;
using AeppGenerator.Api.Gamification;
using Microsoft.Data.Sqlite;
namespace AeppGenerator.Api.Data;

public sealed record LeaderboardEntryDto(string UserId,string FullName,int TotalXP,int CurrentStreak,int Rank,string Username,string Avatar,int RankingXP,bool Self);
public sealed record LeaderboardPage(List<LeaderboardEntryDto> Items,int Page,int PageSize,bool HasNextPage);

public sealed partial class AccountStore
{
 public StudentProfile ReadProfile(string id,string day) { using var c=Open();using var tx=c.BeginTransaction(deferred:true);var profile=ReadProfile(c,tx,id,day);tx.Commit();return profile; }
 private StudentProfile ReadProfile(SqliteConnection c,SqliteTransaction tx,string id,string day)
 {
  StudentProfile p;
  using(var cmd=Command(c,tx,"SELECT PublicCode,Username,Avatar,GroupCode,FriendsJson,Badges,TotalXP,CurrentStreak,LastActivityDate,RecentLoopsJson,AttemptDay,AttemptStartedAt,TheoryAnswer FROM UserProgress WHERE UserId=$id",("$id",id)))using(var r=cmd.ExecuteReader()) {
   if(!r.Read())throw new UnauthorizedAccessException();
   p=new(){Id=id,PublicCode=r.GetString(0),Username=r.GetString(1),Avatar=r.GetString(2),Group=r.GetString(3),Friends=JsonSerializer.Deserialize<List<string>>(r.GetString(4),Json)!,Badges=JsonSerializer.Deserialize<List<string>>(r.GetString(5),Json)!,TotalXP=r.GetInt32(6),CurrentStreak=r.GetInt32(7),LastActivityDate=r.IsDBNull(8)?null:r.GetString(8),RecentLoops=JsonSerializer.Deserialize<List<bool>>(r.GetString(9),Json)!};
   if(!r.IsDBNull(10))p.Attempt=new(){Day=r.GetString(10),StartedAt=DateTimeOffset.Parse(r.GetString(11)),TheoryAnswer=r.IsDBNull(12)?null:r.GetString(12)};
  }
  if(p.LastActivityDate is null || string.CompareOrdinal(p.LastActivityDate,DateOnly.Parse(day).AddDays(-1).ToString("yyyy-MM-dd"))<0 || string.CompareOrdinal(p.LastActivityDate,day)>0)p.CurrentStreak=0;
  using(var cmd=Command(c,tx,"SELECT ChallengeDate,Score,XPEarned,CompletedAt,ResultJson FROM DailyChallengeCompletions WHERE UserId=$id AND ChallengeDate=$day",("$id",id),("$day",day)))using(var r=cmd.ExecuteReader())if(r.Read()){var completion=JsonSerializer.Deserialize<ChallengeCompletion>(r.GetString(4),Json)!;completion.Day=r.GetString(0);completion.CorrectCount=r.GetInt32(1);completion.Xp=r.GetInt32(2);completion.CompletedAt=DateTimeOffset.Parse(r.GetString(3));p.Completions.Add(completion);}
  using(var cmd=Command(c,tx,"SELECT Day FROM ChallengeFreezes WHERE UserId=$id AND WeekStart=$week",("$id",id),("$week",ProgressMigration.WeekStart(day))))using(var r=cmd.ExecuteReader())while(r.Read())p.Freezes.Add(r.GetString(0));
  using(var cmd=Command(c,tx,"SELECT Day FROM ChallengeStudyDays WHERE UserId=$id AND Day=$day",("$id",id),("$day",day)))if(cmd.ExecuteScalar() is string studied)p.Studies.Add(studied);
  return p;
 }
 public Task<T> ProfileTransaction<T>(string id,string day,Func<StudentProfile,T> action)
 {
  using var c=Open();using var tx=c.BeginTransaction(deferred:false);
  var p=ReadProfile(c,tx,id,day);
  var before=JsonSerializer.Serialize(p,Json);var existing=p.Completions.Count;
  var freezes=p.Freezes.ToHashSet();var studies=p.Studies.ToHashSet();
  var result=action(p);
  var completion=existing==0?p.Completions.SingleOrDefault():null;
  if(completion is not null) { using var insert=Command(c,tx,"INSERT INTO DailyChallengeCompletions(Id,UserId,ChallengeDate,Score,XPEarned,CompletedAt,ResultJson) VALUES($id,$user,$day,$score,$xp,$at,$json)",("$id",Guid.NewGuid().ToString()),("$user",id),("$day",completion.Day),("$score",completion.CorrectCount),("$xp",completion.Xp),("$at",completion.CompletedAt.ToString("O")),("$json",JsonSerializer.Serialize(completion,Json)));insert.ExecuteNonQuery(); }
  foreach(var freeze in p.Freezes.Where(date=>!freezes.Contains(date))) { using var insert=Command(c,tx,"INSERT INTO ChallengeFreezes VALUES($id,$day,$week)",("$id",id),("$day",freeze),("$week",ProgressMigration.WeekStart(freeze)));insert.ExecuteNonQuery(); }
  foreach(var study in p.Studies.Where(date=>!studies.Contains(date))) { using var insert=Command(c,tx,"INSERT INTO ChallengeStudyDays VALUES($id,$day) ON CONFLICT DO NOTHING",("$id",id),("$day",study));insert.ExecuteNonQuery(); }
  if(before!=JsonSerializer.Serialize(p,Json)) {
   // Μία ενημέρωση προόδου για τον συγκεκριμένο χρήστη, στην ίδια συναλλαγή με την ολοκλήρωση.
   using var update=Command(c,tx,"""
UPDATE UserProgress SET TotalXP=TotalXP+$xp,CurrentStreak=$streak,MaxStreak=MAX(MaxStreak,$streak),
 LastChallengeDate=CASE WHEN $completed=1 THEN $day ELSE LastChallengeDate END,LastActivityDate=$activity,
 Badges=$badges,Username=$name,Avatar=$avatar,GroupCode=$group,FriendsJson=$friends,RecentLoopsJson=$loops,
 AttemptDay=$attempt,AttemptStartedAt=$started,TheoryAnswer=$theory,
 WeeklyXP=CASE WHEN WeekStart=$week THEN WeeklyXP ELSE 0 END+$xp,WeekStart=$week
WHERE UserId=$id
""",("$xp",completion?.Xp??0),("$streak",p.CurrentStreak),("$completed",completion is null?0:1),("$day",day),("$activity",p.LastActivityDate),("$badges",JsonSerializer.Serialize(p.Badges,Json)),("$name",p.Username),("$avatar",p.Avatar),("$group",p.Group),("$friends",JsonSerializer.Serialize(p.Friends,Json)),("$loops",JsonSerializer.Serialize(p.RecentLoops.TakeLast(5),Json)),("$attempt",p.Attempt?.Day),("$started",p.Attempt?.StartedAt.ToString("O")),("$theory",p.Attempt?.TheoryAnswer),("$week",ProgressMigration.WeekStart(day)),("$id",id));
   if(update.ExecuteNonQuery()!=1)throw new UnauthorizedAccessException();
  }
  tx.Commit();return Task.FromResult(result);
 }
 public bool ValidFriends(string self,string[] codes)
 {
  if(codes.Length>30)return false;
  using var c=Open();using var cmd=Command(c,null,"SELECT COUNT(*) FROM UserProgress WHERE PublicCode IN (SELECT value FROM json_each($codes))",("$codes",JsonSerializer.Serialize(codes.Distinct(),Json)));
  return Convert.ToInt32(cmd.ExecuteScalar())==codes.Distinct().Count();
 }
 public const string NationalLeaderboardSql="""
SELECT p.UserId,u.FullName,p.TotalXP,
 CASE WHEN p.LastActivityDate BETWEEN $yesterday AND $day THEN p.CurrentStreak ELSE 0 END,
 p.Username,p.Avatar,p.TotalXP
FROM UserProgress p INDEXED BY IX_Progress_Ranking JOIN Users u ON u.Id=p.UserId
ORDER BY p.TotalXP DESC,CASE WHEN p.LastActivityDate BETWEEN $yesterday AND $day THEN p.CurrentStreak ELSE 0 END DESC,p.UserId LIMIT $limit OFFSET $offset
""";
 public Task<LeaderboardPage> Leaderboard(string id,string day,string period,string scope,int page,int pageSize)
 {
  if(period is not("weekly" or "all")||scope is not("national" or "group" or "friends")||page is <1 or >1000000||pageSize is <1 or >50)throw new ArgumentException("Μη έγκυρα φίλτρα ή σελιδοποίηση κατάταξης.");
  using var c=Open();var week=ProgressMigration.WeekStart(day);var offset=(page-1)*pageSize;
  var ranking=period=="all"?"p.TotalXP":"CASE WHEN p.WeekStart=$week THEN p.WeeklyXP ELSE 0 END";
  var filter=scope=="national"?"":"WHERE p.UserId=$id OR "+(scope=="group"?"(p.GroupCode<>'' AND p.GroupCode=(SELECT GroupCode FROM UserProgress WHERE UserId=$id))":"p.PublicCode IN (SELECT value FROM json_each((SELECT FriendsJson FROM UserProgress WHERE UserId=$id)))");
  var sql=period=="all"&&scope=="national"?NationalLeaderboardSql:$"SELECT p.UserId,u.FullName,p.TotalXP,CASE WHEN p.LastActivityDate BETWEEN $yesterday AND $day THEN p.CurrentStreak ELSE 0 END,p.Username,p.Avatar,{ranking} FROM UserProgress p JOIN Users u ON u.Id=p.UserId {filter} ORDER BY {ranking} DESC,CASE WHEN p.LastActivityDate BETWEEN $yesterday AND $day THEN p.CurrentStreak ELSE 0 END DESC,p.UserId LIMIT $limit OFFSET $offset";
  using var cmd=Command(c,null,sql,("$day",day),("$yesterday",DateOnly.Parse(day).AddDays(-1).ToString("yyyy-MM-dd")),("$week",week),("$id",id),("$limit",pageSize+1),("$offset",offset));using var r=cmd.ExecuteReader();List<LeaderboardEntryDto> rows=[];
  while(r.Read())rows.Add(new(r.GetString(0),r.GetString(1),r.GetInt32(2),r.GetInt32(3),offset+rows.Count+1,r.GetString(4),r.GetString(5),r.GetInt32(6),r.GetString(0)==id));
  var more=rows.Count>pageSize;if(more)rows.RemoveAt(rows.Count-1);return Task.FromResult(new LeaderboardPage(rows,page,pageSize,more));
 }
}
