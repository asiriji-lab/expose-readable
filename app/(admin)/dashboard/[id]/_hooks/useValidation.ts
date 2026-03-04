'use client';

import { useState, useCallback } from 'react';
import {
  TabName,
  TabData,
  TabState,
  AllTabStates,
  ValidationResult,
  SheetData,
} from '../../../validators/types';
import { validatePeriod } from '../../../validators/structural/period';
import { validateRoom } from '../../../validators/structural/room';
import { validateTeacher } from '../../../validators/structural/teacher';
import { validateStudent } from '../../../validators/structural/student';
import { validatePreplace } from '../../../validators/structural/preplace';
import { validateScout } from '../../../validators/structural/scout';
import { validateElective } from '../../../validators/structural/elective';
import { validateCurriculum } from '../../../validators/structural/curriculum';
import { buildLookups } from '../../../validators/referential/lookups';
import { validateStudentRefs } from '../../../validators/referential/studentRefs';
import { validateScoutRefs } from '../../../validators/referential/scoutRefs';
import { validateElectiveRefs } from '../../../validators/referential/electiveRefs';
import { validateCurriculumRefs } from '../../../validators/referential/curriculumRefs';

const PHASE_1_TABS: TabName[] = ['period', 'room', 'teacher', 'student'];
const PHASE_2_TABS: TabName[] = ['preplace', 'scout', 'elective', 'curriculum'];
const ALL_TABS: TabName[] = [...PHASE_1_TABS, ...PHASE_2_TABS];

function initialStates(): AllTabStates {
  return Object.fromEntries(
    ALL_TABS.map((t) => [t, { status: PHASE_2_TABS.includes(t) ? 'locked' : 'pending', result: null }])
  ) as AllTabStates;
}

function deriveStatus(result: ValidationResult): TabState['status'] {
  if (result.errors.length > 0) return 'errors';
  if (result.warnings.length > 0) return 'warnings';
  return 'passed';
}

export function useValidation(sheetData: SheetData) {
  const [tabStates, setTabStates] = useState<AllTabStates>(initialStates);
  const [isRunning, setIsRunning] = useState(false);

  const setTabState = useCallback((name: TabName, state: Partial<TabState>) => {
    setTabStates((prev) => ({ ...prev, [name]: { ...prev[name], ...state } }));
  }, []);

  const runValidation = useCallback(async () => {
    setIsRunning(true);

    // ── Phase 1 ── structural, run all 4 in parallel
    const phase1Validators: Record<'period' | 'room' | 'teacher' | 'student', (d: TabData) => ValidationResult> = {
      period: validatePeriod,
      room: validateRoom,
      teacher: validateTeacher,
      student: validateStudent,
    };

    // Mark all Phase 1 as validating
    for (const tab of PHASE_1_TABS) setTabState(tab, { status: 'validating' });

    type Phase1Tab = 'period' | 'room' | 'teacher' | 'student';
    const phase1Results: ValidationResult[] = await Promise.all(
      PHASE_1_TABS.map(async (tab) => {
        const data = sheetData[tab] ?? [];
        const result = phase1Validators[tab as Phase1Tab](data);
        setTabState(tab, { status: deriveStatus(result), result });
        return result;
      })
    );

    const phase1AllOk = phase1Results.every((r) => r.errors.length === 0);

    if (!phase1AllOk) {
      // Keep Phase 2 locked
      setIsRunning(false);
      return;
    }

    // ── Phase 2 ── referential, needs lookups
    // preplace must be validated first so its slots are available in buildLookups
    for (const tab of PHASE_2_TABS) setTabState(tab, { status: 'validating' });

    const preplaceStructural = validatePreplace(sheetData['preplace'] ?? []);
    const lookups = buildLookups([...phase1Results, preplaceStructural]);

    const scoutStructural = validateScout(sheetData['scout'] ?? []);
    const electiveStructural = validateElective(sheetData['elective'] ?? []);
    const curriculumStructural = validateCurriculum(sheetData['curriculum'] ?? []);

    // Referential checks layered on top
    const studentPhase1 = phase1Results.find((r) => r.tabName === 'student')!;
    const scoutRef = validateScoutRefs(scoutStructural, lookups);
    const electiveRef = validateElectiveRefs(electiveStructural, lookups);
    const curriculumRef = validateCurriculumRefs(curriculumStructural, lookups);
    const studentRef = validateStudentRefs(studentPhase1, lookups);

    // Update student state with Phase 2 errors merged in
    setTabState('student', { status: deriveStatus(studentRef), result: studentRef });

    const phase2Results: [TabName, ValidationResult][] = [
      ['preplace', preplaceStructural],
      ['scout', scoutRef],
      ['elective', electiveRef],
      ['curriculum', curriculumRef],
    ];

    for (const [name, result] of phase2Results) {
      setTabState(name, { status: deriveStatus(result), result });
    }

    setIsRunning(false);
  }, [sheetData, setTabState]);

  const resetStates = useCallback(() => {
    setTabStates(initialStates());
  }, []);

  const allPassed = ALL_TABS.every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings';
  });

  const hasAnyErrors = ALL_TABS.some((t) => tabStates[t].status === 'errors');

  return { tabStates, isRunning, runValidation, resetStates, allPassed, hasAnyErrors };
}
