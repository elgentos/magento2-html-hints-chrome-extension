# Magento Block Inspector

A Chrome extension that displays Magento block information on hover without opening DevTools.

## For use with Yireo_HtmlHints

This extension requires the [Yireo_HtmlHints](https://github.com/yireo/Yireo_HtmlHints) Magento 2 extension to be enabled on your store. It reads the HTML comments that extension adds to show block names, classes, and templates.

## Installation

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select this extension's directory

## How to Use

| Action | Result |
|--------|--------|
| **Shift+Z** | Toggle inspector on/off |
| **Hover** | See block/container hierarchy at cursor |
| **Shift+A** | Pin tooltip in place (toggle) |
| **Drag ⋮⋮** | Move pinned tooltip |
| **Escape** | Close pinned tooltip |

## What You See

**For each hovered element:**
- Block/Container type (red = block, purple = container)
- Name, class, template name, and file path
- Full hierarchy of nested blocks

**Visual feedback:**
- Red outline on hovered block
- Teal border on pinned tooltip
- Instruction text near cursor

## Features

✅ Hover to inspect blocks and containers
✅ Pin tooltips for detailed reading
✅ Drag to reposition pinned tooltips
✅ Select text directly in tooltip
✅ Automatically hidden by default
✅ Non-intrusive - doesn't modify page

## Keyboard Shortcuts

- `Shift+Z` - Toggle inspector on/off
- `Shift+A` - Pin/unpin tooltip
- `Escape` - Close pinned tooltip

## Troubleshooting

**Tooltip not showing?**
- Ensure Yireo_HtmlHints is enabled in Magento 2
- The extension only works on pages with block comments

**Still can't see blocks?**
- Some dynamically loaded content may lack comments
- Check that opening block comments are in the HTML source

## Development

- `manifest.json` - Extension configuration
- `content.js` - Main logic (scanning, detection, pinning)
- `styles.css` - Visual styling

Non-intrusive: only adds listeners, doesn't modify the page.
