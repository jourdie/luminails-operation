# UI design system plan

## Design direction

Luminails Ops uses a warm, light workspace rather than a dark generic admin dashboard. The memorable element is a blush workspace rail and a quiet linen canvas; the content stays dense, left aligned, and practical.

## Tokens

- Ink: `#302B2D`
- Linen: `#F7F4F0`
- Shell: `#FFFDFB`
- Blush: `#E8B9B0`
- Blush deep: `#A85E5F`
- Sage: `#DCE5DD`
- Amber: `#F5E2BA`

Typography uses Inter for operational text and Manrope for headings and compact metric display. Sentence case is preferred. No decorative script, emoji, or non-Latin UI copy.

## Layout

```text
+------------------+-----------------------------------------------+
| Luminails Ops    | Breadcrumb                 Period selector     |
| workspace        | Page title                                    |
|                  |                                               |
| Dashboard        | Primary metric     Business position          |
| Orders           |                                               |
| Operations       | Alerts and next actions                        |
| Finance          |                                               |
| Settings         |                                               |
+------------------+-----------------------------------------------+
```

The sidebar is fixed on desktop and becomes a compact top bar on small screens. Content aligns to a readable 1440px frame. Cards are reserved for meaningful summaries; tables are full width and use subtle separators instead of heavy decoration.

## Interaction rules

- Use clear status badges with text, not color alone.
- Use confirmation dialogs only for posting, reversal, or destructive actions.
- Keep loading, empty, error, and permission states explicit.
- Respect reduced motion and keyboard focus.
- Use Bahasa Indonesia for user-facing copy and English for technical identifiers.
