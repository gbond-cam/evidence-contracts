namespace SuitabilityWriter.Application.Placeholders.Models;

public sealed record PlaceholderProfile(
    string ContractType,
    string ContractVersion,
    string ReportType,
    IReadOnlyList<string> IncludeGroups,
    Dictionary<string, bool>? RequiredOverrides,
    IReadOnlyList<string>? Optional,
    IReadOnlyList<string>? Forbid
);