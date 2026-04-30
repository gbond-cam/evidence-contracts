namespace SuitabilityWriter.Application.Placeholders.Models;

public sealed record PlaceholderRegistry(
    string ContractType,
    string ContractVersion,
    IReadOnlyList<PlaceholderDefinition> Placeholders,
    IReadOnlyList<PlaceholderAlias>? Aliases
);

public sealed record PlaceholderDefinition(
    string Key,
    string Type,
    int? MaxLen,
    string? Format,
    bool Pii,
    string? Description,
    IReadOnlyList<string>? Examples,
    string? StaticValue = null
);

public sealed record PlaceholderAlias(
    string OldKey,
    string NewKey,
    DateTime DeprecatedSince,
    DateTime RemoveAfter
);