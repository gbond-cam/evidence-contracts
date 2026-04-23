namespace SuitabilityWriter.Application.Placeholders.Models;

public sealed record PlaceholderGroups(
    string ContractType,
    string ContractVersion,
    Dictionary<string, IReadOnlyList<string>> Groups
);
