using System.Text.Json;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Data;
using AeppGenerator.Api.Gamification;
using Microsoft.Data.Sqlite;
var path=Path.Combine(Path.GetTempPath(),"aepp-auth-checks-"+Guid.NewGuid()+".sqlite");var count=0;
void Check(bool condition,string message){if(!condition)throw new Exception(message);count++;Console.WriteLine("✓ "+message);}
try{
 var store=new AccountStore(path);var hash=BCrypt.Net.BCrypt.HashPassword("strong-test-password",12);var first=await store.Register("One@example.com",hash,"Πρώτος Μαθητής");var second=await store.Register("two@example.com",hash,"Δεύτερος Μαθητής");
 Check(hash!="strong-test-password"&&BCrypt.Net.BCrypt.Verify("strong-test-password",hash),"bcrypt αποθηκεύει και επαληθεύει hash");Check(first.Role=="STUDENT"&&store.Progress(first.Id).TotalXP==0,"εγγραφή αρχικοποιεί μαθητή και πρόοδο");
 try{await store.Register("one@EXAMPLE.com",hash,"Διπλό");throw new Exception("Duplicate accepted");}catch(DuplicateEmailException){Check(true,"email μοναδικό ανεξάρτητα από πεζά/κεφαλαία");}
 Check(store.FindEmail("ONE@example.com")!.Id==first.Id,"login αναζητά κανονικοποιημένο email");
 var service=new GamificationService("unused",store:store);await service.Start(first.Id);var day=service.Day;var start=(JsonSerializer.SerializeToElement(await service.Get(first.Id),new JsonSerializerOptions(JsonSerializerDefaults.Web)));var question=start.GetProperty("questions")[0];
 await service.Theory(first.Id,day,"true");var responses=await Task.WhenAll(Enumerable.Range(0,5).Select(_=>service.Complete(first.Id,day,new())));var progress=store.Progress(first.Id);
 Check(progress.TotalXP>=10&&progress.TotalXP<=130&&progress.CurrentStreak==1,"XP και streak ενημερώνονται από τον server");Check(store.Progress(second.Id).TotalXP==0,"απομόνωση προόδου δεύτερου χρήστη");
 var reopened=new AccountStore(path);Check(reopened.Progress(first.Id)==progress||reopened.Progress(first.Id).TotalXP==progress.TotalXP,"πρόοδος διατηρείται σε νέα σύνδεση βάσης");
 using(var db=new SqliteConnection("Data Source="+path)){db.Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT COUNT(*) FROM DailyChallengeCompletions WHERE UserId=$id";cmd.Parameters.AddWithValue("$id",first.Id);Check(Convert.ToInt32(cmd.ExecuteScalar())==1,"παράλληλες υποβολές δημιουργούν μόνο ένα αποτέλεσμα");}
 try{await store.ProfileTransaction<int>(first.Id,day,(p,_)=>{p.Badges.Add("tampered");throw new ArgumentException();});}catch(ArgumentException){}Check(!store.Progress(first.Id).Badges.Contains("tampered"),"αποτυχημένη συναλλαγή κάνει rollback");
 store.AddSession("session",first.Id,DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds());Check(store.ValidSession("session",first.Id,"STUDENT"),"έγκυρη συνεδρία αναγνωρίζεται");Check(!store.ValidSession("session",second.Id,"STUDENT"),"συνεδρία δεν ανήκει σε άλλον χρήστη");store.Revoke("session",first.Id);Check(!store.ValidSession("session",first.Id,"STUDENT"),"logout ανακαλεί συνεδρία");
 store.AddSession("old",first.Id,DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds());Check(store.PromoteTeacher(first.Email)&&!store.ValidSession("old",first.Id,"STUDENT"),"προαγωγή καθηγητή ανακαλεί παλιά δικαιώματα");
 var exam=store.SaveExam(first.Id,"Δοκιμή","examJson","{\"title\":\"Δοκιμή\"}");Check(store.Exam(second.Id,exam.Id)==null&&store.Exam(first.Id,exam.Id)!=null,"διαγωνίσματα προσβάσιμα μόνο στον ιδιοκτήτη");Check(new AccountStore(path).Exams(first.Id).Count==1,"διαγώνισμα διατηρείται στη βάση");
 foreach(var password in new[]{"short",new string('α',40)}){try{AuthService.ValidateRegistration("ok@example.com",password,"Όνομα");throw new Exception("Bad password accepted");}catch(ArgumentException){Check(true,"απορρίπτεται ανεπαρκής/υπερβολικά μεγάλος κωδικός");}}
 Console.WriteLine($"{count} auth/database checks passed.");
}finally{SqliteConnection.ClearAllPools();foreach(var file in new[]{path,path+"-wal",path+"-shm"})if(File.Exists(file))File.Delete(file);}
