using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace AeppGenerator.Api.Data.Migrations;

[DbContext(typeof(AssessmentDbContext))]
public sealed class AssessmentDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder model) => CodeNotesSnapshot.Configure(model);
}
