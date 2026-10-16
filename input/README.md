# Policy spreadsheets - how to update the Policy Explorer

Tim's guide. One spreadsheet per country goes in this folder. When you upload one, the data on the live
site updates by itself within a few minutes. You do not need to run anything.

## To add or replace a country

1. Open this folder on GitHub: **github.com/afcrossland/gridsim_electricprotocol**, then `input/`.
2. Click **Add file**, then **Upload files**, and drag your spreadsheet in.
   - To replace a country, upload a file with the same country name - it overwrites the old one.
3. Type a short note (for example "Japan - updated evidence") and click **Commit changes**.

That is all. The site rebuilds with the new data in about three minutes.

## File names

Name the file `<Country> Output Rev 8.xlsx`, for example `Japan Output Rev 8.xlsx`.

- Use the country's usual English name (UK, NZ and Great Britain also work).
- Spelling "Ouput" and extra letters after the rev (`Rev 8a`) are fine.
- Keep the standard tab ("Question Output") and column headings.
- `BLANK Ouput Rev 8.xlsx` is the empty template - it is ignored.

## How to check it worked

1. Go to the repository's **Actions** tab and open the latest **Import policy spreadsheets** run.
2. The **summary** shows, for each country, how many of the 39 questions were read.
3. Anything it could not match is listed there in plain words, for example a question whose wording did not
   match, or an answer whose category statement did not match one of the question's answers. Those rows are
   left out, not guessed - fix the sheet and upload it again.
4. A green tick means the data was updated. A red cross means nothing was changed, and the summary says
   what to fix (an unrecognised country name, or a file that is not a normal .xlsx).

## Good to know

- **Removing a country:** deleting its file removes its answers from the site.
- **Undoing a mistake:** every upload is kept in the history, so anything can be put back - ask Andrew.
- **Public:** this repository is public, so uploaded spreadsheets and their evidence can be read by anyone.
- **Corrections from visitors:** answers suggested through the site are not written back to the
  spreadsheets. Fold accepted corrections into the sheet yourself, or the next upload will overwrite them.
- Do not edit anything in `src/data/` by hand - it is regenerated from these spreadsheets.
