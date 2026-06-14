# Specification: Data Command Center (UI/UX Refactor)

## 1. Objective
Replace the redundant `SheetConnector` card by merging its functionality into a centralized `DataCommandCenter` (formerly `DevTestPanel`). This provides a single point of entry for all data types (Google Sheets, Import, or Local CSV).

## 2. Visual Hierarchy
1.  **Session Info:** (Name, Year, Semester)
2.  **Data Command Center:** (Connection, Creation, Upload, Stats)
3.  **Validation Grid:** (The 8 status cards - Period, Room, Teacher, etc.)

## 3. Component Details: `DataCommandCenter`

### A. The "Google Sheet" Mode
This mode manages the lifecycle of the remote spreadsheet.
- **Creation Logic:**
    - If `connectedSheetId` is null: Show a placeholder "No Sheet Connected" and a **[Generate Link]** button.
    - Clicking Generate triggers the `drive.files.copy` API.
- **Import Logic:**
    - Replace "Load Examples" with an **[Import Existing]** button.
    - Clicking this toggles the input field to allow pasting a manual Spreadsheet URL.
- **Active Logic:**
    - If `connectedSheetId` is present: Show the URL and an **[Open Sheet ↗]** button.

### B. The "Local Upload" Mode
- **Persistence:** Keep the existing drag-and-drop / file selector logic.
- **Use Case:** Allows users to test data locally without needing a Google Account.

### C. The Summary HUD (At the bottom)
- **Workload Analysis:** Keep the `CurriculumSummary` table.
- **Real-time Sync:** Ensure stats update immediately when a sheet is fetched or a file is dropped.

## 4. Logical Workflow
1.  User lands on `/dashboard/new`.
2.  User sees "Data Command Center" with a **[Generate Link]** button.
3.  User clicks **Generate**.
4.  The new sheet opens in a new tab.
5.  The **Validation Grid** below starts "Fetching" and shows ✅/❌ status.
6.  User fixes errors in the Sheet.
7.  User returns to Dashboard; **Validation Grid** updates to Green.
8.  Submit button unlocks.

## 5. Technical Changes
- **Refactor:** `DevTestPanel.tsx` -> `DataCommandCenter.tsx`.
- **Logic Absorption:** Move `onCreateSkeleton` calls into this component.
- **Deprecation:** Remove `SheetConnector.tsx` from the main `page.tsx` once the transition is complete.
