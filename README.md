# Portfolio

A single-page portfolio built with [Hugo](https://gohugo.io). The site is a
box with three faces (**Intro**, **Works** and **Contact**) floating in a
starfield. You rotate the box to move between faces and scroll down to read
each one.

## Run it

```sh
hugo server          # live preview at http://localhost:1313
hugo --minify        # production build into ./public
```

Requires Hugo **extended**, v0.156 or newer.

## Edit your content

All text lives in `data/`. You don't need to touch the templates.

| File | Face |
| --- | --- |
| `data/profile.yaml` | Intro: name, role, about, stats, skills, "now" |
| `data/works.yaml` | Works: projects (`featured: true` spans the full width) |
| `data/achievements.yaml` | Works: achievements timeline |
| `data/contact.yaml` | Contact: email and links |

Longer text fields accept Markdown. Set your real domain in `baseURL` in
`hugo.toml` before deploying.

## Navigating

| Device | How to rotate |
| --- | --- |
| Phone / tablet | Swipe left or right; the box follows your finger |
| Laptop trackpad | Two-finger horizontal swipe |
| Keyboard | ← / → |
| Any | Header tabs, the "Next face" card at the bottom of each face, and side arrows on wide screens |

Each face has its own URL (`#intro`, `#works`, `#contact`). The site honours
*reduced motion* settings (faces fade instead of rotating), and without
JavaScript it falls back to one ordinary scrolling page.

## Where things are

```
layouts/baseof.html        page shell
layouts/home.html          the three faces
layouts/_partials/art/     SVG megastructures (ring, lattice station, beacon)
assets/css/main.css        styles
assets/js/main.js          the box, swipe/keyboard/trackpad input, starfield
```
