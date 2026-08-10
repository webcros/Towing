import { themeCss, type RealmAccent } from './css-vars';

/**
 * Server-renderable <style> tag emitting the semantic CSS variables for a
 * realm. Place once in the root layout <head> — everything else (Tailwind
 * utilities, components) reads the variables.
 */
export function ThemeStyles({ accent }: { accent: RealmAccent }) {
  return <style data-towing-theme="" dangerouslySetInnerHTML={{ __html: themeCss(accent) }} />;
}
