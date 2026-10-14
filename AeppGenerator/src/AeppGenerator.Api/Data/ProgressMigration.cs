using System.Text.Json;
using AeppGenerator.Api.Gamification;
using Microsoft.Data.Sqlite;
namespace AeppGenerator.Api.Data;

internal static class ProgressMigration
{
 internal const string Schema = """
CREATE TABLE IF NOT EXISTS UserProgress (
 UserId TEXT PRIMARY KEY REFERENCES Users(Id) ON DELETE CASCADE,
 TotalXP INTEGER NOT NULL DEFAULT 0 CHECK(TotalXP>=0), CurrentStreak INTEGER NOT NULL DEFAULT 0 CHECK(CurrentStreak>=0),
 MaxStreak INTEGER NOT NULL DEFAULT 0, LastChallengeDate TEXT, LastActivityDate TEXT,
 Badges TEXT NOT NULL DEFAULT '[]', PublicCode TEXT NOT NULL UNIQUE, Username TEXT NOT NULL, Avatar TEXT NOT NULL DEFAULT '🦉',
 GroupCode TEXT NOT NULL DEFAULT '', FriendsJson TEXT NOT NULL DEFAULT '[]', RecentLoopsJson TEXT NOT NULL DEFAULT '[]',
 AttemptDay TEXT, AttemptStartedAt TEXT, TheoryAnswer TEXT,
 WeekStart TEXT, WeeklyXP INTEGER NOT NULL DEFAULT 0 CHECK(WeeklyXP>=0)
);
CREATE TABLE IF NOT EXISTS ChallengeFreezes (
 UserId TEXT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE, Day TEXT NOT NULL, WeekStart TEXT NOT NULL,
 PRIMARY KEY(UserId,Day), UNIQUE(UserId,WeekStart)
);
CREATE TABLE IF NOT EXISTS ChallengeStudyDays (
 UserId TEXT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE, Day TEXT NOT NULL, PRIMARY KEY(UserId,Day)
);
""";
 private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
 private static SqliteCommand Cmd(SqliteConnection c,SqliteTransaction tx,string sql,params (string,object?)[] values) { var cmd=c.CreateCommand();cmd.Transaction=tx;cmd.CommandText=sql;foreach(var (key,value) in values)cmd.Parameters.AddWithValue(key,value??DBNull.Value);return cmd; }
 internal static void Apply(SqliteConnection c)
 {
  using var tx=c.BeginTransaction(deferred:false);
  using var columns=Cmd(c,tx,"SELECT COUNT(*) FROM pragma_table_info('UserProgress') WHERE name='ProfileJson'");
  var legacy=Convert.ToInt32(columns.ExecuteScalar())!=0;
  if(legacy) { using var rename=Cmd(c,tx,"ALTER TABLE UserProgress RENAME TO LegacyUserProgress");rename.ExecuteNonQuery(); }
  using(var schema=Cmd(c,tx,Schema))schema.ExecuteNonQuery();
  if(legacy) {
   string cursor="";
   while(true) {
    string id,content;int oldMax;
    using(var select=Cmd(c,tx,"SELECT UserId,ProfileJson,MaxStreak FROM LegacyUserProgress WHERE UserId>$cursor ORDER BY UserId LIMIT 1",("$cursor",cursor)))using(var reader=select.ExecuteReader()) { if(!reader.Read())break;id=reader.GetString(0);content=reader.GetString(1);oldMax=reader.GetInt32(2); }
    cursor=id;var p=JsonSerializer.Deserialize<StudentProfile>(content,Json)??throw new InvalidOperationException("Μη έγκυρο παλιό προφίλ.");
    foreach(var completion in p.Completions) { using var insert=Cmd(c,tx,"INSERT INTO DailyChallengeCompletions(Id,UserId,ChallengeDate,Score,XPEarned,CompletedAt,ResultJson) VALUES($id,$user,$day,$score,$xp,$at,$json) ON CONFLICT(UserId,ChallengeDate) DO NOTHING",("$id",Guid.NewGuid().ToString()),("$user",id),("$day",completion.Day),("$score",completion.CorrectCount),("$xp",completion.Xp),("$at",completion.CompletedAt.ToString("O")),("$json",JsonSerializer.Serialize(completion,Json)));insert.ExecuteNonQuery(); }
    p.Completions.Clear();using(var completions=Cmd(c,tx,"SELECT ResultJson FROM DailyChallengeCompletions WHERE UserId=$id ORDER BY ChallengeDate",("$id",id)))using(var reader=completions.ExecuteReader())while(reader.Read())p.Completions.Add(JsonSerializer.Deserialize<ChallengeCompletion>(reader.GetString(0),Json)!);
    foreach(var day in p.Freezes.Distinct()) { using var insert=Cmd(c,tx,"INSERT INTO ChallengeFreezes VALUES($id,$day,$week) ON CONFLICT DO NOTHING",("$id",id),("$day",day),("$week",WeekStart(day)));insert.ExecuteNonQuery(); }
    foreach(var day in p.Studies.Distinct()) { using var insert=Cmd(c,tx,"INSERT INTO ChallengeStudyDays VALUES($id,$day) ON CONFLICT DO NOTHING",("$id",id),("$day",day));insert.ExecuteNonQuery(); }
    var last=p.Completions.Select(x=>x.Day).Concat(p.Freezes).OrderBy(x=>x,StringComparer.Ordinal).LastOrDefault();
    var today=TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens")).ToString("yyyy-MM-dd");
    var week=WeekStart(today);var loops=p.Completions.SelectMany(x=>x.LoopResults).TakeLast(5).ToArray();
    using var save=Cmd(c,tx,"""
INSERT INTO UserProgress(UserId,TotalXP,CurrentStreak,MaxStreak,LastChallengeDate,LastActivityDate,Badges,PublicCode,Username,Avatar,GroupCode,FriendsJson,RecentLoopsJson,AttemptDay,AttemptStartedAt,TheoryAnswer,WeekStart,WeeklyXP)
SELECT $id,COALESCE(SUM(XPEarned),0),$streak,$max,MAX(ChallengeDate),$last,$badges,$code,$name,$avatar,$group,$friends,$loops,$attempt,$started,$theory,$week,COALESCE(SUM(CASE WHEN ChallengeDate>=$week AND ChallengeDate<=$end THEN XPEarned ELSE 0 END),0)
FROM DailyChallengeCompletions WHERE UserId=$id
""",("$id",id),("$streak",last is null?0:GamificationService.Streak(p,last)),("$max",Math.Max(oldMax,p.Completions.Select(x=>x.Streak).DefaultIfEmpty().Max())),("$last",last),("$badges",JsonSerializer.Serialize(p.Badges.Distinct(),Json)),("$code",p.PublicCode),("$name",p.Username),("$avatar",p.Avatar),("$group",p.Group),("$friends",JsonSerializer.Serialize(p.Friends.Distinct().Take(30),Json)),("$loops",JsonSerializer.Serialize(loops,Json)),("$attempt",p.Attempt?.Day),("$started",p.Attempt?.StartedAt.ToString("O")),("$theory",p.Attempt?.TheoryAnswer),("$week",week),("$end",DateOnly.Parse(week).AddDays(6).ToString("yyyy-MM-dd")));
    save.ExecuteNonQuery();
   }
   using var drop=Cmd(c,tx,"DROP TABLE LegacyUserProgress");drop.ExecuteNonQuery();
  }
  using(var indexes=Cmd(c,tx,"""
CREATE INDEX IF NOT EXISTS IX_Progress_Ranking ON UserProgress(TotalXP DESC,CurrentStreak DESC,UserId);
CREATE INDEX IF NOT EXISTS IX_Progress_GroupRanking ON UserProgress(GroupCode,TotalXP DESC,CurrentStreak DESC,UserId);
CREATE INDEX IF NOT EXISTS IX_Progress_WeeklyRanking ON UserProgress(WeekStart,WeeklyXP DESC,CurrentStreak DESC,UserId);
CREATE INDEX IF NOT EXISTS IX_Completions_UserDate ON DailyChallengeCompletions(UserId,ChallengeDate);
PRAGMA user_version=2;
"""))indexes.ExecuteNonQuery();
  tx.Commit();
 }
 internal static string WeekStart(string day) { var date=DateOnly.ParseExact(day,"yyyy-MM-dd");return date.AddDays(-(((int)date.DayOfWeek+6)%7)).ToString("yyyy-MM-dd"); }
}
