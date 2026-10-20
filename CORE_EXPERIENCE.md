# Lazarus UI & Interaction Design Direction

## 1. Core Experience

Lazarus should feel like a modern, polished documentation environment combined with a real, interactive command workspace. Its visual quality should feel considered and calm, with the smooth transitions and restrained details associated with products like Notion, while its execution model takes inspiration from Warp and the connected, sequential feel of Jupyter notebooks.

Lazarus is **not a chatbot, a terminal with a documentation sidebar, or a documentation page with an input field attached to every section**. Documentation remains the primary experience. Command execution is a persistent, contextual capability that the user can invoke anywhere without disrupting the reading experience.

The interface should feel spacious, responsive, and intentional—not like a generic dashboard template or a collection of disconnected components.

## 2. Initial View and Documentation

When a user opens a Lazarus experience, they should immediately see a short, useful introduction to the current topic, followed by the relevant explanation and supporting examples. The initial view should not overwhelm them with a long wall of documentation or an empty terminal.

Documentation should use clear typography, comfortable line lengths, generous but controlled spacing, and a natural reading hierarchy. Code examples, references, interactive pills, dropdowns, and other rich elements should use restrained, neutral styling that fits into the content rather than competing with it.

Normal documentation text must remain visually distinct from executable commands and runtime output. The page should read like excellent documentation first, while making it obvious that certain elements can be interacted with.

The central content area should be scrollable independently of persistent interface elements. Users should be able to move through the documentation and their execution history without losing access to the command interface.

## 3. Persistent Command Composer

The command composer is a central part of Lazarus, but it should never resemble a chatbox.

A single, reusable command composer should remain available near the bottom of the main working area, anchored within the interface rather than awkwardly glued to the bottom edge of the viewport. It should feel like a deliberate developer tool: compact when idle, visually distinct from documentation, and immediately accessible.

The composer should support free-form command editing, a clear run action, keyboard submission, and appropriate execution states. Its design should remain lightweight rather than becoming a full browser-based IDE.

When the user scrolls through documentation, the composer should remain available without covering important content or causing the page layout to jump. On screens where a persistent composer would obstruct reading, it may collapse into a small floating control near the edge of the content area. Activating that control should reveal the composer as an overlay or floating panel without reflowing the documentation.

Opening and closing the composer should preserve the current document, scroll position, command draft, and execution history.

## 4. Command Execution and History

Every submitted command creates an execution block. The block contains the submitted command and its corresponding output, status, and relevant metadata. Together, these form one cohesive, inspectable group, similar to Warp's grouped command-and-output model.

When a command is submitted:

1. The command is added to the execution history as a new block, positioned immediately before the composer in the active execution flow.
2. The block displays a clear running state, with a subtle spinner or progress indicator.
3. Standard output and standard error stream into the block as they arrive.
4. The block transitions to an appropriate final state: completed, failed, cancelled, or timed out.
5. The result remains attached to the command that produced it.

Output should not be limited to plain terminal text. Lazarus should support structured, rich output where appropriate, including formatted text, links, expandable sections, tables, interactive pills, dropdowns, and other explicitly supported components. These elements should be visually consistent, restrained, and genuinely useful.

Command blocks and runtime output must have a distinct visual identity from ordinary documentation content. Users should immediately understand what was written as an explanation, what was submitted for execution, and what came back from the runtime.

### Scrolling behavior

The execution history should behave like a deliberate document or activity stream, not a chat conversation.

When the user is already following the latest activity, a new execution should appear in the active flow and keep the newest output visible as it streams, without fighting the user's scrolling. When the user has scrolled upward to read earlier documentation or inspect previous commands, new executions must not forcibly pull them away from their current position.

In that case, the interface should preserve their reading position and provide a subtle indication that newer activity is available. The user can return to the latest execution explicitly.

The composer should remain accessible in either state. Executing another command must not silently replace previous command blocks or destroy the user's place in the history.

