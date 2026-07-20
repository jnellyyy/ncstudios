# NC Premiere Edit Agent

An Adobe Premiere Pro 25.6+ UXP panel that learns a reference style from an
`Inspo` folder, reads the active timeline, creates a reviewable edit plan, and
applies approved changes to a cloned sequence.

## Current MVP capabilities

- Analyse reference-video pacing, shot density, colour, movement and visible
  transition patterns from clips selected directly in Premiere’s Project/Bin
  panel, or from a Finder folder.
- Read video/audio tracks and clips from the active Premiere sequence.
- Plan trims, ripple removals, timeline moves, disable/enable actions and clip
  renames using only real clip IDs from the active timeline.
- Work without OpenAI API billing by exporting a local `codex-request.json`
  timeline snapshot for Codex/VS Code/ChatGPT to turn into `codex-plan.json`.
- Let the editor uncheck individual proposed changes.
- Clone the sequence before applying any timeline edits.
- Apply the approved changes through Premiere's undoable transaction API.

This first version deliberately does not apply arbitrary generated JavaScript,
silent exports, colour-effect parameters or unreviewed edits.

## Start the helper

Double-click `start-agent.command`. A secure macOS pop-up will appear; paste a
new OpenAI API key with Command-V and choose **Start Agent**. Leave the Terminal
window open while editing. The key is held only in that Terminal process; the
script does not save it.

If you cannot use API billing, leave the key blank when starting the helper.
The helper will still support offline reference pacing analysis, and the panel's
**No API mode** can hand the timeline snapshot to Codex through local files.

Never share an API key in chat, email, screenshots, source files or project
folders. Revoke and replace a key immediately if it has been exposed.

The helper writes requests and responses beneath `runtime/`. This file bridge
avoids exposing the API key inside the Premiere panel and avoids macOS's UXP
restriction on plain local HTTP connections.

## Load the Premiere panel

1. Install **UXP Developer Tool 2.2+** from Creative Cloud Desktop.
2. In Premiere, open Settings > Plugins, enable developer mode, then restart
   Premiere.
3. Open UXP Developer Tool, choose **Add Plugin**, and select
   `plugin/manifest.json`.
4. Choose **Load** or **Load & Watch**.
5. In Premiere, open Window > UXP Plugins > NC Edit Agent.

## First use

1. Choose **Connect helper folder** and select this project's `runtime` folder.
2. Select one to four reference clips, a bin containing them, or a clip on the
   active timeline. Choose **Use selected clip(s) or bin**, then choose
   **Analyse selected source**. A Finder folder remains available as an
   alternative. Offline clips are skipped; attached proxies are accepted.
3. Open the sequence you want to edit and describe the change.
4. Choose **Create edit plan with helper** if the helper is running with API
   access.
5. Review every proposed action and uncheck anything you do not want.
6. Choose **Apply checked changes to a copy**.

## No API mode

Use this when you want Codex/VS Code/ChatGPT to be the brain instead of using
OpenAI API billing in the helper.

1. Connect the panel to this project's `runtime` folder.
2. Open the sequence you want to edit and describe the change in the edit box.
3. Choose **Export for Codex**. The panel writes
   `runtime/codex-request.json` with your timeline, style profile and request.
4. In Codex, ask it to read `runtime/codex-request.json` and write
   `runtime/codex-plan.json`.
5. Back in Premiere, choose **Load Codex plan**.
6. Review the checkboxes, then choose **Apply checked changes to a copy**.

The no-API plan file must use only the clip IDs from the exported request. The
panel still validates every change before applying it to the cloned sequence.

## Notes

- Finished reference videos reveal visible editing patterns, not hidden effect
  settings. Adding LUTs, presets, XML exports and project files to the folder
  gives future versions more precise style information.
- The helper samples up to four videos and the first 90 seconds of each for
  scene-density analysis, keeping turnaround and API use bounded.
- With an API key, sampled reference frames and the compact timeline/style data
  are sent to OpenAI for analysis and planning. Full reference videos and
  Premiere project files are not uploaded by this MVP.
- Without an API key, the helper starts in offline mode and can calculate basic
  pacing metrics. Use **No API mode** when you want Codex to create the edit
  plan from the exported local request file.
