using System.Text.Json;
using SuitabilityWriter.Application.Placeholders.Models;

namespace SuitabilityWriter.Application.Placeholders.Loader;

public sealed class PlaceholderContractLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly string _basePath;

    public PlaceholderContractLoader(string contractsBasePath)
    {
        _basePath = contractsBasePath;
    }

    public PlaceholderRegistry LoadRegistry(string version)
        => LoadJson<PlaceholderRegistry>(Path.Combine(_basePath, "placeholders", version, "placeholder-registry.json"));

    public PlaceholderGroups LoadGroups(string version)
        => LoadJson<PlaceholderGroups>(Path.Combine(_basePath, "placeholders", version, "placeholder-groups.json"));

    public PlaceholderProfile LoadProfile(string version, string reportType)
        => LoadJson<PlaceholderProfile>(
            Path.Combine(_basePath, "placeholders", version, "profiles", $"{reportType.ToLowerInvariant()}.json"));

    private static T LoadJson<T>(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"Placeholder contract file not found: {path}");

        var json = File.ReadAllText(path);

        var obj = JsonSerializer.Deserialize<T>(json, JsonOptions);

        return obj ?? throw new InvalidOperationException($"Failed to deserialize placeholder contract: {path}");
    }
}