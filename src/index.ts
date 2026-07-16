export { buildRenderModel, buildPoseRenderModels } from "./buildRenderModel.js";
export { trimRenderModel, trimRenderModels } from "./trim.js";
export {
  getPose,
  getPoseDuration,
  getIterationsDuration,
  poseNames,
  slotNames,
  describeCharacter,
} from "./poses.js";
export { toRuns } from "./render-runs.js";
export { renderToHTMLString, renderToElement, animatePose } from "./dom.js";
export type { RenderOptions, PoseController, SetPoseOptions } from "./dom.js";
export { CSS_VARS, slotColorVar, themeToStyle, applyTheme } from "./theme.js";
export { characters, getCharacter, monster, dino, ghost } from "./characters/index.js";
export type {
  Character,
  Frame,
  Pose,
  Cell,
  RenderModel,
  CellRun,
  ClassNames,
  Theme,
  PoseSummary,
  CharacterSummary,
} from "./types.js";
