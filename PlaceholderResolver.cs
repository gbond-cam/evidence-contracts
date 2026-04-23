using SuitabilityWriter.Application.Placeholders.Models;

namespace SuitabilityWriter.Application.Placeholders.Resolver;

public sealed record EffectivePlaceholder(
    string Key,
    string Type,
    bool Required,
    int? MaxLen,
    bool Pii
);

public sealed class PlaceholderResolver
{
    public IReadOnlyDictionary<string, EffectivePlaceholder> Resolve(
        PlaceholderRegistry registry,
        PlaceholderGroups groups,
        PlaceholderProfile profile)
    {
        ValidateVersions(registry, groups, profile);

        var registryMap = registry.Placeholders
            .ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);

        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Expand groups
        foreach (var groupName in profile.IncludeGroups)
        {
            if (!groups.Groups.TryGetValue(groupName, out var groupKeys))
                throw new InvalidOperationException($"Unknown placeholder group '{groupName}'.");

            foreach (var key in groupKeys)
                keys.Add(key);
        }

        // Remove forbidden
        if (profile.Forbid != null)
            keys.ExceptWith(profile.Forbid);

        var result = new Dictionary<string, EffectivePlaceholder>(StringComparer.OrdinalIgnoreCase);

        foreach (var key in keys)
        {
            if (!registryMap.TryGetValue(key, out var def))
                throw new InvalidOperationException($"Placeholder '{key}' referenced but not defined in registry.");

            var required =
                profile.RequiredOverrides?.TryGetValue(key, out var req) == true
                    ? req
                    : true; // default required unless overridden

            result[key] = new EffectivePlaceholder(
                Key: def.Key,
                Type: def.Type,
                Required: required,
                MaxLen: def.MaxLen,
                Pii: def.Pii
            );
        }

        return result;
    }

    private static void ValidateVersions(
        PlaceholderRegistry registry,
        PlaceholderGroups groups,
        PlaceholderProfile profile)
    {
        if (registry.ContractVersion != groups.ContractVersion ||
            registry.ContractVersion != profile.ContractVersion)
        {
            throw new InvalidOperationException(
                $"Placeholder contract version mismatch: Registry={registry.ContractVersion}, " +
                $"Groups={groups.ContractVersion}, Profile={profile.ContractVersion}");
        }
    }
}