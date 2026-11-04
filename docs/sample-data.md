# Sample Data

Two ready-made classes you can import into Grouper to try out or test grouping without typing in people and preferences by hand.

| File | Download |
|---|---|
| Sample class 7A (26 people) | [class-7a.json](https://raw.githubusercontent.com/kimipsen/grouper/master/grouper-app/public/sample-data/class-7a.json) |
| Sample class 7B (29 people) | [class-7b.json](https://raw.githubusercontent.com/kimipsen/grouper/master/grouper-app/public/sample-data/class-7b.json) |

The files are also served by the app itself, for example
<https://grouper.kim-ipsen.workers.dev/sample-data/class-7a.json>.

Source files: [`grouper-app/public/sample-data/`](../grouper-app/public/sample-data/).

## Import a sample class

1. Download one of the files above (in the browser, use **Save link as…** on the raw link).
2. In Grouper, go to the session list and select **Import**.
3. Choose the downloaded `.json` file.

Each file contains one session, so import both files to get both classes. Every import creates a new session with a new id, so you can import the same file again to get a fresh copy.

## What each class contains

Both classes follow the same rules:

- Every person has 1–3 **Prefer** (`wantWith`) preferences and 1–2 **Avoid** preferences.
- Preferences only point at people in the same class, never at the person themselves, and never prefer and avoid the same person.
- Every person has a gender and a value from 1 to 5 for the class's custom weight.
- Preference scoring uses the defaults: Prefer score `2`, Avoid score `-2`.
- Gender mode is **Mixed-gender**.
- There is no grouping history; the **Results** tab starts empty.

| | Sample class 7A | Sample class 7B |
|---|---|---|
| People | 26 | 29 |
| Gender | 13 female, 12 male, 1 non-binary | 14 female, 14 male, 1 non-binary |
| Prefer preferences | 57 | 61 |
| Avoid preferences | 31 | 36 |
| Custom weight | Reading level (1–5), mode `balance` | Math level (1–5), mode `match-similar` |
| Mutual Prefer pairs | 2 | 1 |
| Someone prefers a person who avoids them | 5 cases | 4 cases |
| Mutual Avoid pairs | 1 | 0 |

## What to test with it

- **Preference-Based grouping**: check that people end up with someone they prefer and away from people they avoid, and compare satisfaction across runs.
- **Avoid conflicts**: the one-sided cases (A prefers B, but B avoids A) and the mutual Avoid pair in 7A show how the algorithm trades off conflicting wishes.
- **Uneven group sizes**: 26 and 29 people do not divide evenly into groups of 3, 4 or 5 for both classes, which exercises partial groups and the related warnings.
- **Gender modes**: try **Mixed-gender**, **Single-gender** and **Ignore gender**, including how the single non-binary person is placed.
- **Weighted grouping**: 7A balances reading level across groups; 7B puts people with similar math levels together.
- **Export and re-import**: generate some groups, export the session and import it again.

## Keeping the files valid

`grouper-app/src/app/core/services/sample-data.spec.ts` imports both files through the same validation the app uses and checks the rules above. If you edit a sample file or change the session import format, run the tests from `grouper-app/`:

```bash
npm test -- --watch=false
```
