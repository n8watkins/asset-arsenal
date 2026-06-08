"use client";

import { useReducer, useCallback } from "react";
import type {
  IconExtractionRun,
  PipelineStep,
  PipelineErrorStep,
  SourceImage,
  IconManifest,
  IconPromptPack,
  GeneratedIcon,
  DecomposedIcon,
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
    promptPack: undefined,
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
// Action union
// ---------------------------------------------------------------------------

type Action =
  | { type: "UPLOAD_IMAGE"; source: SourceImage }
  | { type: "START_ANALYSIS" }
  | { type: "SET_MANIFEST"; manifest: IconManifest }
  | { type: "EDIT_ICON"; iconId: string; patch: Partial<DecomposedIcon> }
  | { type: "REMOVE_ICON"; iconId: string }
  | { type: "APPROVE_MANIFEST" }
  | { type: "START_PROMPTS" }
  | { type: "SET_PROMPT_PACK"; pack: IconPromptPack }
  | { type: "EDIT_PROMPT"; iconId: string; text: string }
  | { type: "APPROVE_PROMPTS" }
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
    case "UPLOAD_IMAGE": {
      return touch({
        ...state,
        sourceImage: action.source,
        currentStep: "image_uploaded" as PipelineStep,
      });
    }

    case "START_ANALYSIS": {
      return touch({ ...state, currentStep: "analyzing_icons" });
    }

    case "SET_MANIFEST": {
      return touch({
        ...state,
        manifest: action.manifest,
        currentStep: "manifest_ready",
      });
    }

    case "EDIT_ICON": {
      if (!state.manifest) return state;
      const updatedIcons = state.manifest.icons.map((icon) =>
        icon.id === action.iconId ? { ...icon, ...action.patch } : icon
      );
      return touch({
        ...state,
        manifest: {
          ...state.manifest,
          icons: updatedIcons,
          iconCount: updatedIcons.length,
        },
      });
    }

    case "REMOVE_ICON": {
      if (!state.manifest) return state;
      const remainingIcons = state.manifest.icons.filter(
        (icon) => icon.id !== action.iconId
      );
      return touch({
        ...state,
        manifest: {
          ...state.manifest,
          icons: remainingIcons,
          iconCount: remainingIcons.length,
        },
      });
    }

    case "APPROVE_MANIFEST": {
      // Alias: user reviews manifest and approves — moves to generating_prompts stage
      return touch({ ...state, currentStep: "generating_prompts" });
    }

    case "START_PROMPTS": {
      return touch({ ...state, currentStep: "generating_prompts" });
    }

    case "SET_PROMPT_PACK": {
      return touch({
        ...state,
        promptPack: action.pack,
        currentStep: "prompts_ready",
      });
    }

    case "EDIT_PROMPT": {
      if (!state.promptPack) return state;
      const updatedPrompts = state.promptPack.prompts.map((p) =>
        p.iconId === action.iconId ? { ...p, prompt: action.text } : p
      );
      return touch({
        ...state,
        promptPack: { ...state.promptPack, prompts: updatedPrompts },
      });
    }

    case "APPROVE_PROMPTS": {
      return touch({ ...state, currentStep: "generating_icons" });
    }

    case "START_GENERATION": {
      return touch({ ...state, currentStep: "generating_icons" });
    }

    case "INIT_GENERATED_ICONS": {
      return touch({ ...state, generatedIcons: action.icons });
    }

    case "UPDATE_GENERATED_ICON": {
      const updated = state.generatedIcons.map((gi) =>
        gi.id === action.id ? { ...gi, ...action.patch } : gi
      );
      return touch({ ...state, generatedIcons: updated });
    }

    case "FINISH_GENERATION": {
      return touch({ ...state, currentStep: "icons_ready" });
    }

    case "SET_ERROR": {
      // Preserve all prior successful outputs; push error; mark step = error
      return touch({
        ...state,
        currentStep: "error",
        errors: [
          ...state.errors,
          {
            step: action.step,
            message: action.message,
            createdAt: now(),
          },
        ],
      });
    }

    case "CLEAR_ERROR": {
      // Pop the latest error so the caller can allow retry of failed step
      const remaining = state.errors.slice(0, -1);
      // Determine which step to return to based on what data is present
      let recoveryStep: PipelineStep = "idle";
      if (state.generatedIcons.length > 0) recoveryStep = "generating_icons";
      else if (state.promptPack) recoveryStep = "prompts_ready";
      else if (state.manifest) recoveryStep = "manifest_ready";
      else if (state.sourceImage) recoveryStep = "image_uploaded";
      return touch({
        ...state,
        errors: remaining,
        currentStep: recoveryStep,
      });
    }

    case "RESET": {
      return freshRun();
    }

    default: {
      return state;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseIconPipelineReturn = {
  // State
  run: IconExtractionRun;
  currentStep: PipelineStep;

  // Actions
  uploadImage: (source: SourceImage) => void;
  startAnalysis: () => void;
  setManifest: (manifest: IconManifest) => void;
  editIcon: (iconId: string, patch: Partial<DecomposedIcon>) => void;
  removeIcon: (iconId: string) => void;
  approveManifest: () => void;
  startPrompts: () => void;
  setPromptPack: (pack: IconPromptPack) => void;
  editPrompt: (iconId: string, text: string) => void;
  approvePrompts: () => void;
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

  const uploadImage = useCallback(
    (source: SourceImage) => dispatch({ type: "UPLOAD_IMAGE", source }),
    []
  );

  const startAnalysis = useCallback(
    () => dispatch({ type: "START_ANALYSIS" }),
    []
  );

  const setManifest = useCallback(
    (manifest: IconManifest) => dispatch({ type: "SET_MANIFEST", manifest }),
    []
  );

  const editIcon = useCallback(
    (iconId: string, patch: Partial<DecomposedIcon>) =>
      dispatch({ type: "EDIT_ICON", iconId, patch }),
    []
  );

  const removeIcon = useCallback(
    (iconId: string) => dispatch({ type: "REMOVE_ICON", iconId }),
    []
  );

  const approveManifest = useCallback(
    () => dispatch({ type: "APPROVE_MANIFEST" }),
    []
  );

  const startPrompts = useCallback(
    () => dispatch({ type: "START_PROMPTS" }),
    []
  );

  const setPromptPack = useCallback(
    (pack: IconPromptPack) => dispatch({ type: "SET_PROMPT_PACK", pack }),
    []
  );

  const editPrompt = useCallback(
    (iconId: string, text: string) =>
      dispatch({ type: "EDIT_PROMPT", iconId, text }),
    []
  );

  const approvePrompts = useCallback(
    () => dispatch({ type: "APPROVE_PROMPTS" }),
    []
  );

  const startGeneration = useCallback(
    () => dispatch({ type: "START_GENERATION" }),
    []
  );

  const initGeneratedIcons = useCallback(
    (icons: GeneratedIcon[]) =>
      dispatch({ type: "INIT_GENERATED_ICONS", icons }),
    []
  );

  const updateGeneratedIcon = useCallback(
    (id: string, patch: Partial<GeneratedIcon>) =>
      dispatch({ type: "UPDATE_GENERATED_ICON", id, patch }),
    []
  );

  const finishGeneration = useCallback(
    () => dispatch({ type: "FINISH_GENERATION" }),
    []
  );

  const setError = useCallback(
    (step: PipelineErrorStep, message: string) =>
      dispatch({ type: "SET_ERROR", step, message }),
    []
  );

  const clearError = useCallback(
    () => dispatch({ type: "CLEAR_ERROR" }),
    []
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    run,
    currentStep: run.currentStep,
    uploadImage,
    startAnalysis,
    setManifest,
    editIcon,
    removeIcon,
    approveManifest,
    startPrompts,
    setPromptPack,
    editPrompt,
    approvePrompts,
    startGeneration,
    initGeneratedIcons,
    updateGeneratedIcon,
    finishGeneration,
    setError,
    clearError,
    reset,
  };
}
