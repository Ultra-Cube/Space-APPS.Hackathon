# Frontend Interface Preview

> **Built by the Ultra Cube Team for the NASA Space Apps Challenge 2025.**

## Main Interface

The SpaceBio Semantic Search frontend features a modern, clean design:

### Header
```
🚀 SpaceBio Semantic Search
AI-Powered Search for Space Biology Research
```
- Large, eye-catching title with rocket emoji
- Gradient purple background (from #667eea to #764ba2)
- Subtitle explaining the purpose

### Search Section
- Large search input box with placeholder text
- "Search" button with gradient styling
- Result count dropdown (5, 10, 20, 50)
- Responsive layout that stacks on mobile

### Search Results
Each result is displayed as a card with:
- **Title**: Large, clickable publication title in purple
- **Relevance Score**: Badge showing match quality
- **Metadata**: Author names, publication year, and ID
- **Section Tag**: Which part of the paper the excerpt is from
- **Excerpt**: Preview of the relevant text with highlighted search terms
- **Action Buttons**:
  - "📄 View AI Summary" (primary button)
  - "📚 Full Publication" (secondary button)

### AI Summary Modal
When clicking "View AI Summary", a modal overlay appears with:
- Close button (×) in top-right
- Publication title in large purple text
- Formatted summary with:
  - Title
  - Authors
  - Year
  - Abstract excerpt
  - Key findings
- Click outside to close

## Color Scheme

### Primary Colors
- **Purple Gradient**: #667eea → #764ba2
- **White**: #ffffff (cards and text)
- **Dark Purple**: For titles and accents

### Text Colors
- **Headings**: #667eea (purple)
- **Body Text**: #444 (dark gray)
- **Metadata**: #666 (medium gray)
- **Highlights**: #fff59d (yellow) for search terms

### UI Elements
- **Cards**: White with subtle shadows
- **Buttons**: Purple gradient with hover effects
- **Inputs**: White with light gray borders
- **Tags**: Light gray backgrounds

## Responsive Design

### Desktop (>768px)
- Full-width search bar with button on the right
- Multi-column metadata display
- Hover effects on cards and buttons
- Maximum width: 1200px centered

### Mobile (<768px)
- Stacked search input and button
- Single-column layout
- Touch-friendly button sizes
- Simplified metadata display

## Animations

### Hover Effects
- Cards lift up slightly
- Buttons cast larger shadows
- Smooth transitions (0.2s)

### Loading State
- Spinning circle animation
- "Searching..." text
- Centered on screen

## Typography

### Fonts
System font stack for performance:
- -apple-system
- BlinkMacSystemFont
- Segoe UI
- Roboto
- Oxygen
- Ubuntu
- Cantarell
- Sans-serif fallback

### Sizes
- **Main Heading**: 2.5em (40px)
- **Result Titles**: 1.3em (21px)
- **Body Text**: 16px base
- **Metadata**: 0.9em (14px)

## Accessibility Features

1. **Keyboard Navigation**
   - Enter key triggers search
   - Tab navigation through results
   - Escape closes modals

2. **Semantic HTML**
   - Proper heading hierarchy
   - Button elements (not divs)
   - Label elements for inputs

3. **Visual Clarity**
   - High contrast text
   - Clear focus indicators
   - Readable font sizes

4. **Responsive Touch Targets**
   - Buttons at least 44x44px
   - Adequate spacing between elements
   - Mobile-friendly tap areas

## Performance

### Optimizations
- No external dependencies
- Minimal JavaScript
- CSS uses GPU-accelerated properties
- Efficient DOM updates
- Lazy loading for modal content

### File Sizes
- HTML: ~1.5KB
- CSS: ~5.4KB
- JavaScript: ~9.6KB
- **Total**: ~16.5KB (uncompressed)

### Load Time
- Initial load: <100ms
- First search: 200-500ms (model loading)
- Subsequent searches: 50-100ms

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers

## User Experience Flow

1. User arrives at homepage
2. Sees search box and descriptive header
3. Enters search query
4. Sees loading indicator
5. Results appear as cards
6. User can:
   - Read excerpts inline
   - Click for AI summary
   - View full publication
7. Performs new searches easily

This design prioritizes:
- **Simplicity**: Clean, uncluttered interface
- **Speed**: Fast searches and clear results
- **Accessibility**: Works for all users
- **Responsiveness**: Works on all devices
- **Visual Appeal**: Modern, professional look
