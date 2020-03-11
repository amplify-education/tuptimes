# tuptimes

Parse tup logs and augment them with timing statistics

## Usage

```sh
tup | tuptimes
```

Group commands for getting timing subtotals using a `.tuptimesrc` file like:

```json
{
  "groups": [
    {
      "name": "tsc",
      "pattern": "tsc"
    },
    {
      "name": "extract strings",
      "pattern": "extract-translation-strings"
    }
  ]
}
```

Where `name` is a display name, and `pattern` is a regular expression executed on the command line string that appears in the tup log.

Example output:

```
Tup build finished
Total time: 967.3229999999992s (754 commands)
  ‣extract strings: 3.477s (1 commands)
  ‣tsc: 431.3720000000002s (257 commands)
  ‣uncategorized: 532.4740000000004s (496 commands)
```

