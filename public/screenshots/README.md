# Chrome Web Store Screenshots

This directory contains screenshots for the Chrome Web Store submission.

## Required Screenshots

### Specifications
- **Format**: PNG
- **Dimensions**: 1280x800 (recommended) or 640x400
- **Quantity**: Minimum 1, Maximum 5
- **File size**: Under 5MB each

### Recommended Screenshots

| # | Filename | Description |
|---|----------|-------------|
| 1 | `01-main-chat.png` | Main sidepanel with chat interface showing the agent ready to assist |
| 2 | `02-automation.png` | Automation in action - agent performing a task on a webpage |
| 3 | `03-settings.png` | Settings/options page showing configuration options |
| 4 | `04-vision.png` | Vision/analysis feature demonstrating page understanding |
| 5 | `05-scheduler.png` | Task scheduler or marketplace view |

## Capture Instructions

### Setup

1. **Build the extension**:
   ```bash
   npm run build
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` directory

3. **Prepare for consistent sizing**:
   - Open Chrome DevTools (`F12`)
   - Click device toolbar icon (or `Ctrl+Shift+M`)
   - Set custom dimensions: 1280x800
   - Or use "Responsive" mode with 1280x800 viewport

### Capturing Each Screenshot

#### Screenshot 1: Main Chat Interface
1. Open any webpage
2. Click the extension icon to open sidepanel
3. Clear any existing conversation for a clean state
4. Position sidepanel to show the chat input and welcome message
5. Capture the full browser window (1280x800)

#### Screenshot 2: Automation in Action
1. Navigate to a suitable demo page (e.g., a form or e-commerce site)
2. Start an automation task (e.g., "Fill out this form")
3. Capture while the agent is actively working (showing status indicators)
4. Highlight the agent's progress/feedback

#### Screenshot 3: Settings Page
1. Click the gear/settings icon in the sidepanel
2. Show the API key configuration, model selection, and other options
3. Ensure no sensitive data is visible (use placeholder API keys)

#### Screenshot 4: Vision/Analysis Feature
1. Use the agent's vision capability on a page
2. Capture the analysis overlay or results panel
3. Show how the agent understands page content

#### Screenshot 5: Task Scheduler/Marketplace
1. Navigate to the scheduler or marketplace section
2. Show available workflows or scheduled tasks
3. Capture with clean, demo-appropriate data

### Capture Tips

- **Use a clean Chrome profile** - No personal bookmarks or extensions visible
- **Blur or hide sensitive data** - No real API keys, emails, or personal info
- **Use demo content** - Generic placeholder text and images
- **Consistent styling** - Same browser theme across all screenshots
- **Good contrast** - Ensure text is readable
- **Avoid scrolling** - Position key UI elements in frame

## Promotional Tiles (Optional)

Store these in `public/promotional/`:

| Tile | Dimensions | Required | Filename |
|------|------------|----------|----------|
| Small promotional tile | 440x280 PNG | Recommended | `small-tile.png` |
| Large promotional tile | 920x680 PNG | Optional | `large-tile.png` |
| Marquee | 1400x560 PNG | Optional | `marquee.png` |

### Tile Guidelines

- Use brand colors and logo
- Include tagline or key benefit
- No excessive text (legible at small sizes)
- No screenshots embedded in tiles (use separate screenshots)

## File Naming Convention

```
01-main-chat.png
02-automation.png
03-settings.png
04-vision.png
05-scheduler.png
```

Use numbered prefixes to maintain upload order.

## Checklist Before Submission

- [ ] All screenshots are 1280x800 or 640x400 PNG
- [ ] No sensitive data visible
- [ ] Consistent browser theme across screenshots
- [ ] Each screenshot showcases a distinct feature
- [ ] Files under 5MB each
- [ ] Files named with numbered prefixes
