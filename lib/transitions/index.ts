// Transition system exports
export { TransitionProvider } from "./provider"
export { gsap, initializeGSAP, killAnimations, createGSAPContext } from "./gsap-config"
export {
  DURATION,
  EASING,
  STAGGER,
  PAGE_TRANSITIONS,
  getTransitionType,
  prefersReducedMotion,
  type TransitionType,
} from "./animation-config"
export { useTransitionRouter, useTransitionState } from "./hooks"
