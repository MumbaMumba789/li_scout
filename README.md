# CellCheck

CellCheck is a web app that tells people whether a used lithium-ion cell can be reused, is weak, or should be recycled. The user uploads or enters discharge readings (time in minutes, voltage in volts) and gets a grade with a plain-language reason.

Status: prototype. The front end is built. The grading in `app.js` (`estimate()`) is a placeholder and will be replaced by the trained model.

## Run it

Open `index.html` in a browser, or serve the folder:

    python3 -m http.server 8000

Then visit http://localhost:8000.

## CSV format

Two columns, no header required: time in minutes, then voltage in volts. Example:

    0,4.20
    10,4.05
    20,3.85
    30,3.60
    40,3.30

## Files

- `index.html`: the three screens (home/upload, data entry, result).
- `styles.css`: colours and layout; works on phones.
- `app.js`: CSV parsing, the entry table, the discharge curve, and the placeholder `estimate()`.
