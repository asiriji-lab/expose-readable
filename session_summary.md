# ScheDool Project Session Summary - Dec 27, 2025

## Project Overview
We are building **ScheDool**, a premium school scheduling application. This session focused on implementing the multi-step input wizard for school data (Curriculum, Teachers, Electives, etc.).

## 🎨 Design Decisions
- **Brand Color**: Corporate Blue (`#525FE1`).
- **Typography**: Inter (Google Fonts) for a modern, clean look.
- **Aesthetics**: "Glassmorphism" and "Corporate" vibe. Used subtle shadows, rounded corners (`rounded-2xl`), and consistent spacing.
- **UX**: Implemented a vertical Stepper and a Progress Bar to give users clear context of where they are in the 10-step process.

## 🛠️ Components Created/Modified

### 1. `FileDropzone.tsx` (New)
- A reusable drag-and-drop component for CSV/Excel uploads.
- **Features**: Visual feedback on drag-over, click-to-browse fallback, and customizable `title`/`subtitle` props.

### 2. `Stepper.tsx` (New)
- A vertical navigation sidebar showing all 10 steps.
- **Features**: Visual indicators for "Completed" (green check), "Active" (blue), and "Locked" steps.

### 3. `NavigationButtons.tsx` (New)
- Handles "Back", "Next", and "Mark as Done" logic.
- **Features**: Integrated "Mark as Done" toggle to allow users to track their progress manually.

### 4. `Step1` through `Step9`
- **Step 1 (Curriculum)**: 3-column layout for Schedule Name, Year, and Semester + File Upload.
- **Steps 2-9**: Standardized layout with header, example file download link, and the reusable `FileDropzone`.

### 5. `page.tsx` (Main Wizard)
- Orchestrates the entire flow, managing `formData`, `currentStep`, and `completedSteps` state.

## 📈 Current Status
- [x] Step 1: Curriculum Information & Upload
- [x] Step 2: Teacher Data Upload
- [x] Step 3: Elective Data Upload
- [x] Step 4: Scout Data Upload
- [x] Step 5: Period Data Upload
- [x] Step 6: Student Data Upload
- [x] Step 7: Room Data Upload
- [x] Step 8: Constraint Data Upload
- [x] Step 9: Related Files Upload
- [/] Step 10: Generate Schedule (UI implemented, logic pending)

## 🚀 Next Steps
- **Validation**: Re-enable the commented-out validation logic in `page.tsx` once real data requirements are finalized.
- **Backend Integration**: Connect the `FileDropzone` to actual upload endpoints.
- **Step 10 Logic**: Implement the actual schedule generation trigger and results view.

---

# Session Update - Dec 28, 2025: Validation & Guardrails

## 🎯 Objectives Achieved
We focused on ensuring data integrity and improving the user experience during the schedule generation phase.

## 🛡️ Generation Guardrails
- **Completion Check**: Implemented logic in `page.tsx` and `Step10_Generate.tsx` to strictly require Steps 1-8 to be marked as "Done" before generation can proceed. Step 9 is optional.
- **Toast Notification**: Added a **slide-in warning toast** (animated with `slideInRight`) to alert users if they attempt to generate with incomplete steps.
- **Loading UI**: Enhanced the generation screen with a **dynamic progress bar** featuring mock status messages (e.g., "Analyzing constraints...") and a **shimmer animation** for a premium feel.

## ✅ Comprehensive Validation
- **Extended Logic**: Applied the CSV validation logic (previously only in Step 1) to **all input steps** (Teacher, Elective, Scout, Period, Student, Room, Constraint).
- **Regex Rules**: Defined specific regex patterns for each file type in `validationUtils.ts` to ensure data correctness (e.g., validating Teacher IDs, Room Codes).
- **UI Feedback**: Integrated `CsvEditor` with real-time validation feedback (red cells, tooltips) across all steps.

## 📂 File Management
- **Renaming**: Standardized all example CSV files in `public/example_csv/` to `example_XXX.csv` format.

## 📦 Deployment
- **Git Push**: All changes (Validation, Guardrails, UI enhancements) have been successfully committed and pushed to the `frontend` branch.

and yes, i have no idea what i'm doing, or how i do it. but fuck yeah it sorta works.