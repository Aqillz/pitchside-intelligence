# Methodology

## Simulated fixtures

Each built-in fixture generates 76 events from a fixed seed. A fixture's seed makes its replay reproducible. The simulation selects a team, event type, shirt number, location, and pressure for each event. A shot can become a goal in the generator. An imported shot uses the supplied goal flag. The score is the sum of each team's goal flags.

## Metrics

- **Expected goals (xG)** is an illustrative shot value. Estimate distance as `hypot(1.05 × (100 − x), 0.68 × (y − 50))`, then calculate `0.52 × exp(−distance / 19) × (1 − 0.55 × pressure)`. Clamp to 0.01–0.50 per shot. The dashboard sums those values for each team.
- **Expected threat (xT)** uses a location value of `(x / 100)² × (1 − |y − 50| / 100)`. For passes and shots, subtract the start value from the end value and clamp the result to −0.20–1.00. The log shows signed changes. Team totals and five-minute momentum sum only positive changes. Bar heights share a scale across both teams, fitted to the largest currently visible interval.
- **Zone 14** is the central rectangle at `70 ≤ x < 88` and `40 ≤ y ≤ 60` in a team's attacking coordinates. Count an entry when a pass starts outside and ends inside the rectangle.
- **Tactical pitch** draws the latest 12 filtered actions or all filtered event starting positions in the density layer. It mirrors away coordinates onto the common pitch. The team filter narrows the pitch, feed, and log. Summary metrics and the report continue to describe the whole replay.
- **Match report** summarizes chance value, Zone 14 entries, and the largest threat gain. When one team leads from minute 60 onward, the coach section uses a preset score-state cue. Formations are fixture settings or tactical suggestions.

The models are heuristic. They were developed for teaching and demonstration, without training or calibration on real matches. They do not account for tracking coordinates, goalkeeper or defender position, shot type, or team-specific baselines.

## Local import format

Choose a UTF-8 JSON file no larger than 256 KiB. The top level must be a list of 1–300 events in nondecreasing minute order. Use exactly these fields per event.

| Field | Accepted values |
| --- | --- |
| `minute` | Integer from 1 to 90. Multiple events can share a minute. |
| `side` | `home` or `away` |
| `type` | `pass`, `shot`, `tackle`, `pressure`, or `interception` |
| `player` | Fictional shirt number from 1 to 99 |
| `startX`, `startY`, `endX`, `endY` | Numbers from 0 to 100 in attacking coordinates. For both teams, `x = 100` is the goal they attack. |
| `pressure` | Number from 0 to 1 |
| `goal` | Boolean. Only `shot` can have `true`. |

Use the [sample JSON](example-events.json) as a starting point. Imported files use the selected fixture's team labels and start at kickoff. The app validates the entire file before replacing the replay. Use fictional values and shirt numbers. The browser reads the file in memory and clears it on reload.