## 5. Navigation, Search, and Context Switching

Lazarus should provide unobtrusive access to documentation topics without permanently sacrificing space in the main reading area.

A collapsible sidebar should list documentation topics and allow users to navigate between them. A keyboard-accessible search palette should allow users to search documentation, jump directly to a topic, and find relevant commands or concepts.

Selecting a topic should update the documentation context in the main content area, returning the user to that topic's intended starting position. It should not unexpectedly erase execution history, discard an unsaved command draft, or reset the runtime.

The distinction between documentation navigation and execution history must remain clear. Opening a new document is not the same as starting a new runtime session. Existing history should remain available according to the session and local-history model, while the new documentation should appear in a clean, readable state.

Where appropriate, documentation references and search results may offer contextual actions, such as inserting a suggested command into the composer or opening the relevant topic. These actions must be explicit: selecting a suggestion must never execute a command silently.

## 6. Local History and User Control

Lazarus should not persist user execution history in a remote application database. Browser-local storage should be the source of truth for the history that Lazarus restores between visits.

Use IndexedDB for structured local history, including command blocks, supported output data, timestamps, and relevant UI restoration information. Apply reasonable storage limits, handle browser storage failures, and provide a migration strategy as the data model evolves.

When the user returns, Lazarus should restore their locally saved history and relevant interface state where possible. If the underlying runtime session is still valid, the interface may reconnect to it. If the session has expired, Lazarus should retain locally available history while clearly indicating that the former environment is no longer live.

Users must be able to clear their locally stored history through an explicit control in the interface. The action should clearly communicate what will be removed and require confirmation before destructive deletion. Clearing local history and terminating an active runtime should be treated as separate actions unless the user explicitly chooses both.

Local history must never be presented as a guarantee that data can be recovered indefinitely: browser storage may be cleared, evicted, or lost.

Importantly, local history does not mean command execution happens entirely on the user's device. When a command is run, it is still transmitted to the relevant Lazarus execution service. The absence of remotely persisted history must not be described as a promise that execution data never leaves the browser.

## 7. Visual Language and Motion

Lazarus should use a restrained, neutral visual system. Surface colors, borders, pills, dropdowns, tooltips, and secondary controls should feel cohesive rather than colorful or ornamental. Color should have meaning: distinguish execution status, emphasize important actions, and improve readability—not decorate every component.

Motion should communicate state and preserve continuity. Composer expansion, sidebar transitions, command submission, output streaming, and disclosure controls should feel smooth and responsive, with short, purposeful transitions. Avoid dramatic animations, excessive bouncing, unnecessary movement, or effects that slow down common interactions. Respect reduced-motion preferences.

The visual hierarchy should remain consistent across documentation, navigation, command blocks, and rich outputs. Components should appear to belong to one product, not to separate applications embedded in a page.

## 8. Guiding Principles

- **Documentation first:** reading and understanding remain the primary activity.
- **Execution everywhere:** commands are available from a persistent, unobtrusive composer, not repeated input fields throughout the documentation.
- **Commands have context:** each execution and its output form a meaningful group that remains inspectable.
- **Scrolling belongs to the user:** new output must not unexpectedly interrupt reading or move the viewport without reason.
- **Navigation preserves continuity:** changing topics does not automatically destroy the user's working context.
- **Local history is user-controlled:** browser storage retains recoverable interaction history without creating a remote history database.
- **Real execution, honestly represented:** loading, failure, cancellation, expiry, and security boundaries must be visible and accurate.
- **Rich output is deliberate:** interactive output uses supported, validated components rather than arbitrary executable content.
- **Polish comes from consistency:** excellent typography, spacing, responsiveness, subtle motion, and predictable behavior matter more than visual effects.

The defining feeling of Lazarus should be that the user is reading real documentation while working alongside it. Commands, outputs, explanations, and history belong to one continuous environment—but the interface should never feel like a conversation with a chatbot.
