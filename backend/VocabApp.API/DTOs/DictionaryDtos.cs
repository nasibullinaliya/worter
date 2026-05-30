namespace VocabApp.API.DTOs;

public record DictionaryWordDto(
    Guid WordId,
    string Term,
    string Definition,
    string? Example,
    Guid SetId,
    string SetTitle,
    bool IsFinalCompleted
);

public record DictionaryPageDto(
    List<DictionaryWordDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
