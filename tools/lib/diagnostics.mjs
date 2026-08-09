export const diagnostic = (severity, file, location, message) => ({ severity, file, location, message });
export const formatDiagnostic = (d) => `${d.file}${d.location || ''}: ${d.severity}: ${d.message}`;
export function printDiagnostics(items) {
  for (const item of items) (item.severity === 'warning' ? console.warn : console.error)(formatDiagnostic(item));
}
