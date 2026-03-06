/**
 * Config module exports
 */
import { appConfig } from './app.config';

export { appConfig, getBrandName, getLogoGradientClasses } from './app.config';
export type { AppConfig } from './app.config';

/** Shorthand for the style tokens */
export const styles = appConfig.styles;
