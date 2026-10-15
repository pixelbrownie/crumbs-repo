# crumbs — Chrome Extension

> **every piece you love.**  
> Send any product you find anywhere on the web straight into your crumbs board with one click.

---

## Installation (Developer Mode / Unpacked)

1. Open Google Chrome (or Microsoft Edge / Brave / Arc).
2. Navigate to `chrome://extensions` in the address bar.
3. Turn on the **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `extension/dist` folder located in this repository (`c:\Users\Ananya Singh\OneDrive\Desktop\crumbs\extension\dist`).
6. Pin the crumbs extension (`c` icon) to your Chrome toolbar.

---

## Connecting Your Account

1. Click the crumbs icon in your toolbar.
2. Click **Connect crumbs**.
3. It will open `https://crumbsbypixel.vercel.app/connect` (or log in first if needed).
4. Click **Connect Extension** on the page. The extension securely receives your capture token and establishes the link automatically.

*Alternative (Manual Token entry):*
1. Go to `https://crumbsbypixel.vercel.app/settings`.
2. Generate a Capture Token and copy it.
3. Right-click the crumbs icon → **Options** (or click the gear icon in the popup).
4. Paste the token into **Capture Token** and click **Save Settings**.

---

## How to Capture Pieces

- **Extension Popup:** Click the crumbs icon on any product page. You'll see candidate images discovered on the page. Pick your favorite image, review or tweak the title, and click **Save piece**.
- **Keyboard Shortcut:** Press `Alt + Shift + S` (Mac: `Ctrl + Shift + S`) on any page to quick-capture.
- **Right-Click Context Menu:** Right-click on any product image or page and select **Save to crumbs**.
- The toolbar icon will display a momentary `✓` badge upon successful capture.
- The AI vision pipeline immediately rehosts the image, tags the item (category, brand, aesthetic, colors), and organizes it into your smart collections.
