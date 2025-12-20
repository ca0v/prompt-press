---
artifact: faction
phase: requirement
depends-on: []
references: ["faction-crystaline-guard.req", "game-board.req", "geode-amethyst.req", "geode-calcite.req", "geode-pyrite.req", "geode-quartz.req", "geode-rose-quartz.req"]
last-updated: 2025-12-20
---

# Geodes Collection - Requirements

## Overview
This requirement specification outlines the design and implementation of a collection of 5 unique geodes, each possessing distinct special powers. 

The geodes are intended as collectible artifacts for use in the @game-board.req "petrified". 

Each geode must be visually distinct as each piece will have unique powers on the game board. 

The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;

Player 1's faction start in row 1, Player 2's in row 5.

Operationally, players control these geodes in web-based sessions, selecting and moving them strategically during turns, with @geode-pyrite.req serving as the critical erosion target, under constraints like real-time validation and balanced win rates to promote user engagement.
## Functional Requirements
- FR-1: The collection shall consist of exactly 5 geodes.
- FR-2: Each geode will be able to interact with the board in a distinct way.
- FR-3: Some geode may possess distinct special powers.
- FR-4: Each geode shall be visually distinct.
- FR-6: The base faction shall consist of @geode-pyrite.req, @geode-rose-quartz.req, @geode-calcite.req, @geode-amethyst.req, @geode-quartz.req;.
- FR-7: The base faction shall be collectively called "The Crystalline Guard".
- FR-8: @geode-pyrite.req shall have the special power to move one space in any direction, with fissures applying.
- FR-9: @geode-rose-quartz.req shall have the special power to move one space in any direction, with fissures not applying.
- FR-10: @geode-calcite.req shall have the special power to move any number of spaces in a vertical or horizontal direction, with fissures applying.
- FR-11: @geode-amethyst.req shall have the special power to move any number of spaces in a diagonal direction, with fissures applying.
- FR-12: @geode-quartz.req shall have the special power to move any number of spaces in any direction, with fissures applying.
- FR-13: All factions in the game shall include a @geode-pyrite.req piece, which shall be the target piece that needs to be captured to win the game.
- FR-15: Players shall control the geodes in web-based game sessions.
- FR-16: Players shall select and move geodes strategically during their turns.
- FR-17: Movement of geodes shall be validated in real-time.

## Non-Functional Requirements
- NFR-1: Usability - Geode interactions shall be intuitive, with clear visual cues (e.g., glow effects for activation) and accessible controls for users with disabilities (e.g., keyboard navigation).
- NFR-2: Maintainability - Geode capabilities shall be expressed as a configuration allowing players to adjust a geodes abilities and spawn new geodes.
