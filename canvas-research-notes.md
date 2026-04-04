# Canvas Research: Flora vs Weavy vs Luma

## Three Distinct Approaches

### Flora — Node-Based Creative Canvas
- Dark infinite canvas with pannable/zoomable workspace
- Cards/nodes placed spatially, connected by curved lines showing data flow
- Card types: File, Prompt, Image Generator, Image Describer, Compositor, Masks Extractor, Preview, Video
- Each card has: title bar, content area, model selector dropdown, "Re-run model" button
- Connections have colored dots (red = output, blue/green = input)
- Multi-user collaboration with live cursors
- Left sidebar with minimal tool icons
- Explicit data flow: user manually connects inputs to outputs
- Power-user oriented — similar to ComfyUI but more polished

### Weavy — Node-Based Creative Workflows (acquired by Figma)
- Similar to Flora: node-based canvas with connections
- Integrates traditional editing tools alongside AI models
- Familiar to After Effects/Nuke/MAX users
- More structured workflow approach
- Focus on reusable workflow templates
- Professional-grade but steep learning curve

### Luma — Agent-Driven Whiteboard Canvas (MOST RELEVANT)
- Free-form digital whiteboard (like Miro/FigJam), NOT node-based
- No connecting lines between assets
- Assets placed directly on white canvas in thematic clusters
- AI agent automatically organizes generated content spatially
- Full zoom/pan support
- Right-side chat panel for agent interaction
- Bottom floating toolbar with drawing, editorial, document tools
- Agent reads entire board as context — "persistent memory"
- User directs via chat, agent generates and places assets
- Much simpler than Flora/Weavy — no explicit data flow
- Focus on visual consistency across the board (Uni1 model)

## Key Differences

| Feature | Flora/Weavy | Luma |
|---------|-------------|------|
| Paradigm | Node graph with connections | Free-form whiteboard + agent |
| Complexity | High — user builds pipelines | Low — user chats, agent arranges |
| Data flow | Explicit connections | Implicit (agent reads board context) |
| Organization | User-arranged nodes | Agent auto-arranges clusters |
| Learning curve | Steep | Gentle |
| Control | Maximum (every connection explicit) | Less (agent decides layout) |
| Best for | Power users, complex pipelines | Creative direction, iteration |

## Relevance to Drape/FormaStudio

Luma's approach is the most applicable because:
1. Drape's users are fashion professionals, not technical pipeline builders
2. The workflow is more about creative direction than technical routing
3. A whiteboard with clusters (model refs, garments, outputs) maps naturally to fashion workflows
4. The agent-driven approach could work well — "dress this model in these garments" with context from the board
5. No need for explicit node connections — the relationship between model + garment + output is implicit
