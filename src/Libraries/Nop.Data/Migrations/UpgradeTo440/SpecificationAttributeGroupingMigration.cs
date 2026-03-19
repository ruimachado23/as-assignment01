using FluentMigrator;
using Nop.Core.Domain.Catalog;
using Nop.Data.Extensions;
using Nop.Data.Mapping;

namespace Nop.Data.Migrations.UpgradeTo440;

[NopSchemaMigration("2020/03/08 11:26:08:9037680", "Specification attribute grouping")]
public class SpecificationAttributeGroupingMigration : ForwardOnlyMigration
{
    #region Methods

    /// <summary>
    /// Collect the UP migration expressions
    /// </summary>
    public override void Up()
    {
        this.CreateTableIfNotExists<SpecificationAttributeGroup>();

        var tableName = NameCompatibilityManager.GetTableName(typeof(SpecificationAttribute));
        var columnName = NameCompatibilityManager.GetColumnName(typeof(SpecificationAttribute),
            nameof(SpecificationAttribute.SpecificationAttributeGroupId));

        // On fresh installs the base schema already includes this column with its
        // FK and index, so only add it when upgrading from an older version.
        if (!Schema.Table(tableName).Column(columnName).Exists())
        {
            this.AddOrAlterColumnFor<SpecificationAttribute>(t => t.SpecificationAttributeGroupId)
                .AsInt32()
                .Nullable()
                .ForeignKey<SpecificationAttributeGroup>();
        }
    }

    #endregion
}
