"use client";

import { useReducer, useCallback } from "react";
import type {
  IconExtractionRun,
  PipelineStep,
  PipelineErrorStep,
  SourceImage,
  IconManifest,
  CollectionImage,
  IndividualIconPrompts,
  GeneratedIcon,
} from "@/types/icon-pipeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function freshRun(): IconExtractionRun {
  return {
    id: crypto.randomUUID(),
    // sourceImage is required on the type but starts as "not yet set"; we cast
    // an empty sentinel here and overwrite it on the first real upload action.
    sourceImage: undefined as unknown as SourceImage,
    manifest: undefined,
    collectionPrompt: undefined,
    collectionImage: undefined,
    individualPrompts: undefined,
    generatedIcons: [],
    currentStep: "idle",
    errors: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

function touch(run: IconExtractionRun): IconExtractionRun {
  return { ...run, updatedAt: now() };
}

// ---------------------------------------------------------------------------
// Action union — one "start" + one "set" per pipeline step
// ---------------------------------------------------------------------------

type Action =
  | { type: "UPLOAD_IMAGE"; source: SourceImage }
  | { type: "START_ANALYSIS" }
  | { type: "SET_MANIFEST"; manifest: IconManifest }
  | { type: "START_COLLECTION_PROMPT" }
  | { type: "SET_COLLECTION_PROMPT"; collectionPrompt: string }
  | { type: "START_COLLECTION_IMAGE" }
  | { type: "SET_COLLECTION_IMAGE"; collectionImage: CollectionImage }
  | { type: "START_INDIVIDUAL_PROMPTS" }
  | { type: "SET_INDIVIDUAL_PROMPTS"; individualPrompts: IndividualIconPrompts }
  | { type: "START_GENERATION" }
  | { type: "INIT_GENERATED_ICONS"; icons: GeneratedIcon[] }
  | { type: "UPDATE_GENERATED_ICON"; id: string; patch: Partial<GeneratedIcon> }
  | { type: "FINISH_GENERATION" }
  | { type: "SET_ERROR"; step: PipelineErrorStep; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: IconExtractionRun, action: Action): IconExtractionRun {
  switch (action.type) {
    case "UPLOAD_IMAGE":
      return touch({
        ...state,
        sourceImage: action.source,
        currentStep: "image_uploaded",
      });

    case "START_ANALYSIS":
      return touch({ ...state, currentStep: "analyzing" });

    case "SET_MANIFEST":
      return touch({
        ...state,
        manifest: action.manifest,
        currentStep: "manifest_ready",
      });

    case "START_COLLECTION_PROMPT":
      return touch({ ...state, currentStep: "composing_collection_prompt" });

    case "SET_COLLECTION_PROMPT":
      return touch({
        ...state,
        collectionPrompt: action.collectionPrompt,
        currentStep: "collection_prompt_ready",
      });

    case "START_COLLECTION_IMAGE":
      return touch({ ...state, currentStep: "generating_collection_image" });

    case "SET_COLLECTION_IMAGE":
      return touch({
        ...state,
        collectionImage: action.collectionImage,
        currentStep: "collection_image_ready",
      });

    case "START_INDIVIDUAL_PROMPTS":
      return touch({ ...state, currentStep: "composing_individual_prompts" });

    case "SET_INDIVIDUAL_PROMPTS":
      return touch({
        ...state,
        individualPrompts: action.individualPrompts,
        currentStep: "individual_prompts_ready",
      });

    case "START_GENERATION":
      return touch({ ...state, currentStep: "generating_icons" });

    case "INIT_GENERATED_ICONS":
      return touch({ ...state, generatedIcons: action.icons });

    case "UPDATE_GENERATED_ICON":
      return touch({
        ...state,
        generatedIcons: state.generatedIcons.map((gi) =>
          gi.id === action.id ? { ...gi, ...action.patch } : gi,
        ),
      });

    case "FINISH_GENERATION":
      return touch({ ...state, currentStep: "icons_ready" });

    case "SET_ERROR":
      return touch({
        ...state,
        currentStep: "error",
        errors: [
          ...state.errors,
          { step: action.step, message: action.message, createdAt: now() },
        ],
      });

    case "CLEAR_ERROR": {
      // Pop the latest error and return to the furthest-along ready step.
      const remaining = state.errors.slice(0, -1);
      let recoveryStep: PipelineStep = "idle";
      if (state.generatedIcons.length > 0) recoveryStep = "generating_icons";
      else if (state.individualPrompts) recoveryStep = "individual_prompts_ready";
      else if (state.collectionImage) recoveryStep = "collection_image_ready";
      else if (state.collectionPrompt) recoveryStep = "collection_prompt_ready";
      else if (state.manifest) recoveryStep = "manifest_ready";
      else if (state.sourceImage) recoveryStep = "image_uploaded";
      return touch({ ...state, errors: remaining, currentStep: recoveryStep });
    }

    case "RESET":
      return freshRun();

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseIconPipelineReturn = {
  run: IconExtractionRun;
  currentStep: PipelineStep;

  uploadImage: (source: SourceImage) => void;
  startAnalysis: () => void;
  setManifest: (manifest: IconManifest) => void;
  startCollectionPrompt: () => void;
  setCollectionPrompt: (collectionPrompt: string) => void;
  startCollectionImage: () => void;
  setCollectionImage: (collectionImage: CollectionImage) => void;
  startIndividualPrompts: () => void;
  setIndividualPrompts: (individualPrompts: IndividualIconPrompts) => void;
  startGeneration: () => void;
  initGeneratedIcons: (icons: GeneratedIcon[]) => void;
  updateGeneratedIcon: (id: string, patch: Partial<GeneratedIcon>) => void;
  finishGeneration: () => void;
  setError: (step: PipelineErrorStep, message: string) => void;
  clearError: () => void;
  reset: () => void;
};

export function useIconPipeline(): UseIconPipelineReturn {
  const [run, dispatch] = useReducer(reducer, undefined, freshRun);

  return {
    run,
    currentStep: run.currentStep,
    uploadImage: useCallback(
      (source: SourceImage) => dispatch({ type: "UPLOAD_IMAGE", source }),
      [],
    ),
    startAnalysis: useCallback(() => dispatch({ type: "START_ANALYSIS" }), []),
    setManifest: useCallback(
      (manifest: IconManifest) => dispatch({ type: "SET_MANIFEST", manifest }),
      [],
    ),
    startCollectionPrompt: useCallback(
      () => dispatch({ type: "START_COLLECTION_PROMPT" }),
      [],
    ),
    setCollectionPrompt: useCallback(
      (collectionPrompt: string) =>
        dispatch({ type: "SET_COLLECTION_PROMPT", collectionPrompt }),
      [],
    ),
    startCollectionImage: useCallback(
      () => dispatch({ type: "START_COLLECTION_IMAGE" }),
      [],
    ),
    setCollectionImage: useCallback(
      (collectionImage: CollectionImage) =>
        dispatch({ type: "SET_COLLECTION_IMAGE", collectionImage }),
      [],
    ),
    startIndividualPrompts: useCallback(
      () => dispatch({ type: "START_INDIVIDUAL_PROMPTS" }),
      [],
    ),
    setIndividualPrompts: useCallback(
      (individualPrompts: IndividualIconPrompts) =>
        dispatch({ type: "SET_INDIVIDUAL_PROMPTS", individualPrompts }),
      [],
    ),
    startGeneration: useCallback(
      () => dispatch({ type: "START_GENERATION" }),
      [],
    ),
    initGeneratedIcons: useCallback(
      (icons: GeneratedIcon[]) =>
        dispatch({ type: "INIT_GENERATED_ICONS", icons }),
      [],
    ),
    updateGeneratedIcon: useCallback(
      (id: string, patch: Partial<GeneratedIcon>) =>
        dispatch({ type: "UPDATE_GENERATED_ICON", id, patch }),
      [],
    ),
    finishGeneration: useCallback(
      () => dispatch({ type: "FINISH_GENERATION" }),
      [],
    ),
    setError: useCallback(
      (step: PipelineErrorStep, message: string) =>
        dispatch({ type: "SET_ERROR", step, message }),
      [],
    ),
    clearError: useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []),
    reset: useCallback(() => dispatch({ type: "RESET" }), []),
  };
}
